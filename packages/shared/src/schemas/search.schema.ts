import { z } from 'zod';
import { FILTER_OPERATORS, SEARCH_MODES } from '../constants/operators.js';

/**
 * Safe field identifier validation to prevent SQL injection via dynamic field keys.
 */
export const safeFieldKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid field identifier');

export const filterOperatorSchema = z.enum([
  FILTER_OPERATORS.EQ,
  FILTER_OPERATORS.NEQ,
  FILTER_OPERATORS.CONTAINS,
  FILTER_OPERATORS.STARTS_WITH,
  FILTER_OPERATORS.GT,
  FILTER_OPERATORS.GTE,
  FILTER_OPERATORS.LT,
  FILTER_OPERATORS.LTE,
  FILTER_OPERATORS.BETWEEN,
  FILTER_OPERATORS.IN,
  FILTER_OPERATORS.LAST_N_DAYS,
]);

export const filterPrimitiveValueSchema = z.union([
  z.string().max(500),
  z.number(),
  z.boolean(),
]);

export const filterValueSchema = z.union([
  filterPrimitiveValueSchema,
  z.array(z.union([z.string().max(500), z.number()])).max(100),
  z.tuple([
    z.union([z.string().max(100), z.number()]),
    z.union([z.string().max(100), z.number()]),
  ]),
]);

export const filterConditionSchema = z.object({
  id: z.string().max(64).optional(),
  field: safeFieldKeySchema,
  operator: filterOperatorSchema,
  value: filterValueSchema,
});

export const sortRuleSchema = z.object({
  field: safeFieldKeySchema,
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const searchModeSchema = z.enum([
  SEARCH_MODES.FTS,
  SEARCH_MODES.PARTIAL,
  SEARCH_MODES.EXACT,
]);

export const paginationModeSchema = z.enum(['offset', 'cursor']);

export const searchQueryRequestSchema = z.object({
  searchQuery: z.string().trim().max(500).optional().default(''),
  searchMode: searchModeSchema.optional().default(SEARCH_MODES.FTS),
  searchFields: z.array(safeFieldKeySchema).max(20).optional(),
  filters: z.array(filterConditionSchema).max(30).optional().default([]),
  logicOperator: z.enum(['AND', 'OR']).optional().default('AND'),
  sorting: z.array(sortRuleSchema).max(5).optional().default([
    { field: 'createdAt', direction: 'desc' },
  ]),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  pageSize: z.coerce.number().int().min(10).max(500).optional().default(50),
  paginationMode: paginationModeSchema.optional().default('offset'),
  cursor: z.string().max(256).nullable().optional().default(null),
  recordHistoryLog: z.boolean().optional().default(true),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;
export type SortRule = z.infer<typeof sortRuleSchema>;
export type SearchQueryRequest = z.infer<typeof searchQueryRequestSchema>;
