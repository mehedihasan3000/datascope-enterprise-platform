/**
 * DataScope Search Modes, Field Data Types & Dynamic Filter Operators
 * Covers Section 3.C (Advanced Search) & Section 5 (Large-Scale Search)
 */

export const SEARCH_MODES = {
  FTS: 'fts', // PostgreSQL Full-Text Search (tsvector / websearch_to_tsquery)
  PARTIAL: 'partial', // PostgreSQL Trigram Search (pg_trgm ILIKE %term%)
  EXACT: 'exact', // Exact field equality match
} as const;

export type SearchMode = (typeof SEARCH_MODES)[keyof typeof SEARCH_MODES];

export const FIELD_DATA_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  CURRENCY: 'currency',
  DATE: 'date',
  ENUM: 'enum',
  BOOLEAN: 'boolean',
} as const;

export type FieldDataType = (typeof FIELD_DATA_TYPES)[keyof typeof FIELD_DATA_TYPES];

export const FILTER_OPERATORS = {
  EQ: 'eq', // Equals (=)
  NEQ: 'neq', // Does not equal (!=)
  CONTAINS: 'contains', // Partial match (ILIKE %val%)
  STARTS_WITH: 'startsWith', // Prefix match (ILIKE val%)
  GT: 'gt', // Greater than (>)
  GTE: 'gte', // Greater than or equal (>=)
  LT: 'lt', // Less than (<)
  LTE: 'lte', // Less than or equal (<=)
  BETWEEN: 'between', // Numeric or Date range [min, max]
  IN: 'in', // Value in array of options
  LAST_N_DAYS: 'lastNDays', // Created/Updated within last N days (e.g., Last 30 Days)
} as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[keyof typeof FILTER_OPERATORS];

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'Equals (=)',
  neq: 'Not Equals (≠)',
  contains: 'Contains (Partial)',
  startsWith: 'Starts With',
  gt: 'Greater Than (>)',
  gte: 'Greater or Equal (≥)',
  lt: 'Less Than (<)',
  lte: 'Less or Equal (≤)',
  between: 'Between Range',
  in: 'In List',
  lastNDays: 'In Last N Days',
};

export const ALLOWED_OPERATORS_BY_TYPE: Record<FieldDataType, readonly FilterOperator[]> = {
  string: ['eq', 'neq', 'contains', 'startsWith', 'in'],
  enum: ['eq', 'neq', 'in'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  currency: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'lastNDays'],
  boolean: ['eq'],
};

/**
 * Core indexed columns on `dataset_records` table.
 * Any field key not in this set is safely resolved against `attributes->>fieldKey` (JSONB).
 */
export const CORE_RECORD_COLUMNS = [
  'recordCode',
  'title',
  'category',
  'status',
  'country',
  'revenue',
  'employeeCount',
  'riskScore',
  'createdAt',
  'updatedAt',
] as const;

export type CoreRecordColumn = (typeof CORE_RECORD_COLUMNS)[number];
