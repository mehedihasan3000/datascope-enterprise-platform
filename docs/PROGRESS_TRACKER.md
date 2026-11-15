# DataScope – Multi-Model Progress Tracker & Task Playbook

> **CRITICAL RULES FOR ALL AI MODELS (Gemini 4 Argon, Orchestrator, Claude Opus 5.5, Claude Sonnet 5.5, Gemini 4 Hydrogen, Gemini 3.8 Flash)**:
> 1. **Always Ask Permission First**: Before starting any phase, task, or file modification, always ask the user for permission and wait for explicit approval.
> 2. **Read Context First**: Always read [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) and [`Enterprise_Data_Discovery_and_Intelligence_Platform.md`](../Enterprise_Data_Discovery_and_Intelligence_Platform.md) before writing code.
> 3. **Single Source of Truth**: Use shared schemas and types from `packages/shared`. Never duplicate or diverge API contracts between `apps/api` and `apps/web`.
> 4. **Update This Tracker**: When an approved phase or task is completed and verified, mark its checkbox `[x]`, record the model used, and stop to ask the user for approval before moving to the next phase.

---

## Overall Phase Status

| Phase | Name | Recommended Model | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Architecture Blueprints, ADRs & Multi-Model Playbook (`docs/`) | **Gemini 4 Argon** | ✅ Completed |
| **Phase 1** | Monorepo Scaffolding & `packages/shared` Contracts | **Gemini 4 Argon** | ✅ Completed |
| **Phase 2** | Cloud PostgreSQL Drizzle Schema, Indexes & 100k+ Batch Seeder | **Gemini 4 Argon** | ✅ Completed |
| **Phase 3** | Backend Core: Custom JWT (`HttpOnly`) Auth, RBAC & Datasets API | **Orchestrator (Argon)** | ✅ Completed |
| **Phase 4** | Backend Search Engine, Filter AST Compiler, Views & Analytics API | **Claude Opus 5.5** / **Gemini 4 Argon** | ✅ Completed |
| **Phase 5** | Frontend Foundation: Redux Store (5 Slices), RTK Query & Auth UI | **Gemini 4 Hydrogen** | ✅ Completed |
| **Phase 6** | Core Feature UI: Data Explorer, Virtualized Table & Filter Builder | **Gemini 4 Hydrogen** | ✅ Completed |
| **Phase 7** | Secondary App Pages: Recharts Analytics, Saved Views, History & Admin | **Gemini 4 Hydrogen** | ✅ Completed |
| **Phase 8** | Comprehensive Test Suite, 100k Benchmarks & GitHub Actions CI/CD | **Orchestrator (Argon)** | ✅ Completed |

---

## Detailed Task Breakdown & Handoff Specifications

### ✅ Phase 0: Architecture Blueprints, ADRs & Multi-Model Playbook
- **Assigned Model**: Gemini 4 Argon
- **Status**: `[x] Completed`
- **Deliverables**:
  - `[x]` `docs/ARCHITECTURE.md` — System architecture, monorepo structure, Drizzle schema specs, REST API contracts, Redux state boundaries.
  - `[x]` `docs/TECHNICAL_DECISIONS.md` — Answers to all 10 Mandatory Data Fetching Questions (Section 4) + all 10 Mandatory Technical Decision Records (Section 15).
  - `[x]` `docs/SEARCH_ARCHITECTURE.md` — 3-way search investigation (`tsvector` vs `pg_trgm` vs Elasticsearch/OpenSearch), index definitions, and scale thresholds (Section 5).
  - `[x]` `docs/PROGRESS_TRACKER.md` — Multi-model coordination tracker and phase-by-phase playbook.

---

