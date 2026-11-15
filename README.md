# DataScope — Enterprise Data Discovery & Intelligence Platform

DataScope is a full-stack enterprise data discovery, high-speed search, and analytics workspace engineered with Next.js 15, Redux Toolkit / RTK Query, Express 4, Drizzle ORM, and PostgreSQL 16+ Full-Text & Trigram indexing (`tsvector` + `pg_trgm`).

## Key Capabilities

- **Hybrid PostgreSQL Search Engine**: Supports Full-Text Search (`websearch_to_tsquery`), fuzzy substring matching (`pg_trgm` GIN indexes), and exact indexed lookups across **104,000+ seeded records**.
- **Recursive Filter AST & Parameterized SQL Compiler**: Strict Zod-validated multi-condition filtering (`eq`, `neq`, `contains`, `startsWith`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `lastNDays`), multi-column sorting, and hybrid offset / keyset cursor pagination.
- **Virtualized Enterprise Grid**: Smooth `@tanstack/react-table` + `@tanstack/react-virtual` data explorer with saved views, URL-synchronized query state, highlighted search matches, and slide-over record detail drawers.
- **Database-Enforced 3-Tier RBAC**: Custom `HttpOnly` JWT authentication (`ds_access_token` / `ds_refresh_token`) with mutex-guarded silent refresh and dataset-level access control (`ADMIN`, `ANALYST`, `VIEWER`).
- **SQL Aggregation Analytics**: Dedicated PostgreSQL `GROUP BY` and time-series rollup endpoints rendered with interactive Recharts visualizations.

## Monorepo Structure

| Package / Path | Name | Purpose |
| :--- | :--- | :--- |
| `apps/web` | `@datascope/web` | Next.js 15 App Router UI, Redux Toolkit (5 slices), RTK Query, Tailwind CSS v4 |
| `apps/api` | `@datascope/api` | Express 4 REST API, Drizzle ORM schema, JWT auth, RBAC middleware, SQL search compiler |
| `packages/shared` | `@datascope/shared` | Shared Zod schemas, TypeScript domain/API contracts, RBAC role & operator constants |
| `docs` | — | System architecture, ADRs, search benchmarks, and implementation tracker |

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Redux Toolkit & RTK Query, TanStack Table & Virtual, Tailwind CSS v4, Recharts, Lucide Icons
- **Backend**: Node.js 20+, Express 4, Drizzle ORM, PostgreSQL 16+ (`pg_trgm`, GIN `tsvector`, `jsonb_path_ops`), `zod`, `jsonwebtoken`, `bcryptjs`
- **Tooling & CI**: PNPM Workspaces, Turborepo, Vitest, GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))

## Quickstart

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy values from [`.env.example`](.env.example) into:
- `apps/api/.env` (PostgreSQL `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`)
- `apps/web/.env.local` (`NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`)

### 3. Migrate & Seed 104,000+ Records

```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Start Development Servers

```bash
pnpm dev
```

- **Web App**: `http://localhost:3000`
- **API Server**: `http://localhost:4000/api/v1`

### 5. Verification, Tests & Benchmarks

```bash
pnpm typecheck   # TypeScript checks across all packages
pnpm lint        # ESLint checks across workspaces
pnpm test        # Vitest suites (RBAC, Search AST, Cursor Pagination, Saved Views, Redux Store)
pnpm build       # Production builds for shared, api, and web
pnpm benchmark   # 100k PostgreSQL search latency benchmark
```

## Demo Accounts

The idempotent database seeder provisions three RBAC roles with password `Password123!`:

| Role | Email | Capabilities |
| :--- | :--- | :--- |
| `ADMIN` | `admin@datascope.io` | Full access to all 3 datasets, schema creation, dataset ACLs, and user role management |
| `ANALYST` | `analyst@datascope.io` | Access to all 3 datasets, analytics, custom saved views, and view sharing |
| `VIEWER` | `viewer@datascope.io` | Read access to 2 public datasets (restricted datasets return `403 DATASET_ACCESS_DENIED`) |

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Technical Decision Records (ADRs)](docs/TECHNICAL_DECISIONS.md)
- [Search Architecture (`tsvector` & `pg_trgm`)](docs/SEARCH_ARCHITECTURE.md)
- [100k Performance Benchmarks](docs/PERFORMANCE_BENCHMARKS.md)
- [Multi-Model Progress Tracker](docs/PROGRESS_TRACKER.md)
- [Platform Specification](Enterprise_Data_Discovery_and_Intelligence_Platform.md)
