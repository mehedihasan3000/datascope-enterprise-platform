import type { AnalyticsOverviewDTO } from '@datascope/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

function extractCookieHeader(setCookieHeaders: string[] | string | undefined): string {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function loginCookies(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'Password123!' });
  expect(res.status).toBe(200);
  return extractCookieHeader(res.headers['set-cookie']);
}

describe('Saved Views CRUD/Sharing, Search History & SQL Analytics API Tests', () => {
  let adminCookies = '';
  let analystCookies = '';
  let viewerCookies = '';
  let ds1Id = '';

  beforeAll(async () => {
    [adminCookies, analystCookies, viewerCookies] = await Promise.all([
      loginCookies('admin@datascope.io'),
      loginCookies('analyst@datascope.io'),
      loginCookies('viewer@datascope.io'),
    ]);

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

  describe('Saved Views Lifecycle & Role-Based Team Sharing', () => {
    it('supports create -> private isolation -> team role sharing -> edit protection -> delete', async () => {
      let createdViewId = '';

      try {
        const createRes = await request(app)
          .post('/api/v1/saved-views')
          .set('Cookie', analystCookies)
          .send({
            name: 'Vitest Germany High-Revenue View',
            description: 'Automated integration test saved view',
            datasetId: ds1Id,
            searchQuery: 'Quantum',
            searchMode: 'fts',
            filters: [{ field: 'country', operator: 'eq', value: 'Germany' }],
            sorting: [{ field: 'revenue', direction: 'desc' }],
            visibleColumns: ['recordCode', 'title', 'country', 'revenue'],
            isShared: false,
            sharedWithRoles: [],
          });

        expect(createRes.status).toBe(201);
        expect(createRes.body.success).toBe(true);
        createdViewId = createRes.body.data.id;
        expect(createRes.body.data.isShared).toBe(false);

        // Private view accessible by creator & admin, forbidden to VIEWER
        const ownerGet = await request(app)
          .get(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', analystCookies);
        expect(ownerGet.status).toBe(200);

        const adminGet = await request(app)
          .get(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', adminCookies);
        expect(adminGet.status).toBe(200);

        const viewerDenied = await request(app)
          .get(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', viewerCookies);
        expect(viewerDenied.status).toBe(403);
        expect(viewerDenied.body.error.code).toBe('SAVED_VIEW_ACCESS_DENIED');

        // Share explicitly with VIEWER role
        const shareRes = await request(app)
          .patch(`/api/v1/saved-views/${createdViewId}/share`)
          .set('Cookie', analystCookies)
          .send({
            isShared: true,
            sharedWithRoles: ['VIEWER'],
          });
        expect(shareRes.status).toBe(200);
        expect(shareRes.body.data.isShared).toBe(true);
        expect(shareRes.body.data.sharedWithRoles).toEqual(['VIEWER']);

        // VIEWER can read shared view in detail & list endpoints, but cannot modify or delete
        const viewerAllowed = await request(app)
          .get(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', viewerCookies);
        expect(viewerAllowed.status).toBe(200);
        expect(viewerAllowed.body.data.id).toBe(createdViewId);

        const viewerList = await request(app)
          .get('/api/v1/saved-views')
          .set('Cookie', viewerCookies);
        expect(viewerList.status).toBe(200);
        expect(
          (viewerList.body.data as Array<{ id: string }>).some((v) => v.id === createdViewId)
        ).toBe(true);

        const viewerPatchDenied = await request(app)
          .patch(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', viewerCookies)
          .send({ name: 'Hijacked View Name' });
        expect(viewerPatchDenied.status).toBe(403);
        expect(viewerPatchDenied.body.error.code).toBe('FORBIDDEN_ROLE');

        const viewerDeleteDenied = await request(app)
          .delete(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', viewerCookies);
        expect(viewerDeleteDenied.status).toBe(403);
        expect(viewerDeleteDenied.body.error.code).toBe('FORBIDDEN_ROLE');

        // Owner updates the view
        const updateRes = await request(app)
          .patch(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', analystCookies)
          .send({ name: 'Vitest Germany High-Revenue View (Updated)' });
        expect(updateRes.status).toBe(200);
        expect(updateRes.body.data.name).toBe('Vitest Germany High-Revenue View (Updated)');

        // Owner deletes the view
        const deleteRes = await request(app)
          .delete(`/api/v1/saved-views/${createdViewId}`)
          .set('Cookie', analystCookies);
        expect(deleteRes.status).toBe(200);
        createdViewId = '';
      } finally {
        if (createdViewId) {
          await request(app)
            .delete(`/api/v1/saved-views/${createdViewId}`)
            .set('Cookie', adminCookies);
        }
      }
    });
  });

  describe('Search History Audit Logging', () => {
    it('persists executed search queries in search_history with timing & counts', async () => {
      const markerQuery = 'Vanguard';
      const searchRes = await request(app)
        .post(`/api/v1/datasets/${ds1Id}/records/search`)
        .set('Cookie', analystCookies)
        .send({
          searchQuery: markerQuery,
          searchMode: 'fts',
          page: 1,
          pageSize: 10,
          recordHistoryLog: true,
        });
      expect(searchRes.status).toBe(200);

      // Give async non-blocking history insert a brief moment to commit
      await new Promise((resolve) => setTimeout(resolve, 250));

      const historyRes = await request(app)
        .get(`/api/v1/search-history?datasetId=${ds1Id}&limit=10`)
        .set('Cookie', analystCookies);
      expect(historyRes.status).toBe(200);
      const entries = historyRes.body.data as Array<{
        searchQuery: string;
        resultCount: number;
        executionTimeMs: number;
      }>;
      const found = entries.find((e) => e.searchQuery === markerQuery);
      expect(found).toBeDefined();
      expect(found!.resultCount).toBe(searchRes.body.meta.totalRecords);
      expect(typeof found!.executionTimeMs).toBe('number');
    });
  });

  describe('PostgreSQL SQL Aggregation Analytics (/analytics/overview)', () => {
    it('enforces RBAC dataset scoping on analytics summary totals across ADMIN vs VIEWER', async () => {
      const [adminAnalyticsRes, viewerAnalyticsRes, viewerViewsRes, viewerHistoryRes] =
        await Promise.all([
          request(app).get('/api/v1/analytics/overview').set('Cookie', adminCookies),
          request(app).get('/api/v1/analytics/overview').set('Cookie', viewerCookies),
          request(app).get('/api/v1/saved-views').set('Cookie', viewerCookies),
          request(app).get('/api/v1/search-history?limit=200').set('Cookie', viewerCookies),
        ]);

      expect(adminAnalyticsRes.status).toBe(200);
      expect(viewerAnalyticsRes.status).toBe(200);
      expect(viewerViewsRes.status).toBe(200);
      expect(viewerHistoryRes.status).toBe(200);

      const adminData = adminAnalyticsRes.body.data as AnalyticsOverviewDTO;
      const viewerData = viewerAnalyticsRes.body.data as AnalyticsOverviewDTO;
      const viewerAccessibleViews = viewerViewsRes.body.data as Array<{ id: string }>;
      const viewerHistory = viewerHistoryRes.body.data as Array<{ id: string }>;

      expect(adminData.summary.totalDatasets).toBeGreaterThanOrEqual(3);
      expect(adminData.summary.totalRecords).toBeGreaterThanOrEqual(104000);

      // VIEWER cannot see restricted 1,500-record dataset
      expect(viewerData.summary.totalDatasets).toBe(adminData.summary.totalDatasets - 1);
      expect(viewerData.summary.totalRecords).toBe(adminData.summary.totalRecords - 1500);

      // VIEWER saved view & search history counts must be scoped to VIEWER's accessible records
      expect(viewerData.summary.totalSavedViews).toBe(viewerAccessibleViews.length);
      expect(viewerData.summary.totalSearchesExecuted).toBe(viewerHistory.length);

      // VIEWER must not receive detailed /analytics breakdown series
      expect(viewerData.recordsByCategory).toEqual([]);
      expect(viewerData.recordsByStatus).toEqual([]);
      expect(viewerData.recordsByCountry).toEqual([]);
      expect(viewerData.dataGrowthTrends).toEqual([]);
      expect(viewerData.searchActivity).toEqual([]);
      expect(viewerData.mostFrequentFilters).toEqual([]);
    });

    it('returns complete Recharts SQL aggregation distributions matching the 100k dataset total', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/overview?datasetId=${ds1Id}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      const overview = res.body.data as AnalyticsOverviewDTO;

      expect(overview.datasetId).toBe(ds1Id);
      expect(overview.summary.totalRecords).toBe(100000);
      expect(overview.recordsByCategory.length).toBeGreaterThan(0);
      expect(overview.recordsByStatus.length).toBeGreaterThan(0);
      expect(overview.recordsByCountry.length).toBeGreaterThan(0);
      expect(overview.dataGrowthTrends.length).toBeGreaterThan(0);

      const categorySum = overview.recordsByCategory.reduce((acc, item) => acc + item.count, 0);
      const statusSum = overview.recordsByStatus.reduce((acc, item) => acc + item.count, 0);
      expect(categorySum).toBe(100000);
      expect(statusSum).toBe(100000);
    });
  });
});