### ✅ Phase 1: Monorepo Scaffolding & `packages/shared` Contracts
- **Assigned Model**: **Gemini 4 Argon**
- **Status**: `[x] Completed`
- **Objective**: Set up the PNPM/Turborepo workspace and build `packages/shared` as the type-safe contract layer shared by `apps/api` and `apps/web`.
- **Files Created**:
  - `[x]` `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`
  - `[x]` `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
  - `[x]` `packages/shared/src/constants/roles.ts` — `RoleName` (`ADMIN`, `ANALYST`, `VIEWER`), role capability matrix.
  - `[x]` `packages/shared/src/constants/operators.ts` — `FilterOperator` (`eq`, `neq`, `contains`, `startsWith`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `lastNDays`), field type to operator mapping.
  - `[x]` `packages/shared/src/schemas/auth.schema.ts` — `loginSchema`, `registerSchema`, `authUserSchema`.
  - `[x]` `packages/shared/src/schemas/dataset.schema.ts` — `createDatasetSchema`, `datasetFieldSchema`, `accessPermissionSchema`.
  - `[x]` `packages/shared/src/schemas/search.schema.ts` — `filterConditionSchema`, `sortRuleSchema`, `searchQueryRequestSchema` (with strict Zod validation preventing SQL injection or invalid field operators).
  - `[x]` `packages/shared/src/schemas/savedView.schema.ts` — `createSavedViewSchema`, `updateSavedViewSchema`, `shareViewSchema`.
  - `[x]` `packages/shared/src/schemas/user.schema.ts` — `updateUserRoleSchema`, `userPreferencesSchema`.
  - `[x]` `packages/shared/src/types/api.types.ts`, `domain.types.ts`, `analytics.types.ts`.
  - `[x]` Base `apps/api/package.json` + `apps/api/tsconfig.json` and `apps/web/package.json` + `apps/web/tsconfig.json`.
- **Verification Criteria**:
  - `[x]` `pnpm install` succeeds cleanly.
  - `[x]` `pnpm --filter @datascope/shared typecheck` passes with 0 errors.

---

### ✅ Phase 2: Cloud PostgreSQL Drizzle Schema, Indexes & 100k+ Batch Seeder
- **Assigned Model**: **Gemini 4 Argon**
- **Status**: `[x] Completed`
- **Objective**: Implement the PostgreSQL connection pool (supporting Cloud PostgreSQL `DATABASE_URL` with SSL), all 11 Drizzle ORM tables, composite/GIN/`pg_trgm`/`tsvector` indexes, migrations, and the high-speed 100,000+ record batch seeder.
- **Files Created**:
  - `[x]` `apps/api/drizzle.config.ts`
  - `[x]` `apps/api/src/config/env.ts` — Zod-validated environment configuration.
  - `[x]` `apps/api/src/db/index.ts` — `pg.Pool` configured for Cloud PostgreSQL SSL + Drizzle instance.
  - `[x]` `apps/api/src/db/schema/users.ts` — `roles`, `users`, `userPreferences`.
  - `[x]` `apps/api/src/db/schema/datasets.ts` — `datasets`, `datasetFields`, `accessPermissions`.
  - `[x]` `apps/api/src/db/schema/records.ts` — `datasetRecords`, `recordRelationships`, `recordHistory` + composite B-Tree indexes.
  - `[x]` `apps/api/src/db/schema/views.ts` — `savedViews`, `searchHistory`.
  - `[x]` `apps/api/src/db/schema/index.ts` — Barrel export of all tables and relations.
  - `[x]` `apps/api/src/db/migrate.ts` — Applies schema + executes `CREATE EXTENSION IF NOT EXISTS pg_trgm` and GIN `tsvector`/`pg_trgm`/`jsonb_path_ops` indexes.
  - `[x]` `apps/api/src/db/seed/seed-100k.ts` — Deterministic, idempotent batch seeder creating:
    - 3 Roles (`ADMIN`, `ANALYST`, `VIEWER`)
    - 3 Demo Users (`admin@datascope.io`, `analyst@datascope.io`, `viewer@datascope.io` with password `Password123!`)
    - 3 Enterprise Datasets (**104,000 total records**, including primary dataset with **100,000 records** across countries including Germany, US, UK, Japan; statuses `Active`, `Pending`, `Suspended`, `Archived`; revenues ranging from `$5,000` to `$5,000,000`; realistic timestamps including last 30 days)
    - Dynamic `dataset_fields`, `access_permissions`, `record_relationships`, `record_history`, initial `saved_views`, and sample `search_history`.
- **Verification Criteria**:
  - `[x]` `pnpm --filter @datascope/api db:migrate` and `pnpm --filter @datascope/api db:seed` completed in `15.47s` against the Neon Cloud PostgreSQL instance (`104,000` records verified, `ANALYZE` statistics updated).

---

### ✅ Phase 3: Backend Core: Custom JWT (`HttpOnly`) Auth, RBAC & Datasets API
- **Assigned Model**: **Orchestrator (Argon)**
- **Status**: `[x] Completed`
- **Objective**: Build the Express application shell, Custom JWT + `HttpOnly` cookie authentication, Role-Based & Dataset-Level Access Control middleware, Users API, and Dataset Management API.
- **Files Created**:
  - `[x]` `apps/api/src/utils/jwt.ts` — Sign/verify access & refresh JWTs, set/clear `HttpOnly` cookies (`ds_access_token`, `ds_refresh_token`).
  - `[x]` `apps/api/src/middleware/auth.middleware.ts` — Extracts JWT from `HttpOnly` cookie (or `Authorization: Bearer` header fallback for API testing).
  - `[x]` `apps/api/src/middleware/rbac.middleware.ts` — `requireRole(['ADMIN', ...])` and `requireDatasetPermission(permissionType)` verifying `access_permissions` in PostgreSQL so users can never access unauthorized datasets by manipulating parameters.
  - `[x]` `apps/api/src/middleware/validate.middleware.ts` & `error.middleware.ts`.
  - `[x]` `apps/api/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`.
  - `[x]` `apps/api/src/modules/users/users.controller.ts`, `users.service.ts`, `users.routes.ts`.
  - `[x]` `apps/api/src/modules/datasets/datasets.controller.ts`, `datasets.service.ts`, `datasets.routes.ts`.
  - `[x]` `apps/api/src/app.ts` & `apps/api/src/index.ts`.
- **Verification Criteria**:
  - `[x]` `pnpm --filter @datascope/api typecheck` passed with 0 errors.
  - `[x]` Smoke verification passed against Cloud PostgreSQL: login sets `HttpOnly` cookies (`ds_access_token`, `ds_refresh_token`), `/auth/me` and `/auth/refresh` work, Admin/Analyst see 3 datasets, Viewer sees 2 datasets and receives `403 DATASET_ACCESS_DENIED` on the restricted dataset and `403 FORBIDDEN_ROLE` on `/users`, and `/auth/logout` clears cookies.

---

### ✅ Phase 4: Backend Search Engine, Filter AST Compiler, Views & Analytics API
- **Assigned Model**: **Claude Opus 5.5** & **Gemini 4 Argon**
- **Status**: `[x] Completed`
- **Objective**: Implement the high-performance AST-to-Drizzle SQL search compiler, Record Details API, Saved Views & Sharing API, Search History API, and Backend SQL Aggregation Analytics API.
- **Files Created**:
  - `[x]` `apps/api/src/utils/ttl-cache.ts` — In-process LRU + TTL server-side cache with hit/miss telemetry.
  - `[x]` `apps/api/src/utils/query-builder.ts` — Compiles `SearchQueryRequest` into parameterized Drizzle SQL:
    - Global search (`fts` via `websearch_to_tsquery` + prefix matching, `partial` via `pg_trgm` `ILIKE`, `exact` via `=`)
    - Field-level filters on core columns and JSONB `attributes` (`eq`, `neq`, `contains`, `startsWith`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `lastNDays`)
    - Multi-column sorting (`ORDER BY col1 DIR, col2 DIR, id DESC`)
    - Hybrid Offset + Keyset Cursor pagination
  - `[x]` `apps/api/src/modules/search/search.controller.ts`, `search.service.ts`, `search.routes.ts`.
  - `[x]` `apps/api/src/modules/records/records.controller.ts`, `records.service.ts`, `records.routes.ts` (Record info + joined `record_relationships` + `record_history`).
  - `[x]` `apps/api/src/modules/saved-views/saved-views.controller.ts`, `saved-views.service.ts`, `saved-views.routes.ts`.
  - `[x]` `apps/api/src/modules/history/history.controller.ts`, `history.service.ts`, `history.routes.ts`.
  - `[x]` `apps/api/src/modules/analytics/analytics.controller.ts`, `analytics.service.ts`, `analytics.routes.ts` (Pure SQL `GROUP BY` & window aggregations for all required chart metrics).
- **Verification Criteria**:
  - `[x]` `pnpm --filter @datascope/api typecheck` passed with 0 errors.
  - `[x]` Verified against 100,000-record Cloud PostgreSQL dataset: canonical 4-condition query (`Status = Active AND Country = Germany AND Revenue > 10000 AND Created Date = Last 30 Days`) matched 831 records (`1ms` on cache hit), FTS + JSONB `@>` filter matched 3,125 records, Trigram partial search matched 11 records, cursor pagination, record details/relationships/history, saved views CRUD/sharing, search history, and 100k SQL analytics aggregations all passed.

---

### ✅ Phase 5: Frontend Foundation: Redux Store (5 Slices), RTK Query & Auth UI
- **Assigned Model**: **Gemini 4 Hydrogen**
- **Status**: `[x] Completed`
- **Objective**: Set up the Next.js App Router foundation, Redux Toolkit store with all 5 mandatory slices, RTK Query API services with automatic silent refresh, Edge route protection, Public Pages, and the Enterprise App Layout Shell.
- **Files Created**:
  - `[x]` `apps/web/.env.local`, `apps/web/next.config.ts` (with Webpack `extensionAlias` for `@datascope/shared`), `apps/web/postcss.config.mjs`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`
  - `[x]` `apps/web/src/utils/cn.ts`, `apps/web/src/utils/formatters.ts`, `apps/web/src/hooks/usePermissions.ts`
  - `[x]` `apps/web/src/store/index.ts`, `apps/web/src/store/provider.tsx`
  - `[x]` `apps/web/src/store/slices/authSlice.ts`, `datasetSlice.ts`, `searchConfigSlice.ts`, `savedViewsSlice.ts`, `uiPreferencesSlice.ts`
  - `[x]` `apps/web/src/services/apiSlice.ts` (with `credentials: 'include'` & 401 refresh mutex), `authApi.ts`, `datasetsApi.ts`, `recordsApi.ts`, `savedViewsApi.ts`, `historyApi.ts`, `analyticsApi.ts`, `usersApi.ts`
  - `[x]` `apps/web/src/middleware.ts` — Next.js Edge middleware protecting `/dashboard`, `/datasets`, `/explorer`, `/search`, `/saved-views`, `/history`, `/records`, `/analytics`, `/settings` with silent refresh rotation.
  - `[x]` `apps/web/src/components/ui/*` (`Badge`, `Button`, `Skeleton`, `EmptyState`, `ErrorState`, `Toaster`) & `apps/web/src/components/layout/*` (`Sidebar`, `Topbar`, `ErrorBoundary`).
  - `[x]` Public Pages: `apps/web/src/app/(public)/page.tsx` (Landing Page), `login/page.tsx` (with 1-click Demo Role Login buttons for Admin, Analyst, Viewer), `register/page.tsx`.
  - `[x]` App Shell: `apps/web/src/app/(app)/layout.tsx`.
