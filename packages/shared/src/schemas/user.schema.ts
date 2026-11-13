import { z } from 'zod';
import { roleNameSchema } from './auth.schema.js';

export const updateUserRoleSchema = z.object({
  role: roleNameSchema,
  isActive: z.boolean().optional(),
});

export const userPreferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  defaultPageSize: z.number().int().min(10).max(500).default(50),
  tableDensity: z.enum(['compact', 'comfortable', 'spacious']).default('compact'),
  defaultDatasetId: z.string().uuid().nullable().optional(),
  columnConfigs: z
    .record(
      z.string(),
      z.object({
        visibleColumns: z.array(z.string()).optional(),
        columnSizing: z.record(z.string(), z.number()).optional(),
      })
    )
    .optional()
    .default({}),
});

export const updateUserPreferencesSchema = userPreferencesSchema.partial();

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
