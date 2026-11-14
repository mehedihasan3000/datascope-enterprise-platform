import {
  ROLES,
  type AccessPermissionDTO,
  type CreateDatasetInput,
  type DatasetDTO,
  type DatasetFieldDTO,
  type DatasetFieldInput,
  type EffectiveDatasetPermissions,
  type RoleName,
  type UpdateDatasetInput,
  type UpdateDatasetPermissionsInput,
} from '@datascope/shared';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  accessPermissions,
  datasetFields,
  datasets,
  roles,
  users,
} from '../../db/schema/index.js';
import type { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error.middleware.js';
import { resolveEffectiveDatasetPermissions } from '../../middleware/rbac.middleware.js';

const DEFAULT_CORE_FIELDS: DatasetFieldInput[] = [
  {
    fieldKey: 'recordCode',
    displayName: 'Entity ID',
    dataType: 'string',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: true,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 1,
  },
  {
    fieldKey: 'title',
    displayName: 'Organization Name',
    dataType: 'string',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: true,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 2,
  },
  {
    fieldKey: 'category',
    displayName: 'Industry Sector',
    dataType: 'string',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: true,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 3,
  },
  {
    fieldKey: 'status',
    displayName: 'Status',
    dataType: 'enum',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: true,
    isDefaultVisible: true,
    enumValues: ['Active', 'Pending', 'Suspended', 'Archived'],
    sortOrder: 4,
  },
  {
    fieldKey: 'country',
    displayName: 'Country',
    dataType: 'string',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: true,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 5,
  },
  {
    fieldKey: 'revenue',
    displayName: 'Annual Revenue (USD)',
    dataType: 'currency',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: false,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 6,
  },
  {
    fieldKey: 'employeeCount',
    displayName: 'Employees',
    dataType: 'number',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: false,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 7,
  },
  {
    fieldKey: 'riskScore',
    displayName: 'Risk Score',
    dataType: 'number',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: false,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 8,
  },
  {
    fieldKey: 'createdAt',
    displayName: 'Created Date',
    dataType: 'date',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: false,
    isDefaultVisible: true,
    enumValues: null,
    sortOrder: 9,
  },
  {
    fieldKey: 'updatedAt',
    displayName: 'Last Updated',
    dataType: 'date',
    isCoreColumn: true,
    isSortable: true,
    isFilterable: true,
    isSearchable: false,
    isDefaultVisible: false,
    enumValues: null,
    sortOrder: 10,
  },
];

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `dataset-${Date.now()}`;
}

function mapFieldRow(row: typeof datasetFields.$inferSelect): DatasetFieldDTO {
  return {
    id: row.id,
    datasetId: row.datasetId,
    fieldKey: row.fieldKey,
    displayName: row.displayName,
    dataType: row.dataType as DatasetFieldDTO['dataType'],
    isCoreColumn: row.isCoreColumn,
    isSortable: row.isSortable,
    isFilterable: row.isFilterable,
    isSearchable: row.isSearchable,
    isDefaultVisible: row.isDefaultVisible,
    enumValues: row.enumValues ?? null,
    sortOrder: row.sortOrder,
  };
}

export async function listDatasetsForUser(
  user: AuthenticatedUser
): Promise<DatasetDTO[]> {
  const datasetRows = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      slug: datasets.slug,
      description: datasets.description,
      category: datasets.category,
      dataSource: datasets.dataSource,
      totalRecords: datasets.totalRecords,
      createdBy: datasets.createdBy,
      creatorName: users.fullName,
      createdAt: datasets.createdAt,
      updatedAt: datasets.updatedAt,
    })
    .from(datasets)
    .leftJoin(users, eq(datasets.createdBy, users.id))
    .orderBy(desc(datasets.totalRecords), desc(datasets.createdAt));

  if (datasetRows.length === 0) {
    return [];
  }

  const datasetIds = datasetRows.map((d) => d.id);

  // Batch load fields for all datasets
  const allFields = await db
    .select()
    .from(datasetFields)
    .where(inArray(datasetFields.datasetId, datasetIds))
    .orderBy(asc(datasetFields.sortOrder));

  const fieldsByDataset = new Map<string, DatasetFieldDTO[]>();
  for (const field of allFields) {
    const list = fieldsByDataset.get(field.datasetId) ?? [];
    list.push(mapFieldRow(field));
    fieldsByDataset.set(field.datasetId, list);
  }

  // Batch compute effective permissions for non-Admin users
  const permByDataset = new Map<string, EffectiveDatasetPermissions>();
  if (user.role === ROLES.ADMIN) {
    for (const id of datasetIds) {
      permByDataset.set(id, {
        canView: true,
        canSearch: true,
        canExport: true,
        canManage: true,
      });
    }
  } else {
    const allPerms = await db
      .select()
      .from(accessPermissions)
      .where(inArray(accessPermissions.datasetId, datasetIds));

    for (const id of datasetIds) {
      const dsPerms = allPerms.filter((p) => p.datasetId === id);
      const userOverride = dsPerms.find((p) => p.userId === user.id);
      const roleGrant = dsPerms.find(
        (p) => p.roleId === user.roleId && p.userId === null
      );
      const effective = userOverride ?? roleGrant;

      if (effective) {
        permByDataset.set(id, {
          canView: effective.canView,
          canSearch: effective.canSearch,
          canExport: effective.canExport,
          canManage: effective.canManage,
        });
      }
    }
  }

  const visibleDatasets: DatasetDTO[] = [];
  for (const row of datasetRows) {
    const effectivePermissions = permByDataset.get(row.id) ?? {
      canView: false,
      canSearch: false,
      canExport: false,
      canManage: false,
    };

    if (!effectivePermissions.canView) {
      continue;
    }

    visibleDatasets.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: row.category,
      dataSource: row.dataSource,
      totalRecords: row.totalRecords,
      createdBy: row.createdBy,
      creatorName: row.creatorName ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      fields: fieldsByDataset.get(row.id) ?? [],
      effectivePermissions,
    });
  }

  return visibleDatasets;
}

