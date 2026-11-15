'use client';

import {
  Activity,
  ArrowRight,
  BarChart3,
  BookmarkCheck,
  Clock,
  Database,
  DollarSign,
  History,
  ShieldAlert,
  Sparkles,
  Table2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { buildExplorerSearchParamsString } from '@/hooks/useUrlSearchState';
import { useGetAnalyticsOverviewQuery } from '@/services/analyticsApi';
import { useGetDatasetsQuery } from '@/services/datasetsApi';
import { useGetSearchHistoryQuery } from '@/services/historyApi';
import { useGetSavedViewsQuery } from '@/services/savedViewsApi';
import { useAppDispatch } from '@/store';
import { setActiveDatasetId } from '@/store/slices/datasetSlice';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
} from '@/utils/formatters';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { user, can } = usePermissions();

  const {
    data: datasetsRes,
    isLoading: isDatasetsLoading,
    isError: isDatasetsError,
    refetch: refetchDatasets,
  } = useGetDatasetsQuery();

  const {
    data: analyticsRes,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    refetch: refetchAnalytics,
  } = useGetAnalyticsOverviewQuery();

  const { data: savedViewsRes, isLoading: isViewsLoading } =
    useGetSavedViewsQuery();

  const { data: historyRes, isLoading: isHistoryLoading } =
    useGetSearchHistoryQuery({ limit: 6 });

  const datasets = datasetsRes?.data ?? [];
  const analytics = analyticsRes?.data;
  const savedViews = (savedViewsRes?.data ?? []).slice(0, 5);
  const recentSearches = historyRes?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Executive Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-white to-cyan-500/5 dark:from-indigo-950/50 dark:via-[#0d1322] dark:to-cyan-950/30 p-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="indigo">
              <Sparkles className="h-3 w-3" />
              Enterprise Command Center
            </Badge>
            {user && <Badge variant="outline">{user.role}</Badge>}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {user?.fullName ?? 'Explorer'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Monitor real-time metrics across authorized cloud PostgreSQL collections, jump into virtualized 100k+ discovery tables, or resume recent analytical investigations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/explorer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <Table2 className="h-4 w-4" />
            Launch Data Explorer
          </Link>
          {can('analytics:view') && (
            <Link
              href="/analytics"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Open Analytics
            </Link>
          )}
        </div>
      </div>

      {/* Top KPI Cards */}
      {isAnalyticsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton className="min-h-[136px]" />
          <CardSkeleton className="min-h-[136px]" />
          <CardSkeleton className="min-h-[136px]" />
          <CardSkeleton className="min-h-[136px]" />
        </div>
      ) : isAnalyticsError ? (
        <ErrorState
          title="Unable to compute overview metrics"
          onRetry={() => void refetchAnalytics()}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-h-[136px] flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>Authorized Records</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <Database className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {formatNumber(analytics?.summary.totalRecords ?? 0)}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatNumber(analytics?.summary.activeRecords ?? 0)}
              </strong>{' '}
              active across {analytics?.summary.totalDatasets ?? datasets.length} dataset(s)
            </div>
          </div>

          <div className="min-h-[136px] flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>Aggregate Revenue</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {formatCompactCurrency(analytics?.summary.totalRevenue ?? 0)}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              Avg per entity:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {formatCurrency(analytics?.summary.averageRevenue ?? 0)}
              </strong>
            </div>
          </div>

          <div className="min-h-[136px] flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>Avg Query Latency</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <Zap className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {analytics?.summary.avgSearchLatencyMs ?? 0} ms
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {formatNumber(analytics?.summary.totalSearchesExecuted ?? 0)} logged queries ·{' '}
              {analytics?.summary.totalSavedViews ?? 0} saved views
            </div>
          </div>

          <div className="min-h-[136px] flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>Mean Intelligence Risk</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {(analytics?.summary.averageRiskScore ?? 0).toFixed(2)} / 100
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Computed via live SQL aggregation
            </div>
          </div>
        </div>
      )}

      {/* Quick Dataset Launchers */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-500" />
            Authorized Dataset Collections
          </h3>
          <Link
            href="/datasets"
            className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            {can('datasets:manage') ? 'Manage Datasets' : 'Browse Datasets'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isDatasetsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CardSkeleton className="min-h-[208px]" />
            <CardSkeleton className="min-h-[208px]" />
            <CardSkeleton className="min-h-[208px]" />
          </div>
        ) : isDatasetsError ? (
          <ErrorState
            title="Failed to load datasets"
            onRetry={() => void refetchDatasets()}
          />
        ) : datasets.length === 0 ? (
          <EmptyState
            title="No authorized datasets"
            description="Request dataset access from an Administrator to start exploring records."
          />
        ) : (
          <div
            className={
              datasets.length === 2
                ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                : datasets.length === 1
                  ? 'grid grid-cols-1 max-w-xl gap-4'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            }
          >
            {datasets.map((ds) => (
              <div
                key={ds.id}
                className="min-h-[208px] flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm hover:border-indigo-500/40 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="indigo">{ds.category}</Badge>
                    <Badge variant="outline" className="tabular-nums">
                      {formatNumber(ds.totalRecords)} rows
                    </Badge>
                  </div>

                  <h4 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                    {ds.name}
                  </h4>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {ds.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    Updated {formatDate(ds.updatedAt)}
                  </span>

                  <Link
                    href={`/explorer?dataset=${ds.id}`}
                    onClick={() => dispatch(setActiveDatasetId(ds.id))}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/12 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors shrink-0"
                  >
                    Explore
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Saved Views & Search History Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Recent Saved Views */}
        <section className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 text-indigo-500" />
              Saved & Shared Views
            </h3>
            <Link
              href="/saved-views"
              className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
            >
              View All
            </Link>
          </div>

          {isViewsLoading ? (
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-[62px] w-full rounded-xl" />
              <Skeleton className="h-[62px] w-full rounded-xl" />
              <Skeleton className="h-[62px] w-full rounded-xl" />
            </div>
          ) : savedViews.length === 0 ? (
            <EmptyState
              icon={BookmarkCheck}
              title="No saved views yet"
              description="Save custom filter combinations in Data Explorer to launch them with one click."
            />
          ) : (
            <>
              <div className="space-y-2.5 flex-1">
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {view.name}
                        </span>
                        {view.isShared && (
                          <Badge variant="info" className="shrink-0">
                            Shared
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-400">
                        {view.datasetName ?? 'Dataset'} · {view.filters.length} filters ·{' '}
                        {view.searchMode.toUpperCase()}
                      </p>
                    </div>

                    <Link
                      href={`/explorer?viewId=${view.id}&dataset=${view.datasetId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors shrink-0"
                    >
                      Launch
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
              {savedViews.length < 5 && (
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <span>Showing {savedViews.length} accessible workspace view(s)</span>
                  {can('views:save') && (
                    <Link
                      href="/explorer"
                      className="font-medium text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      Save a new view
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* Recent Search Activity */}
        <section className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-500" />
              Recent Search Activity
            </h3>
            <Link
              href="/history"
              className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
            >
              Full Audit Log
            </Link>
          </div>

          {isHistoryLoading ? (
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-[62px] w-full rounded-xl" />
              <Skeleton className="h-[62px] w-full rounded-xl" />
              <Skeleton className="h-[62px] w-full rounded-xl" />
            </div>
          ) : recentSearches.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No recent searches logged"
              description="Executed searches and filter combinations automatically appear here with execution telemetry."
            />
          ) : (
            <div className="space-y-2.5 flex-1">
              {recentSearches.map((entry) => {
                const replayQs = buildExplorerSearchParamsString({
                  activeDatasetId: entry.datasetId,
                  activeViewId: null,
                  isDirty: false,
                  searchConfig: {
                    globalQuery: entry.searchQuery ?? '',
                    searchMode: 'fts',
                    filters: entry.filters ?? [],
                    logicOperator: 'AND',
                    sorting: entry.sorting?.length
                      ? entry.sorting
                      : [{ field: 'createdAt', direction: 'desc' }],
                    pagination: { page: 1, pageSize: 50, mode: 'offset', cursor: null },
                  },
                });

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {entry.searchQuery
                            ? `"${entry.searchQuery}"`
                            : `${entry.filters.length} Filter Rule(s)`}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="default" className="tabular-nums">
                            {formatNumber(entry.resultCount)} hits
                          </Badge>
                          <Badge
                            variant={entry.executionTimeMs < 100 ? 'success' : 'warning'}
                            className="tabular-nums"
                          >
                            <Clock className="h-3 w-3" />
                            {entry.executionTimeMs}ms
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-400">
                        {entry.datasetName ?? 'Dataset'} ·{' '}
                        {formatRelativeTime(entry.executedAt)}
                      </p>
                    </div>

                    <Link
                      href={`/explorer?${replayQs}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors shrink-0"
                    >
                      Re-run
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
