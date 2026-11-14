import {
  ROLE_CAPABILITIES,
  type RoleDTO,
  type RoleName,
  type UpdateUserPreferencesInput,
  type UpdateUserRoleInput,
  type UserDTO,
  type UserPreferencesDTO,
} from '@datascope/shared';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { datasets, roles, userPreferences, users } from '../../db/schema/index.js';
import { AppError } from '../../middleware/error.middleware.js';

type PreferencesRow = typeof userPreferences.$inferSelect;

export function mapPreferencesToDto(row: PreferencesRow): UserPreferencesDTO {
  return {
    id: row.id,
    userId: row.userId,
    theme: row.theme as UserPreferencesDTO['theme'],
    defaultPageSize: row.defaultPageSize,
    tableDensity: row.tableDensity as UserPreferencesDTO['tableDensity'],
    defaultDatasetId: row.defaultDatasetId ?? null,
    columnConfigs: row.columnConfigs ?? {},
    updatedAt: row.updatedAt.toISOString(),
  };
}

function resolveRolePermissions(roleName: RoleName, dbPermissions: string[]): string[] {
  return Array.isArray(dbPermissions) && dbPermissions.length > 0
    ? dbPermissions
    : [...(ROLE_CAPABILITIES[roleName] ?? [])];
}

export async function getOrCreateUserPreferences(
  userId: string
): Promise<UserPreferencesDTO> {
  const existing = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (existing[0]) {
    return mapPreferencesToDto(existing[0]);
  }

  const inserted = await db
    .insert(userPreferences)
    .values({
      userId,
      theme: 'dark',
      defaultPageSize: 50,
      tableDensity: 'compact',
      columnConfigs: {},
    })
    .onConflictDoNothing({ target: userPreferences.userId })
    .returning();

  if (inserted[0]) {
    return mapPreferencesToDto(inserted[0]);
  }

  const retry = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (!retry[0]) {
    throw new AppError(500, 'PREFERENCES_INIT_FAILED', 'Failed to initialize user preferences');
  }

  return mapPreferencesToDto(retry[0]);
}

export async function updateUserPreferences(
  userId: string,
  input: UpdateUserPreferencesInput
): Promise<UserPreferencesDTO> {
  await getOrCreateUserPreferences(userId);

  if (input.defaultDatasetId) {
    const ds = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(eq(datasets.id, input.defaultDatasetId))
      .limit(1);
    if (ds.length === 0) {
      throw new AppError(404, 'DATASET_NOT_FOUND', 'Default dataset not found');
    }
  }

  const updatePayload: Partial<typeof userPreferences.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.theme !== undefined) updatePayload.theme = input.theme;
  if (input.defaultPageSize !== undefined) updatePayload.defaultPageSize = input.defaultPageSize;
  if (input.tableDensity !== undefined) updatePayload.tableDensity = input.tableDensity;
  if (input.defaultDatasetId !== undefined) updatePayload.defaultDatasetId = input.defaultDatasetId;
  if (input.columnConfigs !== undefined) updatePayload.columnConfigs = input.columnConfigs;

  const updated = await db
    .update(userPreferences)
    .set(updatePayload)
    .where(eq(userPreferences.userId, userId))
    .returning();

  if (!updated[0]) {
    throw new AppError(404, 'PREFERENCES_NOT_FOUND', 'User preferences not found');
  }

  return mapPreferencesToDto(updated[0]);
}

export async function findUserDtoById(
  userId: string,
  includePreferences = true
): Promise<UserDTO | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      roleId: users.roleId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleName: roles.name,
      rolePermissions: roles.permissions,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const roleName = row.roleName as RoleName;
  const preferences = includePreferences
    ? await getOrCreateUserPreferences(row.id)
    : undefined;

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: roleName,
    roleId: row.roleId,
    permissions: resolveRolePermissions(roleName, row.rolePermissions),
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(preferences ? { preferences } : {}),
  };
}

export async function listUsers(): Promise<UserDTO[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      roleId: users.roleId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleName: roles.name,
      rolePermissions: roles.permissions,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(desc(users.createdAt));

  return rows.map((row) => {
    const roleName = row.roleName as RoleName;
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      role: roleName,
      roleId: row.roleId,
      permissions: resolveRolePermissions(roleName, row.rolePermissions),
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function listRoles(): Promise<RoleDTO[]> {
  const rows = await db
    .select()
    .from(roles)
    .orderBy(asc(roles.name));

  return rows.map((row) => {
    const roleName = row.name as RoleName;
    return {
      id: row.id,
      name: roleName,
      description: row.description,
      permissions: resolveRolePermissions(roleName, row.permissions),
    };
  });
}

export async function updateUserRole(
  targetUserId: string,
  input: UpdateUserRoleInput,
  actorUserId: string
): Promise<UserDTO> {
  if (targetUserId === actorUserId && input.isActive === false) {
    throw new AppError(
      400,
      'CANNOT_DEACTIVATE_SELF',
      'Administrators cannot deactivate their own account'
    );
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (existingUser.length === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Target user not found');
  }

  const roleRows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, input.role))
    .limit(1);

  const targetRole = roleRows[0];
  if (!targetRole) {
    throw new AppError(404, 'ROLE_NOT_FOUND', `Role '${input.role}' does not exist`);
  }

  const updateData: Partial<typeof users.$inferInsert> = {
    roleId: targetRole.id,
    updatedAt: new Date(),
  };
  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }

  await db.update(users).set(updateData).where(eq(users.id, targetUserId));

  const updated = await findUserDtoById(targetUserId, false);
  if (!updated) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Target user not found after update');
  }

  return updated;
}