- **Verification Criteria**:
  - `[x]` `pnpm --filter @datascope/web typecheck` and `pnpm --filter @datascope/web build` passed with 0 errors.
  - `[x]` Redux store initialization across all 5 slices, dirty-view tracking, multi-column sorting state, and Edge `middleware.ts` unauthenticated redirect (`/explorer` -> `/login?redirect=%2Fexplorer...`) verified.

---

### ✅ Phase 6: Core Feature UI: Data Explorer, Virtualized Table & Filter Builder
- **Assigned Model**: **Gemini 4 Hydrogen**
- **Status**: `[x] Completed`
- **Objective**: Build the central focus of DataScope: the Data Explorer (`/explorer`), the virtualized Enterprise Data Table, Dynamic Filter Builder, Bidirectional URL State Sync hook, and Record Details view (`/records/[id]` + slide-over drawer).
- **Files Created**:
  - `[x]` `apps/web/src/hooks/useDebounce.ts` & `apps/web/src/hooks/useUrlSearchState.ts`
  - `[x]` `apps/web/src/components/data-table/HighlightText.tsx` & `apps/web/src/components/data-table/EnterpriseDataTable.tsx` — `@tanstack/react-table` + `@tanstack/react-virtual` row virtualization, dynamic columns from `dataset_fields`, single & multi-column sorting badges, column resizing handles, column visibility popover, multi-row checkbox selection + permission-gated CSV export, search match `<mark>` highlighting, and hybrid offset/cursor pagination bar with Jump-to-Page input.
  - `[x]` `apps/web/src/features/filter-builder/DynamicFilterBuilder.tsx` — Add/remove/toggle multiple filter conditions dynamically typed to `dataset_fields` (`status`, `country`, `revenue`, `createdAt`, etc.) + quick preset chips (including the Section 3.C Germany Active >$10k Last 30 Days preset) & `AND`/`OR` logic operator switch.
  - `[x]` `apps/web/src/features/saved-views/SaveViewModal.tsx`, `apps/web/src/features/data-explorer/DataExplorerView.tsx`, & `apps/web/src/app/(app)/explorer/page.tsx`.
  - `[x]` `apps/web/src/features/record-details/RecordDetailContent.tsx`, `apps/web/src/features/record-details/RecordDetailDrawer.tsx`, & `apps/web/src/app/(app)/records/[id]/page.tsx` (Complete attributes + raw JSON inspector, Related Records cards, and Historical Changes timeline).
