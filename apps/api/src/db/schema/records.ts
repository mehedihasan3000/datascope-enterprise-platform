import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { datasets } from './datasets.js';
import { users } from './users.js';

export const datasetRecords = pgTable(
  'dataset_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    recordCode: varchar('record_code', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    country: varchar('country', { length: 100 }).notNull(),
    revenue: numeric('revenue', { precision: 15, scale: 2 }).notNull().default('0.00'),
    employeeCount: integer('employee_count').notNull().default(0),
    riskScore: numeric('risk_score', { precision: 5, scale: 2 }).notNull().default('0.00'),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    searchText: text('search_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Primary Composite Discovery Index (accelerates Status + Country + Revenue + Date range queries)
    index('idx_records_composite_discovery').on(
      table.datasetId,
      table.status,
      table.country,
      table.revenue,
      table.createdAt
    ),
    // Category & Status Analytics Covering Index
    index('idx_records_dataset_category_status').on(
      table.datasetId,
      table.category,
      table.status
    ),
    // Cursor / Keyset Deep Pagination Index
    index('idx_records_cursor_pagination').on(table.datasetId, table.createdAt, table.id),
    // Exact Lookup Indexes
    index('idx_records_dataset_code').on(table.datasetId, table.recordCode),
    index('idx_records_dataset_revenue').on(table.datasetId, table.revenue),
    index('idx_records_dataset_employees').on(table.datasetId, table.employeeCount),
  ]
);

export const recordRelationships = pgTable(
  'record_relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceRecordId: uuid('source_record_id')
      .notNull()
      .references(() => datasetRecords.id, { onDelete: 'cascade' }),
    targetRecordId: uuid('target_record_id')
      .notNull()
      .references(() => datasetRecords.id, { onDelete: 'cascade' }),
    relationshipType: varchar('relationship_type', { length: 64 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_relationships_source').on(table.sourceRecordId),
    index('idx_relationships_target').on(table.targetRecordId),
  ]
);

export const recordHistory = pgTable(
  'record_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recordId: uuid('record_id')
      .notNull()
      .references(() => datasetRecords.id, { onDelete: 'cascade' }),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changeType: varchar('change_type', { length: 50 }).notNull(),
    summary: varchar('summary', { length: 255 }).notNull(),
    previousValues: jsonb('previous_values').$type<Record<string, unknown> | null>().default(null),
    newValues: jsonb('new_values').$type<Record<string, unknown>>().notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_record_history_record_id').on(table.recordId, table.changedAt),
  ]
);
