import type { ApiResponse, SearchHistoryDTO } from '@datascope/shared';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware.js';
import * as historyService from './history.service.js';

export const getSearchHistory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId =
      typeof req.query.datasetId === 'string' && req.query.datasetId.trim()
        ? req.query.datasetId.trim()
        : undefined;
    const limit =
      typeof req.query.limit === 'number'
        ? req.query.limit
        : Number(req.query.limit ?? 50);

    const data = await historyService.listUserSearchHistory(
      req.user!,
      datasetId,
      Number.isFinite(limit) ? limit : 50
    );

    const response: ApiResponse<SearchHistoryDTO[]> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const deleteSearchHistory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId =
      typeof req.query.datasetId === 'string' && req.query.datasetId.trim()
        ? req.query.datasetId.trim()
        : undefined;

    const data = await historyService.clearUserSearchHistory(req.user!, datasetId);
    const response: ApiResponse<{ cleared: true }> = {
      success: true,
      data,
    };
    res.json(response);
  }
);
