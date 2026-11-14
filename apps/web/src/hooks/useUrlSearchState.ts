'use client';

import {
  FILTER_OPERATORS,
  filterConditionSchema,
  SEARCH_MODES,
  searchModeSchema,
  sortRuleSchema,
  type FilterCondition,
  type SearchMode,
  type SortRule,
} from '@datascope/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveDatasetId } from '@/store/slices/datasetSlice';
import { setActiveViewId } from '@/store/slices/savedViewsSlice';
import {
  DEFAULT_SORTING,
  hydrateSearchConfigFromUrl,
  type SearchConfigState,
} from '@/store/slices/searchConfigSlice';

const uuidSchema = z.string().uuid();

function isDefaultSorting(sorting: SortRule[]): boolean {
  if (sorting.length !== DEFAULT_SORTING.length) return false;
  return (
    sorting[0]?.field === DEFAULT_SORTING[0]?.field &&
    sorting[0]?.direction === DEFAULT_SORTING[0]?.direction
  );
}

function parseSortParam(raw: string | null): SortRule[] {
  if (!raw) return DEFAULT_SORTING;
  const parsedRules: SortRule[] = [];
  for (const token of raw.split(',')) {
    const [field, dir] = token.split(':');
    const result = sortRuleSchema.safeParse({
      field: field?.trim(),
      direction: dir === 'asc' ? 'asc' : 'desc',
    });
    if (result.success) {
      parsedRules.push(result.data);
    }
  }
  return parsedRules.length > 0 ? parsedRules.slice(0, 5) : DEFAULT_SORTING;
}

function serializeSortParam(sorting: SortRule[]): string {
  return sorting.map((rule) => `${rule.field}:${rule.direction}`).join(',');
}

function parseFiltersParam(raw: string | null): FilterCondition[] {
  if (!raw) return [];
  try {
    const parsedJson: unknown = JSON.parse(raw);
    const result = filterConditionSchema.array().max(30).safeParse(parsedJson);
    if (result.success) {
      return result.data.filter((item) => {
        if (item.operator === FILTER_OPERATORS.IN) {
          return Array.isArray(item.value) ? item.value.length > 0 : String(item.value).length > 0;
        }
        return true;
      });
    }
  } catch {
    // Gracefully ignore malformed URL filter JSON (ADR-09)
  }
  return [];
}

export interface ParsedUrlSearchParams {
  datasetId: string | null;
  viewId: string | null;
  searchConfig: SearchConfigState;
  hasExplicitQueryState: boolean;
}

export function parseExplorerSearchParams(
  params: URLSearchParams
): ParsedUrlSearchParams {
  const rawDataset = params.get('dataset');
  const datasetCheck = rawDataset ? uuidSchema.safeParse(rawDataset) : null;
  const datasetId = datasetCheck?.success ? datasetCheck.data : null;

  const rawViewId = params.get('viewId');
  const viewCheck = rawViewId ? uuidSchema.safeParse(rawViewId) : null;
  const viewId = viewCheck?.success ? viewCheck.data : null;

  const rawQuery = params.get('q') ?? '';
  const modeResult = searchModeSchema.safeParse(params.get('mode'));
  const searchMode: SearchMode = modeResult.success ? modeResult.data : SEARCH_MODES.FTS;

  const filters = parseFiltersParam(params.get('filters'));
  const rawLogic = params.get('logic');
  const logicOperator: 'AND' | 'OR' = rawLogic === 'OR' ? 'OR' : 'AND';
  const sorting = parseSortParam(params.get('sort'));

  const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 && parsedPage <= 100000
      ? parsedPage
      : 1;

  const parsedLimit = Number.parseInt(params.get('limit') ?? '50', 10);
  const pageSize =
    Number.isFinite(parsedLimit) && parsedLimit >= 10 && parsedLimit <= 500
      ? parsedLimit
      : 50;

  const paginationMode = params.get('pm') === 'cursor' ? 'cursor' : 'offset';

  const hasExplicitQueryState = Boolean(
    params.has('q') ||
      params.has('mode') ||
      params.has('filters') ||
      params.has('logic') ||
      params.has('sort') ||
      params.has('page') ||
      params.has('limit') ||
      params.has('pm')
  );

  return {
    datasetId,
    viewId,
    hasExplicitQueryState,
    searchConfig: {
      globalQuery: rawQuery.slice(0, 500),
      searchMode,
      filters,
      logicOperator,
      sorting,
      pagination: {
        page,
        pageSize,
        mode: paginationMode,
        cursor: null,
      },
    },
  };
}

