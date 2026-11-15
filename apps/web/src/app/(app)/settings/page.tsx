'use client';

import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type RoleName,
  type UserDTO,
} from '@datascope/shared';
import {
  CheckCircle2,
  Save,
  Settings,
  ShieldCheck,
  Sliders,
  UserCheck,
  Users,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useGetDatasetsQuery } from '@/services/datasetsApi';
import {
  useGetMyPreferencesQuery,
  useGetRolesQuery,
  useGetUsersQuery,
  useUpdateMyPreferencesMutation,
  useUpdateUserRoleMutation,
} from '@/services/usersApi';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setTableDensity,
  setTheme,
  addToast,
} from '@/store/slices/uiPreferencesSlice';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';

const ROLE_VARIANT: Record<RoleName, BadgeVariant> = {
  ADMIN: 'danger',
  ANALYST: 'indigo',
  VIEWER: 'info',
};

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { user: currentUser, isAdmin, can } = usePermissions();
  const currentTheme = useAppSelector((s) => s.uiPreferences.theme);
  const currentDensity = useAppSelector((s) => s.uiPreferences.tableDensity);

  const { data: datasetsRes } = useGetDatasetsQuery();
  const { data: prefsRes, isLoading: isPrefsLoading } =
    useGetMyPreferencesQuery();
  const [updateMyPreferences, { isLoading: isSavingPrefs }] =
    useUpdateMyPreferencesMutation();

  const canManageUsers = can('users:manage');
  const {
    data: usersRes,
    isLoading: isUsersLoading,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useGetUsersQuery(undefined, { skip: !canManageUsers });
  const { data: rolesRes } = useGetRolesQuery(undefined, {
    skip: !canManageUsers,
  });
  const [updateUserRole, { isLoading: isUpdatingRole }] =
    useUpdateUserRoleMutation();

  const [themeChoice, setThemeChoice] = useState<'dark' | 'light'>(currentTheme);
  const [densityChoice, setDensityChoice] = useState<
    'compact' | 'comfortable' | 'spacious'
  >(currentDensity);
  const [pageSizeChoice, setPageSizeChoice] = useState<number>(50);
  const [defaultDatasetId, setDefaultDatasetId] = useState<string>('');

  useEffect(() => {
    const prefs = prefsRes?.data;
    if (!prefs) return;
    if (prefs.theme === 'dark' || prefs.theme === 'light') {
      setThemeChoice(prefs.theme);
    }
    setDensityChoice(prefs.tableDensity);
    setPageSizeChoice(prefs.defaultPageSize);
    setDefaultDatasetId(prefs.defaultDatasetId ?? '');
  }, [prefsRes?.data]);

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await updateMyPreferences({
        theme: themeChoice,
        tableDensity: densityChoice,
        defaultPageSize: pageSizeChoice,
        defaultDatasetId: defaultDatasetId || null,
      }).unwrap();

      dispatch(setTheme(themeChoice));
      dispatch(setTableDensity(densityChoice));
      dispatch(
        addToast({
          variant: 'success',
          title: 'Workspace preferences saved',
          description: 'Your UI, table density, and default dataset settings are persisted.',
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
          title: 'Failed to save preferences',
          description: apiMsg || 'Please retry.',
        })
      );
    }
  };

  const handleRoleUpdate = async (
    targetUser: UserDTO,
    nextRole: RoleName,
    nextActive: boolean
  ) => {
    try {
      await updateUserRole({
        userId: targetUser.id,
        body: {
          role: nextRole,
          isActive: nextActive,
        },
      }).unwrap();
      dispatch(
        addToast({
          variant: 'success',
          title: 'User access updated',
          description: `${targetUser.fullName} updated to ${ROLE_LABELS[nextRole]} (${nextActive ? 'Active' : 'Suspended'}).`,
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
          title: 'Role update rejected',
          description: apiMsg || 'Could not update user permissions.',
        })
      );
    }
  };

  const datasets = datasetsRes?.data ?? [];
  const users = usersRes?.data ?? [];
  const roles = rolesRes?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Top Row: Profile Summary + Personal UI Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account & Capabilities Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 font-bold text-base">
              {(currentUser?.fullName ?? 'DS')
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {currentUser?.fullName}
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {currentUser?.email}
              </p>
            </div>
          </div>

          {currentUser && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Assigned Role</span>
                <Badge variant={ROLE_VARIANT[currentUser.role]}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {ROLE_LABELS[currentUser.role]}
                </Badge>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {ROLE_DESCRIPTIONS[currentUser.role]}
              </p>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Granted Capabilities ({currentUser.permissions.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {currentUser.permissions.map((cap) => (
                    <Badge key={cap} variant="outline" className="font-mono text-[10px]">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Preferences Form */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Sliders className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Workspace & Data Explorer Preferences
            </h2>
          </div>

          {isPrefsLoading ? (
            <div className="mt-4">
              <CardSkeleton />
            </div>
          ) : (
            <form onSubmit={handleSavePreferences} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="settings-theme"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Color Theme
                  </label>
                  <select
                    id="settings-theme"
                    name="theme"
                    aria-label="Preferred color theme"
                    value={themeChoice}
                    onChange={(e) =>
                      setThemeChoice(e.target.value as 'dark' | 'light')
                    }
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="dark">Enterprise Dark Slate</option>
                    <option value="light">Clean Daylight Light</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="settings-density"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Table Row Density
                  </label>
                  <select
                    id="settings-density"
                    name="tableDensity"
                    aria-label="Preferred table density"
                    value={densityChoice}
                    onChange={(e) =>
                      setDensityChoice(
                        e.target.value as 'compact' | 'comfortable' | 'spacious'
                      )
                    }
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="compact">Compact (40px rows)</option>
                    <option value="comfortable">Balanced (48px rows)</option>
                    <option value="spacious">Spacious (58px rows)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="settings-page-size"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Default Page Size
                  </label>
                  <select
                    id="settings-page-size"
                    name="defaultPageSize"
                    aria-label="Default records per page"
                    value={pageSizeChoice}
                    onChange={(e) => setPageSizeChoice(Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    {[25, 50, 100, 250].map((ps) => (
                      <option key={ps} value={ps}>
                        {ps} records per page
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="settings-default-dataset"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Default Startup Dataset
                  </label>
                  <select
                    id="settings-default-dataset"
                    name="defaultDatasetId"
                    aria-label="Default dataset"
                    value={defaultDatasetId}
                    onChange={(e) => setDefaultDatasetId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="">First Authorized Dataset</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" size="sm" isLoading={isSavingPrefs}>
                  <Save className="h-3.5 w-3.5" />
                  Save Preferences
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Admin Only: Platform User & Role Management */}
      {isAdmin && canManageUsers && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Platform User & Role Administration
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage user RBAC roles (`ADMIN`, `ANALYST`, `VIEWER`) and account activation state.
                </p>
              </div>
            </div>
            <Badge variant="danger">Administrator Controls</Badge>
          </div>

          {isUsersLoading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : isUsersError ? (
            <ErrorState
              title="Unable to load platform users"
              onRetry={() => void refetchUsers()}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{u.fullName}</span>
                            {isSelf && <Badge variant="outline">You</Badge>}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                          {u.email}
                        </td>

                        <td className="px-4 py-3">
                          <select
                            id={`user-role-${u.id}`}
                            name={`userRole-${u.id}`}
                            aria-label={`Role for ${u.email}`}
                            disabled={isUpdatingRole}
                            value={u.role}
                            onChange={(e) =>
                              void handleRoleUpdate(
                                u,
                                e.target.value as RoleName,
                                u.isActive
                              )
                            }
                            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
                          >
                            <option value="ADMIN">Administrator</option>
                            <option value="ANALYST">Data Analyst</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={isSelf || isUpdatingRole}
                            title={
                              isSelf
                                ? 'Administrators cannot deactivate their own account'
                                : 'Toggle active status'
                            }
                            onClick={() =>
                              void handleRoleUpdate(u, u.role, !u.isActive)
                            }
                            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Badge variant={u.isActive ? 'success' : 'danger'}>
                              {u.isActive ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </>
                              ) : (
                                'Suspended'
                              )}
                            </Badge>
                          </button>
                        </td>

                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                          {u.lastLoginAt ? (
                            <span title={formatDateTime(u.lastLoginAt)}>
                              {formatRelativeTime(u.lastLoginAt)}
                            </span>
                          ) : (
                            'Never'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {roles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant={ROLE_VARIANT[r.name]}>{ROLE_LABELS[r.name]}</Badge>
                    <UserCheck className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {r.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 text-xs text-slate-600 dark:text-slate-400">
          <Settings className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>
            User & Role Administration settings are restricted to Administrator accounts.
          </span>
        </div>
      )}
    </div>
  );
}
