# DataScope – Large-Scale Search & Query Optimization Architecture (Section 5)

This document details DataScope's search architecture, database indexing strategy, query compiler design, and the mandatory three-way comparison between **PostgreSQL Full-Text Search**, **PostgreSQL Trigram Search (`pg_trgm`)**, and **External Search Engines (Elasticsearch / OpenSearch)**.

---

## 1. Three-Way Search Engine Investigation & Comparison

| Evaluation Criterion | 1. PostgreSQL Full-Text Search (`tsvector` / `tsquery`) | 2. PostgreSQL Trigram Search (`pg_trgm` GIN) | 3. External Search Engine (Elasticsearch / OpenSearch) |
| :--- | :--- | :--- | :--- |
| **Core Mechanism** | Tokenizes text into normalized lexemes (stemming, stop-word removal) stored in a `tsvector` column with a `GIN` inverted index. | Breaks strings into 3-character sliding windows (trigrams) indexed via `GIN (col gin_trgm_ops)` or `GiST`. | Dedicated distributed inverted index (Apache Lucene) with BM25 scoring, analyzers, and shard replication. |
| **Whole-Word & Stemmed Search** (`"german financial"` -> matches `"Germany"`, `"Finance"`) | **Excellent** (`< 10ms` on 100k–5M rows; supports `ts_rank_cd` and boolean operators `&`, `\|`, `!`, `:*`). | **Fair** (matches character overlap rather than linguistic stems). | **Excellent** (industry standard BM25, synonym rings, multi-language analyzers). |
| **Partial / Substring / Code Match** (`"0482"` -> matches `"ENT-00048291"` or `"BioTech"` -> `"ech"`) | **Limited** (supports prefix `term:*`, but not arbitrary infix `%term%` without scanning). | **Excellent** (accelerates `ILIKE '%term%'` and similarity `%` operator via GIN trigram intersection in `< 20ms`). | **Very Good** (requires `ngram` / `wildcard` field mappings which substantially increase index storage). |
| **Combined Relational Filters + RBAC** (`Status = Active AND Country = Germany AND Revenue > 10000`) | **Native & Atomic** (executes inside the same SQL query plan and ACID transaction as dataset-level RBAC). | **Native & Atomic** (combines seamlessly with B-Tree composite indexes via PostgreSQL `BitmapAnd` index scans). | **Complex** (requires replicating `access_permissions` and all structured fields into the search cluster). |
| **Data Synchronization & Consistency** | **Real-time (`0ms` lag)** — maintained inside PostgreSQL via generated columns or triggers. | **Real-time (`0ms` lag)** — maintained automatically by PostgreSQL GIN index on write. | **Eventual Consistency** — requires dual-writes, outbox queues, or CDC (Debezium/Kafka), risking stale results. |
| **Operational Cost & Infrastructure** | **Zero extra infrastructure** — runs inside existing Managed Cloud PostgreSQL instance. | **Zero extra infrastructure** — uses built-in `CREATE EXTENSION pg_trgm`. | **High** — requires dedicated JVM cluster nodes, memory management, and synchronization pipelines. |
| **Ideal Scale Ceiling** | `100,000` to `~15,000,000` structured records. | `100,000` to `~5,000,000` records (trigram GIN indexes grow larger than `tsvector` indexes). | `10,000,000` to `10,000,000,000+` documents across horizontal shards. |

---

## 2. Selected Approach for DataScope & Justification

### Selected Architecture: **Hybrid PostgreSQL FTS (`tsvector`) + Trigram (`pg_trgm`) + Composite B-Tree & JSONB GIN Indexing**

Rather than choosing only FTS *or* only Trigram search, DataScope implements a **Unified PostgreSQL Hybrid Search Engine** inside `apps/api/src/modules/search/`:

1. **Global Search Mode (`fts` - Default)**:
   - Uses `to_tsvector('english', search_text) @@ websearch_to_tsquery('english', $query)` with prefix matching fallback, ranked by `ts_rank`.
   - Ideal for natural multi-word searches across titles, categories, countries, and descriptions.
2. **Partial / Substring Match Mode (`partial`)**:
   - Uses `pg_trgm` GIN-indexed `search_text ILIKE '%' || $query || '%'` and `record_code ILIKE '%' || $query || '%'`.
   - Ideal when an analyst searches for a partial record code (`"4829"`), SKU fragment, or mid-word substring.
3. **Exact Match Mode (`exact`)**:
   - Uses B-Tree indexed equality `=` on `record_code`, `title`, `status`, or `country`.
