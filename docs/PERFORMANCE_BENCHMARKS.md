# DataScope Empirical Performance Benchmarks (100,000+ Records)

> **Generated Automatically**: `2026-11-16T06:58:40.108Z` via `pnpm benchmark` (`apps/api/tests/benchmark-100k.ts`)  
> **Target Environment**: Cloud PostgreSQL (`PostgreSQL 18.7 (a21afb5) on aarch64-unknown-linux-gnu`)  
> **Dataset Volume Verified**: `100,000` records in `Global Enterprise Intelligence Directory` (`104,000` total records across workspace datasets)

---

## 1. End-to-End Query, Pagination, Analytics & Cache Latency

| Scenario | Mode | Runs | Min | p50 (Median) | p95 | Max | Matched Rows | Architecture Note |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| 1. Global Full-Text Search ("Quantum") | Cold DB Query | 10 | 106.12 ms | **110.25 ms** | 167.95 ms | 167.95 ms | 3,125 | GIN tsvector + tsquery prefix index |
| 2. Global Full-Text Search (Cache Hit) | Warm Server Cache Hit | 25 | 0.01 ms | **0.01 ms** | 0.03 ms | 0.08 ms | 3,125 | In-process LRU+TTL cache (120s TTL) |
| 3. Trigram Partial Search ("Synthet") | Cold DB Query | 10 | 72.89 ms | **78.5 ms** | 365.93 ms | 365.93 ms | 3,125 | GIN pg_trgm sub-word ILIKE index |
| 4. Exact Match Lookup ("ENT-050000") | Cold DB Query | 10 | 123.06 ms | **126.53 ms** | 140.33 ms | 140.33 ms | 1 | B-Tree idx_records_dataset_code |
| 5. Section 3.C Combined Filter (AND x4) | Cold DB Query | 10 | 59.91 ms | **61.8 ms** | 207.86 ms | 207.86 ms | 831 | Composite index (dataset,status,country,revenue,created_at) |
| 6. Section 3.C Combined Filter (Cache Hit) | Warm Server Cache Hit | 25 | 0.04 ms | **0.05 ms** | 0.09 ms | 0.11 ms | 831 | TTL cache speedup vs cold PostgreSQL round-trip |
| 7. Dynamic JSONB + Enum IN Filter | Cold DB Query | 10 | 71.94 ms | **118.78 ms** | 212.81 ms | 212.81 ms | 16,667 | GIN jsonb_path_ops @> containment |
| 8. Multi-Sort Offset Pagination (Page 1) | Cold DB Query | 10 | 112.44 ms | **118.58 ms** | 129.42 ms | 129.42 ms | 100,000 | Uses precomputed datasets.total_records metadata |
| 9. Multi-Sort Offset Pagination (Page 50) | Cold DB Query | 10 | 64.93 ms | **117.53 ms** | 253.04 ms | 253.04 ms | 100,000 | OFFSET 2450 on 100k dataset |
| 10. Keyset Cursor Pagination (Sequential) | Cold DB Seek | 10 | 64.01 ms | **115.23 ms** | 126.35 ms | 126.35 ms | 100,000 | Index seek (created_at, id) < cursor |
| 11. SQL Analytics Aggregations (6 Panels) | Cold Parallel SQL | 6 | 372.86 ms | **393.29 ms** | 408.31 ms | 408.31 ms | 100,000 | 6 parallel SQL GROUP BY aggregations |
| 12. SQL Analytics Aggregations (Cache Hit) | Warm 60s TTL Cache | 20 | 115.97 ms | **117.62 ms** | 127.64 ms | 133.72 ms | 100,000 | In-process analytics aggregation cache |

---

## 2. Empirical Cache Effectiveness & Network Round-Trip Analysis

- **Server Search Result Cache (`TtlCache`, 120s TTL, 500-entry LRU)**:
  - Cold Cloud PostgreSQL Full-Text Search (p50): **110.25 ms**
  - Warm Server Cache Hit (p50): **0.01 ms** (~**11,025x** faster by eliminating remote database I/O and query planning overhead)
