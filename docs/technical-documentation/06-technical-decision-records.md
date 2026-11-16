# 06 — Technical Decision Records (TDR / ADR)

This document formalizes the architectural, data-fetching, database, search, caching, and deployment decisions governing **DataScope**.

---

## TDR-01: Hybrid Next.js Server/Client Framing + RTK Query vs. Redux Thunks / TanStack Query

- **Context / Problem:** Interactive data discovery requires fast filter/sort/page transitions without full-page reloads while adhering to Redux Toolkit as the global state architecture.
- **Alternatives Considered:**
  1. Hand-written `createAsyncThunk` reducers inside feature slices.
  2. Dual-library stack (`Redux Toolkit` + `TanStack Query`).
  3. **RTK Query (`apiSlice`) embedded inside the unified Redux Toolkit store**, paired with Next.js App Router layouts and Edge authentication guards.
- **Decision:** Selected **RTK Query (`apiSlice`)** for all server state alongside 5 focused client slices (`auth`, `dataset`, `searchConfig`, `savedViews`, `uiPreferences`).
- **Trade-offs & Performance Impact:** Eliminates manual cache key maps, boilerplate loading booleans, and duplicate state providers; automatically deduplicates identical in-flight subscriptions and retains paginated results (`keepUnusedDataFor: 120s` for searches, `300s` for datasets, `180s` for analytics/record details). Requires disciplined tag annotations (`providesTags` / `invalidatesTags`).

---

## TDR-02: Strict Server-Side Search, Filtering & Pagination vs. Client-Side Processing

- **Context / Problem:** Datasets start at `100,000+` rows (`104,000` seeded total) and target multi-million row scale with arbitrary dynamic filtering and sorting.
- **Alternatives Considered:**
  1. Download entire dataset JSON to browser memory or IndexedDB + Web Worker filtering.
  2. **Strict server-side SQL execution in PostgreSQL (`LIMIT` `10`–`500` rows per response).**
- **Decision:** Selected **strict server-side filtering, sorting, aggregation, and pagination**.
- **Trade-offs & Performance Impact:** Keeps browser payloads compact (`25`–`250` typical rows, `< 50 KB` JSON) and analytics summary payloads under a few kilobytes regardless of whether a dataset holds `100K` or `50M` rows; preserves strict RBAC security because unauthorized columns/datasets never reach browser memory. Trade-off: each novel filter/sort triggers a debounced HTTP round-trip.

---

## TDR-03: Cloud PostgreSQL (Hybrid Relational Columns + JSONB) vs. NoSQL Document Store

- **Context / Problem:** DataScope combines transactional relational RBAC (`roles`, `users`, `access_permissions`, `record_relationships`, `record_history`) with dynamic per-dataset attributes and complex numeric/date range filtering.
- **Alternatives Considered:**
  1. MongoDB document store.
  2. Wide-column NoSQL (Cassandra / DynamoDB).
  3. **Managed Cloud PostgreSQL with hybrid typed core columns + `JSONB` `attributes`.**
- **Decision:** Selected **PostgreSQL (`pg.Pool` + Drizzle ORM)**.
- **Trade-offs & Performance Impact:** Single ACID engine supports foreign-key RBAC joins, composite B-Tree range queries (`revenue`, `created_at`), window-function SQL analytics (`SUM(...) OVER`), GIN `tsvector`, GIN `pg_trgm`, and GIN `jsonb_path_ops` containment (`@>`). Above `50M–100M` rows in one table, declarative partitioning (`PARTITION BY LIST (dataset_id)`) will be required.

---

## TDR-04: Hybrid Offset + Keyset (Cursor) Pagination Strategy

- **Context / Problem:** Analysts expect arbitrary "Go to Page N" navigation in data tables, yet deep `OFFSET` scans degrade linearly (`O(offset)`) on million-row tables.
- **Alternatives Considered:**
  1. Pure `LIMIT / OFFSET`.
  2. Pure keyset cursor pagination (disallows page jumping).
  3. **Dual-mode Hybrid Offset + Keyset Cursor Pagination (`paginationMode: 'offset' | 'cursor'`).**
- **Decision:** Support **both modes** natively in [`query-builder.ts`](../../apps/api/src/utils/query-builder.ts) and `EnterpriseDataTable`. Offset mode powers standard page-jump browsing (with `O(1)` total row lookup via `datasets.total_records` on unfiltered datasets), while Cursor mode encodes `(createdAt, id)` in `base64url` (`WHERE (created_at, id) < ($ts, $uuid)`) for constant-time `O(log N)` deep sequential traversal (`0.129 ms` DB seek time).
- **Trade-offs:** In `cursor` mode, sort order is fixed to `(created_at DESC, id DESC)` to match `idx_records_cursor_pagination`.

---

## TDR-05: Hybrid PostgreSQL FTS (`tsvector`) + Trigram (`pg_trgm`) vs. Elasticsearch / OpenSearch

- **Context / Problem:** Analysts run both multi-word domain queries (`"Quantum"`) and partial infix substring/code queries (`"Synthet"`, `"050000"`) that must immediately respect dataset RBAC changes.
- **Alternatives Considered:**
  1. External Elasticsearch / OpenSearch cluster.
  2. Unindexed `ILIKE` sequential table scans.
  3. **In-database Hybrid `tsvector` + `pg_trgm` GIN indexes + B-Tree exact matching.**
