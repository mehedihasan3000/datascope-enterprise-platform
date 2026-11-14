import type { SearchHistoryDTO } from '@datascope/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { datasets, searchHistory } from '../../db/schema/index.js';
import type { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error.middleware.js';
import { resolveEffectiveDatasetPermissions } from '../../middleware/rbac.middleware.js';

export async function listUserSearchHistory(
  user: AuthenticatedUser,
  datasetId?: string,
  limit = 50
): Promise<SearchHistoryDTO[]> {
  if (datasetId) {
    const perms = await resolveEffectiveDatasetPermissions(datasetId, user);
    if (!perms.canView) {
      throw new AppError(
        403,
        'DATASET_ACCESS_DENIED',
        'You do not have permission to access search history for this dataset'
      );
    }
  }

  const rows = await db
    .select({
      entry: searchHistory,
      datasetName: datasets.name,
    })
    .from(searchHistory)
    .innerJoin(datasets, eq(searchHistory.datasetId, datasets.id))
    .where(
      datasetId
        ? and(
            eq(searchHistory.userId, user.id),
            eq(searchHistory.datasetId, datasetId)
          )
        : eq(searchHistory.userId, user.id)
    )
    .orderBy(desc(searchHistory.executedAt))
    .limit(Math.min(Math.max(limit, 1), 200));

  return rows.map((r) => ({
    id: r.entry.id,
    userId: r.entry.userId,
    datasetId: r.entry.datasetId,
    datasetName: r.datasetName ?? undefined,
    searchQuery: r.entry.searchQuery,
    filters: r.entry.filters ?? [],
    sorting: r.entry.sorting ?? [],
    resultCount: r.entry.resultCount,
    executionTimeMs: r.entry.executionTimeMs,
    executedAt: r.entry.executedAt.toISOString(),
  }));
}

export async function clearUserSearchHistory(
  user: AuthenticatedUser,
  datasetId?: string
): Promise<{ cleared: true }> {
  await db
    .delete(searchHistory)
    .where(
      datasetId
        ? and(
            eq(searchHistory.userId, user.id),
            eq(searchHistory.datasetId, datasetId)
          )
        : eq(searchHistory.userId, user.id)
    );

  return { cleared: true };
}