- **Verification Criteria**:
  - `[x]` `pnpm --filter @datascope/web typecheck` (`tsc --noEmit`) and `pnpm --filter @datascope/web build` (`/explorer` and `/records/[id]`) passed with 0 errors.
  - `[x]` URL query param round-trip + malformed/hostile URL resilience, Redux Explorer store transitions, and live E2E Express + Cloud PostgreSQL (100k dataset, Section 3.C canonical query -> 831 matching records, cursor pagination, Edge middleware JWT auth, and record details) verified.

---

### ✅ Phase 7: Secondary App Pages: Recharts Analytics, Saved Views, History & Admin
- **Recommended Model**: **Claude Sonnet 5.5** or **Gemini 3.8 Flash** (Completed with **Gemini 4 Hydrogen** per user approval)
- **Status**: `[x] Completed`
- **Objective**: Complete all remaining required application pages with enterprise polish.
- **Files Created**:
  - `[x]` `apps/web/src/app/(app)/dashboard/page.tsx` — Executive Overview Dashboard (KPI cards, recent saved views, recent search activity, quick dataset launchers).
  - `[x]` `apps/web/src/app/(app)/datasets/page.tsx` — Dataset Library, schema inspector (`DatasetSchemaModal.tsx`), Create Dataset modal (`CreateDatasetModal.tsx`, Admin), and Role/User Access Permission configurator (`DatasetPermissionsModal.tsx`, Admin).
  - `[x]` `apps/web/src/app/(app)/search/page.tsx` — Dedicated full-screen Advanced Search & Query Workbench.
  - `[x]` `apps/web/src/app/(app)/saved-views/page.tsx` — Saved Views management (create, edit, delete, 1-click launch into Explorer, share with roles/team via `ShareViewModal.tsx`).
  - `[x]` `apps/web/src/app/(app)/history/page.tsx` — Search History audit log with execution latency badges, result counts, and 1-click re-run.
  - `[x]` `apps/web/src/app/(app)/analytics/page.tsx` — **Recharts** Data Intelligence Dashboard (Total Records, Records by Category bar chart, Records by Status donut chart, Data Growth Trends area chart, Search Activity line chart, Most Frequently Used Filters horizontal bar chart).
  - `[x]` `apps/web/src/app/(app)/settings/page.tsx` — User Preferences (theme, density, default page size) + Admin User & Role Management table.
