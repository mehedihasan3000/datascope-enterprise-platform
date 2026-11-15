'use client';

import {
  SEARCH_MODES,
  type SearchMode,
} from '@datascope/shared';
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  Clock,
  Code2,
  Copy,
  Database,
  ExternalLink,
  RotateCcw,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { HighlightText } from '@/components/data-table/HighlightText';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { DynamicFilterBuilder } from '@/features/filter-builder/DynamicFilterBuilder';
import { RecordDetailDrawer } from '@/features/record-details/RecordDetailDrawer';
import { SaveViewModal } from '@/features/saved-views/SaveViewModal';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import { buildExplorerSearchParamsString } from '@/hooks/useUrlSearchState';
import {
  useGetDatasetByIdQuery,
  useGetDatasetsQuery,
} from '@/services/datasetsApi';
import { useSearchRecordsQuery } from '@/services/recordsApi';
import { useGetSavedViewsQuery } from '@/services/savedViewsApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveDatasetId } from '@/store/slices/datasetSlice';
import { openSaveModal } from '@/store/slices/savedViewsSlice';
import {
  resetSearchConfig,
  setGlobalQuery,
  setSearchMode,
} from '@/store/slices/searchConfigSlice';
import { setActiveDetailRecordId } from '@/store/slices/uiPreferencesSlice';
import { cn } from '@/utils/cn';
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatNumber,
} from '@/utils/formatters';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  Active: 'success',
  Pending: 'warning',
  Suspended: 'danger',
  Archived: 'default',
};

const SEARCH_MODES_INFO: Array<{
  mode: SearchMode;
  title: string;
  desc: string;
}> = [
  {
    mode: SEARCH_MODES.FTS,
    title: 'Full-Text Search (tsvector)',
    desc: 'Stemmed English tokens + prefix matching',
  },
  {
    mode: SEARCH_MODES.PARTIAL,
    title: 'Trigram Partial Match (pg_trgm)',
    desc: 'Fast substring matching across codes & text',
  },
  {
    mode: SEARCH_MODES.EXACT,
    title: 'Exact Equality Match',
    desc: 'Strict equality on indexed columns',
  },
];

