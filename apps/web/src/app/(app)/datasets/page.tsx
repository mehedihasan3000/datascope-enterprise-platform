'use client';

import type { DatasetDTO } from '@datascope/shared';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Columns3,
  Database,
  Plus,
  Search,
  Server,
  Shield,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { CreateDatasetModal } from '@/features/datasets/CreateDatasetModal';
import { DatasetPermissionsModal } from '@/features/datasets/DatasetPermissionsModal';
import { DatasetSchemaModal } from '@/features/datasets/DatasetSchemaModal';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useDeleteDatasetMutation,
  useGetDatasetsQuery,
} from '@/services/datasetsApi';
import { useAppDispatch } from '@/store';
import { setActiveDatasetId } from '@/store/slices/datasetSlice';
import { addToast } from '@/store/slices/uiPreferencesSlice';
import { formatDate, formatNumber } from '@/utils/formatters';

export default function DatasetsPage() {
  const dispatch = useAppDispatch();
  const { isAdmin, can } = usePermissions();

  const {
    data: datasetsRes,
    isLoading,
    isError,
    refetch,
  } = useGetDatasetsQuery();
  const [deleteDataset, { isLoading: isDeleting }] = useDeleteDatasetMutation();

  const [filterText, setFilterText] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [schemaTarget, setSchemaTarget] = useState<DatasetDTO | null>(null);
  const [permTarget, setPermTarget] = useState<DatasetDTO | null>(null);

  const datasets = useMemo(() => {
    const all = datasetsRes?.data ?? [];
    const term = filterText.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (ds) =>
        ds.name.toLowerCase().includes(term) ||
        ds.category.toLowerCase().includes(term) ||
        ds.dataSource.toLowerCase().includes(term) ||
        ds.description.toLowerCase().includes(term)
    );
  }, [datasetsRes?.data, filterText]);

  const handleDeleteDataset = async (ds: DatasetDTO) => {
    if (ds.totalRecords > 0) {
      dispatch(
        addToast({
          variant: 'warning',
          title: 'Seeded dataset protected in demo',
          description:
            'Only newly created custom datasets with 0 rows should be deleted from the UI.',
        })
      );
      return;
    }

    try {
      await deleteDataset(ds.id).unwrap();
      dispatch(
        addToast({
          variant: 'info',
          title: 'Dataset deleted',
          description: `"${ds.name}" has been removed.`,
        })
      );
    } catch (err) {
      const apiMsg =
        err && typeof err === 'object' && 'data' in err
          ? (err.data as { error?: { message?: string } })?.error?.message
          : undefined;
      dispatch(
        addToast({
          variant: 'error',
          title: 'Failed to delete dataset',
          description: apiMsg || 'Please try again.',
        })
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter collections by name, category, or data source..."
            aria-label="Filter datasets"
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums py-1">
            {datasets.length} Authorized Collections
          </Badge>
          {can('datasets:manage') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Dataset
            </Button>
          )}
        </div>
      </div>

      {/* Dataset Catalog Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load Dataset Library"
          onRetry={() => void refetch()}
        />
      ) : datasets.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No matching datasets found"
          description={
            filterText
              ? 'No authorized dataset collections matched your search filter.'
              : 'You do not currently have access to any dataset collections.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {datasets.map((ds) => {
            const perms = ds.effectivePermissions;
            return (
              <div
                key={ds.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="indigo">{ds.category}</Badge>
                      <Badge variant="outline" className="font-mono">
                        {ds.slug}
                      </Badge>
                    </div>
                    <Badge variant="success" className="tabular-nums">
                      {formatNumber(ds.totalRecords)} records
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {ds.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {ds.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <Server className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{ds.dataSource}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Updated {formatDate(ds.updatedAt)}</span>
                    </div>
                  </div>

                  {perms && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 mr-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        Effective Access:
                      </span>
                      {perms.canView && <Badge variant="default">View</Badge>}
                      {perms.canSearch && <Badge variant="default">Search</Badge>}
                      {perms.canExport && <Badge variant="default">Export</Badge>}
                      {perms.canManage && <Badge variant="danger">Manage</Badge>}
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSchemaTarget(ds)}
                    >
                      <Columns3 className="h-3.5 w-3.5" />
                      Schema
                    </Button>

                    {can('permissions:manage') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPermTarget(ds)}
                      >
                        <Shield className="h-3.5 w-3.5 text-indigo-500" />
                        Permissions
                      </Button>
                    )}

                    {isAdmin && ds.totalRecords === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteDataset(ds)}
                        className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <Link
                    href={`/explorer?dataset=${ds.id}`}
                    onClick={() => dispatch(setActiveDatasetId(ds.id))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                  >
                    Open Explorer
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Create Modal, Schema Inspector Modal & Permissions Configurator */}
      <CreateDatasetModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <DatasetSchemaModal
        dataset={schemaTarget}
        onClose={() => setSchemaTarget(null)}
      />
      <DatasetPermissionsModal
        dataset={permTarget}
        onClose={() => setPermTarget(null)}
      />
    </div>
  );
}