4. **Combined Multi-Condition Filter Compiler (`query-builder.ts`)**:
   - Combines global search with arbitrary field-level filter conditions (`eq`, `neq`, `contains`, `startsWith`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `lastNDays`):
     ```sql
     SELECT id, dataset_id, record_code, title, category, status, country, revenue,
            employee_count, risk_score, attributes, created_at, updated_at
     FROM dataset_records
     WHERE dataset_id = $1
       AND status = 'Active'
       AND country = 'Germany'
       AND revenue > 10000
       AND created_at >= NOW() - INTERVAL '30 days'
       AND to_tsvector('english', search_text) @@ websearch_to_tsquery('english', $2)
     ORDER BY revenue DESC, created_at DESC
     LIMIT 50 OFFSET 0;
     ```

### Why This Approach Was Selected
1. **Zero Synchronization Anomalies**: All 100,000+ initial records (and millions at scale) remain strictly consistent with `access_permissions` and `datasets`. When an Administrator revokes a role's access to a dataset, search access is revoked in the exact same database transaction.
2. **Cloud PostgreSQL Compatibility**: Both `tsvector` GIN indexes and the `pg_trgm` extension are natively supported out-of-the-box on every major managed cloud PostgreSQL provider (Neon, Supabase, AWS RDS, Google Cloud SQL, Railway, Aiven).
3. **PostgreSQL `BitmapAnd` Execution**: PostgreSQL can intersect a B-Tree index scan on `(dataset_id, status, country, revenue, created_at)` with a GIN index scan on `search_text` in memory using a `BitmapAnd` plan node, returning results in `< 20ms`.

---

## 3. Database Index Definitions (`apps/api/src/db/schema/records.ts`)

1. **Primary Composite Filter & Sort Index (B-Tree)**:
   ```sql
   CREATE INDEX idx_records_composite_discovery
   ON dataset_records (dataset_id, status, country, revenue DESC, created_at DESC);
   ```
2. **Category & Analytics Covering Index (B-Tree)**:
   ```sql
   CREATE INDEX idx_records_dataset_category_status
   ON dataset_records (dataset_id, category, status);
   ```
3. **Keyset / Cursor Deep Pagination Index (B-Tree)**:
   ```sql
   CREATE INDEX idx_records_cursor_pagination
   ON dataset_records (dataset_id, created_at DESC, id DESC);
   ```
4. **Full-Text Search Inverted Index (GIN)**:
   ```sql
   CREATE INDEX idx_records_fts_gin
   ON dataset_records USING GIN (to_tsvector('english', search_text));
   ```
5. **Trigram Partial-Match Index (GIN `pg_trgm`)**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX idx_records_trigram_gin
   ON dataset_records USING GIN (search_text gin_trgm_ops);
   CREATE INDEX idx_records_code_trigram_gin
   ON dataset_records USING GIN (record_code gin_trgm_ops);
   ```
6. **Dynamic JSONB Attributes Index (GIN `jsonb_path_ops`)**:
   ```sql
   CREATE INDEX idx_records_attributes_gin
   ON dataset_records USING GIN (attributes jsonb_path_ops);
   ```

---

## 4. When Our Selected Approach Stops Being Sufficient (Scale Thresholds)

While PostgreSQL FTS + `pg_trgm` + Composite B-Tree indexes easily handle `100,000` to `~10,000,000` records, the architecture will hit inflection points under the following conditions:

1. **Unstructured Text Volume Exceeds `20M–50M` Rows**:
   - **Symptom**: GIN index maintenance overhead slows down high-frequency `INSERT`/`UPDATE` ingestion (`> 5,000 writes/sec`), and `pg_trgm` index size exceeds available RAM buffer cache (`shared_buffers`), causing disk I/O thrashing.
   - **Mitigation Path**: Partition `dataset_records` by `dataset_id` (`PARTITION BY LIST (dataset_id)`), or offload full-text indexing to an **OpenSearch / Elasticsearch** cluster fed via PostgreSQL Logical Replication (CDC).
2. **Fuzzy Typo Tolerance (Levenshtein Edit Distance `>= 2`) Across Multi-Term Queries**:
   - **Symptom**: `pg_trgm` similarity `%` across millions of long text strings requires scanning large posting lists when users make multiple spelling errors.
   - **Mitigation Path**: Introduce OpenSearch with BM25 + `fuzziness: "AUTO"` while keeping PostgreSQL as the system of record.
3. **Deep Faceted Aggregations Across 20+ Dynamic Dimensions Simultaneously**:
   - **Symptom**: Computing live facet counts across 20 JSONB keys on `50M+` rows in OLTP PostgreSQL competes with transactional CPU.
   - **Mitigation Path**: Add materialized rollup tables refreshed incrementally, or query ClickHouse / DuckDB / OpenSearch aggregations for analytical facets.
