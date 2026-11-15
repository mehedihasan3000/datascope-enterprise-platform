# DataScope – System Architecture & Multi-Model Implementation Blueprint

> **Purpose of This Document**: This file serves as the authoritative technical contract for **DataScope – Enterprise Data Discovery & Intelligence Platform**. Every AI model working on this repository (**Gemini 4 Argon**, **Orchestrator (Argon)**, **Claude Opus 5.5**, **Claude Sonnet 5.5**, **Gemini 4 Hydrogen**, and **Gemini 3.8 Flash**) must adhere strictly to the folder structure, database schema, API contracts, and state boundaries defined here.

---

## 1. Multi-Model Continuity Protocol

Before writing or modifying any code, every AI model must:
1. Read [`docs/PROGRESS_TRACKER.md`](./PROGRESS_TRACKER.md) to identify the current active phase and completed tasks.
2. Check [`packages/shared/src/index.ts`](../packages/shared/src/index.ts) (once Phase 1 is complete) and reuse all shared Zod schemas, TypeScript interfaces, and constants instead of redefining duplicate types in `apps/api` or `apps/web`.
3. Never start a new phase or modify files outside the assigned task scope without explicit user approval.
4. Update [`docs/PROGRESS_TRACKER.md`](./PROGRESS_TRACKER.md) upon completing and verifying an assigned task.

---

## 2. Monorepo Topology & Tech Stack

- **Package Manager & Build System**: `pnpm` workspaces + `turbo` (Turborepo)
- **Shared Package (`packages/shared`)**: TypeScript + `zod` (Zero runtime dependencies other than `zod`)
- **Backend (`apps/api`)**:
  - Runtime & Framework: Node.js + Express.js + TypeScript (`tsx` for dev, `tsup`/`tsc` for build)
  - Database & ORM: Managed Cloud PostgreSQL (`pg` pool with SSL support) + `drizzle-orm` + `drizzle-kit`
  - Authentication & Security: `jose` / `jsonwebtoken` (`HttpOnly` cookies), `bcryptjs`, `helmet`, `cors`, `cookie-parser`, `express-rate-limit`
  - Testing: `vitest` + `supertest`
- **Frontend (`apps/web`)**:
  - Framework: Next.js (App Router) + React + TypeScript
  - State Management (Mandatory): `@reduxjs/toolkit` + `react-redux` (5 client slices + RTK Query `apiSlice`)
  - Data Table & Virtualization: `@tanstack/react-table` + `@tanstack/react-virtual`
  - Analytics Visualization: `recharts`
  - Styling & Icons: Tailwind CSS + `lucide-react` + `clsx` + `tailwind-merge`
  - Testing: `vitest` + `@testing-library/react`

---

## 3. Environment Configuration Specification

### 3.1 Backend (`apps/api/.env`)
```env
NODE_ENV=development
PORT=4000
# Managed Cloud PostgreSQL URL (Neon, Supabase, Aiven, Railway, RDS, etc.)
DATABASE_URL="postgresql://user:password@cloud-host.region.provider.com:5432/datascope?sslmode=require"
DATABASE_POOL_MAX=20

# Custom JWT + HttpOnly Cookie Auth
JWT_ACCESS_SECRET="replace-with-64-char-random-access-secret"
JWT_REFRESH_SECRET="replace-with-64-char-random-refresh-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
COOKIE_DOMAIN="localhost"
COOKIE_SECURE="false"

# CORS Allowed Origin
FRONTEND_URL="http://localhost:3000"
```

