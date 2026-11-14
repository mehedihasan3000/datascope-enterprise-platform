import { searchQueryRequestSchema } from '@datascope/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireDatasetPermission } from '../../middleware/rbac.middleware.js';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import * as searchController from './search.controller.js';

const router = Router({ mergeParams: true });
const datasetIdParamSchema = z.object({
  id: z.string().uuid('Invalid dataset UUID'),
});

router.use(requireAuth);

router.post(
  '/:id/records/search',
  validateParams(datasetIdParamSchema),
  requireDatasetPermission('canSearch', 'id'),
  validateBody(searchQueryRequestSchema),
  searchController.postSearchDatasetRecords
);

export const searchRoutes: Router = router;