export default function AdvancedSearchWorkbenchPage() {
  const dispatch = useAppDispatch();
  const { user, can } = usePermissions();

  const activeDatasetId = useAppSelector((s) => s.dataset.activeDatasetId);
  const searchConfig = useAppSelector((s) => s.searchConfig);

  const [queryText, setQueryText] = useState(searchConfig.globalQuery);
  const debouncedQuery = useDebounce(queryText, 300);
  const lastDispatchedRef = useRef(searchConfig.globalQuery);
  const [copiedAst, setCopiedAst] = useState(false);

  useEffect(() => {
    if (debouncedQuery !== lastDispatchedRef.current) {
      lastDispatchedRef.current = debouncedQuery;
      dispatch(setGlobalQuery(debouncedQuery));
    }
  }, [debouncedQuery, dispatch]);

  useEffect(() => {
    if (searchConfig.globalQuery !== lastDispatchedRef.current) {
      lastDispatchedRef.current = searchConfig.globalQuery;
      setQueryText(searchConfig.globalQuery);
    }
  }, [searchConfig.globalQuery]);

  const { data: datasetsRes, isLoading: isDatasetsLoading } = useGetDatasetsQuery();
  const datasets = datasetsRes?.data ?? [];

  useEffect(() => {
    if (!activeDatasetId && datasets.length > 0) {
      const preferred = user?.preferences?.defaultDatasetId;
      const valid = datasets.find((d) => d.id === preferred);
      dispatch(setActiveDatasetId(valid ? valid.id : datasets[0]!.id));
    }
  }, [activeDatasetId, datasets, dispatch, user?.preferences?.defaultDatasetId]);

  const { data: datasetDetailRes, isLoading: isSchemaLoading } =
    useGetDatasetByIdQuery(activeDatasetId!, { skip: !activeDatasetId });

  const fields = datasetDetailRes?.data?.fields ?? [];

  const { data: savedViewsRes } = useGetSavedViewsQuery(activeDatasetId ?? undefined, {
    skip: !activeDatasetId,
  });

  const compiledRequest = useMemo(
    () => ({
      searchQuery: searchConfig.globalQuery,
      searchMode: searchConfig.searchMode,
      filters: searchConfig.filters,
      logicOperator: searchConfig.logicOperator,
      sorting: searchConfig.sorting,
      page: 1,
      pageSize: 25,
      paginationMode: 'offset' as const,
      cursor: null,
      recordHistoryLog: true,
    }),
    [searchConfig]
  );

  const {
    data: searchRes,
    isLoading: isSearchLoading,
    isFetching: isSearchFetching,
    isError: isSearchError,
    refetch,
  } = useSearchRecordsQuery(
    {
      datasetId: activeDatasetId!,
      query: compiledRequest,
    },
    { skip: !activeDatasetId }
  );

  const explorerHref = useMemo(() => {
    const qs = buildExplorerSearchParamsString({
      activeDatasetId,
      activeViewId: null,
      isDirty: false,
      searchConfig,
    });
    return qs ? `/explorer?${qs}` : '/explorer';
  }, [activeDatasetId, searchConfig]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    lastDispatchedRef.current = queryText;
    dispatch(setGlobalQuery(queryText));
  };

  const handleCopyPayload = () => {
    void navigator.clipboard.writeText(JSON.stringify(compiledRequest, null, 2));
    setCopiedAst(true);
    setTimeout(() => setCopiedAst(false), 1800);
  };

  if (isDatasetsLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <TableSkeleton rows={6} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Workbench Header & Dataset Selector */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="indigo">
                <Sparkles className="h-3 w-3" />
                Section 3.C Query Workbench
              </Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Build & test combined full-text, trigram, numeric range, and date window queries
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Multi-Clause Search & AST Query Constructor
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can('views:save') && activeDatasetId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => dispatch(openSaveModal())}
              >
                <BookmarkPlus className="h-3.5 w-3.5 text-indigo-500" />
                Save View
              </Button>
            )}

            <Link
              href={explorerHref}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Open Full Workspace
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Dataset + Query Input */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 h-10">
            <Database className="h-4 w-4 text-indigo-500 shrink-0" />
            <select
              aria-label="Target dataset"
              value={activeDatasetId ?? ''}
              onChange={(e) => {
                dispatch(setActiveDatasetId(e.target.value));
                dispatch(resetSearchConfig());
              }}
              className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none truncate cursor-pointer"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id} className="bg-white dark:bg-slate-900">
                  {ds.name} ({formatCompactNumber(ds.totalRecords)})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-6 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Global search terms (e.g. Germany FinTech, ENT-00048291, Siemens)..."
              aria-label="Global search text"
              className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="lg:col-span-2 flex items-center gap-2">
            <Button type="submit" variant="primary" size="md" className="flex-1 h-10">
              Run Query
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Reset query"
              onClick={() => {
                lastDispatchedRef.current = '';
                setQueryText('');
                dispatch(resetSearchConfig());
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Search Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {SEARCH_MODES_INFO.map((item) => {
            const active = searchConfig.searchMode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => dispatch(setSearchMode(item.mode))}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors cursor-pointer',
                  active
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                )}
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {item.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Filter Builder & Live JSON AST Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          {!isSchemaLoading && fields.length > 0 && (
            <DynamicFilterBuilder fields={fields} isExpanded />
          )}
        </div>

        {/* Live AST Preview */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              <Code2 className="h-4 w-4 text-indigo-500" />
              Compiled Search Request
            </div>
            <button
              type="button"
              onClick={handleCopyPayload}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copiedAst ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy JSON
                </>
              )}
            </button>
          </div>

          <pre className="flex-1 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] font-mono text-indigo-200">
            {JSON.stringify(compiledRequest, null, 2)}
          </pre>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Validated via Zod SearchSchema</span>
            <span>POST /datasets/:id/records/search</span>
          </div>
        </div>
      </div>

      {/* Live Preview Results */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              Live Preview Results (Top 25)
            </span>
            {searchRes?.meta && (
              <>
                <Badge variant="indigo" className="tabular-nums">
                  {formatNumber(searchRes.meta.totalRecords)} matching records
                </Badge>
                <Badge variant="default" className="tabular-nums">
                  <Clock className="h-3 w-3 text-indigo-400" />
                  {searchRes.meta.executionTimeMs} ms
                </Badge>
                {searchRes.meta.cacheHit && (
                  <Badge variant="success">
                    <Zap className="h-3 w-3" />
                    Cache Hit
                  </Badge>
                )}
              </>
            )}
          </div>

          <Link
            href={explorerHref}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            Inspect all pages in Data Explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isSearchLoading && !searchRes ? (
          <div className="p-4">
            <TableSkeleton rows={6} columns={6} />
          </div>
        ) : isSearchError ? (
          <div className="p-4">
            <ErrorState
              title="Search query execution failed"
              onRetry={() => void refetch()}
            />
          </div>
        ) : (searchRes?.data?.length ?? 0) === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Zero matching records"
              description="Modify search terms or relax filter conditions to widen matches."
            />
          </div>
        ) : (
          <div className={cn('overflow-x-auto', isSearchFetching && 'opacity-70')}>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Entity ID</th>
                  <th className="px-4 py-2.5">Organization</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Country</th>
                  <th className="px-4 py-2.5">Sector</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                  <th className="px-4 py-2.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {searchRes?.data.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => dispatch(setActiveDetailRecordId(record.id))}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/45 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-indigo-600 dark:text-indigo-400">
                      <HighlightText
                        text={record.recordCode}
                        query={searchConfig.globalQuery}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      <HighlightText
                        text={record.title}
                        query={searchConfig.globalQuery}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_BADGE[record.status] ?? 'outline'}>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      <HighlightText
                        text={record.country}
                        query={searchConfig.globalQuery}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {record.category}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(record.revenue)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">
                      {formatDate(record.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordDetailDrawer />

      {activeDatasetId && (
        <SaveViewModal
          datasetId={activeDatasetId}
          fields={fields}
          existingViews={savedViewsRes?.data ?? []}
        />
      )}
    </div>
  );
}