### 3.2 Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
INTERNAL_API_URL="http://localhost:4000/api/v1"
JWT_ACCESS_SECRET="replace-with-64-char-random-access-secret"
```

---

## 4. Database Schema Specification (Drizzle ORM)

All tables reside in `apps/api/src/db/schema/` and are exported via `apps/api/src/db/schema/index.ts`.

### 4.1 `roles` (`apps/api/src/db/schema/users.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Role UUID |
| `name` | `varchar(50)` | `UNIQUE NOT NULL` | `'ADMIN' \| 'ANALYST' \| 'VIEWER'` |
| `description` | `text` | `NOT NULL` | Role summary |
| `permissions` | `jsonb` | `NOT NULL DEFAULT '[]'` | String array of global permissions |
| `createdAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |

### 4.2 `users` (`apps/api/src/db/schema/users.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | User UUID |
| `email` | `varchar(255)` | `UNIQUE NOT NULL` | User login email |
| `passwordHash` | `varchar(255)` | `NOT NULL` | Bcrypt password hash |
| `fullName` | `varchar(150)` | `NOT NULL` | Display name |
| `roleId` | `uuid` | `NOT NULL REFERENCES roles(id)` | Assigned role FK |
| `isActive` | `boolean` | `NOT NULL DEFAULT true` | Account status |
| `lastLoginAt` | `timestamptz` | `NULL` | Last login timestamp |
| `createdAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updatedAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Update timestamp |

### 4.3 `user_preferences` (`apps/api/src/db/schema/users.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Preference UUID |
| `userId` | `uuid` | `UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owner user |
| `theme` | `varchar(20)` | `NOT NULL DEFAULT 'dark'` | `'dark' \| 'light' \| 'system'` |
| `defaultPageSize` | `integer` | `NOT NULL DEFAULT 50` | `25 \| 50 \| 100 \| 250` |
| `tableDensity` | `varchar(20)` | `NOT NULL DEFAULT 'compact'` | `'compact' \| 'comfortable' \| 'spacious'` |
| `defaultDatasetId` | `uuid` | `NULL` | Default selected dataset |
| `columnConfigs` | `jsonb` | `NOT NULL DEFAULT '{}'` | Per-dataset visible/resized column map |
| `updatedAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Last modified timestamp |

### 4.4 `datasets` (`apps/api/src/db/schema/datasets.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Dataset UUID |
| `name` | `varchar(200)` | `NOT NULL` | Dataset display name |
| `slug` | `varchar(200)` | `UNIQUE NOT NULL` | URL-friendly identifier |
| `description` | `text` | `NOT NULL` | Detailed description |
| `category` | `varchar(100)` | `NOT NULL` | e.g., `'Enterprise Accounts'`, `'Financial Transactions'`, `'Global Supply Chain'` |
| `dataSource` | `varchar(150)` | `NOT NULL` | e.g., `'SAP ERP Warehouse'`, `'Salesforce CRM Sync'` |
| `totalRecords` | `integer` | `NOT NULL DEFAULT 0` | Maintained counter of total rows |
| `createdBy` | `uuid` | `NOT NULL REFERENCES users(id)` | Creator Admin user |
| `createdAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Created Date |
| `updatedAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Last Updated Date |

### 4.5 `dataset_fields` (`apps/api/src/db/schema/datasets.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Field UUID |
| `datasetId` | `uuid` | `NOT NULL REFERENCES datasets(id) ON DELETE CASCADE` | Parent dataset |
| `fieldKey` | `varchar(100)` | `NOT NULL` | Column key (`status`, `country`, `revenue`, or JSONB key) |
| `displayName` | `varchar(150)` | `NOT NULL` | Human-readable column header |
| `dataType` | `varchar(30)` | `NOT NULL` | `'string' \| 'number' \| 'currency' \| 'date' \| 'enum' \| 'boolean'` |
| `isCoreColumn` | `boolean` | `NOT NULL DEFAULT false` | `true` if mapped to top-level indexed column on `dataset_records` |
| `isSortable` | `boolean` | `NOT NULL DEFAULT true` | Whether sorting is allowed |
| `isFilterable` | `boolean` | `NOT NULL DEFAULT true` | Whether dynamic filter builder includes this field |
| `isSearchable` | `boolean` | `NOT NULL DEFAULT true` | Whether global search indexes this field |
| ` isDefaultVisible`| `boolean` | `NOT NULL DEFAULT true` | Default visibility in Data Explorer |
| `enumValues` | `jsonb` | `NULL` | Array of allowed values if `dataType === 'enum'` |
| `sortOrder` | `integer` | `NOT NULL DEFAULT 0` | Display order in table |