- **Verification Criteria**:
  - `[x]` `pnpm --filter @datascope/web typecheck` (`tsc --noEmit`) and `pnpm --filter @datascope/web build` (all 12 public & app routes including `/dashboard`, `/datasets`, `/search`, `/saved-views`, `/history`, `/analytics`, `/settings`) passed with 0 errors.
  - `[x]` `verify-phase7-e2e.ts` verified Edge middleware auth across all 7 Phase 7 routes, SQL Analytics overview aggregations against 104,000 live Cloud PostgreSQL records across 3 datasets, Dataset permissions RBAC, Saved Views, Search History, Users/Roles, and User Preferences.

---

### ✅ Phase 8: Comprehensive Test Suite, 100k Benchmarks & GitHub Actions CI/CD
- **Recommended Model**: **Gemini 4 Hydrogen** or **Orchestrator (Argon)** (Completed with **Orchestrator (Argon)** per user approval)
- **Status**: `[x] Completed`
- **Objective**: Write Unit, Integration, and API tests covering all 10 required test areas (Section 14), execute empirical performance benchmarks against the 100,000+ record dataset, record results in `docs/PERFORMANCE_BENCHMARKS.md`, and configure GitHub Actions CI/CD.
- **Files Created**:
  - `[x]` `apps/api/vitest.config.ts` & `apps/web/vitest.config.ts` — Monorepo Vitest configurations.
  - `[x]` `apps/api/tests/auth-rbac.test.ts` — Auth & Dataset Access Permission tests (verifying unauthorized dataset parameter manipulation is blocked and user-level overrides work).
  - `[x]` `apps/api/tests/search-filters-pagination.test.ts` — Global search (`fts`, `partial`, `exact`), combined `AND`/`OR` + JSONB filters, multi-column sorting, offset/cursor pagination, `TtlCache` unit/invalidation tests, and error validation tests.
  - `[x]` `apps/api/tests/saved-views-analytics.test.ts` — Saved views CRUD/role sharing, search history logging, and SQL aggregation tests.
  - `[x]` `apps/web/src/store/__tests__/store-and-caching.test.ts` — Redux slices (all 5 slices), URL state serialization/resilience, RTK Query caching, request deduplication, cache invalidation, and 401 refresh mutex tests.
  - `[x]` `apps/api/tests/benchmark-100k.ts` — Automated benchmark runner measuring min/p50/p95/max query & pagination latencies, cache hit speedups, analytics aggregations, and PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` query plans.
  - `[x]` `docs/PERFORMANCE_BENCHMARKS.md` — Empirical benchmark report recorded from the live 100,000+ record Cloud PostgreSQL dataset (`104,000` total rows).
  - `[x]` `.github/workflows/ci.yml` — Automated GitHub Actions CI/CD workflow with PostgreSQL 16 service container, migrations, 100k seed, tests, and full build.
- **Verification Criteria**:
  - `[x]` All unit, integration, and API tests pass (`pnpm test`: `24/24` in `@datascope/api` + `9/9` in `@datascope/web`), `pnpm typecheck` and `pnpm build` succeed across all 3 workspaces (`@datascope/shared`, `@datascope/api`, `@datascope/web`), and `pnpm benchmark` populated `docs/PERFORMANCE_BENCHMARKS.md` with verified live Cloud PostgreSQL metrics.
