import { z } from 'zod';
import { FIELD_DATA_TYPES } from '../constants/operators.js';

export const fieldDataTypeSchema = z.enum([
  FIELD_DATA_TYPES.STRING,
  FIELD_DATA_TYPES.NUMBER,
  FIELD_DATA_TYPES.CURRENCY,
  FIELD_DATA_TYPES.DATE,
  FIELD_DATA_TYPES.ENUM,
  FIELD_DATA_TYPES.BOOLEAN,
]);

export const datasetFieldInputSchema = z.object({
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field key must be alphanumeric/camelCase'),
  displayName: z.string().trim().min(1).max(150),
  dataType: fieldDataTypeSchema,
  isCoreColumn: z.boolean().default(false),
  isSortable: z.boolean().default(true),
  isFilterable: z.boolean().default(true),
  isSearchable: z.boolean().default(true),
  isDefaultVisible: z.boolean().default(true),
  enumValues: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const createDatasetSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  description: z.string().trim().min(5).max(2000),
  category: z.string().trim().min(2).max(100),
  dataSource: z.string().trim().min(2).max(150),
  fields: z.array(datasetFieldInputSchema).optional(),
});

export const updateDatasetSchema = createDatasetSchema.partial();

export const accessPermissionEntrySchema = z
  .object({
    roleId: z.string().uuid().nullable().optional(),
    userId: z.string().uuid().nullable().optional(),
    canView: z.boolean().default(true),
    canSearch: z.boolean().default(true),
    canExport: z.boolean().default(false),
    canManage: z.boolean().default(false),
  })
  .refine((data) => Boolean(data.roleId || data.userId), {
    message: 'Either roleId or userId must be specified for an access permission grant',
  });

export const updateDatasetPermissionsSchema = z.object({
  permissions: z.array(accessPermissionEntrySchema).min(1),
});

export type DatasetFieldInput = z.infer<typeof datasetFieldInputSchema>;
export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;
export type UpdateDatasetInput = z.infer<typeof updateDatasetSchema>;
export type AccessPermissionEntryInput = z.infer<typeof accessPermissionEntrySchema>;
export type UpdateDatasetPermissionsInput = z.infer<typeof updateDatasetPermissionsSchema>;