export function buildExplorerSearchParamsString(state: {
  activeDatasetId: string | null;
  activeViewId: string | null;
  isDirty: boolean;
  searchConfig: SearchConfigState;
}): string {
  const params = new URLSearchParams();

  if (state.activeDatasetId) {
    params.set('dataset', state.activeDatasetId);
  }
  if (state.activeViewId && !state.isDirty) {
    params.set('viewId', state.activeViewId);
  }
  if (state.searchConfig.globalQuery.trim().length > 0) {
    params.set('q', state.searchConfig.globalQuery);
  }
  if (state.searchConfig.searchMode !== SEARCH_MODES.FTS) {
    params.set('mode', state.searchConfig.searchMode);
  }
  if (state.searchConfig.filters.length > 0) {
    params.set('filters', JSON.stringify(state.searchConfig.filters));
    if (state.searchConfig.logicOperator !== 'AND') {
      params.set('logic', state.searchConfig.logicOperator);
    }
  }
  if (!isDefaultSorting(state.searchConfig.sorting)) {
    params.set('sort', serializeSortParam(state.searchConfig.sorting));
  }
  if (state.searchConfig.pagination.page > 1) {
    params.set('page', String(state.searchConfig.pagination.page));
  }
  if (state.searchConfig.pagination.pageSize !== 50) {
    params.set('limit', String(state.searchConfig.pagination.pageSize));
  }
  if (state.searchConfig.pagination.mode === 'cursor') {
    params.set('pm', 'cursor');
  }

  return params.toString();
}

/**
 * Bidirectional URL Search State Synchronization hook (ADR-09).
 * Keeps browser URL query parameters in lockstep with Redux search & dataset slices.
 */
export function useUrlSearchState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const activeDatasetId = useAppSelector((s) => s.dataset.activeDatasetId);
  const searchConfig = useAppSelector((s) => s.searchConfig);
  const activeViewId = useAppSelector((s) => s.savedViews.activeViewId);
  const isDirty = useAppSelector((s) => s.savedViews.isDirty);

  const currentQs = searchParams.toString();
  const parsedFromUrl = useMemo(
    () => parseExplorerSearchParams(new URLSearchParams(currentQs)),
    [currentQs]
  );

  const isHydratedRef = useRef(false);
  const lastWrittenQsRef = useRef<string | null>(null);
  const skipNextPushRef = useRef(false);

  // Direction 1: URL -> Redux (initial mount with params or browser Back/Forward navigation)
  useEffect(() => {
    const isInitialMount = !isHydratedRef.current;

    if (!isInitialMount && currentQs === lastWrittenQsRef.current) {
      return;
    }

    if (isInitialMount) {
      isHydratedRef.current = true;
      if (!currentQs) {
        return;
      }
    }

    lastWrittenQsRef.current = currentQs;
    skipNextPushRef.current = true;

    if (parsedFromUrl.datasetId) {
      dispatch(setActiveDatasetId(parsedFromUrl.datasetId));
    }

    if (parsedFromUrl.viewId && !parsedFromUrl.hasExplicitQueryState) {
      dispatch(setActiveViewId(parsedFromUrl.viewId));
      return;
    }

    dispatch(hydrateSearchConfigFromUrl(parsedFromUrl.searchConfig));
    if (parsedFromUrl.viewId) {
      dispatch(setActiveViewId(parsedFromUrl.viewId));
    }
  }, [currentQs, dispatch, parsedFromUrl]);

  // Direction 2: Redux -> URL (debounced / smooth shallow replace without full reload)
  useEffect(() => {
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }

    if (!isHydratedRef.current || !activeDatasetId) {
      return;
    }

    const nextQs = buildExplorerSearchParamsString({
      activeDatasetId,
      activeViewId,
      isDirty,
      searchConfig,
    });

    if (nextQs === currentQs || nextQs === lastWrittenQsRef.current) {
      return;
    }

    lastWrittenQsRef.current = nextQs;
    const targetUrl = nextQs ? `${pathname}?${nextQs}` : pathname;
    router.replace(targetUrl, { scroll: false });
  }, [
    activeDatasetId,
    activeViewId,
    currentQs,
    isDirty,
    pathname,
    router,
    searchConfig,
  ]);

  return {
    urlDatasetId: parsedFromUrl.datasetId,
    urlViewId: parsedFromUrl.viewId,
    hasExplicitQueryState: parsedFromUrl.hasExplicitQueryState,
  };
}
