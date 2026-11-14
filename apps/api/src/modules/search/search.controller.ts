import type {
  ApiResponse,
  DatasetRecordDTO,
  SearchQueryRequest,
} from '@datascope/shared';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware.js';
import * as searchService from './search.service.js';

export const postSearchDatasetRecords = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId = req.params.id as string;
    const searchRequest = req.body as SearchQueryRequest;

    const result = await searchService.executeDatasetSearch(
      datasetId,
      searchRequest,
      req.user!
    );

    const response: ApiResponse<DatasetRecordDTO[]> = {
      success: true,
      data: result.records,
      meta: result.meta,
    };

    res.json(response);
  }
);
