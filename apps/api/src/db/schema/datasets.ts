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
import { roles, users } from './users.js';

export const datasets = pgTable(
  'datasets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    description: text('description').notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    dataSource: varchar('data_source', { length: 150 }).notNull(),
    totalRecords: integer('total_records').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_datasets_category').on(table.category),
    index('idx_datasets_created_by').on(table.createdBy),
  ]
);

export const datasetFields = pgTable(
  'dataset_fields',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    fieldKey: varchar('field_key', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 150 }).notNull(),
    dataType: varchar('data_type', { length: 30 }).notNull(),
    isCoreColumn: boolean('is_core_column').notNull().default(false),
    isSortable: boolean('is_sortable').notNull().default(true),
    isFilterable: boolean('is_filterable').notNull().default(true),
    isSearchable: boolean('is_searchable').notNull().default(true),
    isDefaultVisible: boolean('is_default_visible').notNull().default(true),
    enumValues: jsonb('enum_values').$type<string[] | null>().default(null),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('idx_dataset_fields_dataset_id').on(table.datasetId, table.sortOrder),
  ]
);

export const accessPermissions = pgTable(
  'access_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    canView: boolean('can_view').notNull().default(true),
    canSearch: boolean('can_search').notNull().default(true),
    canExport: boolean('can_export').notNull().default(false),
    canManage: boolean('can_manage').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_access_permissions_dataset_role').on(table.datasetId, table.roleId),
    index('idx_access_permissions_dataset_user').on(table.datasetId, table.userId),
  ]
);
