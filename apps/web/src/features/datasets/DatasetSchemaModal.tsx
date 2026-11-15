'use client';

import type { DatasetDTO } from '@datascope/shared';
import { Columns3, Layers, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGetDatasetByIdQuery } from '@/services/datasetsApi';

export interface DatasetSchemaModalProps {
  dataset: DatasetDTO | null;
  onClose: () => void;
}

export function DatasetSchemaModal({
  dataset,
  onClose,
}: DatasetSchemaModalProps) {
  const { data, isLoading, isError, refetch } = useGetDatasetByIdQuery(
    dataset?.id ?? '',
    { skip: !dataset }
  );

  if (!dataset) return null;

  const fields = [...(data?.data?.fields ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Inspect dataset schema"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
      />

      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Columns3 className="h-5 w-5 text-indigo-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Dynamic Schema Inspector
              </h2>
              <Badge variant="indigo">{dataset.name}</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {fields.length} registered field definitions powering dynamic table columns, sorting, and typed SQL filter compilation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schema inspector"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <ErrorState
              title="Unable to inspect schema"
              onRetry={() => void refetch()}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Display Name</th>
                    <th className="px-3 py-2.5">Field Key</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Storage</th>
                    <th className="px-3 py-2.5">Capabilities</th>
                    <th className="px-3 py-2.5">Enum Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {fields.map((field) => (
                    <tr
                      key={field.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {field.displayName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-indigo-600 dark:text-indigo-400">
                        {field.fieldKey}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline">{field.dataType}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={field.isCoreColumn ? 'indigo' : 'info'}>
                          <Layers className="h-3 w-3" />
                          {field.isCoreColumn ? 'Core Index' : 'JSONB Attr'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {field.isSortable && <Badge variant="default">Sort</Badge>}
                          {field.isFilterable && <Badge variant="default">Filter</Badge>}
                          {field.isSearchable && <Badge variant="default">Search</Badge>}
                          {field.isDefaultVisible && (
                            <Badge variant="success">Default</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {field.enumValues?.length
                          ? field.enumValues.join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
