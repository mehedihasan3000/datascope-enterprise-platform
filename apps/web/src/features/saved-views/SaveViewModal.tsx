'use client';

import {
  createSavedViewSchema,
  ROLES,
  type DatasetFieldDTO,
  type RoleName,
  type SavedViewDTO,
} from '@datascope/shared';
import { BookmarkCheck, Share2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import {
  useCreateSavedViewMutation,
  useUpdateSavedViewMutation,
} from '@/services/savedViewsApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeSaveModal } from '@/store/slices/savedViewsSlice';
import { addToast } from '@/store/slices/uiPreferencesSlice';

const SHAREABLE_ROLES: Array<{ role: RoleName; label: string }> = [
  { role: ROLES.ANALYST, label: 'Data Analysts' },
  { role: ROLES.VIEWER, label: 'Executive Viewers' },
  { role: ROLES.ADMIN, label: 'Administrators' },
];

export interface SaveViewModalProps {
  datasetId: string;
  fields: DatasetFieldDTO[];
  existingViews: SavedViewDTO[];
}

export function SaveViewModal({
  datasetId,
  fields,
  existingViews,
}: SaveViewModalProps) {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((s) => s.savedViews.isSaveModalOpen);
  const editingViewId = useAppSelector((s) => s.savedViews.editingViewId);
  const searchConfig = useAppSelector((s) => s.searchConfig);
  const columnVisibility = useAppSelector(
    (s) => s.dataset.columnVisibility[datasetId]
  );

  const [createSavedView, { isLoading: isCreating }] =
    useCreateSavedViewMutation();
  const [updateSavedView, { isLoading: isUpdating }] =
    useUpdateSavedViewMutation();

  const editingView = editingViewId
    ? existingViews.find((v) => v.id === editingViewId) ?? null
    : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [sharedWithRoles, setSharedWithRoles] = useState<RoleName[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingView) {
      setName(editingView.name);
      setDescription(editingView.description ?? '');
      setIsShared(editingView.isShared);
      setSharedWithRoles(editingView.sharedWithRoles ?? []);
    } else {
      setName('');
      setDescription('');
      setIsShared(false);
      setSharedWithRoles([]);
    }
    setFormError(null);
  }, [editingView, isOpen]);

  if (!isOpen) return null;

  const visibleColumns = fields
    .filter((f) =>
      columnVisibility && f.fieldKey in columnVisibility
        ? Boolean(columnVisibility[f.fieldKey])
        : f.isDefaultVisible
    )
    .map((f) => f.fieldKey);

  const handleToggleRole = (role: RoleName) => {
    setSharedWithRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      datasetId,
      searchQuery: searchConfig.globalQuery.trim(),
      searchMode: searchConfig.searchMode,
      filters: searchConfig.filters,
      sorting: searchConfig.sorting,
      visibleColumns,
      isShared,
      sharedWithRoles: isShared ? sharedWithRoles : [],
    };

    const parsed = createSavedViewSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Invalid saved view configuration.');
      return;
    }

    try {
      if (editingView) {
        const { datasetId: _unused, ...updateBody } = parsed.data;
        await updateSavedView({ id: editingView.id, body: updateBody }).unwrap();
        dispatch(
          addToast({
            variant: 'success',
            title: 'Saved view updated',
            description: `"${parsed.data.name}" saved with current filters and sorting.`,
          })
        );
      } else {
        await createSavedView(parsed.data).unwrap();
        dispatch(
          addToast({
            variant: 'success',
            title: 'Saved view created',
            description: `"${parsed.data.name}" is now available in your Saved Views library.`,
          })
        );
      }
    } catch (err) {
      const apiMsg =
        err && typeof err === 'object' && 'data' in err
          ? (err.data as { error?: { message?: string } })?.error?.message
          : undefined;
      setFormError(apiMsg || 'Failed to persist saved view.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Save query view"
    >
      <div
        onClick={() => dispatch(closeSaveModal())}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {editingView ? 'Update Saved View' : 'Save Current Explorer View'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatch(closeSaveModal())}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              View Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Germany High-Revenue Active Accounts"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this discovery view monitors..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                <Share2 className="h-3.5 w-3.5 text-indigo-500" />
                Share view with authorized roles
              </span>
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
              />
            </label>

            {isShared && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SHAREABLE_ROLES.map(({ role, label }) => {
                  const active = sharedWithRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleToggleRole(role)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Captures: {searchConfig.filters.length} filter(s), {searchConfig.sorting.length}{' '}
            sort rule(s), {visibleColumns.length} visible column(s), mode{' '}
            <code className="font-mono">{searchConfig.searchMode}</code>.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch(closeSaveModal())}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating || isUpdating}
            >
              {editingView ? 'Save Changes' : 'Save View'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
