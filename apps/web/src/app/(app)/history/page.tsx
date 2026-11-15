'use client';

import {
  ArrowRight,
  Clock,
  Filter,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { buildExplorerSearchParamsString } from '@/hooks/useUrlSearchState';
import { useGetDatasetsQuery } from '@/services/datasetsApi';
import {
  useClearSearchHistoryMutation,
  useGetSearchHistoryQuery,
} from '@/services/historyApi';
import { useAppDispatch } from '@/store';
import { addToast } from '@/store/slices/uiPreferencesSlice';
import {
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from '@/utils/formatters';

export default function SearchHistoryPage() {
  const dispatch = useAppDispatch();
  const [datasetFilter, setDatasetFilter] = useState<string>('ALL');
  const [queryFilter, setQueryFilter] = useState('');

  const { data: datasetsRes } = useGetDatasetsQuery();
  const datasets = datasetsRes?.data ?? [];

  const {
    data: historyRes,
    isLoading,
    isError,
    refetch,
  } = useGetSearchHistoryQuery({
    datasetId: datasetFilter === 'ALL' ? undefined : datasetFilter,
    limit: 100,
  });

  const [clearHistory, { isLoading: isClearing }] =
    useClearSearchHistoryMutation();

  const entries = useMemo(() => {
    const raw = historyRes?.data ?? [];
    const term = queryFilter.trim().toLowerCase();
    if (!term) return raw;
    return raw.filter(
      (item) =>
        item.searchQuery.toLowerCase().includes(term) ||
        (item.datasetName ?? '').toLowerCase().includes(term) ||
        item.filters.some((f) => f.field.toLowerCase().includes(term))
    );
  }, [historyRes?.data, queryFilter]);

  const handleClear = async () => {
    try {
      await clearHistory(
        datasetFilter === 'ALL' ? undefined : datasetFilter
      ).unwrap();
      dispatch(
        addToast({
          variant: 'info',
          title: 'Search history cleared',
          description:
            datasetFilter === 'ALL'
              ? 'Cleared all search logs for your account.'
              : 'Cleared search logs for the selected dataset.',
        })
      );
    } catch {
      dispatch(
        addToast({
          variant: 'error',
          title: 'Unable to clear search history',
          description: 'Please retry.',
        })
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={queryFilter}
              onChange={(e) => setQueryFilter(e.target.value)}
              placeholder="Filter history by query text or field..."
              aria-label="Filter history entries"
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            aria-label="Filter history by dataset"
            value={datasetFilter}
            onChange={(e) => setDatasetFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <option value="ALL">All Authorized Datasets</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          isLoading={isClearing}
          disabled={entries.length === 0}
          onClick={() => void handleClear()}
          className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear History
        </Button>
      </div>

      {/* History Audit Log Table */}
      {isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : isError ? (
        <ErrorState
          title="Unable to load search history"
          onRetry={() => void refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Search audit log is empty"
          description="Queries with search keywords or field filters executed in Data Explorer are automatically logged here."
          action={
            <Link
              href="/explorer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Start Discovering in Explorer
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Executed</th>
                  <th className="px-4 py-3">Dataset</th>
                  <th className="px-4 py-3">Query & Filter Clauses</th>
                  <th className="px-4 py-3 text-right">Matches</th>
                  <th className="px-4 py-3 text-right">Latency</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {entries.map((item) => {
                  const replayQs = buildExplorerSearchParamsString({
                    activeDatasetId: item.datasetId,
                    activeViewId: null,
                    isDirty: false,
                    searchConfig: {
                      globalQuery: item.searchQuery ?? '',
                      searchMode: 'fts',
                      filters: item.filters ?? [],
                      logicOperator: 'AND',
                      sorting: item.sorting?.length
                        ? item.sorting
                        : [{ field: 'createdAt', direction: 'desc' }],
                      pagination: {
                        page: 1,
                        pageSize: 50,
                        mode: 'offset',
                        cursor: null,
                      },
                    },
                  });

                  const latencyVariant =
                    item.executionTimeMs <= 80
                      ? 'success'
                      : item.executionTimeMs <= 300
                        ? 'warning'
                        : 'danger';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {formatRelativeTime(item.executedAt)}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {formatDateTime(item.executedAt)}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant="indigo">
                          {item.datasetName ?? 'Dataset'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 max-w-md space-y-1.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {item.searchQuery ? (
                            <span>Search: &ldquo;{item.searchQuery}&rdquo;</span>
                          ) : (
                            <span className="text-slate-500 italic">
                              Structured Filter Query (No text term)
                            </span>
                          )}
                        </div>

                        {item.filters.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.filters.map((f, idx) => (
                              <Badge key={idx} variant="outline" className="text-[11px]">
                                <Filter className="h-2.5 w-2.5" />
                                {f.field} {f.operator}{' '}
                                {Array.isArray(f.value)
                                  ? f.value.join('–')
                                  : String(f.value)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {formatNumber(item.resultCount)}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Badge variant={latencyVariant} className="tabular-nums">
                          <Clock className="h-3 w-3" />
                          {item.executionTimeMs} ms
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/explorer?${replayQs}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                        >
                          Re-run
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
