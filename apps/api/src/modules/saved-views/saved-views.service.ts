import {
  ROLES,
  type CreateSavedViewInput,
  type SavedViewDTO,
  type SearchMode,
  type ShareSavedViewInput,
  type UpdateSavedViewInput,
} from '@datascope/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { datasets, savedViews, users } from '../../db/schema/index.js';
import type { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error.middleware.js';
import { resolveEffectiveDatasetPermissions } from '../../middleware/rbac.middleware.js';
import { invalidateAnalyticsCache } from '../analytics/analytics.service.js';
import { listDatasetsForUser } from '../datasets/datasets.service.js';

function mapSavedViewRow(
  row: typeof savedViews.$inferSelect,
  datasetName?: string | null,
  ownerName?: string | null
): SavedViewDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    datasetId: row.datasetId,
    datasetName: datasetName ?? undefined,
    userId: row.userId,
    ownerName: ownerName ?? undefined,
    searchQuery: row.searchQuery,
    searchMode: row.searchMode as SearchMode,
    filters: row.filters ?? [],
    sorting: row.sorting ?? [],
    visibleColumns: row.visibleColumns ?? [],
    isShared: row.isShared,
    sharedWithRoles: row.sharedWithRoles ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function canUserAccessSavedView(
  row: typeof savedViews.$inferSelect,
  user: AuthenticatedUser
): boolean {
  if (user.role === ROLES.ADMIN || row.userId === user.id) {
    return true;
  }
  if (row.isShared) {
    const rolesList = Array.isArray(row.sharedWithRoles) ? row.sharedWithRoles : [];
    return rolesList.length === 0 || rolesList.includes(user.role);
  }
  return false;
}

export async function listSavedViews(
  user: AuthenticatedUser,
  datasetId?: string
): Promise<SavedViewDTO[]> {
  if (datasetId) {
    const perms = await resolveEffectiveDatasetPermissions(datasetId, user);
    if (!perms.canView) {
      throw new AppError(
        403,
        'DATASET_ACCESS_DENIED',
        'You do not have permission to access saved views for this dataset'
      );
    }
  }

  const authorizedDatasets = await listDatasetsForUser(user);
  const authorizedDatasetIds = new Set(authorizedDatasets.map((d) => d.id));

  const rows = await db
    .select({
      view: savedViews,
      datasetName: datasets.name,
      ownerName: users.fullName,
    })
    .from(savedViews)
    .innerJoin(datasets, eq(savedViews.datasetId, datasets.id))
    .leftJoin(users, eq(savedViews.userId, users.id))
    .where(datasetId ? eq(savedViews.datasetId, datasetId) : undefined)
    .orderBy(desc(savedViews.updatedAt));

  const results: SavedViewDTO[] = [];
  for (const r of rows) {
    if (!authorizedDatasetIds.has(r.view.datasetId)) {
      continue;
    }
    if (!canUserAccessSavedView(r.view, user)) {
      continue;
    }
    results.push(mapSavedViewRow(r.view, r.datasetName, r.ownerName));
  }

  return results;
}

export async function getSavedViewById(
  viewId: string,
  user: AuthenticatedUser
): Promise<SavedViewDTO> {
  const rows = await db
    .select({
      view: savedViews,
      datasetName: datasets.name,
      ownerName: users.fullName,
    })
    .from(savedViews)
    .innerJoin(datasets, eq(savedViews.datasetId, datasets.id))
    .leftJoin(users, eq(savedViews.userId, users.id))
    .where(eq(savedViews.id, viewId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError(404, 'SAVED_VIEW_NOT_FOUND', 'Saved view not found');
  }

  const perms = await resolveEffectiveDatasetPermissions(row.view.datasetId, user);
  if (!perms.canView || !canUserAccessSavedView(row.view, user)) {
    throw new AppError(
      403,
      'SAVED_VIEW_ACCESS_DENIED',
      'You do not have permission to access this saved view'
    );
  }

  return mapSavedViewRow(row.view, row.datasetName, row.ownerName);
}

export async function createSavedView(
  input: CreateSavedViewInput,
  user: AuthenticatedUser
): Promise<SavedViewDTO> {
  const perms = await resolveEffectiveDatasetPermissions(input.datasetId, user);
  if (!perms.canView) {
    throw new AppError(
      403,
      'DATASET_ACCESS_DENIED',
      'You do not have permission to save a view for this dataset'
    );
  }

  const [inserted] = await db
    .insert(savedViews)
    .values({
      name: input.name,
      description: input.description ?? null,
      datasetId: input.datasetId,
      userId: user.id,
      searchQuery: input.searchQuery ?? '',
      searchMode: input.searchMode ?? 'fts',
      filters: input.filters ?? [],
      sorting: input.sorting ?? [],
      visibleColumns: input.visibleColumns ?? [],
      isShared: input.isShared ?? false,
      sharedWithRoles: input.sharedWithRoles ?? [],
    })
    .returning();

  invalidateAnalyticsCache();
  return getSavedViewById(inserted!.id, user);
}

export async function updateSavedView(
  viewId: string,
  input: UpdateSavedViewInput,
  user: AuthenticatedUser
): Promise<SavedViewDTO> {
  const existing = await db
    .select()
    .from(savedViews)
    .where(eq(savedViews.id, viewId))
    .limit(1);

  const view = existing[0];
  if (!view) {
    throw new AppError(404, 'SAVED_VIEW_NOT_FOUND', 'Saved view not found');
  }

  if (view.userId !== user.id && user.role !== ROLES.ADMIN) {
    throw new AppError(
      403,
      'FORBIDDEN_VIEW_MODIFICATION',
      'Only the view owner or an administrator can modify this saved view'
    );
  }

  const updatePayload: Partial<typeof savedViews.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.description !== undefined) updatePayload.description = input.description ?? null;
  if (input.searchQuery !== undefined) updatePayload.searchQuery = input.searchQuery;
  if (input.searchMode !== undefined) updatePayload.searchMode = input.searchMode;
  if (input.filters !== undefined) updatePayload.filters = input.filters;
  if (input.sorting !== undefined) updatePayload.sorting = input.sorting;
  if (input.visibleColumns !== undefined) updatePayload.visibleColumns = input.visibleColumns;
  if (input.isShared !== undefined) updatePayload.isShared = input.isShared;
  if (input.sharedWithRoles !== undefined) updatePayload.sharedWithRoles = input.sharedWithRoles;

  await db
    .update(savedViews)
    .set(updatePayload)
    .where(and(eq(savedViews.id, viewId)));

  invalidateAnalyticsCache();
  return getSavedViewById(viewId, user);
}

export async function shareSavedView(
  viewId: string,
  input: ShareSavedViewInput,
  user: AuthenticatedUser
): Promise<SavedViewDTO> {
  return updateSavedView(
    viewId,
    {
      isShared: input.isShared,
      sharedWithRoles: input.sharedWithRoles,
    },
    user
  );
}

export async function deleteSavedView(
  viewId: string,
  user: AuthenticatedUser
): Promise<{ id: string }> {
  const existing = await db
    .select()
    .from(savedViews)
    .where(eq(savedViews.id, viewId))
    .limit(1);

  const view = existing[0];
  if (!view) {
    throw new AppError(404, 'SAVED_VIEW_NOT_FOUND', 'Saved view not found');
  }

  if (view.userId !== user.id && user.role !== ROLES.ADMIN) {
    throw new AppError(
      403,
      'FORBIDDEN_VIEW_MODIFICATION',
      'Only the view owner or an administrator can delete this saved view'
    );
  }

  await db.delete(savedViews).where(eq(savedViews.id, viewId));
  invalidateAnalyticsCache();
  return { id: viewId };
}
