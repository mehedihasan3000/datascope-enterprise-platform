import type { ApiResponse, RecordDetailDTO } from '@datascope/shared';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware.js';
import * as recordsService from './records.service.js';

export const getDatasetRecordById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId = req.params.id as string | undefined;
    const recordId = req.params.recordId as string;

    const data = await recordsService.getRecordDetail(
      recordId,
      req.user!,
      datasetId
    );

    const response: ApiResponse<RecordDetailDTO> = {
      success: true,
      data,
    };

    res.json(response);
  }
);
