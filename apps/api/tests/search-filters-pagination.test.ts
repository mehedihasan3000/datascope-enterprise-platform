import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import {
  getSearchCacheStats,
  invalidateDatasetSearchCache,
} from '../src/modules/search/search.service.js';
import { decodeCursor, encodeCursor } from '../src/utils/query-builder.js';
import { TtlCache } from '../src/utils/ttl-cache.js';

function extractCookieHeader(setCookieHeaders: string[] | string | undefined): string {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('Search Logic, Combined Filters, Sorting, Pagination & Cache Unit/API Tests', () => {
  let adminCookies = '';
  let ds1Id = '';

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@datascope.io', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    adminCookies = extractCookieHeader(loginRes.headers['set-cookie']);

    const datasetsRes = await request(app)
      .get('/api/v1/datasets')
      .set('Cookie', adminCookies);
    expect(datasetsRes.status).toBe(200);
    const ds1 = (datasetsRes.body.data as Array<{ id: string; slug: string }>).find(
      (d) => d.slug === 'global-enterprise-intelligence'
    );
    expect(ds1).toBeDefined();
    ds1Id = ds1!.id;
  });

  describe('Unit Tests: TtlCache & Keyset Cursor Codec', () => {
    it('tracks hits/misses, evicts LRU entries at capacity, expires TTL, and deletes by prefix', async () => {
      const cache = new TtlCache<string>({ maxEntries: 2, ttlMs: 500 });

      expect(cache.get('missing')).toBeUndefined();
      cache.set('ds1:a', 'val-a');
      cache.set('ds1:b', 'val-b');
      // Refresh 'ds1:a' so 'ds1:b' becomes LRU
      expect(cache.get('ds1:a')).toBe('val-a');
      cache.set('ds2:c', 'val-c');

      expect(cache.get('ds1:b')).toBeUndefined();
      expect(cache.get('ds1:a')).toBe('val-a');
      expect(cache.deleteByPrefix('ds1:')).toBe(1);
      expect(cache.get('ds1:a')).toBeUndefined();

      cache.set('ephemeral', 'temp', 25);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(cache.get('ephemeral')).toBeUndefined();

      const stats = cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(4);
      expect(stats.hitRate).toBe(0.3333);
    });

    it('round-trips keyset pagination cursors and rejects malformed cursors with 400 INVALID_CURSOR', () => {
      const encoded = encodeCursor({
        createdAt: '2026-10-01T12:00:00.000Z',
        id: '11111111-1111-4111-8111-111111111111',
      });
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual({
        createdAt: '2026-10-01T12:00:00.000Z',
        id: '11111111-1111-4111-8111-111111111111',
      });

      expect(() => decodeCursor('not-valid-base64-json!!')).toThrowError(/invalid/i);
    });
  });

  describe('Search Modes (FTS, Partial Trigram, Exact Match)', () => {
    it('executes Full-Text Search (fts) cleanly across the 100k dataset', async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          searchQuery: 'Quantum',
          searchMode: 'fts',
          page: 1,
          pageSize: 20,
          recordHistoryLog: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta.totalRecords).toBeGreaterThan(0);
      for (const row of res.body.data as Array<{ title: string; recordCode: string }>) {
        expect(row.title.toLowerCase()).toContain('quantum');
      }
    });

    it('executes Partial Trigram Search (partial) for sub-word matching', async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          searchQuery: 'Synthet',
          searchMode: 'partial',
          page: 1,
          pageSize: 20,
          recordHistoryLog: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const row of res.body.data as Array<{ title: string }>) {
        expect(row.title.toLowerCase()).toContain('synthet');
      }
    });

    it('executes Exact Match Search (exact) by recordCode', async () => {
      const sampleRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({ page: 1, pageSize: 10, recordHistoryLog: false });
      expect(sampleRes.status).toBe(200);
      const targetCode = sampleRes.body.data[0].recordCode as string;

      const exactRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          searchQuery: targetCode,
          searchMode: 'exact',
          page: 1,
          pageSize: 10,
          recordHistoryLog: false,
        });

      expect(exactRes.status).toBe(200);
      expect(exactRes.body.meta.totalRecords).toBe(1);
      expect(exactRes.body.data[0].recordCode).toBe(targetCode);
    });
  });

  describe('Combined Filters (AND/OR, Numeric, Date Range, JSONB) & Multi-Column Sorting', () => {
    it('evaluates Section 3.C 4-condition AND filter accurately against 100k records', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          logicOperator: 'AND',
          filters: [
            { field: 'status', operator: 'eq', value: 'Active' },
            { field: 'country', operator: 'eq', value: 'Germany' },
            { field: 'revenue', operator: 'gt', value: 10000 },
            {
              field: 'createdAt',
              operator: 'between',
              value: [thirtyDaysAgo.toISOString(), now.toISOString()],
            },
          ],
          page: 1,
          pageSize: 25,
          recordHistoryLog: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.meta.totalRecords).toBeGreaterThan(0);
      for (const row of res.body.data as Array<{
        status: string;
        country: string;
        revenue: number;
        createdAt: string;
      }>) {
        expect(row.status).toBe('Active');
        expect(row.country).toBe('Germany');
        expect(row.revenue).toBeGreaterThan(10000);
        const createdTs = Date.parse(row.createdAt);
        expect(createdTs).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime());
        expect(createdTs).toBeLessThanOrEqual(now.getTime());
      }
    });

    it('supports dynamic JSONB attribute filters and IN / OR operators', async () => {
      const jsonbRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          logicOperator: 'AND',
          filters: [
            { field: 'region', operator: 'eq', value: 'EMEA' },
            { field: 'verified', operator: 'eq', value: true },
            { field: 'category', operator: 'in', value: ['FinTech', 'Cybersecurity'] },
          ],
          page: 1,
          pageSize: 20,
          recordHistoryLog: false,
        });

      expect(jsonbRes.status).toBe(200);
      expect(jsonbRes.body.data.length).toBeGreaterThan(0);
      for (const row of jsonbRes.body.data as Array<{
        category: string;
        attributes: Record<string, unknown>;
      }>) {
        expect(['FinTech', 'Cybersecurity']).toContain(row.category);
        expect(row.attributes.region).toBe('EMEA');
        expect(row.attributes.verified).toBe(true);
      }

      const orRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          logicOperator: 'OR',
          filters: [
            { field: 'country', operator: 'eq', value: 'Germany' },
            { field: 'country', operator: 'eq', value: 'Japan' },
          ],
          page: 1,
          pageSize: 20,
          recordHistoryLog: false,
        });

      expect(orRes.status).toBe(200);
      expect(orRes.body.data.length).toBeGreaterThan(0);
      for (const row of orRes.body.data as Array<{ country: string }>) {
        expect(['Germany', 'Japan']).toContain(row.country);
      }
    });

    it('applies deterministic multi-column sorting (category ASC, revenue DESC)', async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          sorting: [
            { field: 'category', direction: 'asc' },
            { field: 'revenue', direction: 'desc' },
          ],
          page: 1,
          pageSize: 50,
          recordHistoryLog: false,
        });

      expect(res.status).toBe(200);
      const rows = res.body.data as Array<{ category: string; revenue: number }>;
      expect(rows.length).toBe(50);

      for (let i = 1; i < rows.length; i += 1) {
        const prev = rows[i - 1]!;
        const curr = rows[i]!;
        const cmp = prev.category.localeCompare(curr.category);
        expect(cmp).toBeLessThanOrEqual(0);
        if (prev.category === curr.category) {
          expect(prev.revenue).toBeGreaterThanOrEqual(curr.revenue);
        }
      }
    });
  });

  describe('Pagination (Offset & Keyset Cursor), Caching, Record Detail & Validation Errors', () => {
    it('supports disjoint offset pagination across page boundaries', async () => {
      const page1 = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          paginationMode: 'offset',
          page: 1,
          pageSize: 20,
          sorting: [{ field: 'createdAt', direction: 'desc' }],
          recordHistoryLog: false,
        });

      const page2 = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          paginationMode: 'offset',
          page: 2,
          pageSize: 20,
          sorting: [{ field: 'createdAt', direction: 'desc' }],
          recordHistoryLog: false,
        });

      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);
      expect(page1.body.meta.totalRecords).toBe(100000);
      expect(page1.body.meta.totalPages).toBe(5000);
      expect(page1.body.meta.hasPreviousPage).toBe(false);
      expect(page1.body.meta.hasNextPage).toBe(true);
      expect(page2.body.meta.hasPreviousPage).toBe(true);

      const ids1 = new Set((page1.body.data as Array<{ id: string }>).map((r) => r.id));
      for (const row of page2.body.data as Array<{ id: string }>) {
        expect(ids1.has(row.id)).toBe(false);
      }
    });

    it('supports keyset cursor pagination with nextCursor and zero row overlap', async () => {
      const batch1 = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          paginationMode: 'cursor',
          pageSize: 20,
          recordHistoryLog: false,
        });

      expect(batch1.status).toBe(200);
      expect(batch1.body.data.length).toBe(20);
      expect(typeof batch1.body.meta.nextCursor).toBe('string');

      const batch2 = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          paginationMode: 'cursor',
          cursor: batch1.body.meta.nextCursor,
          pageSize: 20,
          recordHistoryLog: false,
        });

      expect(batch2.status).toBe(200);
      expect(batch2.body.data.length).toBe(20);
      expect(batch2.body.meta.hasPreviousPage).toBe(true);

      const ids1 = new Set((batch1.body.data as Array<{ id: string }>).map((r) => r.id));
      for (const row of batch2.body.data as Array<{ id: string }>) {
        expect(ids1.has(row.id)).toBe(false);
      }
    });

    it('hits server TTL cache on identical repeat queries and clears entries on invalidation', async () => {
      invalidateDatasetSearchCache(ds1Id);
      const uniqueQuery = `Quantum`;
      const payload = {
        searchQuery: uniqueQuery,
        searchMode: 'fts',
        filters: [{ field: 'country', operator: 'eq', value: 'Switzerland' }],
        page: 1,
        pageSize: 15,
        recordHistoryLog: false,
      };

      const first = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send(payload);
      expect(first.status).toBe(200);
      expect(first.body.meta.cacheHit).toBe(false);

      const hitsBefore = getSearchCacheStats().hits;
      const second = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send(payload);
      expect(second.status).toBe(200);
      expect(second.body.meta.cacheHit).toBe(true);
      expect(getSearchCacheStats().hits).toBe(hitsBefore + 1);

      invalidateDatasetSearchCache(ds1Id);
      const third = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send(payload);
      expect(third.status).toBe(200);
      expect(third.body.meta.cacheHit).toBe(false);
    });

    it('returns full record details including relationships and history trails', async () => {
      const listRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          sorting: [{ field: 'createdAt', direction: 'desc' }],
          page: 1,
          pageSize: 10,
          recordHistoryLog: false,
        });
      expect(listRes.status).toBe(200);
      const recordId = listRes.body.data[0].id as string;

      const detailRes = await request(app)
        .get(`/api/v1/datasets/${ds1Id}/records/${recordId}`)
        .set('Cookie', adminCookies);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.id).toBe(recordId);
      expect(Array.isArray(detailRes.body.data.relationships)).toBe(true);
      expect(Array.isArray(detailRes.body.data.history)).toBe(true);
    });

    it('returns structured 400 validation & cursor errors for malformed payloads', async () => {
      const badUuidRes = await request(app)
        .post('/api/v1/datasets/not-a-uuid/records/search')
        .set('Cookie', adminCookies)
        .send({ page: 1 });
      expect(badUuidRes.status).toBe(400);
      expect(badUuidRes.body.success).toBe(false);
      expect(badUuidRes.body.error.code).toBe('VALIDATION_ERROR');

      const badOpRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          filters: [{ field: 'status', operator: 'invalid_op', value: 'Active' }],
        });
      expect(badOpRes.status).toBe(400);
      expect(badOpRes.body.success).toBe(false);
      expect(badOpRes.body.error.code).toBe('VALIDATION_ERROR');

      const badCursorRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', adminCookies)
        .send({
          paginationMode: 'cursor',
          cursor: 'tampered-cursor',
          recordHistoryLog: false,
        });
      expect(badCursorRes.status).toBe(400);
      expect(badCursorRes.body.success).toBe(false);
      expect(badCursorRes.body.error.code).toBe('INVALID_CURSOR');
    });
  });
});
