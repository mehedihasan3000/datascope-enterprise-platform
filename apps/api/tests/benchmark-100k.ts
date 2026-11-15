import '../src/config/env.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROLES,
  searchQueryRequestSchema,
  type SearchQueryRequest,
} from '@datascope/shared';
import { db, pool } from '../src/db/index.js';
import { datasets, roles, users } from '../src/db/schema/index.js';
import type { AuthenticatedUser } from '../src/middleware/auth.middleware.js';
import {
  getAnalyticsOverview,
  invalidateAnalyticsCache,
} from '../src/modules/analytics/analytics.service.js';
import {
  executeDatasetSearch,
  invalidateDatasetSearchCache,
} from '../src/modules/search/search.service.js';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '../../../docs/PERFORMANCE_BENCHMARKS.md');

interface BenchmarkStats {
  scenario: string;
  mode: string;
  iterations: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  resultCount: number;
  notes: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return Number(sorted[idx]!.toFixed(2));
}

function summarizeTimings(
  scenario: string,
  mode: string,
  samples: number[],
  resultCount: number,
  notes: string
): BenchmarkStats {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    scenario,
    mode,
    iterations: samples.length,
    minMs: Number((sorted[0] ?? 0).toFixed(2)),
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    resultCount,
    notes,
  };
}

async function runColdSearchBenchmark(
  scenario: string,
  datasetId: string,
  user: AuthenticatedUser,
  req: Partial<SearchQueryRequest>,
  notes: string,
  iterations = 10
): Promise<BenchmarkStats> {
  const parsedReq = searchQueryRequestSchema.parse({
    ...req,
    recordHistoryLog: false,
  });
  const samples: number[] = [];
  let totalMatches = 0;

  // Warmup connection/plan
  invalidateDatasetSearchCache(datasetId);
  await executeDatasetSearch(datasetId, parsedReq, user);

  for (let i = 0; i < iterations; i += 1) {
    invalidateDatasetSearchCache(datasetId);
    const start = performance.now();
    const res = await executeDatasetSearch(datasetId, parsedReq, user);
    samples.push(performance.now() - start);
    totalMatches = res.meta.totalRecords;
  }

  return summarizeTimings(scenario, 'Cold DB Query', samples, totalMatches, notes);
}

async function runWarmCacheBenchmark(
  scenario: string,
  datasetId: string,
  user: AuthenticatedUser,
  req: Partial<SearchQueryRequest>,
  notes: string,
  iterations = 25
): Promise<BenchmarkStats> {
  const parsedReq = searchQueryRequestSchema.parse({
    ...req,
    recordHistoryLog: false,
  });
  invalidateDatasetSearchCache(datasetId);
  const seed = await executeDatasetSearch(datasetId, parsedReq, user);

  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await executeDatasetSearch(datasetId, parsedReq, user);
    samples.push(performance.now() - start);
  }

  return summarizeTimings(
    scenario,
    'Warm Server Cache Hit',
    samples,
    seed.meta.totalRecords,
    notes
  );
}

