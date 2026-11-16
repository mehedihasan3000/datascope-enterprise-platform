# 05 — REST API Documentation (`/api/v1`)

> **Local Base URL:** `http://localhost:4000/api/v1`  
> **Production Client Base URL (Same-Origin Next.js BFF Proxy):** `/api/v1` (`https://<frontend-domain>/api/v1/*`)  
> **Upstream Express Origin:** `https://<render-service>.onrender.com/api/v1`

---

## 1. Conventions, Authentication & Security

### 1.1 Transport & Authentication
- **Cookies (Primary Browser Auth):** Express issues two `HttpOnly`, `SameSite=Lax`, `Path=/` cookies (`Secure` enforced when `COOKIE_SECURE=true` or `NODE_ENV=production`):
  - `ds_access_token` (`15m` default expiry)
  - `ds_refresh_token` (`7d` default expiry)
- **Bearer Fallback (`auth.middleware.ts`):** `Authorization: Bearer <accessToken>` is also accepted for automated API/test clients.
- **No-Cache Enforcement:** `/api/v1/auth/*` and all BFF-proxied responses emit `Cache-Control: private, no-store, no-cache, must-revalidate` and `Pragma: no-cache`.

### 1.2 Standard Response Envelopes

**Success Envelope (`ApiResponse<T>`):**
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "pageSize": 50,
    "totalRecords": 100000,
    "totalPages": 2000,
    "nextCursor": "eyJjcmVhdGVkQXQiOi...",
    "hasNextPage": true,
    "hasPreviousPage": false,
    "executionTimeMs": 62,
    "cacheHit": false
  }
}
```

**Error Envelope (`ApiErrorResponse`):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "message": "Please provide a valid enterprise email address" }]
  }
}
```

### 1.3 Common HTTP Status Codes & Rate Limiting
| Status | Error Code Example | Cause |
| :---: | :--- | :--- |
| `400` | `VALIDATION_ERROR`, `INVALID_CURSOR`, `INVALID_DATASET_ID`, `INVALID_FILTER_FIELD`, `UNSUPPORTED_OPERATOR` | Zod schema or query-builder validation failure |
| `401` | `UNAUTHORIZED`, `INVALID_CREDENTIALS` | Missing, invalid, or expired token/credentials |
| `403` | `FORBIDDEN_ROLE`, `DATASET_ACCESS_DENIED`, `ACCOUNT_DISABLED` | Role or dataset permission denied |
| `404` | `ROUTE_NOT_FOUND`, `DATASET_NOT_FOUND`, `RECORD_NOT_FOUND`, `SAVED_VIEW_NOT_FOUND` | Missing resource or cross-dataset mismatch |
| `409` | `EMAIL_ALREADY_EXISTS` | Duplicate registration email |
| `429` | `RATE_LIMIT_EXCEEDED` | Triggered on `POST /auth/login` or `POST /auth/register` (`30 req / 15 min` in prod; `500` in dev) |
| `502` / `503` | `BAD_GATEWAY`, `PROXY_MISCONFIGURED` | Next.js BFF proxy upstream failure or missing `INTERNAL_API_URL` |

---

## 2. RBAC Permission Matrix

| Capability | `ADMIN` | `ANALYST` | `VIEWER` |
| :--- | :---: | :---: | :---: |
| User & Role Administration (`/users`, `/users/:id/role`) | Yes | No | No |
| Dataset Create / Delete & Permissions Config | Yes | No | No |
| Explore Authorized Datasets & View Record Details | Yes | Yes (`canView`) | Yes (`canView`) |
| Search & Filter Datasets | Yes | Yes (`canSearch`) | Yes (`canSearch`) |
| Create / Update / Share / Delete Saved Views | Yes | Yes (own/shared rules) | Read shared only |
| Platform Analytics Distributions (`/analytics/overview`) | Full metrics | Full metrics | KPI summary only (`recordsBy*` empty) |

Dataset endpoints resolve effective permissions via `resolveEffectiveDatasetPermissions()`: **user-level overrides (`userId`) override role-level grants (`roleId`)**, while `ADMIN` bypasses per-dataset restrictions.

---

## 3. Endpoints Reference

### 3.1 System Health

#### `GET /api/v1/health`
- **Auth:** Public
- **Response (`200 OK`):** Database connection check (`connected`, PostgreSQL `version`, `latencyMs`) + in-process `searchCache` stats (`size`, `hits`, `misses`, `hitRate`).

