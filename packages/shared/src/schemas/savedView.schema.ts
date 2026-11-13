import { z } from 'zod';
import { roleNameSchema } from './auth.schema.js';
import {
  filterConditionSchema,
  safeFieldKeySchema,
  searchModeSchema,
  sortRuleSchema,
} from './search.schema.js';

export const createSavedViewSchema = z.object({
  name: z.string().trim().min(2, 'View name must be at least 2 characters').max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  datasetId: z.string().uuid('Valid datasetId is required'),
  searchQuery: z.string().trim().max(500).default(''),
  searchMode: searchModeSchema.default('fts'),
  filters: z.array(filterConditionSchema).max(30).default([]),
  sorting: z.array(sortRuleSchema).max(5).default([]),
  visibleColumns: z.array(safeFieldKeySchema).max(50).default([]),
  isShared: z.boolean().default(false),
  sharedWithRoles: z.array(roleNameSchema).default([]),
});

export const updateSavedViewSchema = createSavedViewSchema.partial().omit({
  datasetId: true,
});

export const shareSavedViewSchema = z.object({
  isShared: z.boolean(),
  sharedWithRoles: z.array(roleNameSchema).default([]),
});

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
export type ShareSavedViewInput = z.infer<typeof shareSavedViewSchema>;
