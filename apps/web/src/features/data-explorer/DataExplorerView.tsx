'use client';

import {
  SEARCH_MODES,
  type DatasetFieldDTO,
  type SavedViewDTO,
  type SearchMode,
} from '@datascope/shared';
import {
  Bookmark,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  RotateCcw,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { EnterpriseDataTable } from '@/components/data-table/EnterpriseDataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { DynamicFilterBuilder } from '@/features/filter-builder/DynamicFilterBuilder';
import { RecordDetailDrawer } from '@/features/record-details/RecordDetailDrawer';
import { SaveViewModal } from '@/features/saved-views/SaveViewModal';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import { useUrlSearchState } from '@/hooks/useUrlSearchState';
import {
  useGetDatasetByIdQuery,
  useGetDatasetsQuery,
} from '@/services/datasetsApi';
import { useSearchRecordsQuery } from '@/services/recordsApi';
import {
  useGetSavedViewsQuery,
  useLazyGetSavedViewByIdQuery,
} from '@/services/savedViewsApi';
import { useUpdateMyPreferencesMutation } from '@/services/usersApi';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setActiveDatasetId,
  setColumnVisibility,
} from '@/store/slices/datasetSlice';
import {
  clearActiveView,
  openSaveModal,
  setActiveViewId,
} from '@/store/slices/savedViewsSlice';
import {
  applySavedViewConfig,
  resetSearchConfig,
  setGlobalQuery,
  setSearchMode,
} from '@/store/slices/searchConfigSlice';
import {
  addToast,
  setActiveDetailRecordId,
  setFilterDrawerOpen,
  setTableDensity,
} from '@/store/slices/uiPreferencesSlice';
import { cn } from '@/utils/cn';
import { formatCompactNumber, formatNumber } from '@/utils/formatters';

const SEARCH_MODE_META: Array<{
  mode: SearchMode;
  label: string;
  hint: string;
}> = [
  { mode: SEARCH_MODES.FTS, label: 'Full-Text', hint: 'PostgreSQL tsvector + stemming' },
  { mode: SEARCH_MODES.PARTIAL, label: 'Partial', hint: 'pg_trgm substring ILIKE' },
  { mode: SEARCH_MODES.EXACT, label: 'Exact', hint: 'Exact column equality match' },
];

const DENSITY_OPTIONS: Array<{
  value: 'compact' | 'comfortable' | 'spacious';
  label: string;
}> = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Balanced' },
  { value: 'spacious', label: 'Spacious' },
];

