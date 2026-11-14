import type {
  ApiResponse,
  LoginInput,
  RegisterInput,
  UserDTO,
} from '@datascope/shared';
import type { Request, Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware.js';
import {
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
} from '../../utils/jwt.js';
import { findUserDtoById } from '../users/users.service.js';
import * as authService from './auth.service.js';

interface AuthPayloadData {
  user: UserDTO;
  accessToken: string;
}

export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as RegisterInput;
  const result = await authService.register(input);
  setAuthCookies(res, result.accessToken, result.refreshToken);

  const response: ApiResponse<AuthPayloadData> = {
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  };
  res.status(201).json(response);
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as LoginInput;
  const result = await authService.login(input);
  setAuthCookies(res, result.accessToken, result.refreshToken);

  const response: ApiResponse<AuthPayloadData> = {
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  };
  res.json(response);
});

export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const cookieRefresh = req.cookies?.[REFRESH_COOKIE_NAME];
  const bodyRefresh =
    req.body && typeof req.body === 'object'
      ? (req.body as { refreshToken?: unknown }).refreshToken
      : undefined;
  const token =
    typeof cookieRefresh === 'string'
      ? cookieRefresh
      : typeof bodyRefresh === 'string'
        ? bodyRefresh
        : undefined;

  const result = await authService.refreshSession(token);
  setAuthCookies(res, result.accessToken, result.refreshToken);

  const response: ApiResponse<AuthPayloadData> = {
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  };
  res.json(response);
});

export const logout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  clearAuthCookies(res);
  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: 'Logged out successfully' },
  };
  res.json(response);
});

export const me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await findUserDtoById(req.user!.id, true);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User account not found');
  }

  const response: ApiResponse<UserDTO> = {
    success: true,
    data: user,
  };
  res.json(response);
});
