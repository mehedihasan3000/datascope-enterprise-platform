import { ROLES } from '@datascope/shared';
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

async function loginAs(email: string, password = 'Password123!') {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const cookies = extractCookieHeader(res.headers['set-cookie']);
  expect(cookies).toContain('ds_access_token=');
  expect(cookies).toContain('ds_refresh_token=');
  return {
    user: res.body.data.user as { id: string; email: string; role: string; roleId: string },
    accessToken: res.body.data.accessToken as string,
    cookies,
  };
}

describe('Authentication, Dataset Access Permissions & RBAC API Tests', () => {
  let adminSession: Awaited<ReturnType<typeof loginAs>>;
  let analystSession: Awaited<ReturnType<typeof loginAs>>;
  let viewerSession: Awaited<ReturnType<typeof loginAs>>;
  let ds1Id = '';
  let restrictedDsId = '';
  let restrictedRecordId = '';

  beforeAll(async () => {
    adminSession = await loginAs('admin@datascope.io');
    analystSession = await loginAs('analyst@datascope.io');
    viewerSession = await loginAs('viewer@datascope.io');

    const datasetsRes = await request(app)
      .get('/api/v1/datasets')
      .set('Cookie', adminSession.cookies);
    expect(datasetsRes.status).toBe(200);

    const list = datasetsRes.body.data as Array<{ id: string; slug: string; totalRecords: number }>;
    const ds1 = list.find((d) => d.slug === 'global-enterprise-intelligence');
    const ds3 = list.find((d) => d.slug === 'restricted-ma-target-pipeline');

    expect(ds1).toBeDefined();
    expect(ds3).toBeDefined();
    ds1Id = ds1!.id;
    restrictedDsId = ds3!.id;

    // Fetch a real record ID inside the restricted dataset using admin credentials
    const restrictedRecordsRes = await request(app)
      .post(`/api/v1/datasets/${restrictedDsId}/records/search`)
      .set('Cookie', adminSession.cookies)
      .send({ page: 1, pageSize: 10, recordHistoryLog: false });
    expect(restrictedRecordsRes.status).toBe(200);
    restrictedRecordId = restrictedRecordsRes.body.data[0].id;
    expect(restrictedRecordId).toBeTruthy();
  });

  describe('Authentication & Session Flows', () => {
    it('rejects unauthenticated requests to /auth/me with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid credentials on /auth/login with 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@datascope.io', password: 'WrongPassword999!' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('validates malformed login payloads with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '123' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rotates session access token cleanly via /auth/refresh cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', analystSession.cookies);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(ROLES.ANALYST);
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(extractCookieHeader(res.headers['set-cookie'])).toContain('ds_access_token=');
    });
  });

  describe('Dataset Access Permissions & Parameter Manipulation Protection', () => {
    it('scopes GET /datasets strictly to datasets authorized for the authenticated user', async () => {
      const adminRes = await request(app)
        .get('/api/v1/datasets')
        .set('Cookie', adminSession.cookies);
      expect(adminRes.status).toBe(200);
      const adminSlugs = (adminRes.body.data as Array<{ slug: string }>).map((d) => d.slug);
      expect(adminSlugs).toContain('global-enterprise-intelligence');
      expect(adminSlugs).toContain('restricted-ma-target-pipeline');

      const viewerRes = await request(app)
        .get('/api/v1/datasets')
        .set('Cookie', viewerSession.cookies);
      expect(viewerRes.status).toBe(200);
      const viewerSlugs = (viewerRes.body.data as Array<{ slug: string }>).map((d) => d.slug);
      expect(viewerSlugs).toContain('global-enterprise-intelligence');
      expect(viewerSlugs).not.toContain('restricted-ma-target-pipeline');
    });

    it('blocks unauthorized datasetId URL & body parameter manipulation for VIEWER across all endpoints', async () => {
      // 1. Direct dataset detail fetch
      const detailRes = await request(app)
        .get(`/api/v1/datasets/${restrictedDsId}`)
        .set('Cookie', viewerSession.cookies);
      expect(detailRes.status).toBe(403);
      expect(detailRes.body.error.code).toBe('DATASET_ACCESS_DENIED');

      // 2. Direct dataset record search
      const searchRes = await request(app)
        .post(`/api/v1/datasets/${restrictedDsId}/records/search`)
        .set('Cookie', viewerSession.cookies)
        .send({ page: 1, pageSize: 10 });
      expect(searchRes.status).toBe(403);
      expect(searchRes.body.error.code).toBe('DATASET_ACCESS_DENIED');

      // 3. Direct dataset-scoped record detail fetch
      const dsRecordRes = await request(app)
        .get(`/api/v1/datasets/${restrictedDsId}/records/${restrictedRecordId}`)
        .set('Cookie', viewerSession.cookies);
      expect(dsRecordRes.status).toBe(403);
      expect(dsRecordRes.body.error.code).toBe('DATASET_ACCESS_DENIED');

      // 4. Standalone record detail endpoint (/api/v1/records/:recordId) still enforces parent dataset RBAC
      const directRecordRes = await request(app)
        .get(`/api/v1/records/${restrictedRecordId}`)
        .set('Cookie', viewerSession.cookies);
      expect(directRecordRes.status).toBe(403);
      expect(directRecordRes.body.error.code).toBe('DATASET_ACCESS_DENIED');

      // 5. Saved views filtered by restricted datasetId
      const savedViewsQueryRes = await request(app)
        .get(`/api/v1/saved-views?datasetId=${restrictedDsId}`)
        .set('Cookie', viewerSession.cookies);
      expect(savedViewsQueryRes.status).toBe(403);
      expect(savedViewsQueryRes.body.error.code).toBe('DATASET_ACCESS_DENIED');

      // 6. Creating a saved view as VIEWER is blocked by role guard
      const createViewRes = await request(app)
        .post('/api/v1/saved-views')
        .set('Cookie', viewerSession.cookies)
        .send({ name: 'Unauthorized View', datasetId: restrictedDsId });
      expect(createViewRes.status).toBe(403);
      expect(createViewRes.body.error.code).toBe('FORBIDDEN_ROLE');

      // 7. Analytics scoped to restricted datasetId
      const analyticsRes = await request(app)
        .get(`/api/v1/analytics/overview?datasetId=${restrictedDsId}`)
        .set('Cookie', viewerSession.cookies);
      expect(analyticsRes.status).toBe(403);
      expect(analyticsRes.body.error.code).toBe('DATASET_ACCESS_DENIED');
    });

    it('enforces ADMIN-only protection on /users and /datasets/:id/permissions and applies user-level overrides', async () => {
      const viewerUsersRes = await request(app)
        .get('/api/v1/users')
        .set('Cookie', viewerSession.cookies);
      expect(viewerUsersRes.status).toBe(403);
      expect(viewerUsersRes.body.error.code).toBe('FORBIDDEN_ROLE');

      const analystUsersRes = await request(app)
        .get('/api/v1/users')
        .set('Cookie', analystSession.cookies);
      expect(analystUsersRes.status).toBe(403);
      expect(analystUsersRes.body.error.code).toBe('FORBIDDEN_ROLE');

      const adminUsersRes = await request(app)
        .get('/api/v1/users')
        .set('Cookie', adminSession.cookies);
      expect(adminUsersRes.status).toBe(200);
      expect(Array.isArray(adminUsersRes.body.data)).toBe(true);

      const viewerPermsRes = await request(app)
        .get(`/api/v1/datasets/${ds1Id}/permissions`)
        .set('Cookie', viewerSession.cookies);
      expect(viewerPermsRes.status).toBe(403);

      // Test temporary user-specific override on restricted dataset and restore cleanly
      const originalPermsRes = await request(app)
        .get(`/api/v1/datasets/${restrictedDsId}/permissions`)
        .set('Cookie', adminSession.cookies);
      expect(originalPermsRes.status).toBe(200);

      const originalEntries = (
        originalPermsRes.body.data as Array<{
          roleId: string | null;
          userId: string | null;
          canView: boolean;
          canSearch: boolean;
          canExport: boolean;
          canManage: boolean;
        }>
      ).map((p) => ({
        roleId: p.roleId,
        userId: p.userId,
        canView: p.canView,
        canSearch: p.canSearch,
        canExport: p.canExport,
        canManage: p.canManage,
      }));

      try {
        const grantRes = await request(app)
          .put(`/api/v1/datasets/${restrictedDsId}/permissions`)
          .set('Cookie', adminSession.cookies)
          .send({
            permissions: [
              ...originalEntries,
              {
                userId: viewerSession.user.id,
                roleId: null,
                canView: true,
                canSearch: true,
                canExport: false,
                canManage: false,
              },
            ],
          });
        expect(grantRes.status).toBe(200);

        const grantedAccessRes = await request(app)
          .get(`/api/v1/datasets/${restrictedDsId}`)
          .set('Cookie', viewerSession.cookies);
        expect(grantedAccessRes.status).toBe(200);
        expect(grantedAccessRes.body.data.id).toBe(restrictedDsId);
      } finally {
        const restoreRes = await request(app)
          .put(`/api/v1/datasets/${restrictedDsId}/permissions`)
          .set('Cookie', adminSession.cookies)
          .send({ permissions: originalEntries });
        expect(restoreRes.status).toBe(200);
      }

      const revokedAccessRes = await request(app)
        .get(`/api/v1/datasets/${restrictedDsId}`)
        .set('Cookie', viewerSession.cookies);
      expect(revokedAccessRes.status).toBe(403);
      expect(revokedAccessRes.body.error.code).toBe('DATASET_ACCESS_DENIED');
    });
  });
});