- **Server Analytics Aggregation Cache (`analyticsCache`, 60s TTL)**:
  - Cold 6-Query SQL Aggregation across 100,000+ records (p50): **393.29 ms**
  - Warm Analytics Cache Hit (p50): **117.62 ms** (~**3x** faster for dashboard switches & revisit traffic)
- **Frontend Request Efficiency**:
  - `useDebounce(300ms)` prevents per-keystroke query floods when typing multi-word queries (e.g., typing a 10-character term emits 1 API call instead of 10).
  - RTK Query `apiSlice` deduplicates concurrent identical component subscriptions in-flight and caches paginated views per `(datasetId, filters, sorting, page, pageSize)` key (`keepUnusedDataFor: 120s`).
  - `EnterpriseDataTable` uses `@tanstack/react-virtual` row virtualization (`overscan: 10`), mounting only the ~15–22 visible DOM rows rather than rendering all 50–250 rows simultaneously.

---

## 3. PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` Query Plan Verification

### 3.1 Global Full-Text Search (`to_tsvector` + GIN Index)
```text
Limit  (cost=0.42..798.65 rows=50 width=70) (actual time=10.395..12.272 rows=50.00 loops=1)
  Buffers: shared hit=1326
  ->  Index Scan using idx_records_cursor_pagination on dataset_records  (cost=0.42..48277.36 rows=3024 width=70) (actual time=10.394..12.265 rows=50.00 loops=1)
        Index Cond: (dataset_id = 'f80ce9ec-5ced-413c-94ce-6e6b9ebed4fd'::uuid)
        Filter: (to_tsvector('english'::regconfig, search_text) @@ '''quantum'''::tsquery)
        Rows Removed by Filter: 1256
        Index Searches: 1
        Buffers: shared hit=1326
Planning:
  Buffers: shared hit=57
Planning Time: 1.049 ms
Execution Time: 12.307 ms
```

### 3.2 Section 3.C Canonical 4-Condition Combined Filter (`status = Active AND country = Germany AND revenue > 10000 AND created_at BETWEEN ...`)
```text
Limit  (cost=3.86..177.54 rows=50 width=70) (actual time=0.152..0.188 rows=50.00 loops=1)
  Buffers: shared hit=65
  ->  Incremental Sort  (cost=3.86..1337.68 rows=384 width=70) (actual time=0.151..0.182 rows=50.00 loops=1)
        Sort Key: revenue DESC, id DESC
        Presorted Key: revenue
        Full-sort Groups: 2  Sort Method: quicksort  Average Memory: 29kB  Peak Memory: 29kB
        Buffers: shared hit=65
        ->  Index Scan Backward using idx_records_composite_discovery on dataset_records  (cost=0.42..1320.40 rows=384 width=70) (actual time=0.057..0.137 rows=51.00 loops=1)
              Index Cond: ((dataset_id = 'f80ce9ec-5ced-413c-94ce-6e6b9ebed4fd'::uuid) AND ((status)::text = 'Active'::text) AND ((country)::text = 'Germany'::text) AND (revenue > '10000'::numeric) AND (created_at >= '2026-10-17 06:58:27.954+00'::timestamp with time zone) AND (created_at <= '2026-11-16 06:58:27.954+00'::timestamp with time zone))
              Index Searches: 1
              Buffers: shared hit=56
Planning:
  Buffers: shared hit=14
Planning Time: 0.193 ms
Execution Time: 0.216 ms
```

### 3.3 Keyset Cursor Pagination Seek (`ORDER BY created_at DESC, id DESC LIMIT 50`)
```text
Limit  (cost=0.42..11.93 rows=50 width=62) (actual time=0.023..0.104 rows=50.00 loops=1)
  Buffers: shared hit=54
  ->  Index Scan using idx_records_cursor_pagination on dataset_records  (cost=0.42..23024.08 rows=100013 width=62) (actual time=0.022..0.099 rows=50.00 loops=1)
        Index Cond: (dataset_id = 'f80ce9ec-5ced-413c-94ce-6e6b9ebed4fd'::uuid)
        Index Searches: 1
        Buffers: shared hit=54
Planning Time: 0.120 ms
Execution Time: 0.129 ms
```
