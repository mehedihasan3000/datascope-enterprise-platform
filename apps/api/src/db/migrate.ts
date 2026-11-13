import { pool } from './index.js';

const MIGRATION_SQL = `
-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(50) NOT NULL UNIQUE,
  "description" text NOT NULL,
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "full_name" varchar(150) NOT NULL,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_users_role_id" ON "users" ("role_id");
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");

-- 4. User Preferences Table
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "theme" varchar(20) NOT NULL DEFAULT 'dark',
  "default_page_size" integer NOT NULL DEFAULT 50,
  "table_density" varchar(20) NOT NULL DEFAULT 'compact',
  "default_dataset_id" uuid,
  "column_configs" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 5. Datasets Table
CREATE TABLE IF NOT EXISTS "datasets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(200) NOT NULL,
  "slug" varchar(200) NOT NULL UNIQUE,
  "description" text NOT NULL,
  "category" varchar(100) NOT NULL,
  "data_source" varchar(150) NOT NULL,
  "total_records" integer NOT NULL DEFAULT 0,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_datasets_category" ON "datasets" ("category");
CREATE INDEX IF NOT EXISTS "idx_datasets_created_by" ON "datasets" ("created_by");

-- 6. Dataset Fields Table
CREATE TABLE IF NOT EXISTS "dataset_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dataset_id" uuid NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "field_key" varchar(100) NOT NULL,
  "display_name" varchar(150) NOT NULL,
  "data_type" varchar(30) NOT NULL,
  "is_core_column" boolean NOT NULL DEFAULT false,
  "is_sortable" boolean NOT NULL DEFAULT true,
  "is_filterable" boolean NOT NULL DEFAULT true,
  "is_searchable" boolean NOT NULL DEFAULT true,
  "is_default_visible" boolean NOT NULL DEFAULT true,
  "enum_values" jsonb DEFAULT null,
  "sort_order" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "idx_dataset_fields_dataset_id" ON "dataset_fields" ("dataset_id", "sort_order");

-- 7. Access Permissions Table
CREATE TABLE IF NOT EXISTS "access_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dataset_id" uuid NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "role_id" uuid REFERENCES "roles"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "can_view" boolean NOT NULL DEFAULT true,
  "can_search" boolean NOT NULL DEFAULT true,
  "can_export" boolean NOT NULL DEFAULT false,
  "can_manage" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_access_permissions_dataset_role" ON "access_permissions" ("dataset_id", "role_id");
CREATE INDEX IF NOT EXISTS "idx_access_permissions_dataset_user" ON "access_permissions" ("dataset_id", "user_id");

-- 8. Dataset Records Table (100k+ to Multi-Million Rows)
CREATE TABLE IF NOT EXISTS "dataset_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dataset_id" uuid NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "record_code" varchar(64) NOT NULL,
  "title" varchar(255) NOT NULL,
  "category" varchar(100) NOT NULL,
  "status" varchar(50) NOT NULL,
  "country" varchar(100) NOT NULL,
  "revenue" numeric(15, 2) NOT NULL DEFAULT 0.00,
  "employee_count" integer NOT NULL DEFAULT 0,
  "risk_score" numeric(5, 2) NOT NULL DEFAULT 0.00,
  "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "search_text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- B-Tree Composite & Analytical Indexes on dataset_records
CREATE INDEX IF NOT EXISTS "idx_records_composite_discovery"
  ON "dataset_records" ("dataset_id", "status", "country", "revenue", "created_at");
CREATE INDEX IF NOT EXISTS "idx_records_dataset_category_status"
  ON "dataset_records" ("dataset_id", "category", "status");
CREATE INDEX IF NOT EXISTS "idx_records_cursor_pagination"
  ON "dataset_records" ("dataset_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "idx_records_dataset_code"
  ON "dataset_records" ("dataset_id", "record_code");
CREATE INDEX IF NOT EXISTS "idx_records_dataset_revenue"
  ON "dataset_records" ("dataset_id", "revenue");
CREATE INDEX IF NOT EXISTS "idx_records_dataset_employees"
  ON "dataset_records" ("dataset_id", "employee_count");

-- GIN Full-Text Search (tsvector), Trigram (pg_trgm), and JSONB Indexes
CREATE INDEX IF NOT EXISTS "idx_records_fts_gin"
  ON "dataset_records" USING GIN (to_tsvector('english', "search_text"));
CREATE INDEX IF NOT EXISTS "idx_records_trigram_gin"
  ON "dataset_records" USING GIN ("search_text" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_records_code_trigram_gin"
  ON "dataset_records" USING GIN ("record_code" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_records_attributes_gin"
  ON "dataset_records" USING GIN ("attributes" jsonb_path_ops);

-- 9. Record Relationships Table
CREATE TABLE IF NOT EXISTS "record_relationships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_record_id" uuid NOT NULL REFERENCES "dataset_records"("id") ON DELETE CASCADE,
  "target_record_id" uuid NOT NULL REFERENCES "dataset_records"("id") ON DELETE CASCADE,
  "relationship_type" varchar(64) NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_relationships_source" ON "record_relationships" ("source_record_id");
CREATE INDEX IF NOT EXISTS "idx_relationships_target" ON "record_relationships" ("target_record_id");

-- 10. Record History (Audit Trail) Table
CREATE TABLE IF NOT EXISTS "record_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "record_id" uuid NOT NULL REFERENCES "dataset_records"("id") ON DELETE CASCADE,
  "changed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "change_type" varchar(50) NOT NULL,
  "summary" varchar(255) NOT NULL,
  "previous_values" jsonb DEFAULT null,
  "new_values" jsonb NOT NULL,
  "changed_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_record_history_record_id" ON "record_history" ("record_id", "changed_at" DESC);

-- 11. Saved Views Table
CREATE TABLE IF NOT EXISTS "saved_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(150) NOT NULL,
  "description" text,
  "dataset_id" uuid NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "search_query" varchar(500) NOT NULL DEFAULT '',
  "search_mode" varchar(20) NOT NULL DEFAULT 'fts',
  "filters" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sorting" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "visible_columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_shared" boolean NOT NULL DEFAULT false,
  "shared_with_roles" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_saved_views_dataset_user" ON "saved_views" ("dataset_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_saved_views_shared" ON "saved_views" ("dataset_id", "is_shared");

-- 12. Search History Table
CREATE TABLE IF NOT EXISTS "search_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "dataset_id" uuid NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "search_query" varchar(500) NOT NULL DEFAULT '',
  "filters" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sorting" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "result_count" integer NOT NULL DEFAULT 0,
  "execution_time_ms" integer NOT NULL DEFAULT 0,
  "executed_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_search_history_user_executed" ON "search_history" ("user_id", "executed_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_search_history_dataset_executed" ON "search_history" ("dataset_id", "executed_at" DESC);
`;

export async function runMigrations(): Promise<void> {
  const start = performance.now();
  console.log('🚀 Connecting to Cloud PostgreSQL and applying DataScope schema & indexes...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(MIGRATION_SQL);
    await client.query('COMMIT');
    const elapsed = Math.round(performance.now() - start);
    console.log(`✅ Database schema and specialized B-Tree/GIN/Trigram indexes migrated in ${elapsed}ms.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Execute when run directly via `pnpm --filter @datascope/api db:migrate`
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
