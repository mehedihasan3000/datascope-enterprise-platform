'use client';

import type { SavedViewDTO } from '@datascope/shared';
import {
  ArrowRight,
  BookmarkCheck,
  Edit3,
  Globe,
  Lock,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { SaveViewModal } from '@/features/saved-views/SaveViewModal';
import { ShareViewModal } from '@/features/saved-views/ShareViewModal';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useGetDatasetByIdQuery,
  useGetDatasetsQuery,
} from '@/services/datasetsApi';
import {
  useDeleteSavedViewMutation,
  useGetSavedViewsQuery,
} from '@/services/savedViewsApi';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  openSaveModal,
  openShareModal,
} from '@/store/slices/savedViewsSlice';
import { addToast } from '@/store/slices/uiPreferencesSlice';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/formatters';

export default function SavedViewsPage() {
  const dispatch = useAppDispatch();
  const { user, isAdmin, can } = usePermissions();
  const activeDatasetId = useAppSelector((s) => s.dataset.activeDatasetId);

  const [datasetFilter, setDatasetFilter] = useState<string>('ALL');
  const [ownershipTab, setOwnershipTab] = useState<'all' | 'mine' | 'shared'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: datasetsRes } = useGetDatasetsQuery();
  const datasets = datasetsRes?.data ?? [];

  const {
    data: savedViewsRes,
    isLoading,
    isError,
    refetch,
  } = useGetSavedViewsQuery(datasetFilter === 'ALL' ? undefined : datasetFilter);

  const editingViewId = useAppSelector((s) => s.savedViews.editingViewId);
  const allViews = useMemo(() => savedViewsRes?.data ?? [], [savedViewsRes]);

  const modalDatasetId =
    allViews.find((v) => v.id === editingViewId)?.datasetId ??
    (datasetFilter !== 'ALL' ? datasetFilter : activeDatasetId) ??
    datasets[0]?.id ??
    '';

  const { data: modalDatasetDetail } = useGetDatasetByIdQuery(modalDatasetId, {
    skip: !modalDatasetId,
  });

  const [deleteSavedView, { isLoading: isDeleting }] =
    useDeleteSavedViewMutation();

  const filteredViews = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allViews.filter((view) => {
      if (ownershipTab === 'mine' && view.userId !== user?.id) return false;
      if (ownershipTab === 'shared' && !view.isShared) return false;
      if (!q) return true;
      return (
        view.name.toLowerCase().includes(q) ||
        (view.description ?? '').toLowerCase().includes(q) ||
        (view.datasetName ?? '').toLowerCase().includes(q) ||
        view.searchQuery.toLowerCase().includes(q)
      );
    });
  }, [allViews, ownershipTab, searchTerm, user?.id]);

  const handleDeleteView = async (view: SavedViewDTO) => {
    try {
      await deleteSavedView(view.id).unwrap();
      dispatch(
        addToast({
          variant: 'info',
          title: 'Saved view deleted',
          description: `"${view.name}" was removed cleanly.`,
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
          title: 'Failed to delete view',
          description: apiMsg || 'You may not have permission to delete this view.',
        })
      );
    }
  };

  const canSaveOrEdit = can('views:save');
  const canShare = can('views:share');

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter saved views..."
              aria-label="Search saved views"
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            aria-label="Filter by dataset"
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

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 text-xs">
            {(
              [
                ['all', 'All Accessible'],
                ['mine', 'Created by Me'],
                ['shared', 'Team Shared'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOwnershipTab(key)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
                  ownershipTab === key
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!canSaveOrEdit && (
            <Badge variant="outline">Viewer: Shared Read-Only Access</Badge>
          )}
          {canSaveOrEdit && modalDatasetId && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => dispatch(openSaveModal())}
            >
              <Plus className="h-4 w-4" />
              Save Active Query
            </Button>
          )}
        </div>
      </div>

      {/* Views Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load Saved Views"
          onRetry={() => void refetch()}
        />
      ) : filteredViews.length === 0 ? (
        <EmptyState
          icon={BookmarkCheck}
          title="No saved views match your filters"
          description={
            canSaveOrEdit
              ? 'Save filtered queries in Data Explorer to build reusable discovery shortcuts.'
              : 'Shared views configured by Analysts or Administrators will appear here.'
          }
          action={
            <Link
              href="/explorer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Go to Data Explorer
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredViews.map((view) => {
            const canModify =
              canSaveOrEdit && (view.userId === user?.id || isAdmin);
            const canShareView =
              canShare && (view.userId === user?.id || isAdmin);

            return (
              <div
                key={view.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="indigo">
                        {view.datasetName ?? 'Dataset'}
                      </Badge>
                      {view.isShared ? (
                        <Badge variant="success">
                          <Globe className="h-3 w-3" />
                          Shared
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Lock className="h-3 w-3" />
                          Private
                        </Badge>
                      )}
                    </div>

                    <Badge variant="default" className="font-mono uppercase">
                      {view.searchMode}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {view.name}
                    </h3>
                    {view.description && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {view.description}
                      </p>
                    )}
                  </div>

                  {/* Filter / Sort Summary Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {view.searchQuery && (
                      <Badge variant="info">q: &ldquo;{view.searchQuery}&rdquo;</Badge>
                    )}
                    <Badge variant="outline">
                      {view.filters.length} filter(s)
                    </Badge>
                    <Badge variant="outline">
                      {view.sorting.length} sort rule(s)
                    </Badge>
                    {view.visibleColumns.length > 0 && (
                      <Badge variant="outline">
                        {view.visibleColumns.length} cols
                      </Badge>
                    )}
                  </div>

                  {view.isShared && view.sharedWithRoles.length > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Visible to roles:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {view.sharedWithRoles.join(', ')}
                      </strong>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400">
                    Owner: {view.ownerName ?? 'Team Member'} ·{' '}
                    {formatDateTime(view.createdAt)}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    {canModify && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit view metadata & active filters"
                        onClick={() =>
                          dispatch(openSaveModal({ editingViewId: view.id }))
                        }
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                    {canShareView && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Configure team sharing"
                        onClick={() => dispatch(openShareModal(view.id))}
                      >
                        <Share2 className="h-4 w-4 text-indigo-500" />
                      </Button>
                    )}
                    {canModify && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete saved view"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteView(view)}
                        className="text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <Link
                    href={`/explorer?viewId=${view.id}&dataset=${view.datasetId}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                  >
                    Launch View
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalDatasetId && (
        <SaveViewModal
          datasetId={modalDatasetId}
          fields={modalDatasetDetail?.data?.fields ?? []}
          existingViews={allViews}
        />
      )}

      <ShareViewModal views={allViews} />
    </div>
  );
}
