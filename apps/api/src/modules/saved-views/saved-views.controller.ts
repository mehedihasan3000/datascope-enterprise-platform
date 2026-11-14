import type {
  ApiResponse,
  CreateSavedViewInput,
  SavedViewDTO,
  ShareSavedViewInput,
  UpdateSavedViewInput,
} from '@datascope/shared';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware.js';
import * as savedViewsService from './saved-views.service.js';

export const getSavedViews = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const datasetId =
      typeof req.query.datasetId === 'string' && req.query.datasetId.trim()
        ? req.query.datasetId.trim()
        : undefined;

    const data = await savedViewsService.listSavedViews(req.user!, datasetId);
    const response: ApiResponse<SavedViewDTO[]> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const getSavedViewById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const viewId = req.params.id as string;
    const data = await savedViewsService.getSavedViewById(viewId, req.user!);
    const response: ApiResponse<SavedViewDTO> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const postSavedView = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreateSavedViewInput;
    const data = await savedViewsService.createSavedView(input, req.user!);
    const response: ApiResponse<SavedViewDTO> = {
      success: true,
      data,
    };
    res.status(201).json(response);
  }
);

export const patchSavedView = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const viewId = req.params.id as string;
    const input = req.body as UpdateSavedViewInput;
    const data = await savedViewsService.updateSavedView(viewId, input, req.user!);
    const response: ApiResponse<SavedViewDTO> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const patchShareSavedView = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const viewId = req.params.id as string;
    const input = req.body as ShareSavedViewInput;
    const data = await savedViewsService.shareSavedView(viewId, input, req.user!);
    const response: ApiResponse<SavedViewDTO> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const deleteSavedView = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const viewId = req.params.id as string;
    const data = await savedViewsService.deleteSavedView(viewId, req.user!);
    const response: ApiResponse<{ id: string }> = {
      success: true,
      data,
    };
    res.json(response);
  }
);
