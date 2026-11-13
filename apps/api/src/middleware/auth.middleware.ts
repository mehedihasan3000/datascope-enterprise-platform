import { ROLE_CAPABILITIES, type EffectiveDatasetPermissions, type RoleName } from '@datascope/shared';
import { eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.js';
import { roles, users } from '../db/schema/index.js';
import { ACCESS_COOKIE_NAME, verifyAccessToken } from '../utils/jwt.js';
import { AppError, asyncHandler } from './error.middleware.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  roleId: string;
  permissions: string[];
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      datasetPermissions?: EffectiveDatasetPermissions;
    }
  }
}

function extractAccessToken(req: Request): string | null {
  const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractAccessToken(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token');
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
        roleId: roles.id,
        roleName: roles.name,
        rolePermissions: roles.permissions,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, payload.sub))
      .limit(1);

    const record = rows[0];
    if (!record) {
      throw new AppError(401, 'UNAUTHORIZED', 'User account no longer exists');
    }

    if (!record.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'User account has been deactivated');
    }

    const roleName = record.roleName as RoleName;
    const permissions =
      Array.isArray(record.rolePermissions) && record.rolePermissions.length > 0
        ? record.rolePermissions
        : [...(ROLE_CAPABILITIES[roleName] ?? [])];

    req.user = {
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      role: roleName,
      roleId: record.roleId,
      permissions,
      isActive: record.isActive,
    };

    next();
  }
);
