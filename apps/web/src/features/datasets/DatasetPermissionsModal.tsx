'use client';

import type { AccessPermissionEntryInput, DatasetDTO } from '@datascope/shared';
import { Plus, Shield, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useGetDatasetPermissionsQuery,
  useUpdateDatasetPermissionsMutation,
} from '@/services/datasetsApi';
import { useGetRolesQuery, useGetUsersQuery } from '@/services/usersApi';
import { useAppDispatch } from '@/store';
import { addToast } from '@/store/slices/uiPreferencesSlice';

interface EditablePermissionRow {
  localId: string;
  targetType: 'role' | 'user';
  roleId: string;
  userId: string;
  canView: boolean;
  canSearch: boolean;
  canExport: boolean;
  canManage: boolean;
}

export interface DatasetPermissionsModalProps {
  dataset: DatasetDTO | null;
  onClose: () => void;
}

export function DatasetPermissionsModal({
  dataset,
  onClose,
}: DatasetPermissionsModalProps) {
  const dispatch = useAppDispatch();

  const {
    data: permsRes,
    isLoading: isPermsLoading,
    isError: isPermsError,
    refetch,
  } = useGetDatasetPermissionsQuery(dataset?.id ?? '', {
    skip: !dataset,
  });

  const { data: rolesRes } = useGetRolesQuery(undefined, { skip: !dataset });
  const { data: usersRes } = useGetUsersQuery(undefined, { skip: !dataset });
  const [updatePermissions, { isLoading: isSaving }] =
    useUpdateDatasetPermissionsMutation();

  const roles = rolesRes?.data ?? [];
  const users = usersRes?.data ?? [];

  const [rows, setRows] = useState<EditablePermissionRow[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!permsRes?.data) return;
    setRows(
      permsRes.data.map((p, idx) => ({
        localId: p.id || `perm-${idx}`,
        targetType: p.roleId ? 'role' : 'user',
        roleId: p.roleId ?? '',
        userId: p.userId ?? '',
        canView: p.canView,
        canSearch: p.canSearch,
        canExport: p.canExport,
        canManage: p.canManage,
      }))
    );
    setFormError(null);
  }, [permsRes?.data]);

  if (!dataset) return null;

  const handleAddGrant = (targetType: 'role' | 'user') => {
    const defaultRoleId = roles[0]?.id ?? '';
    const defaultUserId = users[0]?.id ?? '';
    setRows((prev) => [
      ...prev,
      {
        localId: `grant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        targetType,
        roleId: targetType === 'role' ? defaultRoleId : '',
        userId: targetType === 'user' ? defaultUserId : '',
        canView: true,
        canSearch: true,
        canExport: false,
        canManage: false,
      },
    ]);
  };

  const handleSave = async () => {
    setFormError(null);

    const payloadEntries: AccessPermissionEntryInput[] = rows
      .filter((r) => (r.targetType === 'role' ? Boolean(r.roleId) : Boolean(r.userId)))
      .map((r) => ({
        roleId: r.targetType === 'role' ? r.roleId : null,
        userId: r.targetType === 'user' ? r.userId : null,
        canView: r.canView,
        canSearch: r.canSearch,
        canExport: r.canExport,
        canManage: r.canManage,
      }));

    if (payloadEntries.length === 0) {
      setFormError('At least one role or user permission entry is required.');
      return;
    }

    try {
      await updatePermissions({
        datasetId: dataset.id,
        body: { permissions: payloadEntries },
      }).unwrap();
      dispatch(
        addToast({
          variant: 'success',
          title: 'Permissions updated',
          description: `Saved ${payloadEntries.length} access rules for "${dataset.name}".`,
        })
      );
      onClose();
    } catch (err) {
      const apiMsg =
        err && typeof err === 'object' && 'data' in err
          ? (err.data as { error?: { message?: string } })?.error?.message
          : undefined;
      setFormError(apiMsg || 'Failed to save dataset permissions.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configure dataset permissions"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
      />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Access Control Matrix
              </h2>
              <Badge variant="outline">{dataset.name}</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure role-level and user-specific overrides enforced server-side in PostgreSQL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              {formError}
            </div>
          )}

          {isPermsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isPermsError ? (
            <ErrorState
              title="Failed to load permissions"
              onRetry={() => void refetch()}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddGrant('role')}
                  disabled={roles.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Role Grant
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddGrant('user')}
                  disabled={users.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add User Override
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {rows.map((row) => (
                  <div
                    key={row.localId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3"
                  >
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <Badge variant={row.targetType === 'role' ? 'indigo' : 'info'}>
                        {row.targetType === 'role' ? 'Role' : 'User'}
                      </Badge>

                      {row.targetType === 'role' ? (
                        <select
                          aria-label="Target role"
                          value={row.roleId}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((item) =>
                                item.localId === row.localId
                                  ? { ...item, roleId: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 cursor-pointer"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          aria-label="Target user"
                          value={row.userId}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((item) =>
                                item.localId === row.localId
                                  ? { ...item, userId: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 max-w-[210px] truncate cursor-pointer"
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.email} ({u.role})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {(
                        [
                          ['canView', 'View'],
                          ['canSearch', 'Search'],
                          ['canExport', 'Export'],
                          ['canManage', 'Manage'],
                        ] as const
                      ).map(([flag, label]) => (
                        <label
                          key={flag}
                          className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={row[flag]}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((item) =>
                                  item.localId === row.localId
                                    ? { ...item, [flag]: e.target.checked }
                                    : item
                                )
                              )
                            }
                            className="h-3.5 w-3.5 rounded accent-indigo-600 cursor-pointer"
                          />
                          {label}
                        </label>
                      ))}

                      <button
                        type="button"
                        aria-label="Delete permission rule"
                        onClick={() =>
                          setRows((prev) =>
                            prev.filter((item) => item.localId !== row.localId)
                          )
                        }
                        className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSaving}
              disabled={isPermsLoading || isPermsError}
              onClick={() => void handleSave()}
            >
              Save Permission Rules
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
