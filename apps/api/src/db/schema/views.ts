import type { FilterCondition, RoleName, SortRule } from '@datascope/shared';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { datasets } from './datasets.js';
import { users } from './users.js';

export const savedViews = pgTable(
  'saved_views',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    searchQuery: varchar('search_query', { length: 500 }).notNull().default(''),
    searchMode: varchar('search_mode', { length: 20 }).notNull().default('fts'),
    filters: jsonb('filters').$type<FilterCondition[]>().notNull().default([]),
    sorting: jsonb('sorting').$type<SortRule[]>().notNull().default([]),
    visibleColumns: jsonb('visible_columns').$type<string[]>().notNull().default([]),
    isShared: boolean('is_shared').notNull().default(false),
    sharedWithRoles: jsonb('shared_with_roles').$type<RoleName[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_saved_views_dataset_user').on(table.datasetId, table.userId),
    index('idx_saved_views_shared').on(table.datasetId, table.isShared),
  ]
);

export const searchHistory = pgTable(
  'search_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    searchQuery: varchar('search_query', { length: 500 }).notNull().default(''),
    filters: jsonb('filters').$type<FilterCondition[]>().notNull().default([]),
    sorting: jsonb('sorting').$type<SortRule[]>().notNull().default([]),
    resultCount: integer('result_count').notNull().default(0),
    executionTimeMs: integer('execution_time_ms').notNull().default(0),
    executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_search_history_user_executed').on(table.userId, table.executedAt),
    index('idx_search_history_dataset_executed').on(table.datasetId, table.executedAt),
  ]
);
