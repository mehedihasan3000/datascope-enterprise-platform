import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireDatasetPermission } from '../../middleware/rbac.middleware.js';
import { validateParams } from '../../middleware/validate.middleware.js';
import * as recordsController from './records.controller.js';

const datasetRecordParamsSchema = z.object({
  id: z.string().uuid('Invalid dataset UUID'),
  recordId: z.string().uuid('Invalid record UUID'),
});

const directRecordParamsSchema = z.object({
  recordId: z.string().uuid('Invalid record UUID'),
});

// Mounted under /api/v1/datasets (`/:id/records/:recordId`)
export const datasetRecordsRoutes: Router = Router({ mergeParams: true });
datasetRecordsRoutes.use(requireAuth);
datasetRecordsRoutes.get(
  '/:id/records/:recordId',
  validateParams(datasetRecordParamsSchema),
  requireDatasetPermission('canView', 'id'),
  recordsController.getDatasetRecordById
);

// Mounted under /api/v1/records (`/:recordId`)
export const standaloneRecordsRoutes: Router = Router();
standaloneRecordsRoutes.use(requireAuth);
standaloneRecordsRoutes.get(
  '/:recordId',
  validateParams(directRecordParamsSchema),
  recordsController.getDatasetRecordById
);
