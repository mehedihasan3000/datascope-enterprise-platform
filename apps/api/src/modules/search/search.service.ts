import type {
  DatasetRecordDTO,
  PaginationMeta,
  SearchQueryRequest,
} from '@datascope/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { datasetRecords, datasets, searchHistory } from '../../db/schema/index.js';
import type { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import {
  buildOrderByClauses,
  buildSearchWhereClause,
  encodeCursor,
} from '../../utils/query-builder.js';
import { TtlCache, type TtlCacheStats } from '../../utils/ttl-cache.js';

export interface SearchExecutionResult {
  records: DatasetRecordDTO[];
  meta: PaginationMeta;
}

interface CachedSearchEntry {
  records: DatasetRecordDTO[];
  totalRecords: number;
  totalPages: number;
  nextCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const searchResultCache = new TtlCache<CachedSearchEntry>({
  maxEntries: 500,
  ttlMs: 120_000, // 2 minutes TTL (ADR-08)
});

export function getSearchCacheStats(): TtlCacheStats {
  return searchResultCache.stats();
}

export function invalidateDatasetSearchCache(datasetId?: string): void {
  if (datasetId) {
    searchResultCache.deleteByPrefix(`${datasetId}:`);
  } else {
    searchResultCache.clear();
  }
}

function buildCacheKey(datasetId: string, req: SearchQueryRequest): string {
  return `${datasetId}:${JSON.stringify({
    q: req.searchQuery ?? '',
    m: req.searchMode ?? 'fts',
    f: req.filters ?? [],
    lo: req.logicOperator ?? 'AND',
    s: req.sorting ?? [],
    p: req.page ?? 1,
    ps: req.pageSize ?? 50,
    pm: req.paginationMode ?? 'offset',
    c: req.cursor ?? null,
  })}`;
}

export function mapRecordRowToDto(
  row: typeof datasetRecords.$inferSelect
): DatasetRecordDTO {
  return {
    id: row.id,
    datasetId: row.datasetId,
    recordCode: row.recordCode,
    title: row.title,
    category: row.category,
    status: row.status,
    country: row.country,
    revenue: Number(row.revenue),
    employeeCount: row.employeeCount,
    riskScore: Number(row.riskScore),
    attributes: row.attributes ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function logSearchExecution(
  userId: string,
  datasetId: string,
  req: SearchQueryRequest,
  resultCount: number,
  executionTimeMs: number
): Promise<void> {
  const hasSearchTerm = Boolean(req.searchQuery && req.searchQuery.trim().length > 0);
  const hasFilters = Boolean(req.filters && req.filters.length > 0);
  const isFirstPage = (req.page ?? 1) === 1 && !req.cursor;

  if (req.recordHistoryLog === false || !isFirstPage || (!hasSearchTerm && !hasFilters)) {
    return;
  }

  try {
    await db.insert(searchHistory).values({
      userId,
      datasetId,
      searchQuery: (req.searchQuery ?? '').trim(),
      filters: req.filters ?? [],
      sorting: req.sorting ?? [],
      resultCount,
      executionTimeMs,
    });
  } catch (err) {
    console.error('Non-fatal error logging search history:', err);
  }
}

export async function executeDatasetSearch(
  datasetId: string,
  request: SearchQueryRequest,
  user: AuthenticatedUser
): Promise<SearchExecutionResult> {
  const start = performance.now();
  const page = request.page ?? 1;
  const pageSize = request.pageSize ?? 50;
  const paginationMode = request.paginationMode ?? 'offset';
  const cacheKey = buildCacheKey(datasetId, request);

  const cached = searchResultCache.get(cacheKey);
  if (cached) {
    const executionTimeMs = Math.max(1, Math.round(performance.now() - start));
    void logSearchExecution(
      user.id,
      datasetId,
      request,
      cached.totalRecords,
      executionTimeMs
    );

    return {
      records: cached.records,
      meta: {
        page,
        pageSize,
        totalRecords: cached.totalRecords,
        totalPages: cached.totalPages,
        nextCursor: cached.nextCursor,
        hasNextPage: cached.hasNextPage,
        hasPreviousPage: cached.hasPreviousPage,
        executionTimeMs,
        cacheHit: true,
      },
    };
  }

  const { baseWhereSql, paginatedWhereSql, isUnfilteredDatasetQuery } =
    buildSearchWhereClause(datasetId, request);
  const orderByClauses = buildOrderByClauses(request.sorting, paginationMode);
  const offset = paginationMode === 'cursor' ? 0 : (page - 1) * pageSize;

  const recordsPromise = db
    .select()
    .from(datasetRecords)
    .where(paginatedWhereSql)
    .orderBy(...orderByClauses)
    .limit(pageSize)
    .offset(offset);

  const countPromise: Promise<number> = isUnfilteredDatasetQuery
    ? db
        .select({ totalRecords: datasets.totalRecords })
        .from(datasets)
        .where(eq(datasets.id, datasetId))
        .limit(1)
        .then((r) => r[0]?.totalRecords ?? 0)
    : db
        .select({ count: sql<number>`count(*)::int` })
        .from(datasetRecords)
        .where(baseWhereSql)
        .then((r) => Number(r[0]?.count ?? 0));

  const [rows, totalRecords] = await Promise.all([recordsPromise, countPromise]);
  const records = rows.map(mapRecordRowToDto);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const lastRecord = records[records.length - 1];
  const nextCursor =
    lastRecord && records.length === pageSize
      ? encodeCursor({ createdAt: lastRecord.createdAt, id: lastRecord.id })
      : null;

  const hasNextPage =
    paginationMode === 'cursor' ? Boolean(nextCursor) : page < totalPages;
  const hasPreviousPage =
    paginationMode === 'cursor' ? Boolean(request.cursor) : page > 1;

  const entry: CachedSearchEntry = {
    records,
    totalRecords,
    totalPages,
    nextCursor,
    hasNextPage,
    hasPreviousPage,
  };
  searchResultCache.set(cacheKey, entry);

  const executionTimeMs = Math.max(1, Math.round(performance.now() - start));

  void logSearchExecution(user.id, datasetId, request, totalRecords, executionTimeMs);

  return {
    records,
    meta: {
      page,
      pageSize,
      totalRecords,
      totalPages,
      nextCursor,
      hasNextPage,
      hasPreviousPage,
      executionTimeMs,
      cacheHit: false,
    },
  };
}
