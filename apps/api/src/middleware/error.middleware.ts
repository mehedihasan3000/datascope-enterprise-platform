import type { ApiErrorDetail, ApiErrorResponse } from '@datascope/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError(
      404,
      'ROUTE_NOT_FOUND',
      `Endpoint ${req.method} ${req.originalUrl} does not exist`
    )
  );
}

function formatZodIssues(err: ZodError): ApiErrorDetail[] {
  return err.issues.map((issue) => ({
    field: issue.path.join('.') || undefined,
    message: issue.message,
  }));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(payload);
    return;
  }

  if (err instanceof ZodError) {
    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formatZodIssues(err),
      },
    };
    res.status(400).json(payload);
    return;
  }

  const jwtErrorName =
    err instanceof Error ? err.name : undefined;

  if (jwtErrorName === 'TokenExpiredError' || jwtErrorName === 'JsonWebTokenError') {
    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message:
          jwtErrorName === 'TokenExpiredError'
            ? 'Authentication token has expired'
            : 'Invalid authentication token',
      },
    };
    res.status(401).json(payload);
    return;
  }

  console.error('Unhandled API Error:', err);

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
    },
  };
  res.status(500).json(payload);
}