---

### 3.2 Authentication (`/api/v1/auth`)

| Method & Path | Auth | Validation Schema | Description & Status Codes |
| :--- | :--- | :--- | :--- |
| `POST /auth/register` | Public (rate limited) | `registerSchema`: `{ email, password (min 8, >=1 uppercase, >=1 digit), fullName, role?: 'ANALYST' \| 'VIEWER' }` | Creates user + default `user_preferences`, sets `HttpOnly` auth cookies. `201 Created`, `403 FORBIDDEN_ROLE` if `ADMIN` requested, `409 EMAIL_ALREADY_EXISTS`. |
| `POST /auth/login` | Public (rate limited) | `loginSchema`: `{ email, password (min 6) }` | Verifies `bcryptjs` hash, updates `lastLoginAt`, sets `HttpOnly` cookies, returns `{ user, accessToken }`. `200 OK`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`. |
| `POST /auth/refresh` | Refresh cookie or JSON `{ refreshToken }` | — | Validates `ds_refresh_token`, verifies active user, rotates both cookies and returns refreshed `{ user, accessToken }`. `200 OK`, `401 UNAUTHORIZED`. |
| `POST /auth/logout` | Public | — | Clears `ds_access_token` and `ds_refresh_token` cookies. Returns `{ cleared: true }` (`200 OK`). |
| `GET /auth/me` | `requireAuth` | — | Returns authenticated `UserDTO` including embedded `preferences`. `200 OK`. |

---

### 3.3 Users & Workspace Preferences (`/api/v1/users`)

| Method & Path | Access | Body / Params | Description |
| :--- | :--- | :--- | :--- |
| `GET /users/me/preferences` | Authenticated | — | Fetches or initializes `UserPreferencesDTO` (`theme`, `defaultPageSize`, `tableDensity`, `defaultDatasetId`, `columnConfigs`). |
| `PUT /users/me/preferences` | Authenticated | `updateUserPreferencesSchema` (partial preferences) | Updates persisted user preferences and returns updated `UserPreferencesDTO`. |
| `GET /users/roles` | `ADMIN` | — | Lists available roles (`ADMIN`, `ANALYST`, `VIEWER`) and capabilities. |
| `GET /users` | `ADMIN` | — | Lists all users with roles and activity metadata. |
| `PATCH /users/:id/role` | `ADMIN` | Param `id: uuid`; Body `{ role, isActive? }` | Reassigns user role and/or active status. |

---

### 3.4 Datasets & Access Control (`/api/v1/datasets`)

| Method & Path | Access | Schema / Validation | Description |
| :--- | :--- | :--- | :--- |
| `GET /datasets` | Authenticated | — | Lists all datasets authorized (`canView`) for the caller with field metadata & effective permissions. |
| `POST /datasets` | `ADMIN` | `createDatasetSchema`: `{ name, slug?, description, category, dataSource, fields? }` | Creates dataset, field schema, and default permissions (`201 Created`). |
| `GET /datasets/:id` | `canView` | Param `id: uuid` | Returns `DatasetDTO` with sorted `fields[]` and `effectivePermissions`. |
| `PATCH /datasets/:id` | `canManage` | Param `id: uuid`; `updateDatasetSchema` | Updates dataset metadata/schema fields. |
| `DELETE /datasets/:id` | `ADMIN` | Param `id: uuid` | Deletes dataset and cascades records/fields/views (`{ id }`). |
| `GET /datasets/:id/permissions` | `ADMIN` | Param `id: uuid` | Lists all role grants & user overrides for the dataset. |
| `PUT /datasets/:id/permissions` | `ADMIN` | Body `{ permissions: [{ roleId?, userId?, canView, canSearch, canExport, canManage }] }` | Atomically replaces dataset permission rules inside a transaction (`updatedAt` bumped). |

---

### 3.5 High-Scale Search & Record Discovery (`/api/v1/datasets/:id/records/search`)

- **Method & Path:** `POST /api/v1/datasets/:id/records/search`
- **Access:** Authenticated + `requireDatasetPermission('canSearch', 'id')`
- **Validation:** `id: uuid` + `searchQueryRequestSchema`:

```json
{
  "searchQuery": "Quantum",
  "searchMode": "fts",
  "filters": [
    { "field": "status", "operator": "eq", "value": "Active" },
    { "field": "country", "operator": "eq", "value": "Germany" },
    { "field": "revenue", "operator": "gt", "value": 10000 },
    { "field": "createdAt", "operator": "lastNDays", "value": 30 }
  ],
  "logicOperator": "AND",
  "sorting": [{ "field": "revenue", "direction": "desc" }],
  "page": 1,
  "pageSize": 50,
  "paginationMode": "offset",
  "cursor": null,
  "recordHistoryLog": true
}
```

- **Parameter Limits (Zod):**
  - `searchQuery`: string, max `500` chars
  - `searchMode`: `'fts' | 'partial' | 'exact'` (default `'fts'`)
  - `filters`: max `30` conditions (`operators`: `eq`, `neq`, `contains`, `startsWith`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `lastNDays`)
  - `sorting`: max `5` rules (`direction`: `'asc' | 'desc'`)
  - `page`: `1`..`100000`; `pageSize`: `10`..`500` (default `50`)
  - `paginationMode`: `'offset' | 'cursor'` (`cursor`: base64url encoded `{ createdAt, id }`)
- **Side Effect:** Page 1 searches containing a non-empty `searchQuery` or `filters` asynchronously log an audit record to `search_history` unless `recordHistoryLog: false`.

---

### 3.6 Record Intelligence Details (`/api/v1/.../records`)

| Method & Path | Access | Description |
| :--- | :--- | :--- |
| `GET /datasets/:id/records/:recordId` | `canView` on `:id` | Fetches full `RecordDetailDTO` (core columns, dynamic `attributes`, up to 50 joined `relationships`, and up to 100 ordered `history` entries) scoped strictly to dataset `:id`. |
| `GET /records/:recordId` | Authenticated + dynamic `canView` check on record's dataset | Direct record detail lookup; enforces `resolveEffectiveDatasetPermissions(row.datasetId, user).canView` before returning data (`403 DATASET_ACCESS_DENIED` if unauthorized). |

---

### 3.7 Saved Views (`/api/v1/saved-views`)

| Method & Path | Access | Description |
| :--- | :--- | :--- |
| `GET /saved-views?datasetId=<uuid>` | Authenticated | Lists caller's private views + views shared with caller's role across authorized datasets. |
| `GET /saved-views/:id` | Authenticated | Fetches single view if authorized on its dataset and either owner, Admin, or matching `sharedWithRoles`. |
| `POST /saved-views` | `ADMIN` or `ANALYST` | Persists search query, mode, filters, sorting, visible columns, and sharing flags (`201 Created`). Invalidates Analytics cache. |
| `PATCH /saved-views/:id` | `ADMIN` or `ANALYST` (Owner or Admin) | Updates saved view configuration (`updateSavedViewSchema`). |
| `PATCH /saved-views/:id/share` | `ADMIN` or `ANALYST` (Owner or Admin) | Toggles `isShared` and updates `sharedWithRoles` (`shareSavedViewSchema`). |
| `DELETE /saved-views/:id` | `ADMIN` or `ANALYST` (Owner or Admin) | Deletes saved view and invalidates Analytics cache. |

---

### 3.8 Search History & Analytics (`/api/v1/search-history`, `/api/v1/analytics`)

| Method & Path | Access | Query Params | Description |
| :--- | :--- | :--- | :--- |
| `GET /search-history` | Authenticated | `datasetId?: uuid`, `limit?: 1..200` (default `50`) | Lists the authenticated user's recent executed search history (`canView` enforced when filtered by `datasetId`). |
| `DELETE /search-history` | Authenticated | `datasetId?: uuid` | Clears current user's search history (optionally scoped to one dataset). |
| `GET /analytics/overview` | Authenticated (`canView` check) | `datasetId?: uuid` | Executes 6+ parallel PostgreSQL SQL aggregations (60s server `analyticsCache`). Returns `summary`, `recordsByCategory`, `recordsByStatus`, `recordsByCountry` (top 12), `dataGrowthTrends` (monthly + cumulative window sum), `searchActivity` (up to 30 daily buckets), and `mostFrequentFilters` (`jsonb_array_elements` top 10). `VIEWER` receives KPI summary counts only (`recordsBy*`, trends, activity, filters returned as `[]`). |