### 4.6 `access_permissions` (`apps/api/src/db/schema/datasets.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Permission UUID |
| `datasetId` | `uuid` | `NOT NULL REFERENCES datasets(id) ON DELETE CASCADE` | Target dataset |
| `roleId` | `uuid` | `NULL REFERENCES roles(id) ON DELETE CASCADE` | Role-level grant |
| `userId` | `uuid` | `NULL REFERENCES users(id) ON DELETE CASCADE` | User-specific override grant |
| `canView` | `boolean` | `NOT NULL DEFAULT true` | Browse & read dataset |
| `canSearch` | `boolean` | `NOT NULL DEFAULT true` | Run advanced searches |
| `canExport` | `boolean` | `NOT NULL DEFAULT false` | Export dataset records |
| `canManage` | `boolean` | `NOT NULL DEFAULT false` | Modify schema & permissions |
| `createdAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Grant timestamp |

### 4.7 `dataset_records` (`apps/api/src/db/schema/records.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Record UUID |
| `datasetId` | `uuid` | `NOT NULL REFERENCES datasets(id) ON DELETE CASCADE` | Parent dataset |
| `recordCode` | `varchar(64)` | `NOT NULL` | External business key (e.g., `ENT-00048291`) |
| `title` | `varchar(255)` | `NOT NULL` | Primary entity name / title |
| `category` | `varchar(100)` | `NOT NULL` | Industry / domain category |
| `status` | `varchar(50)` | `NOT NULL` | `'Active' \| 'Pending' \| 'Suspended' \| 'Archived'` |
| `country` | `varchar(100)` | `NOT NULL` | ISO Country name (`'Germany'`, `'United States'`, etc.) |
| `revenue` | `numeric(15,2)` | `NOT NULL DEFAULT 0` | Numeric revenue in USD |
| `employeeCount` | `integer` | `NOT NULL DEFAULT 0` | Organization headcount |
| `riskScore` | `numeric(5,2)` | `NOT NULL DEFAULT 0` | Intelligence risk metric (`0.00` to `100.00`) |
| `attributes` | `jsonb` | `NOT NULL DEFAULT '{}'` | Dynamic domain fields (region, accountManager, tier, tags, etc.) |
| `searchText` | `text` | `NOT NULL` | Concatenated searchable text for `tsvector` and `pg_trgm` |
| `createdAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Record Created Date |
| `updatedAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Record Updated Date |