export async function getDatasetById(
  datasetId: string,
  user: AuthenticatedUser,
  precomputedPerms?: EffectiveDatasetPermissions
): Promise<DatasetDTO> {
  const rows = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      slug: datasets.slug,
      description: datasets.description,
      category: datasets.category,
      dataSource: datasets.dataSource,
      totalRecords: datasets.totalRecords,
      createdBy: datasets.createdBy,
      creatorName: users.fullName,
      createdAt: datasets.createdAt,
      updatedAt: datasets.updatedAt,
    })
    .from(datasets)
    .leftJoin(users, eq(datasets.createdBy, users.id))
    .where(eq(datasets.id, datasetId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError(404, 'DATASET_NOT_FOUND', 'Dataset not found');
  }

  const fields = await db
    .select()
    .from(datasetFields)
    .where(eq(datasetFields.datasetId, datasetId))
    .orderBy(asc(datasetFields.sortOrder));

  const effectivePermissions =
    precomputedPerms ?? (await resolveEffectiveDatasetPermissions(datasetId, user));

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    dataSource: row.dataSource,
    totalRecords: row.totalRecords,
    createdBy: row.createdBy,
    creatorName: row.creatorName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    fields: fields.map(mapFieldRow),
    effectivePermissions,
  };
}

export async function createDataset(
  input: CreateDatasetInput,
  user: AuthenticatedUser
): Promise<DatasetDTO> {
  const baseSlug = input.slug ? input.slug.trim() : slugifyName(input.name);

  const existingSlug = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.slug, baseSlug))
    .limit(1);

  let finalSlug = baseSlug;
  if (existingSlug.length > 0) {
    if (input.slug) {
      throw new AppError(
        409,
        'DATASET_SLUG_EXISTS',
        `A dataset with slug '${baseSlug}' already exists`
      );
    }
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const allRoles = await db.select().from(roles);
  const fieldsToInsert =
    input.fields && input.fields.length > 0 ? input.fields : DEFAULT_CORE_FIELDS;

  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(datasets)
      .values({
        name: input.name,
        slug: finalSlug,
        description: input.description,
        category: input.category,
        dataSource: input.dataSource,
        totalRecords: 0,
        createdBy: user.id,
      })
      .returning({ id: datasets.id });

    const datasetId = created!.id;

    await tx.insert(datasetFields).values(
      fieldsToInsert.map((f, index) => ({
        datasetId,
        fieldKey: f.fieldKey,
        displayName: f.displayName,
        dataType: f.dataType,
        isCoreColumn: f.isCoreColumn,
        isSortable: f.isSortable,
        isFilterable: f.isFilterable,
        isSearchable: f.isSearchable,
        isDefaultVisible: f.isDefaultVisible,
        enumValues: f.enumValues ?? null,
        sortOrder: f.sortOrder || index + 1,
      }))
    );

    const permissionValues = allRoles.map((r) => {
      const rName = r.name as RoleName;
      if (rName === ROLES.ADMIN) {
        return {
          datasetId,
          roleId: r.id,
          canView: true,
          canSearch: true,
          canExport: true,
          canManage: true,
        };
      }
      if (rName === ROLES.ANALYST) {
        return {
          datasetId,
          roleId: r.id,
          canView: true,
          canSearch: true,
          canExport: true,
          canManage: false,
        };
      }
      return {
        datasetId,
        roleId: r.id,
        canView: true,
        canSearch: true,
        canExport: false,
        canManage: false,
      };
    });

    if (permissionValues.length > 0) {
      await tx.insert(accessPermissions).values(permissionValues);
    }

    return datasetId;
  });

  return getDatasetById(createdId, user, {
    canView: true,
    canSearch: true,
    canExport: true,
    canManage: true,
  });
}

