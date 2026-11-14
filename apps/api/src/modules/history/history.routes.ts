import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateQuery } from '../../middleware/validate.middleware.js';
import * as historyController from './history.controller.js';

const router = Router();

const historyQuerySchema = z.object({
  datasetId: z.string().uuid('Invalid dataset UUID').optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

router.use(requireAuth);

router.get('/', validateQuery(historyQuerySchema), historyController.getSearchHistory);
router.delete('/', validateQuery(historyQuerySchema), historyController.deleteSearchHistory);

export const historyRoutes: Router = router;