- **Decision:** Implemented selectable `fts`, `partial`, and `exact` search modes directly in PostgreSQL (`idx_records_fts_gin`, `idx_records_trigram_gin`, `idx_records_code_trigram_gin`, `idx_records_dataset_code`).
- **Trade-offs:** Zero ETL/CDC sync lag (`0 ms` lag when dataset permissions change) and zero additional cluster infrastructure up to `~10M–15M` records. At `>20M–50M` rows with heavy write rates or typo tolerance needs, CDC replication to OpenSearch becomes appropriate.

---

## TDR-06: Same-Origin Node.js BFF Route Handler (`/api/v1/[...path]`) vs. Direct Cross-Site API / Declarative Rewrites

- **Context / Problem:** Frontend is hosted on Vercel (`*.vercel.app`) while Express API runs on Render (`*.onrender.com`) with free-tier hostnames on separate Public Suffix List domains. Calling Render directly fails `SameSite=Lax` cookies cross-site, and switching cookies to `SameSite=None` on `onrender.com` does not make cookies visible to Vercel Edge Middleware (`src/middleware.ts`). Meanwhile, declarative `next.config.ts` external `rewrites()` proxies through Vercel's CDN layer, baking `INTERNAL_API_URL` at build time and lacking control over normalizing upstream `Domain=...` or multi-`Set-Cookie` headers via `getSetCookie()`.
- **Alternatives Considered:**
  1. Direct cross-origin browser requests to `onrender.com` with `SameSite=None; Secure` + client-only localStorage tokens (insecure vs XSS and incompatible with Edge SSR Middleware cookie verification).
  2. Declarative `next.config.ts` `rewrites()`.
  3. **Explicit Next.js Node.js App Router BFF Route Handler (`src/app/api/v1/[...path]/route.ts`) + shared `src/lib/api-proxy.ts`.**
- **Decision:** Replaced declarative `rewrites()` with a runtime Node.js BFF Route Handler (`dynamic = 'force-dynamic'`). It resolves `INTERNAL_API_URL` dynamically, strips `Origin` and compressed hop headers (`Content-Encoding` / `Content-Length`), iterates `headers.getSetCookie()` to forward every `Set-Cookie` individually with upstream `Domain=` stripped so cookies bind as first-party cookies on `*.vercel.app`, and sets `Cache-Control: private, no-store, no-cache, must-revalidate`.
- **Trade-offs:** Adds one intra-server hop (`Vercel -> Render`) per API request (~15–40 ms) in exchange for strict first-party `HttpOnly; SameSite=Lax; Secure` cookie security and full Edge Middleware protection without requiring a custom shared domain.

---

## TDR-07: Input Debouncing (`300ms`) & Request Deduplication

- **Decision:** Global search text updates local React input state immediately at 60fps while `useDebounce(searchInput, 300)` gates dispatches to `searchConfigSlice` (bypassed immediately on form `Enter` submission). Concurrent subscribers share one RTK Query fetch.
- **Impact:** Typing a 10–12 character search phrase emits 1 API call instead of 10–12 sequential DB queries (~85%+ query volume reduction).

---

## TDR-08: Windowed Row Virtualization (`@tanstack/react-virtual`) & Row Memoization

- **Decision:** Combine `@tanstack/react-table` with `@tanstack/react-virtual` and `memo(VirtualizedTableRow)` keyed by dynamic density heights (`compact: 40px`, `comfortable: 48px`, `spacious: 58px`).
- **Impact:** Keeps DOM nodes bounded to ~15–22 visible rows even at `pageSize = 250` with live search highlighting enabled.

---

## TDR-09: Multi-Tier Volatility-Aware Caching

- **Decision:** Match cache lifetime to mutation frequency:
  - Client RTK Query: Datasets `300s`, Analytics & Record Details `180s`, Record Searches `120s`, Auth/Views/History `60s`.
  - Backend In-Process `TtlCache`: `searchResultCache` (`500` LRU entries, `120s` TTL, invalidated by prefix on dataset mutations/imports) and `analyticsCache` (`100` LRU entries, `60s` TTL, invalidated on dataset/saved-view mutations). RBAC checks remain live on every request so permission revocations take effect immediately.
- **Impact:** Empirical warm search cache hits resolve in `0.01–0.05 ms` on server (`~11,025x` speedup over cold remote PostgreSQL FTS).

---

## TDR-10: Two-Way URL Query State Synchronization (`useUrlSearchState`)

- **Decision:** Parse and serialize `?dataset=...&q=...&mode=...&filters=...&logic=...&sort=...&page=...&limit=...&pm=...&viewId=...` via Zod-validated `useUrlSearchState`, writing changes via `router.replace(..., { scroll: false })`.
- **Trade-offs:** Enables bookmarking, Back/Forward navigation, and deep linking into exact exploration views; large filter configurations (`>30` clauses) persist safely as server Saved Views referenced via `?viewId=<uuid>`.

---

## TDR-11: Strict Four-Tier Frontend State Boundary

- **Decision:** Isolate Server State (RTK Query), Global Config/UI State (5 Redux slices), Shareable Navigation State (URL), and Ephemeral Component State (`useState`). Raw `DatasetRecordDTO[]` arrays are forbidden inside Redux client slices.

---

## TDR-12: Single-Source `@datascope/shared` Zod Contracts & Defense-in-Depth RBAC

- **Decision:** Centralize Zod schemas, RBAC roles/capabilities, filter operator metadata, and DTO interfaces inside `@datascope/shared`. API routes verify JWT + role + per-dataset permissions via Express middleware (`requireAuth`, `requireRole`, `requireDatasetPermission`) and field allowlists (`safeFieldKeySchema`) regardless of frontend UI hiding.
