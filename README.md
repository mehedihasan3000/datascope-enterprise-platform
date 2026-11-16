# DataScope — Enterprise Data Discovery & Intelligence Platform

DataScope is a full-stack enterprise data discovery, high-speed search, and analytics workspace designed to explore, filter, and analyze `100,000+` structured and semi-structured enterprise records with sub-second responsiveness, strict role-based security, and real-time URL state synchronization.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Frontend Architecture](#frontend-architecture)
- [Data Fetching Strategy](#data-fetching-strategy)
- [State Management Strategy](#state-management-strategy)
- [Search Architecture](#search-architecture)
- [Database Indexing Strategy](#database-indexing-strategy)
- [Pagination Strategy](#pagination-strategy)
- [Caching Strategy](#caching-strategy)
- [Performance Optimization](#performance-optimization)
- [Testing Strategy](#testing-strategy)
- [Deployment Instructions](#deployment-instructions)
- [Local Quickstart & Demo Accounts](#local-quickstart--demo-accounts)
- [Technical Documentation Suite](#technical-documentation-suite)

---

## Project Overview

DataScope solves the challenge of exploring large multi-tenant datasets cleanly inside the browser without downloading bulk collections into client memory or running an external search cluster. Built as a TypeScript PNPM/Turborepo monorepo (`@datascope/shared`, `@datascope/api`, `@datascope/web`), the platform pairs a Next.js App Router frontend and Redux Toolkit / RTK Query data layer with an Express API and PostgreSQL analytical search engine indexing `104,000+` seeded records.

| Package / Path | Name | Responsibility |
| :--- | :--- | :--- |
| `apps/web` | `@datascope/web` | Next.js App Router UI, Edge JWT Middleware, Node.js BFF Route Handler (`/api/v1/[...path]`), Redux Toolkit store & RTK Query, virtualized data grid |
| `apps/api` | `@datascope/api` | Express REST API, Drizzle ORM schema & migrations, parameterized SQL search compiler, RBAC middleware, LRU+TTL server caches |
| `packages/shared` | `@datascope/shared` | Shared Zod validation schemas, TypeScript domain/API contracts, RBAC role capabilities, and dynamic filter operator definitions |
| `docs/technical-documentation` | — | Architectural diagrams, ER schema, API reference, TDRs, and live benchmark reports |

---

## Features

- **High-Speed Enterprise Data Explorer (`/explorer`)**: Interactive multi-column table powered by `@tanstack/react-table` and `@tanstack/react-virtual` with dynamic column visibility/resizing, density presets (`compact`, `comfortable`, `spacious`), live match highlighting (`HighlightText`), CSV export, and slide-over record intelligence drawers.
- **Three-Mode Global Search & Workbench (`/search`)**: Instant switching between PostgreSQL Full-Text Search (`fts`), partial trigram substring matching (`partial`), and exact business-key equality (`exact`).
- **Dynamic Multi-Condition Filter Builder**: Supports `AND` / `OR` logical combination across core indexed columns and dynamic JSONB `attributes` using 11 operators (`eq`, `neq`, `contains`, `startsWith`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `lastNDays`) plus one-click analytical presets.
- **Record Intelligence & Audit History (`/records/[id]`)**: Inspects full entity metadata, JSONB domain attributes, bidirectional relationship links (`PARENT_COMPANY`, `SUBSIDIARY`, `STRATEGIC_PARTNER`, `SUPPLIER`), and historical audit trails (`record_history`).
- **Saved Views & Role-Based Team Collaboration (`/saved-views`)**: Save active queries, filters, sorting rules, and column layouts as personal views or share them selectively with workspace roles (`ADMIN`, `ANALYST`, `VIEWER`) with dirty-state detection and deep linking (`?viewId=<uuid>`).
- **Search History Telemetry (`/history`)**: Automatically logs executed searches with result counts and server latency metrics, enabling instant re-execution or cleanup.
- **SQL Aggregation Analytics Dashboard (`/analytics`)**: Interactive Recharts bar, area, line, and pie visualizations computed server-side in PostgreSQL across categories, statuses, countries, growth trends, daily search activity, and frequent filters.
- **Three-Tier RBAC & Dataset Permissions (`/datasets`, `/settings`)**: Enforces `ADMIN`, `ANALYST`, and `VIEWER` capabilities alongside per-dataset role grants and user-level permission overrides (`canView`, `canSearch`, `canExport`, `canManage`).

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js (App Router), React, TypeScript, Redux Toolkit, RTK Query, TanStack Table, TanStack Virtual, Recharts, Tailwind CSS, Lucide Icons, `jose` |
| **Backend** | Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL (`pg`, `pg_trgm`, `tsvector`, `jsonb_path_ops`), `zod`, `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `express-rate-limit` |
| **Monorepo & CI/CD** | PNPM Workspaces, Turborepo, Vitest, Supertest, Testing Library / jsdom, GitHub Actions, Vercel (Frontend), Render (API), Neon (Managed PostgreSQL) |

---

## Frontend Architecture

The frontend uses a **Next.js App Router** layout architecture split into `(public)` routes (`/`, `/login`, `/register`) and protected `(app)` routes (`/dashboard`, `/explorer`, `/search`, `/datasets`, `/saved-views`, `/history`, `/analytics`, `/records/[id]`, `/settings`):

1. **Edge Route Guard (`apps/web/src/middleware.ts`)**: Verifies the `HttpOnly` `ds_access_token` cookie via `jose` before protected pages render, performs transparent token rotation via `POST /auth/refresh` when expired (skipping Next.js router prefetches), and attaches `x-middleware-cache: no-cache` and `Cache-Control: private, no-store` headers.
2. **Same-Origin Node.js BFF Proxy (`apps/web/src/app/api/v1/[...path]/route.ts`)**: Proxies client API requests (`/api/v1/*`) to the backend Express origin at runtime via `apps/web/src/lib/api-proxy.ts`. It preserves multi-cookie `Set-Cookie` headers with `headers.getSetCookie()`, strips upstream `Domain` attributes so cookies bind as first-party `HttpOnly; SameSite=Lax` cookies on the frontend host, and strips `Origin`, `Content-Encoding`, and `Content-Length` headers cleanly.
3. **Feature & Presentation Layer**: Modular feature views (`DataExplorerView`, `DynamicFilterBuilder`, `RecordDetailDrawer`, `SaveViewModal`, `ShareViewModal`, dataset management modals) paired with global `Sidebar`, `Topbar`, `ErrorBoundary`, `Toaster`, and `usePermissions`.

---

## Data Fetching Strategy

DataScope combines **server-side route framing** with **RTK Query (`apiSlice`)** as the unified asynchronous transport layer:

- **Automatic Request Deduplication & Invalidation**: Concurrent subscribers share one serialized HTTP request per `(datasetId, searchQuery, filters, sorting, page, pageSize)` key, while declarative tags (`Auth`, `Users`, `Preferences`, `Datasets`, `DatasetPermissions`, `Records`, `RecordDetail`, `SavedViews`, `SearchHistory`, `Analytics`) trigger automatic background revalidation on mutations.
- **Mutex-Guarded Silent Re-Authentication**: A shared `inFlightRefreshPromise` lock in `apps/web/src/services/apiSlice.ts` intercepts `401 Unauthorized` responses, executes a single `POST /api/v1/auth/refresh` call, and transparently retries queued failed requests.
- **Optimistic UI Updates**: Preference updates (`updateMyPreferences`) apply immediate optimistic cache patches via `updateQueryData` with automatic `.undo()` rollback on server failure.
- **URL Synchronization**: `useUrlSearchState` provides two-way sync between `searchConfigSlice` and browser query parameters (`?dataset=...&q=...&mode=...&filters=...&sort=...&page=...&limit=...&pm=...&viewId=...`) using `router.replace(..., { scroll: false })`.

---

## State Management Strategy

State is partitioned strictly across **four clear boundaries** (raw dataset rows are never copied into Redux client slices):

1. **Server State (`RTK Query`)**: Normalized response caches inside `apiSlice` (`authApi`, `usersApi`, `datasetsApi`, `recordsApi`, `savedViewsApi`, `historyApi`, `analyticsApi`).
2. **Global Client State (`5 Redux Toolkit Slices`)**:
   - `authSlice`: User session identity, initialization status, and optional in-memory bearer token sync.
   - `datasetSlice`: Active dataset ID, per-dataset column visibility/widths, and selected record IDs.
   - `searchConfigSlice`: Search string, search mode (`fts`, `partial`, `exact`), filter conditions, `AND`/`OR` logic, multi-column sorting rules, and offset/cursor pagination state.
   - `savedViewsSlice`: Active saved view ID, dirty-state tracker (via Redux `addMatcher`), and modal state.
   - `uiPreferencesSlice`: Theme (`dark`/`light`), table density, sidebar/drawer toggles, and active toast queue.
3. **URL Navigation State**: Shareable and bookmarkable exploration queries parsed safely via Zod (`useUrlSearchState`).
4. **Local Component State (`useState`)**: Ephemeral typing buffers, draft filter inputs prior to apply, and drag/dropdown state.

---

## Search Architecture

Rather than maintaining an external search cluster with eventual-consistency synchronization lag, DataScope compiles search and filter expressions directly into parameterized PostgreSQL queries inside `apps/api/src/utils/query-builder.ts` and `apps/api/src/modules/search/search.service.ts`:

- **Full-Text Search (`fts`)**: Combines `to_tsvector('english', search_text) @@ websearch_to_tsquery('english', $q)` with sanitized prefix token queries (`term:*`) and automatic business-code fallback (`record_code ILIKE`).
- **Partial Substring Search (`partial`)**: Compiles `search_text ILIKE '%q%' OR record_code ILIKE '%q%'` accelerated by GIN `pg_trgm` trigram indexes.
- **Exact Match (`exact`)**: Executes indexed equality (`=`) across `record_code`, `title`, `category`, `status`, and `country`.
- **Dynamic Filter & Sort Compiler**: Validates every field identifier against `safeFieldKeySchema` (`/^[a-zA-Z][a-zA-Z0-9_]*$/`). Core fields map to typed B-Tree columns on `dataset_records`, while dynamic domain attributes compile JSONB `@>` containment (for `eq`) or typed `attributes ->> field` expressions. Multi-column `ORDER BY` always appends `id DESC` for deterministic pagination tie-breaking.

---

## Database Indexing Strategy

`apps/api/src/db/migrate.ts` provisions **11 normalized PostgreSQL tables** (`roles`, `users`, `user_preferences`, `datasets`, `dataset_fields`, `access_permissions`, `dataset_records`, `record_relationships`, `record_history`, `saved_views`, `search_history`) backed by targeted B-Tree and GIN indexes on `dataset_records`:

- **Composite Filter & Sort B-Tree (`idx_records_composite_discovery`)**: `(dataset_id, status, country, revenue, created_at)` — accelerates multi-condition analytics and discovery filters (`0.216 ms` PostgreSQL execution time verified on 100k rows).
- **Keyset Cursor Seek B-Tree (`idx_records_cursor_pagination`)**: `(dataset_id, created_at DESC, id DESC)` — powers constant-time cursor traversal (`0.129 ms` PostgreSQL execution time).
- **Targeted B-Tree Indexes**: `idx_records_dataset_category_status`, `idx_records_dataset_code`, `idx_records_dataset_revenue`, and `idx_records_dataset_employees`.
- **Full-Text GIN Index (`idx_records_fts_gin`)**: `GIN (to_tsvector('english', search_text))`.
- **Trigram GIN Indexes (`idx_records_trigram_gin`, `idx_records_code_trigram_gin`)**: `GIN (search_text gin_trgm_ops)` and `GIN (record_code gin_trgm_ops)` via `pg_trgm`.
- **Dynamic JSONB GIN Index (`idx_records_attributes_gin`)**: `GIN (attributes jsonb_path_ops)` accelerating `@>` equality queries on dataset-specific fields.

---

## Pagination Strategy

DataScope implements **Dual-Mode Hybrid Pagination**:

1. **Offset Pagination (`paginationMode: 'offset'`, default)**: Uses `LIMIT pageSize OFFSET (page - 1) * pageSize` to enable direct "Go to Page N" jumping and arbitrary multi-column sorting (`pageSize`: `10`–`500`). For unfiltered dataset views, total counts are read in `O(1)` directly from `datasets.total_records` instead of scanning the table with `COUNT(*)`.
2. **Keyset Cursor Pagination (`paginationMode: 'cursor'`)**: Encodes `(createdAt, id)` in a validated `base64url` cursor token and issues `WHERE (created_at, id) < ($ts, $uuid) ORDER BY created_at DESC, id DESC LIMIT pageSize`, avoiding linear `OFFSET` discard degradation across deep multi-million-row pages.

---

## Caching Strategy

Caching operates across three coordinated tiers (`apps/web/src/services/*.ts`, `apps/api/src/utils/ttl-cache.ts`, `apps/api/src/app.ts`):

- **Client Cache (RTK Query)**: Volatility-aware retention windows — datasets & schemas (`300s`), record details & analytics (`180s`), search results (`120s`), and `60s` defaults for saved views/history/preferences — with instant cross-endpoint tag invalidation.
- **Backend Search Cache (`searchResultCache`)**: Per-process LRU + TTL cache (`500` max entries, `120s` TTL) keyed by full dataset ID + normalized search/filter/sort/pagination signature (`0.01–0.05 ms` warm cache hits vs `~110 ms` cold remote DB FTS). Prefix-invalidated on dataset updates via `invalidateDatasetSearchCache(datasetId)`.
- **Backend Analytics Cache (`analyticsCache`)**: Per-process LRU + TTL cache (`100` max entries, `60s` TTL) scoped per user/role/authorized dataset set. Live dataset permissions are verified against PostgreSQL before reading `analyticsCache` so revocations take effect immediately; invalidated on dataset or saved-view changes.
- **HTTP / Edge Security Headers**: Authentication endpoints and proxied BFF responses explicitly set `Cache-Control: private, no-store, no-cache, must-revalidate` and `x-middleware-cache: no-cache` to guarantee auth cookies and redirects are never cached by CDN layers.

---

## Performance Optimization

- **Input Debouncing (`useDebounce(300ms)`)**: Buffers rapid typing in the search bar before dispatching Redux/RTK Query searches (instant bypass on `Enter`), eliminating redundant per-keystroke queries.
- **Windowed DOM Virtualization (`@tanstack/react-virtual`)**: `EnterpriseDataTable` renders only the ~15–22 rows inside the active scroll viewport alongside `React.memo` row components (`VirtualizedTableRow`), keeping scroll performance smooth up to `500` rows per page.
- **Parallel Database Execution**: Search queries execute record fetches and counts concurrently (`Promise.all`), while `/analytics/overview` dispatches KPI, category, status, country, monthly cumulative window trends, daily search activity, and JSONB filter-frequency SQL queries in parallel.
- **Zero-CLS Loading States & Package Optimization**: Differentiates `isLoading` (structured `TableSkeleton`/`CardSkeleton` placeholders) from `isFetching` (retaining visible table rows during background updates), and applies Next.js `optimizePackageImports` for `lucide-react` and `recharts`.

---

## Testing Strategy

Verification spans unit, integration, RBAC security, proxy, static type, production build, and live Cloud PostgreSQL benchmark checks:

| Layer | Suite / Command | Verified Scope |
| :--- | :--- | :--- |
| **Backend Integration & Search (`@datascope/api`)** | `apps/api/tests/*.test.ts` (`pnpm test`) | **24 passing tests** across `search-filters-pagination.test.ts` (13 tests: FTS, trigram, exact, 4-condition filter, JSONB/OR/IN, multi-sort, offset & cursor pagination, TTL cache), `auth-rbac.test.ts` (7 tests: JWT cookies, parameter manipulation, user-level overrides, admin-only guards), and `saved-views-analytics.test.ts` (4 tests: view sharing lifecycle, search history persistence, SQL analytics RBAC scoping) |
| **Frontend Store & BFF Proxy (`@datascope/web`)** | `apps/web/src/**/__tests__/*.test.ts` (`pnpm test`) | **15 passing tests** across `store-and-caching.test.ts` (9 tests) and `api-proxy.test.ts` (6 tests covering multi-`Set-Cookie` preservation, `Domain`/`Secure` normalization, loop prevention, and `502` handling) |
| **Type Safety & Lint** | `pnpm typecheck`, `pnpm lint` | Strict `tsc --noEmit` verification across `@datascope/shared`, `@datascope/api`, and `@datascope/web` |
| **100K Database Benchmarks** | `pnpm benchmark` (`apps/api/tests/benchmark-100k.ts`) | Benchmarks all 12 query/cache/analytics scenarios against `100,000` (`104,000` total) rows and captures PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` query plans |
| **Automated CI Pipeline** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Runs typecheck, lint, migrations, `100,000+` record seeding, full Vitest suite, and production builds on every push/PR to `main` |

---

## Deployment Instructions

DataScope is configured for split cloud deployment using **Neon** (PostgreSQL), **Render** (`apps/api`), and **Vercel** (`apps/web`):

### 1. Provision Neon PostgreSQL
1. Create a Neon project and copy the connection URI (`sslmode=require`; direct connection URI supported out of the box with SSL auto-enabled in `apps/api/src/db/index.ts`).
2. Run database migrations and seed `104,000+` records from your local machine or CI shell pointing `DATABASE_URL` to Neon:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

### 2. Deploy Backend (`apps/api`) on Render
Use [`render.yaml`](render.yaml) (Web Service running `pnpm install --frozen-lockfile` and `pnpm --filter @datascope/api start` with health check `/api/v1/health`) and configure environment variables:
- `NODE_ENV=production`
- `DATABASE_URL=<neon-connection-uri>`
- `DATABASE_POOL_MAX=10`
- `JWT_ACCESS_SECRET=<64+ char random secret>`
- `JWT_REFRESH_SECRET=<64+ char random secret>`
- `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=7d`
- `COOKIE_SECURE=true`
- Leave `COOKIE_DOMAIN` **unset/empty** (because the Next.js BFF proxy binds auth cookies as host-only cookies on the Vercel domain).
- `FRONTEND_URL=https://<your-vercel-app>.vercel.app` (supports comma-separated origins).

### 3. Deploy Frontend (`apps/web`) on Vercel
1. Connect the GitHub repository in Vercel with **Root Directory** set to `apps/web` (or configured via [`turbo.json`](turbo.json) from the monorepo root).
2. Set Vercel Environment Variables:
   - `NEXT_PUBLIC_API_URL=/api/v1` (routes browser requests same-origin through the Node.js BFF proxy; never point directly to `onrender.com` if using Edge Middleware cookie auth).
   - `INTERNAL_API_URL=https://<your-render-service>.onrender.com/api/v1`
   - `JWT_ACCESS_SECRET=<exact same string as Render JWT_ACCESS_SECRET>` (required so Vercel Edge Middleware validates `ds_access_token` cleanly without falling back to `/auth/refresh` on every page load).
3. Deploy and verify login, registration, and `/explorer` navigation cleanly store first-party `HttpOnly` cookies on your Vercel domain.

---

## Local Quickstart & Demo Accounts

```bash
# 1. Install dependencies
pnpm install

# 2. Configure apps/api/.env and apps/web/.env.local using .env.example
# 3. Apply PostgreSQL migrations and seed 104,000+ enterprise records
pnpm db:migrate
pnpm db:seed

# 4. Run development servers (Web: http://localhost:3000, API: http://localhost:4000/api/v1)
pnpm dev

# 5. Run full quality & benchmark commands
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm benchmark
```

The idempotent database seeder provisions three RBAC demo accounts with password **`Password123!`**:

| Role | Email | Capabilities |
| :--- | :--- | :--- |
| `ADMIN` | `admin@datascope.io` | Full access to all datasets, dataset creation, schema/ACL administration, and user role management |
| `ANALYST` | `analyst@datascope.io` | Full dataset search/filtering, analytics visualizations, and creating/sharing saved views |
| `VIEWER` | `viewer@datascope.io` | Read & search access to authorized datasets (restricted datasets enforce `403 DATASET_ACCESS_DENIED`) |

### Docker Compose (Full Stack Local Run)

To spin up `postgres:16-alpine`, `api` (with automatic `db:migrate` and `db:seed` of `104,000+` records), and `web` (`next start`) cleanly without modifying your local `.env*` setup:

```bash
docker compose up --build
```

- **Web App (BFF Proxy `/api/v1`):** `http://localhost:3000`
- **API Health Endpoint:** `http://localhost:4000/api/v1/health`
- Stop and clean up containers (add `-v` to wipe the `postgres_data` volume):
  ```bash
  docker compose down
  ```

---

## Technical Documentation Suite

Detailed architecture diagrams, database ER models, API specifications, decision records, and empirical benchmarks are organized inside [`docs/technical-documentation/`](docs/technical-documentation):

- [01 — Frontend Architecture Diagram](docs/technical-documentation/01-frontend-architecture-diagram.md)
- [02 — Data Fetching Flow Diagram](docs/technical-documentation/02-data-fetching-flow-diagram.md)
- [03 — Search Architecture Diagram](docs/technical-documentation/03-search-architecture-diagram.md)
- [04 — Database ER Diagram](docs/technical-documentation/04-database-er-diagram.md)
- [05 — API Documentation](docs/technical-documentation/05-api-documentation.md)
- [06 — Technical Decision Records](docs/technical-documentation/06-technical-decision-records.md)
- [07 — Performance Test Report](docs/technical-documentation/07-performance-test-report.md)
- [Raw Auto-Generated 100k Benchmark Output](docs/PERFORMANCE_BENCHMARKS.md)
- [Platform Functional Specification](Enterprise_Data_Discovery_and_Intelligence_Platform.md)
