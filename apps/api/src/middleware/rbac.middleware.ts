import { ROLES, type EffectiveDatasetPermissions, type RoleName } from '@datascope/shared';
import { and, eq, or } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accessPermissions, datasets } from '../db/schema/index.js';
import type { AuthenticatedUser } from './auth.middleware.js';
import { AppError, asyncHandler } from './error.middleware.js';

const uuidSchema = z.string().uuid();

export function requireRole(allowedRoles: readonly RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          403,
          'FORBIDDEN_ROLE',
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        )
      );
      return;
    }

    next();
  };
}

export async function resolveEffectiveDatasetPermissions(
  datasetId: string,
  user: AuthenticatedUser
): Promise<EffectiveDatasetPermissions> {
  if (user.role === ROLES.ADMIN) {
    return {
      canView: true,
      canSearch: true,
      canExport: true,
      canManage: true,
    };
  }

  const rows = await db
    .select({
      userId: accessPermissions.userId,
      roleId: accessPermissions.roleId,
      canView: accessPermissions.canView,
      canSearch: accessPermissions.canSearch,
      canExport: accessPermissions.canExport,
      canManage: accessPermissions.canManage,
    })
    .from(accessPermissions)
    .where(
      and(
        eq(accessPermissions.datasetId, datasetId),
        or(
          eq(accessPermissions.userId, user.id),
          eq(accessPermissions.roleId, user.roleId)
        )
      )
    );

  // User-specific permission override takes precedence over role-level permission
  const userOverride = rows.find((row) => row.userId === user.id);
  const roleGrant = rows.find((row) => row.roleId === user.roleId && row.userId === null);
  const effective = userOverride ?? roleGrant;

  if (!effective) {
    return {
      canView: false,
      canSearch: false,
      canExport: false,
      canManage: false,
    };
  }

  return {
    canView: effective.canView,
    canSearch: effective.canSearch,
    canExport: effective.canExport,
    canManage: effective.canManage,
  };
}

export function requireDatasetPermission(
  permission: keyof EffectiveDatasetPermissions,
  paramName = 'id'
) {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
      }

      const rawId =
        req.params?.[paramName] ??
        (req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>).datasetId
          : undefined) ??
        req.query?.datasetId;

      const parsedId = uuidSchema.safeParse(rawId);
      if (!parsedId.success) {
        throw new AppError(400, 'INVALID_DATASET_ID', 'A valid dataset UUID is required');
      }

      const datasetId = parsedId.data;

      const existingDataset = await db
        .select({ id: datasets.id })
        .from(datasets)
        .where(eq(datasets.id, datasetId))
        .limit(1);

      if (existingDataset.length === 0) {
        throw new AppError(404, 'DATASET_NOT_FOUND', 'Dataset not found');
      }

      const perms = await resolveEffectiveDatasetPermissions(datasetId, req.user);
      if (!perms[permission]) {
        throw new AppError(
          403,
          'DATASET_ACCESS_DENIED',
          'You do not have permission to access or perform this action on this dataset'
        );
      }

      req.datasetPermissions = perms;
      next();
    }
  );
}