### 4.8 `record_relationships` (`apps/api/src/db/schema/records.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Relationship UUID |
| `sourceRecordId` | `uuid` | `NOT NULL REFERENCES dataset_records(id) ON DELETE CASCADE` | Origin record |
| `targetRecordId` | `uuid` | `NOT NULL REFERENCES dataset_records(id) ON DELETE CASCADE` | Related target record |
| `relationshipType`| `varchar(64)` | `NOT NULL` | `'PARENT_COMPANY' \| 'SUBSIDIARY' \| 'STRATEGIC_PARTNER' \| 'SUPPLIER'` |
| `metadata` | `jsonb` | `NOT NULL DEFAULT '{}'` | Relationship confidence score / notes |
| `createdAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |

### 4.9 `record_history` (`apps/api/src/db/schema/records.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Audit entry UUID |
| `recordId` | `uuid` | `NOT NULL REFERENCES dataset_records(id) ON DELETE CASCADE` | Audited record |
| `changedBy` | `uuid` | `NULL REFERENCES users(id)` | User who made the change |
| `changeType` | `varchar(50)` | `NOT NULL` | `'CREATED' \| 'UPDATED' \| 'STATUS_CHANGED' \| 'ENRICHED'` |
| `summary` | `varchar(255)` | `NOT NULL` | Human-readable change summary |
| `previousValues` | `jsonb` | `NULL` | Snapshot of changed fields before update |
| `newValues` | `jsonb` | `NOT NULL` | Snapshot of changed fields after update |
| `changedAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Historical change timestamp |

### 4.10 `saved_views` (`apps/api/src/db/schema/views.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Saved View UUID |
| `name` | `varchar(150)` | `NOT NULL` | View Name |
| `description` | `text` | `NULL` | Optional description |
| `datasetId` | `uuid` | `NOT NULL REFERENCES datasets(id) ON DELETE CASCADE` | Target Dataset |
| `userId` | `uuid` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owner user |
| `searchQuery` | `varchar(500)` | `NOT NULL DEFAULT ''` | Global search term |
| `searchMode` | `varchar(20)` | `NOT NULL DEFAULT 'fts'` | `'fts' \| 'partial' \| 'exact'` |
| `filters` | `jsonb` | `NOT NULL DEFAULT '[]'` | Array of `FilterCondition` objects |
| `sorting` | `jsonb` | `NOT NULL DEFAULT '[]'` | Array of `SortRule` objects |
| `visibleColumns` | `jsonb` | `NOT NULL DEFAULT '[]'` | Ordered array of visible `fieldKey` strings |
| `isShared` | `boolean` | `NOT NULL DEFAULT false` | Whether shared with team members |
| `sharedWithRoles` | `jsonb` | `NOT NULL DEFAULT '[]'` | Roles allowed to access (`['ANALYST', 'VIEWER']`) |
| `createdAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Created Date |
| `updatedAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Updated Date |

### 4.11 `search_history` (`apps/api/src/db/schema/views.ts`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | History entry UUID |
| `userId` | `uuid` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Executing user |
| `datasetId` | `uuid` | `NOT NULL REFERENCES datasets(id) ON DELETE CASCADE` | Target dataset |
| `searchQuery` | `varchar(500)` | `NOT NULL DEFAULT ''` | Search term |
| `filters` | `jsonb` | `NOT NULL DEFAULT '[]'` | Executed filter conditions |
| `sorting` | `jsonb` | `NOT NULL DEFAULT '[]'` | Executed sorting rules |
| `resultCount` | `integer` | `NOT NULL DEFAULT 0` | Matching records count |
| `executionTimeMs` | `integer` | `NOT NULL DEFAULT 0` | Server query latency in milliseconds |
| `executedAt` | `timestamptz` | `NOT NULL DEFAULT now()` | Execution timestamp |

---

## 5. REST API Contract Specification (`/api/v1`)

All endpoints return a standardized JSON envelope defined in `packages/shared/src/types/api.types.ts`:
```ts
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    totalRecords?: number;
    totalPages?: number;
    nextCursor?: string | null;
    executionTimeMs?: number;
    cacheHit?: boolean;
  };
}
```

### 5.1 Authentication & Users
- `POST /api/v1/auth/register` — Register new user, set `HttpOnly` JWT cookies.
- `POST /api/v1/auth/login` — Authenticate credentials, set `ds_access_token` & `ds_refresh_token` `HttpOnly` cookies.
- `POST /api/v1/auth/refresh` — Rotate access token using `ds_refresh_token`.
- `POST /api/v1/auth/logout` — Clear auth cookies.
- `GET /api/v1/auth/me` — Return authenticated user profile, role, permissions, and `user_preferences`.
- `GET /api/v1/users` *(Admin only)* — List platform users with roles.
- `PATCH /api/v1/users/:id/role` *(Admin only)* — Change user role or active status.
- `PUT /api/v1/users/me/preferences` — Update current user's UI/table preferences.

