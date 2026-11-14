import {
  createDatasetSchema,
  ROLES,
  updateDatasetPermissionsSchema,
  updateDatasetSchema,
} from '@datascope/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  requireDatasetPermission,
  requireRole,
} from '../../middleware/rbac.middleware.js';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import * as datasetsController from './datasets.controller.js';

const router = Router();
const idParamSchema = z.object({ id: z.string().uuid('Invalid dataset UUID') });

router.use(requireAuth);

router.get('/', datasetsController.getDatasets);
router.post(
  '/',
  requireRole([ROLES.ADMIN]),
  validateBody(createDatasetSchema),
  datasetsController.postDataset
);

router.get(
  '/:id',
  validateParams(idParamSchema),
  requireDatasetPermission('canView'),
  datasetsController.getDatasetById
);

router.patch(
  '/:id',
  validateParams(idParamSchema),
  requireDatasetPermission('canManage'),
  validateBody(updateDatasetSchema),
  datasetsController.patchDataset
);

router.delete(
  '/:id',
  validateParams(idParamSchema),
  requireRole([ROLES.ADMIN]),
  datasetsController.deleteDataset
);

router.get(
  '/:id/permissions',
  validateParams(idParamSchema),
  requireRole([ROLES.ADMIN]),
  datasetsController.getDatasetPermissions
);

router.put(
  '/:id/permissions',
  validateParams(idParamSchema),
  requireRole([ROLES.ADMIN]),
  validateBody(updateDatasetPermissionsSchema),
  datasetsController.putDatasetPermissions
);

export const datasetsRoutes: Router = router;
