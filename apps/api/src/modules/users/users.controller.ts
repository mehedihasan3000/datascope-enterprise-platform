import type {
  ApiResponse,
  RoleDTO,
  UpdateUserPreferencesInput,
  UpdateUserRoleInput,
  UserDTO,
  UserPreferencesDTO,
} from '@datascope/shared';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware.js';
import * as usersService from './users.service.js';

export const getUsers = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await usersService.listUsers();
  const response: ApiResponse<UserDTO[]> = {
    success: true,
    data,
  };
  res.json(response);
});

export const getRoles = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await usersService.listRoles();
  const response: ApiResponse<RoleDTO[]> = {
    success: true,
    data,
  };
  res.json(response);
});

export const patchUserRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const targetUserId = req.params.id as string;
  const input = req.body as UpdateUserRoleInput;
  const data = await usersService.updateUserRole(targetUserId, input, req.user!.id);
  const response: ApiResponse<UserDTO> = {
    success: true,
    data,
  };
  res.json(response);
});

export const getMyPreferences = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await usersService.getOrCreateUserPreferences(req.user!.id);
    const response: ApiResponse<UserPreferencesDTO> = {
      success: true,
      data,
    };
    res.json(response);
  }
);

export const putMyPreferences = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = req.body as UpdateUserPreferencesInput;
    const data = await usersService.updateUserPreferences(req.user!.id, input);
    const response: ApiResponse<UserPreferencesDTO> = {
      success: true,
      data,
    };
    res.json(response);
  }
);