### 5.2 Datasets & Permissions
- `GET /api/v1/datasets` — List datasets authorized for current user's role/user ID.
- `POST /api/v1/datasets` *(Admin only)* — Create dataset & field definitions.
- `GET /api/v1/datasets/:id` — Get dataset metadata, `dataset_fields`, and current user's effective permissions.
- `PATCH /api/v1/datasets/:id` *(Admin only)* — Update dataset metadata.
- `GET /api/v1/datasets/:id/permissions` *(Admin only)* — List dataset access permissions.
- `PUT /api/v1/datasets/:id/permissions` *(Admin only)* — Configure role/user access permissions for dataset.

### 5.3 Records Search, Explorer & Record Details
- `POST /api/v1/datasets/:id/records/search` — Execute high-performance server-side search, multi-condition filtering, multi-column sorting, and pagination (supports both `offset` and `cursor` pagination modes). Automatically records entry in `search_history` when triggered by user search action.
- `GET /api/v1/datasets/:id/records/:recordId` — Fetch complete record details, `record_relationships` (with joined target record summaries), and `record_history` audit trail.

### 5.4 Saved Views & Search History
- `GET /api/v1/saved-views?datasetId=...` — List user's own views + views shared with user's role for authorized datasets.
- `POST /api/v1/saved-views` *(Admin & Analyst)* — Create saved view.
- `PATCH /api/v1/saved-views/:id` *(Owner or Admin)* — Update saved view or sharing settings.
- `DELETE /api/v1/saved-views/:id` *(Owner or Admin)* — Delete saved view.
- `GET /api/v1/search-history?datasetId=...&limit=50` — Fetch recent search queries for current user.
- `DELETE /api/v1/search-history` — Clear user's search history.

### 5.5 Analytics (Backend SQL Aggregations)
- `GET /api/v1/analytics/overview?datasetId=...` — Returns aggregated metrics calculated via PostgreSQL `GROUP BY` and window functions:
  - `totalRecords`, `activeRecords`, `totalRevenue`, `averageRiskScore`
  - `recordsByCategory`: `Array<{ category: string; count: number; totalRevenue: number }>`
  - `recordsByStatus`: `Array<{ status: string; count: number; percentage: number }>`
  - `dataGrowthTrends`: `Array<{ month: string; recordsCreated: number; cumulativeRecords: number }>`
  - `searchActivity`: `Array<{ date: string; queryCount: number; avgExecutionTimeMs: number }>`
  - `mostFrequentFilters`: `Array<{ fieldKey: string; operator: string; usageCount: number }>`

---

## 6. Frontend Architecture & Redux Toolkit Specification (Sections 6, 7, 10)

### 6.1 Five Mandatory Redux Slices (`apps/web/src/store/slices/`)
1. **`authSlice.ts`**:
   - State: `{ user: AuthUser | null; isAuthenticated: boolean; isInitialized: boolean }`
2. **`datasetSlice.ts`**:
   - State: `{ activeDatasetId: string | null; columnVisibility: Record<string, Record<string, boolean>>; columnSizing: Record<string, Record<string, number>>; selectedRowIds: string[] }`
3. **`searchConfigSlice.ts`**:
   - State: `{ globalQuery: string; searchMode: 'fts' | 'partial' | 'exact'; filters: FilterCondition[]; logicOperator: 'AND' | 'OR'; sorting: SortRule[]; pagination: { page: number; pageSize: number; mode: 'offset' | 'cursor'; cursor: string | null } }`
4. **`savedViewsSlice.ts`**:
   - State: `{ activeViewId: string | null; isDirty: boolean; isSaveModalOpen: boolean; isShareModalOpen: boolean }`
5. **`uiPreferencesSlice.ts`**:
   - State: `{ sidebarCollapsed: boolean; tableDensity: 'compact' | 'comfortable' | 'spacious'; activeDetailRecordId: string | null; isFilterDrawerOpen: boolean; theme: 'dark' | 'light' }`

### 6.2 Strict Rule: No Raw Datasets in Redux Slices
Raw dataset records (`DatasetRecord[]`) must **only** reside in RTK Query's managed cache (`recordsApi`), keyed by the serialized search parameters. Redux client slices store **configuration, selection IDs, and UI state only**.