export function DataExplorerView() {
  const dispatch = useAppDispatch();
  const { can } = usePermissions();

  const { urlDatasetId, urlViewId, hasExplicitQueryState } = useUrlSearchState();

  const user = useAppSelector((s) => s.auth.user);
  const activeDatasetId = useAppSelector((s) => s.dataset.activeDatasetId);
  const searchConfig = useAppSelector((s) => s.searchConfig);
  const activeViewId = useAppSelector((s) => s.savedViews.activeViewId);
  const isDirty = useAppSelector((s) => s.savedViews.isDirty);
  const isFilterDrawerOpen = useAppSelector(
    (s) => s.uiPreferences.isFilterDrawerOpen
  );
  const tableDensity = useAppSelector((s) => s.uiPreferences.tableDensity);

  // Debounced search input synchronized cleanly with searchConfig.globalQuery
  const [searchInput, setSearchInput] = useState(searchConfig.globalQuery);
  const debouncedSearch = useDebounce(searchInput, 300);
  const lastDispatchedQueryRef = useRef(searchConfig.globalQuery);

  useEffect(() => {
    if (debouncedSearch !== lastDispatchedQueryRef.current) {
      lastDispatchedQueryRef.current = debouncedSearch;
      dispatch(setGlobalQuery(debouncedSearch));
    }
  }, [debouncedSearch, dispatch]);

  useEffect(() => {
    if (searchConfig.globalQuery !== lastDispatchedQueryRef.current) {
      lastDispatchedQueryRef.current = searchConfig.globalQuery;
      setSearchInput(searchConfig.globalQuery);
    }
  }, [searchConfig.globalQuery]);

  // Datasets & Active Dataset Schema
  const {
    data: datasetsRes,
    isLoading: isDatasetsLoading,
    isError: isDatasetsError,
    refetch: refetchDatasets,
  } = useGetDatasetsQuery();

  const datasets = useMemo(() => datasetsRes?.data ?? [], [datasetsRes]);

  useEffect(() => {
    if (!activeDatasetId && !urlDatasetId && !urlViewId && datasets.length > 0) {
      const preferredId = user?.preferences?.defaultDatasetId;
      const valid = datasets.find((d) => d.id === preferredId);
      dispatch(setActiveDatasetId(valid ? valid.id : datasets[0]!.id));
    }
  }, [
    activeDatasetId,
    datasets,
    dispatch,
    urlDatasetId,
    urlViewId,
    user?.preferences?.defaultDatasetId,
  ]);

  const {
    data: datasetDetailRes,
    isLoading: isSchemaLoading,
    isError: isSchemaError,
    error: schemaError,
    refetch: refetchDatasetDetail,
  } = useGetDatasetByIdQuery(activeDatasetId!, {
    skip: !activeDatasetId,
  });

  const activeDataset = datasetDetailRes?.data;
  const datasetFields: DatasetFieldDTO[] = useMemo(
    () => activeDataset?.fields ?? [],
    [activeDataset?.fields]
  );

  // Saved Views for Active Dataset + Deep-link ?viewId= Support
  const { data: savedViewsRes } = useGetSavedViewsQuery(activeDatasetId ?? undefined, {
    skip: !activeDatasetId,
  });
  const savedViews = useMemo(() => savedViewsRes?.data ?? [], [savedViewsRes]);
  const [triggerGetSavedView] = useLazyGetSavedViewByIdQuery();
  const appliedUrlViewRef = useRef<string | null>(null);

  const applyViewToExplorer = useCallback(
    (view: SavedViewDTO, fieldsForVisibility?: DatasetFieldDTO[]) => {
      if (view.datasetId !== activeDatasetId) {
        dispatch(setActiveDatasetId(view.datasetId));
      }

      lastDispatchedQueryRef.current = view.searchQuery ?? '';
      setSearchInput(view.searchQuery ?? '');

      dispatch(
        applySavedViewConfig({
          searchQuery: view.searchQuery ?? '',
          searchMode: view.searchMode ?? SEARCH_MODES.FTS,
          filters: view.filters ?? [],
          sorting: view.sorting ?? [],
        })
      );
      dispatch(setActiveViewId(view.id));

      if (view.visibleColumns && view.visibleColumns.length > 0) {
        const schema = fieldsForVisibility ?? datasetFields;
        if (schema.length > 0) {
          const visibilityMap: Record<string, boolean> = {};
          const visibleSet = new Set(view.visibleColumns);
          for (const f of schema) {
            visibilityMap[f.fieldKey] = visibleSet.has(f.fieldKey);
          }
          dispatch(
            setColumnVisibility({
              datasetId: view.datasetId,
              visibility: visibilityMap,
            })
          );
        }
      }

      if ((view.filters?.length ?? 0) > 0) {
        dispatch(setFilterDrawerOpen(true));
      }
    },
    [activeDatasetId, datasetFields, dispatch]
  );

  // Auto-apply ?viewId=... when opened from Saved Views or shared link
  useEffect(() => {
    if (
      !urlViewId ||
      hasExplicitQueryState ||
      appliedUrlViewRef.current === urlViewId
    ) {
      return;
    }

    const foundInList = savedViews.find((v) => v.id === urlViewId);
    if (foundInList) {
      appliedUrlViewRef.current = urlViewId;
      applyViewToExplorer(foundInList);
      return;
    }

    appliedUrlViewRef.current = urlViewId;
    void triggerGetSavedView(urlViewId)
      .unwrap()
      .then((res) => {
        if (res.data) {
          applyViewToExplorer(res.data);
        }
      })
      .catch(() => {
        dispatch(
          addToast({
            variant: 'warning',
            title: 'Saved view unavailable',
            description: 'The requested saved view could not be loaded.',
          })
        );
      });
  }, [
    applyViewToExplorer,
    dispatch,
    hasExplicitQueryState,
    savedViews,
    triggerGetSavedView,
    urlViewId,
  ]);

  // Execute Server-Side Search via RTK Query (ADR-01 / ADR-02)
  const searchQueryBody = useMemo(
    () => ({
      searchQuery: searchConfig.globalQuery,
      searchMode: searchConfig.searchMode,
      filters: searchConfig.filters,
      logicOperator: searchConfig.logicOperator,
      sorting: searchConfig.sorting,
      page: searchConfig.pagination.page,
      pageSize: searchConfig.pagination.pageSize,
      paginationMode: searchConfig.pagination.mode,
      cursor: searchConfig.pagination.cursor,
      recordHistoryLog: true,
    }),
    [searchConfig]
  );

  const {
    data: searchResponse,
    isLoading: isRecordsLoading,
    isFetching: isRecordsFetching,
    isError: isRecordsError,
    error: recordsError,
    refetch: refetchRecords,
  } = useSearchRecordsQuery(
    {
      datasetId: activeDatasetId!,
      query: searchQueryBody,
    },
    {
      skip: !activeDatasetId,
    }
  );

  const [updatePreferences] = useUpdateMyPreferencesMutation();

  const handleSearchFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchInput !== lastDispatchedQueryRef.current) {
      lastDispatchedQueryRef.current = searchInput;
      dispatch(setGlobalQuery(searchInput));
    }
  };

  const handleClearSearchAndFilters = () => {
    lastDispatchedQueryRef.current = '';
    setSearchInput('');
    dispatch(resetSearchConfig());
    dispatch(clearActiveView());
  };

  const handleDensityChange = (nextDensity: 'compact' | 'comfortable' | 'spacious') => {
    dispatch(setTableDensity(nextDensity));
    if (user) {
      void updatePreferences({ tableDensity: nextDensity });
    }
  };

  const activeView = useMemo(
    () => savedViews.find((v) => v.id === activeViewId) ?? null,
    [activeViewId, savedViews]
  );

  const recordsErrMessage =
    recordsError && 'data' in recordsError
      ? (recordsError.data as { error?: { message?: string } })?.error?.message
      : undefined;

  const schemaErrMessage =
    schemaError && 'data' in schemaError
      ? (schemaError.data as { error?: { message?: string } })?.error?.message
      : undefined;

  if (isDatasetsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={10} columns={6} />
      </div>
    );
  }

  if (isDatasetsError) {
    return (
      <ErrorState
        title="Unable to load authorized datasets"
        message="Could not retrieve dataset collections from the DataScope API."
        onRetry={() => void refetchDatasets()}
      />
    );
  }

  if (datasets.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="No authorized datasets available"
        description="Your account currently does not have view permissions for any datasets. Contact an Administrator to request access."
      />
    );
  }

  const canSaveViews = can('views:save');

  return (
    <div className="space-y-4">
      {/* Top Workspace Control Deck: Dataset Identity, Telemetry & Saved Views */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Dataset Identity + Live Telemetry Badges */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-1.5">
              <Database className="h-4 w-4 text-indigo-500 shrink-0" />
              <select
                aria-label="Select dataset to explore"
                value={activeDatasetId ?? ''}
                onChange={(e) => {
                  const nextId = e.target.value;
                  if (nextId !== activeDatasetId) {
                    lastDispatchedQueryRef.current = '';
                    setSearchInput('');
                    dispatch(setActiveDatasetId(nextId));
                    dispatch(resetSearchConfig());
                    dispatch(clearActiveView());
                  }
                }}
                className="bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none max-w-[260px] truncate cursor-pointer"
              >
                {datasets.map((ds) => (
                  <option
                    key={ds.id}
                    value={ds.id}
                    className="bg-white dark:bg-slate-900"
                  >
                    {ds.name} ({formatCompactNumber(ds.totalRecords)})
                  </option>
                ))}
              </select>
            </div>

            {activeDataset && (
              <>
                <Badge variant="outline">
                  Source: {activeDataset.dataSource}
                </Badge>
                <Badge variant="indigo" className="tabular-nums">
                  {formatNumber(
                    searchResponse?.meta?.totalRecords ?? activeDataset.totalRecords
                  )}{' '}
                  matches / {formatCompactNumber(activeDataset.totalRecords)} total
                </Badge>
              </>
            )}

            {searchResponse?.meta && (
              <>
                <Badge variant="default" className="tabular-nums">
                  <Clock className="h-3 w-3 text-indigo-400" />
                  {searchResponse.meta.executionTimeMs} ms
                </Badge>
                {searchResponse.meta.cacheHit && (
                  <Badge variant="success">
                    <Zap className="h-3 w-3" />
                    Cache Hit
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Right Controls: Saved Views Picker, Save Button & Table Density */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Saved Views Quick Switcher */}
            {savedViews.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5">
                <Bookmark className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <select
                  aria-label="Load saved view"
                  value={activeViewId ?? ''}
                  onChange={(e) => {
                    const viewId = e.target.value;
                    if (!viewId) {
                      dispatch(clearActiveView());
                      return;
                    }
                    const view = savedViews.find((v) => v.id === viewId);
                    if (view) {
                      applyViewToExplorer(view);
                    }
                  }}
                  className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none max-w-[180px] truncate cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-slate-900">
                    Load Saved View...
                  </option>
                  {savedViews.map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                      className="bg-white dark:bg-slate-900"
                    >
                      {v.name} {v.isShared ? '(Shared)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeView && (
              <Badge variant={isDirty ? 'warning' : 'success'}>
                {isDirty ? 'View Modified' : 'View Synced'}
              </Badge>
            )}

            {canSaveViews && activeDatasetId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  dispatch(
                    openSaveModal(
                      activeView && activeView.userId === user?.id
                        ? { editingViewId: activeView.id }
                        : undefined
                    )
                  )
                }
              >
                <BookmarkPlus className="h-3.5 w-3.5 text-indigo-500" />
                {activeView && isDirty && activeView.userId === user?.id
                  ? 'Update View'
                  : 'Save View'}
              </Button>
            )}

            {/* Table Density Switcher */}
            <div
              className="hidden sm:inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5"
              title="Table row density"
            >
              <Rows3 className="h-3.5 w-3.5 text-slate-400 mx-1.5" />
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleDensityChange(opt.value)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                    tableDensity === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global Search Input + Search Mode Switcher + Filter Panel Toggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          <form
            onSubmit={handleSearchFormSubmit}
            className="relative flex-1 flex items-center"
          >
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search organizations, entity codes (e.g. ENT-00048291), categories, countries, or tags... (Press Enter for instant search)"
              aria-label="Global dataset search"
              className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 pl-9 pr-9 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => {
                  lastDispatchedQueryRef.current = '';
                  setSearchInput('');
                  dispatch(setGlobalQuery(''));
                }}
                className="absolute right-2.5 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Search Mode Selector */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Search matching mode"
              className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5"
            >
              {SEARCH_MODE_META.map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  title={item.hint}
                  onClick={() => dispatch(setSearchMode(item.mode))}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    searchConfig.searchMode === item.mode
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <Button
              variant={isFilterDrawerOpen ? 'primary' : 'outline'}
              size="md"
              onClick={() => dispatch(setFilterDrawerOpen(!isFilterDrawerOpen))}
              className="h-10"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {searchConfig.filters.length > 0 && (
                <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500/20 px-1.5 text-[11px] font-bold">
                  {searchConfig.filters.length}
                </span>
              )}
            </Button>

            {(searchConfig.globalQuery ||
              searchConfig.filters.length > 0 ||
              activeViewId) && (
              <Button
                variant="ghost"
                size="md"
                onClick={handleClearSearchAndFilters}
                title="Reset all search parameters and filters"
                className="h-10"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Schema Error State */}
      {isSchemaError && (
        <ErrorState
          title="Unable to load dataset field schema"
          message={schemaErrMessage}
          onRetry={() => void refetchDatasetDetail()}
        />
      )}

      {/* Dynamic Field-Typed Filter Builder + Preset Chips */}
      {!isSchemaLoading && datasetFields.length > 0 && (
        <DynamicFilterBuilder
          fields={datasetFields}
          isExpanded={isFilterDrawerOpen}
          onToggleExpanded={() => dispatch(setFilterDrawerOpen(!isFilterDrawerOpen))}
        />
      )}

      {/* Virtualized Enterprise Data Table */}
      {activeDatasetId && (
        <EnterpriseDataTable
          datasetId={activeDatasetId}
          fields={datasetFields}
          records={searchResponse?.data ?? []}
          meta={searchResponse?.meta}
          effectivePermissions={activeDataset?.effectivePermissions}
          isLoading={isSchemaLoading || (isRecordsLoading && !searchResponse)}
          isFetching={isRecordsFetching}
          isError={isRecordsError}
          errorMessage={recordsErrMessage}
          onRetry={() => void refetchRecords()}
          onInspectRecord={(recordId) =>
            dispatch(setActiveDetailRecordId(recordId))
          }
          onClearAllFilters={handleClearSearchAndFilters}
        />
      )}

      {/* Footer RBAC Capability Indicator */}
      {activeDataset?.effectivePermissions && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Dataset Access Verified
            </span>
            <span>
              Permissions:{' '}
              {[
                activeDataset.effectivePermissions.canView && 'View',
                activeDataset.effectivePermissions.canSearch && 'Search',
                activeDataset.effectivePermissions.canExport && 'Export',
                activeDataset.effectivePermissions.canManage && 'Manage',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Server-side filtering & virtualization active
          </span>
        </div>
      )}

      {/* Slide-over Record Intelligence Drawer */}
      <RecordDetailDrawer />

      {/* Save / Update Saved View Modal */}
      {activeDatasetId && (
        <SaveViewModal
          datasetId={activeDatasetId}
          fields={datasetFields}
          existingViews={savedViews}
        />
      )}
    </div>
  );
}
