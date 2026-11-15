'use client';

import { ROLES, type RoleName, type SavedViewDTO } from '@datascope/shared';
import { Share2, Users, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useShareSavedViewMutation } from '@/services/savedViewsApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeShareModal } from '@/store/slices/savedViewsSlice';
import { addToast } from '@/store/slices/uiPreferencesSlice';

const ROLE_OPTIONS: Array<{ role: RoleName; label: string }> = [
  { role: ROLES.VIEWER, label: 'Executive Viewers' },
  { role: ROLES.ANALYST, label: 'Data Analysts' },
  { role: ROLES.ADMIN, label: 'Administrators' },
];

export function ShareViewModal({ views }: { views: SavedViewDTO[] }) {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((s) => s.savedViews.isShareModalOpen);
  const sharingViewId = useAppSelector((s) => s.savedViews.sharingViewId);

  const [shareSavedView, { isLoading }] = useShareSavedViewMutation();

  const targetView = views.find((v) => v.id === sharingViewId) ?? null;

  const [isShared, setIsShared] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!targetView) return;
    setIsShared(targetView.isShared);
    setSelectedRoles(targetView.sharedWithRoles ?? []);
    setErrorMsg(null);
  }, [targetView]);

  if (!isOpen || !targetView) return null;

  const handleToggleRole = (role: RoleName) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isShared && selectedRoles.length === 0) {
      setErrorMsg('Select at least one role when team sharing is enabled.');
      return;
    }

    try {
      await shareSavedView({
        id: targetView.id,
        body: {
          isShared,
          sharedWithRoles: isShared ? selectedRoles : [],
        },
      }).unwrap();
      dispatch(
        addToast({
          variant: 'success',
          title: isShared ? 'View shared with team' : 'View set to private',
          description: `"${targetView.name}" sharing settings updated.`,
        })
      );
    } catch (err) {
      const apiMsg =
        err && typeof err === 'object' && 'data' in err
          ? (err.data as { error?: { message?: string } })?.error?.message
          : undefined;
      setErrorMsg(apiMsg || 'Failed to update sharing settings.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share saved view"
    >
      <div
        onClick={() => dispatch(closeShareModal())}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Share Query Configuration
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatch(closeShareModal())}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-3">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              {targetView.name}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
              <Badge variant="outline">
                {targetView.datasetName ?? 'Dataset View'}
              </Badge>
              <span>{targetView.filters.length} filters</span>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 cursor-pointer">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
              <Users className="h-4 w-4 text-indigo-500" />
              Enable sharing with team roles
            </span>
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
            />
          </label>

          {isShared && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Authorized Roles:
              </p>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(({ role, label }) => {
                  const active = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleToggleRole(role)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch(closeShareModal())}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
              Update Sharing
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

