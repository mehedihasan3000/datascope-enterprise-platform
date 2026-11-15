import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './db/index.js';
import {
  asyncHandler,
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { datasetsRoutes } from './modules/datasets/datasets.routes.js';
import { historyRoutes } from './modules/history/history.routes.js';
import {
  datasetRecordsRoutes,
  standaloneRecordsRoutes,
} from './modules/records/records.routes.js';
import { savedViewsRoutes } from './modules/saved-views/saved-views.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { getSearchCacheStats } from './modules/search/search.service.js';
import { usersRoutes } from './modules/users/users.routes.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  const allowedOrigins = new Set(
    env.FRONTEND_URL.split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  );

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ''))) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  app.get(
    '/api/v1/health',
    asyncHandler(async (_req, res) => {
      const dbStatus = await checkDatabaseConnection();
      res.json({
        success: true,
        data: {
          status: 'ok',
          environment: env.NODE_ENV,
          timestamp: new Date().toISOString(),
          db: dbStatus,
          searchCache: getSearchCacheStats(),
        },
      });
    })
  );

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/datasets', datasetsRoutes);
  app.use('/api/v1/datasets', searchRoutes);
  app.use('/api/v1/datasets', datasetRecordsRoutes);
  app.use('/api/v1/records', standaloneRecordsRoutes);
  app.use('/api/v1/saved-views', savedViewsRoutes);
  app.use('/api/v1/search-history', historyRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