async function runExplainAnalyze(sqlText: string, params: unknown[]): Promise<string> {
  const res = await pool.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sqlText}`,
    params
  );
  return res.rows.map((r) => r['QUERY PLAN']).join('\n');
}

async function main() {
  console.log('📊 Starting DataScope 100,000+ Record Performance Benchmark Runner...');

  const dsRows = await db
    .select()
    .from(datasets)
    .where(eq(datasets.slug, 'global-enterprise-intelligence'))
    .limit(1);

  const primaryDataset = dsRows[0];
  if (!primaryDataset) {
    throw new Error('Primary dataset global-enterprise-intelligence not found. Run pnpm db:seed first.');
  }

  const countCheck = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM dataset_records WHERE dataset_id = $1`,
    [primaryDataset.id]
  );
  const ds1Count = Number.parseInt(countCheck.rows[0]?.count ?? '0', 10);
  if (ds1Count < 100_000) {
    throw new Error(`Expected >= 100,000 rows in primary dataset, found ${ds1Count}`);
  }

  const adminRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      isActive: users.isActive,
      roleId: roles.id,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(roles.name, ROLES.ADMIN))
    .limit(1);

  const adminRow = adminRows[0];
  if (!adminRow) {
    throw new Error('Admin user not found in database.');
  }

  const adminUser: AuthenticatedUser = {
    id: adminRow.id,
    email: adminRow.email,
    fullName: adminRow.fullName,
    role: ROLES.ADMIN,
    roleId: adminRow.roleId,
    permissions: ['*'],
    isActive: adminRow.isActive,
  };

  const pgVersionRes = await pool.query<{ version: string }>('SELECT version()');
  const totalDbRowsRes = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM dataset_records'
  );
  const totalDbRows = Number.parseInt(totalDbRowsRes.rows[0]?.count ?? '0', 10);

  const results: BenchmarkStats[] = [];

  // 1. Global FTS Search (Cold + Warm)
  const ftsQuery: Partial<SearchQueryRequest> = {
    searchQuery: 'Quantum',
    searchMode: 'fts',
    page: 1,
    pageSize: 50,
    paginationMode: 'offset',
  };
  results.push(
    await runColdSearchBenchmark(
      '1. Global Full-Text Search ("Quantum")',
      primaryDataset.id,
      adminUser,
      ftsQuery,
      'GIN tsvector + tsquery prefix index'
    )
  );
  results.push(
    await runWarmCacheBenchmark(
      '2. Global Full-Text Search (Cache Hit)',
      primaryDataset.id,
      adminUser,
      ftsQuery,
      'In-process LRU+TTL cache (120s TTL)'
    )
  );

  // 2. Partial Trigram Search
  results.push(
    await runColdSearchBenchmark(
      '3. Trigram Partial Search ("Synthet")',
      primaryDataset.id,
      adminUser,
      {
        searchQuery: 'Synthet',
        searchMode: 'partial',
        page: 1,
        pageSize: 50,
        paginationMode: 'offset',
      },
      'GIN pg_trgm sub-word ILIKE index'
    )
  );

  // 3. Exact Lookup Search
  results.push(
    await runColdSearchBenchmark(
      '4. Exact Match Lookup ("ENT-050000")',
      primaryDataset.id,
      adminUser,
      {
        searchQuery: 'ENT-050000',
        searchMode: 'exact',
        page: 1,
        pageSize: 50,
        paginationMode: 'offset',
      },
      'B-Tree idx_records_dataset_code'
    )
  );

  // 4. Section 3.C Canonical Combined 4-Condition Filter (Cold + Warm)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const canonicalFilterQuery: Partial<SearchQueryRequest> = {
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
    sorting: [{ field: 'revenue', direction: 'desc' }],
    page: 1,
    pageSize: 50,
    paginationMode: 'offset',
  };
  results.push(
    await runColdSearchBenchmark(
      '5. Section 3.C Combined Filter (AND x4)',
      primaryDataset.id,
      adminUser,
      canonicalFilterQuery,
      'Composite index (dataset,status,country,revenue,created_at)'
    )
  );
  results.push(
    await runWarmCacheBenchmark(
      '6. Section 3.C Combined Filter (Cache Hit)',
      primaryDataset.id,
      adminUser,
      canonicalFilterQuery,
      'TTL cache speedup vs cold PostgreSQL round-trip'
    )
  );

  // 5. Dynamic JSONB Filter + IN
  results.push(
    await runColdSearchBenchmark(
      '7. Dynamic JSONB + Enum IN Filter',
      primaryDataset.id,
      adminUser,
      {
        logicOperator: 'AND',
        filters: [
          { field: 'region', operator: 'eq', value: 'EMEA' },
          { field: 'category', operator: 'in', value: ['FinTech', 'Enterprise SaaS'] },
        ],
        page: 1,
        pageSize: 50,
        paginationMode: 'offset',
      },
      'GIN jsonb_path_ops @> containment'
    )
  );

  // 6. Offset Pagination Page 1 vs Page 50
  results.push(
    await runColdSearchBenchmark(
      '8. Multi-Sort Offset Pagination (Page 1)',
      primaryDataset.id,
      adminUser,
      {
        sorting: [
          { field: 'revenue', direction: 'desc' },
          { field: 'createdAt', direction: 'desc' },
        ],
        page: 1,
        pageSize: 50,
        paginationMode: 'offset',
      },
      'Uses precomputed datasets.total_records metadata'
    )
  );
  results.push(
    await runColdSearchBenchmark(
      '9. Multi-Sort Offset Pagination (Page 50)',
      primaryDataset.id,
      adminUser,
      {
        sorting: [
          { field: 'revenue', direction: 'desc' },
          { field: 'createdAt', direction: 'desc' },
        ],
        page: 50,
        pageSize: 50,
        paginationMode: 'offset',
      },
      'OFFSET 2450 on 100k dataset'
    )
  );

  // 7. Keyset Cursor Deep Pagination (advance 5 cursors)
  invalidateDatasetSearchCache(primaryDataset.id);
  const cursorSamples: number[] = [];
  let cursorToken: string | undefined;
  let cursorRows = 0;
  for (let step = 0; step < 10; step += 1) {
    invalidateDatasetSearchCache(primaryDataset.id);
    const start = performance.now();
    const res = await executeDatasetSearch(
      primaryDataset.id,
      searchQueryRequestSchema.parse({
        paginationMode: 'cursor',
        cursor: cursorToken ?? null,
        pageSize: 50,
        recordHistoryLog: false,
      }),
      adminUser
    );
    cursorSamples.push(performance.now() - start);
    cursorToken = res.meta.nextCursor ?? undefined;
    cursorRows = res.meta.totalRecords;
  }
  results.push(
    summarizeTimings(
      '10. Keyset Cursor Pagination (Sequential)',
      'Cold DB Seek',
      cursorSamples,
      cursorRows,
      'Index seek (created_at, id) < cursor'
    )
  );

  // 8. Backend SQL Analytics Aggregations (Cold vs Warm)
  invalidateAnalyticsCache();
  await getAnalyticsOverview(adminUser, primaryDataset.id); // warmup
  const coldAnalyticsSamples: number[] = [];
  let analyticsTotal = 0;
  for (let i = 0; i < 6; i += 1) {
    invalidateAnalyticsCache();
    const start = performance.now();
    const overview = await getAnalyticsOverview(adminUser, primaryDataset.id);
    coldAnalyticsSamples.push(performance.now() - start);
    analyticsTotal = overview.summary.totalRecords;
  }
  results.push(
    summarizeTimings(
      '11. SQL Analytics Aggregations (6 Panels)',
      'Cold Parallel SQL',
      coldAnalyticsSamples,
      analyticsTotal,
      '6 parallel SQL GROUP BY aggregations'
    )
  );

  const warmAnalyticsSamples: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    await getAnalyticsOverview(adminUser, primaryDataset.id);
    warmAnalyticsSamples.push(performance.now() - start);
  }
  results.push(
    summarizeTimings(
      '12. SQL Analytics Aggregations (Cache Hit)',
      'Warm 60s TTL Cache',
      warmAnalyticsSamples,
      analyticsTotal,
      'In-process analytics aggregation cache'
    )
  );

  // Run EXPLAIN ANALYZE Verification
  const explainFts = await runExplainAnalyze(
    `SELECT id, record_code, title, revenue
     FROM dataset_records
     WHERE dataset_id = $1
       AND to_tsvector('english', search_text) @@ websearch_to_tsquery('english', $2)
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [primaryDataset.id, 'Quantum']
  );

  const explainCanonical = await runExplainAnalyze(
    `SELECT id, record_code, title, revenue, created_at
     FROM dataset_records
     WHERE dataset_id = $1
       AND status = $2
       AND country = $3
       AND revenue > $4
       AND created_at BETWEEN $5::timestamptz AND $6::timestamptz
     ORDER BY revenue DESC, id DESC
     LIMIT 50`,
    [
      primaryDataset.id,
      'Active',
      'Germany',
      10000,
      thirtyDaysAgo.toISOString(),
      now.toISOString(),
    ]
  );

  const explainCursor = await runExplainAnalyze(
    `SELECT id, record_code, title, created_at
     FROM dataset_records
     WHERE dataset_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [primaryDataset.id]
  );

  // Calculate Cache Speedup Factor
  const coldFtsP50 = results[0]!.p50Ms;
  const warmFtsP50 = Math.max(0.01, results[1]!.p50Ms);
  const searchSpeedup = Math.round(coldFtsP50 / warmFtsP50);

  const coldAnalyticsP50 = results[10]!.p50Ms;
  const warmAnalyticsP50 = Math.max(0.01, results[11]!.p50Ms);
  const analyticsSpeedup = Math.round(coldAnalyticsP50 / warmAnalyticsP50);

  const tableRows = results
    .map(
      (r) =>
        `| ${r.scenario} | ${r.mode} | ${r.iterations} | ${r.minMs} ms | **${r.p50Ms} ms** | ${r.p95Ms} ms | ${r.maxMs} ms | ${r.resultCount.toLocaleString()} | ${r.notes} |`
    )
    .join('\n');

  const markdown = `# DataScope Empirical Performance Benchmarks (100,000+ Records)

> **Generated Automatically**: \`${new Date().toISOString()}\` via \`pnpm benchmark\` (\`apps/api/tests/benchmark-100k.ts\`)  
> **Target Environment**: Cloud PostgreSQL (\`${pgVersionRes.rows[0]?.version?.split(',')[0] ?? 'PostgreSQL'}\`)  
> **Dataset Volume Verified**: \`${ds1Count.toLocaleString()}\` records in \`${primaryDataset.name}\` (\`${totalDbRows.toLocaleString()}\` total records across workspace datasets)

---

## 1. End-to-End Query, Pagination, Analytics & Cache Latency

| Scenario | Mode | Runs | Min | p50 (Median) | p95 | Max | Matched Rows | Architecture Note |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
${tableRows}

---

## 2. Empirical Cache Effectiveness & Network Round-Trip Analysis

- **Server Search Result Cache (\`TtlCache\`, 120s TTL, 500-entry LRU)**:
  - Cold Cloud PostgreSQL Full-Text Search (p50): **${coldFtsP50} ms**
  - Warm Server Cache Hit (p50): **${warmFtsP50} ms** (~**${searchSpeedup.toLocaleString()}x** faster by eliminating remote database I/O and query planning overhead)
- **Server Analytics Aggregation Cache (\`analyticsCache\`, 60s TTL)**:
  - Cold 6-Query SQL Aggregation across ${ds1Count.toLocaleString()}+ records (p50): **${coldAnalyticsP50} ms**
  - Warm Analytics Cache Hit (p50): **${warmAnalyticsP50} ms** (~**${analyticsSpeedup.toLocaleString()}x** faster for dashboard switches & revisit traffic)
- **Frontend Request Efficiency**:
  - \`useDebounce(300ms)\` prevents per-keystroke query floods when typing multi-word queries (e.g., typing a 10-character term emits 1 API call instead of 10).
  - RTK Query \`apiSlice\` deduplicates concurrent identical component subscriptions in-flight and caches paginated views per \`(datasetId, filters, sorting, page, pageSize)\` key (\`keepUnusedDataFor: 120s\`).
  - \`EnterpriseDataTable\` uses \`@tanstack/react-virtual\` row virtualization (\`overscan: 10\`), mounting only the ~15–22 visible DOM rows rather than rendering all 50–250 rows simultaneously.

---

## 3. PostgreSQL \`EXPLAIN (ANALYZE, BUFFERS)\` Query Plan Verification

### 3.1 Global Full-Text Search (\`to_tsvector\` + GIN Index)
\`\`\`text
${explainFts}
\`\`\`

### 3.2 Section 3.C Canonical 4-Condition Combined Filter (\`status = Active AND country = Germany AND revenue > 10000 AND created_at BETWEEN ...\`)
\`\`\`text
${explainCanonical}
\`\`\`

### 3.3 Keyset Cursor Pagination Seek (\`ORDER BY created_at DESC, id DESC LIMIT 50\`)
\`\`\`text
${explainCursor}
\`\`\`
`;

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, markdown, 'utf8');

  console.log(`✅ Benchmark complete! Report written to ${OUTPUT_PATH}`);
  console.table(
    results.map((r) => ({
      Scenario: r.scenario,
      Mode: r.mode,
      'p50 (ms)': r.p50Ms,
      'p95 (ms)': r.p95Ms,
      Matches: r.resultCount,
    }))
  );
}

main()
  .catch((err) => {
    console.error('❌ Benchmark runner failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
