import {
  createSavedViewSchema,
  ROLES,
  shareSavedViewSchema,
  updateSavedViewSchema,
} from '@datascope/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.middleware.js';
import * as savedViewsController from './saved-views.controller.js';

const router = Router();
const idParamSchema = z.object({ id: z.string().uuid('Invalid saved view UUID') });
const listQuerySchema = z.object({
  datasetId: z.string().uuid('Invalid dataset UUID').optional(),
});

router.use(requireAuth);

router.get('/', validateQuery(listQuerySchema), savedViewsController.getSavedViews);
router.get('/:id', validateParams(idParamSchema), savedViewsController.getSavedViewById);

router.post(
  '/',
  requireRole([ROLES.ADMIN, ROLES.ANALYST]),
  validateBody(createSavedViewSchema),
  savedViewsController.postSavedView
);

router.patch(
  '/:id',
  requireRole([ROLES.ADMIN, ROLES.ANALYST]),
  validateParams(idParamSchema),
  validateBody(updateSavedViewSchema),
  savedViewsController.patchSavedView
);

router.patch(
  '/:id/share',
  requireRole([ROLES.ADMIN, ROLES.ANALYST]),
  validateParams(idParamSchema),
  validateBody(shareSavedViewSchema),
  savedViewsController.patchShareSavedView
);

router.delete(
  '/:id',
  requireRole([ROLES.ADMIN, ROLES.ANALYST]),
  validateParams(idParamSchema),
  savedViewsController.deleteSavedView
);

export const savedViewsRoutes: Router = router;
