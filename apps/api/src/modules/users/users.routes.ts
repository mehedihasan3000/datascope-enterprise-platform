import {
  ROLES,
  updateUserPreferencesSchema,
  updateUserRoleSchema,
} from '@datascope/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import * as usersController from './users.controller.js';

const router = Router();
const idParamSchema = z.object({ id: z.string().uuid('Invalid user UUID') });

router.use(requireAuth);

// Self-service user preferences
router.get('/me/preferences', usersController.getMyPreferences);
router.put(
  '/me/preferences',
  validateBody(updateUserPreferencesSchema),
  usersController.putMyPreferences
);

// Admin user & role management
router.get('/roles', requireRole([ROLES.ADMIN]), usersController.getRoles);
router.get('/', requireRole([ROLES.ADMIN]), usersController.getUsers);
router.patch(
  '/:id/role',
  requireRole([ROLES.ADMIN]),
  validateParams(idParamSchema),
  validateBody(updateUserRoleSchema),
  usersController.patchUserRole
);

export const usersRoutes: Router = router;
