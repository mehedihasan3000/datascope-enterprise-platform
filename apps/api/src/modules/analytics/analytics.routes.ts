import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateQuery } from '../../middleware/validate.middleware.js';
import * as analyticsController from './analytics.controller.js';

const router = Router();

const overviewQuerySchema = z.object({
  datasetId: z.string().uuid('Invalid dataset UUID').optional(),
});

router.use(requireAuth);

router.get(
  '/overview',
  validateQuery(overviewQuerySchema),
  analyticsController.getOverviewAnalytics
);

export const analyticsRoutes: Router = router;
