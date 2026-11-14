import type {
  AccessPermissionDTO,
  ApiResponse,
  CreateDatasetInput,
  DatasetDTO,
  UpdateDatasetInput,
  UpdateDatasetPermissionsInput,
} from '@datascope/shared';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware.js';
import * as datasetsService from './datasets.service.js';

export const getDatasets = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await datasetsService.listDatasetsForUser(req.user!);
    const response: ApiResponse<DatasetDTO[]> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const postDataset = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreateDatasetInput;
    const data = await datasetsService.createDataset(input, req.user!);
    const response: ApiResponse<DatasetDTO> = {
      success: true,
      data,
    };
    res.status(201).json(response);
  }
);

export const getDatasetById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId = req.params.id as string;
    const data = await datasetsService.getDatasetById(
      datasetId,
      req.user!,
      req.datasetPermissions
    );
    const response: ApiResponse<DatasetDTO> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const patchDataset = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId = req.params.id as string;
    const input = req.body as UpdateDatasetInput;
    const data = await datasetsService.updateDataset(
      datasetId,
      input,
      req.user!,
      req.datasetPermissions
    );
    const response: ApiResponse<DatasetDTO> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const deleteDataset = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId = req.params.id as string;
    const data = await datasetsService.deleteDataset(datasetId);
    const response: ApiResponse<{ id: string }> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const getDatasetPermissions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId = req.params.id as string;
    const data = await datasetsService.getDatasetPermissions(datasetId);
    const response: ApiResponse<AccessPermissionDTO[]> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const putDatasetPermissions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId = req.params.id as string;
    const input = req.body as UpdateDatasetPermissionsInput;
    const data = await datasetsService.updateDatasetPermissions(datasetId, input);
    const response: ApiResponse<AccessPermissionDTO[]> = {
      success: true,
      data,
    };
    res.json(response);
  }
);
