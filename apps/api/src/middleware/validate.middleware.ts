import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from './error.middleware.js';

function createValidator<T>(
  source: 'body' | 'query' | 'params',
  schema: ZodSchema<T>
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || undefined,
        message: issue.message,
      }));
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          `Invalid request ${source}`,
          details
        )
      );
      return;
    }

    (req as unknown as Record<string, unknown>)[source] = parsed.data;
    next();
  };
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return createValidator('body', schema);
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return createValidator('query', schema);
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return createValidator('params', schema);
}
