import type { AnalyticsOverviewDTO, ApiResponse } from '@datascope/shared';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware.js';
import * as analyticsService from './analytics.service.js';

export const getOverviewAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId =
      typeof req.query.datasetId === 'string' && req.query.datasetId.trim()
        ? req.query.datasetId.trim()
        : undefined;

    const data = await analyticsService.getAnalyticsOverview(req.user!, datasetId);
    const response: ApiResponse<AnalyticsOverviewDTO> = {
      success: true,
      data,
    };

    res.json(response);
  }
);