export async function updateDataset(
  datasetId: string,
  input: UpdateDatasetInput,
  user: AuthenticatedUser,
  perms?: EffectiveDatasetPermissions
): Promise<DatasetDTO> {
  if (input.slug) {
    const conflict = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(eq(datasets.slug, input.slug))
      .limit(1);

    if (conflict[0] && conflict[0].id !== datasetId) {
      throw new AppError(
        409,
        'DATASET_SLUG_EXISTS',
        `A dataset with slug '${input.slug}' already exists`
      );
    }
  }

  await db.transaction(async (tx) => {
    const updatePayload: Partial<typeof datasets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.slug !== undefined) updatePayload.slug = input.slug;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.category !== undefined) updatePayload.category = input.category;
    if (input.dataSource !== undefined) updatePayload.dataSource = input.dataSource;

    await tx.update(datasets).set(updatePayload).where(eq(datasets.id, datasetId));

    if (input.fields && input.fields.length > 0) {
      await tx.delete(datasetFields).where(eq(datasetFields.datasetId, datasetId));
      await tx.insert(datasetFields).values(
        input.fields.map((f, index) => ({
          datasetId,
          fieldKey: f.fieldKey,
          displayName: f.displayName,
          dataType: f.dataType,
          isCoreColumn: f.isCoreColumn,
          isSortable: f.isSortable,
          isFilterable: f.isFilterable,
          isSearchable: f.isSearchable,
          isDefaultVisible: f.isDefaultVisible,
          enumValues: f.enumValues ?? null,
          sortOrder: f.sortOrder || index + 1,
        }))
      );
    }
  });

  return getDatasetById(datasetId, user, perms);
}

export async function deleteDataset(datasetId: string): Promise<{ id: string }> {
  const existing = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (existing.length === 0) {
    throw new AppError(404, 'DATASET_NOT_FOUND', 'Dataset not found');
  }

  await db.delete(datasets).where(eq(datasets.id, datasetId));
  return { id: datasetId };
}

export async function getDatasetPermissions(
  datasetId: string
): Promise<AccessPermissionDTO[]> {
  const existing = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (existing.length === 0) {
    throw new AppError(404, 'DATASET_NOT_FOUND', 'Dataset not found');
  }

  const rows = await db
    .select({
      id: accessPermissions.id,
      datasetId: accessPermissions.datasetId,
      roleId: accessPermissions.roleId,
      roleName: roles.name,
      userId: accessPermissions.userId,
      userEmail: users.email,
      canView: accessPermissions.canView,
      canSearch: accessPermissions.canSearch,
      canExport: accessPermissions.canExport,
      canManage: accessPermissions.canManage,
      createdAt: accessPermissions.createdAt,
    })
    .from(accessPermissions)
    .leftJoin(roles, eq(accessPermissions.roleId, roles.id))
    .leftJoin(users, eq(accessPermissions.userId, users.id))
    .where(eq(accessPermissions.datasetId, datasetId))
    .orderBy(asc(accessPermissions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    datasetId: row.datasetId,
    roleId: row.roleId ?? null,
    roleName: (row.roleName as RoleName | null) ?? null,
    userId: row.userId ?? null,
    userEmail: row.userEmail ?? null,
    canView: row.canView,
    canSearch: row.canSearch,
    canExport: row.canExport,
    canManage: row.canManage,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function updateDatasetPermissions(
  datasetId: string,
  input: UpdateDatasetPermissionsInput
): Promise<AccessPermissionDTO[]> {
  const existing = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (existing.length === 0) {
    throw new AppError(404, 'DATASET_NOT_FOUND', 'Dataset not found');
  }

  const roleIds = input.permissions
    .map((p) => p.roleId)
    .filter((id): id is string => Boolean(id));
  const userIds = input.permissions
    .map((p) => p.userId)
    .filter((id): id is string => Boolean(id));

  if (roleIds.length > 0) {
    const foundRoles = await db
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.id, roleIds));
    const foundSet = new Set(foundRoles.map((r) => r.id));
    for (const rid of roleIds) {
      if (!foundSet.has(rid)) {
        throw new AppError(400, 'INVALID_ROLE_ID', `Role UUID '${rid}' does not exist`);
      }
    }
  }

  if (userIds.length > 0) {
    const foundUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, userIds));
    const foundSet = new Set(foundUsers.map((u) => u.id));
    for (const uid of userIds) {
      if (!foundSet.has(uid)) {
        throw new AppError(400, 'INVALID_USER_ID', `User UUID '${uid}' does not exist`);
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(accessPermissions)
      .where(eq(accessPermissions.datasetId, datasetId));

    await tx.insert(accessPermissions).values(
      input.permissions.map((p) => ({
        datasetId,
        roleId: p.roleId ?? null,
        userId: p.userId ?? null,
        canView: p.canView,
        canSearch: p.canSearch,
        canExport: p.canExport,
        canManage: p.canManage,
      }))
    );

    await tx
      .update(datasets)
      .set({ updatedAt: new Date() })
      .where(eq(datasets.id, datasetId));
  });

  return getDatasetPermissions(datasetId);
}
