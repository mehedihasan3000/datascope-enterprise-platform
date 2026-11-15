'use client';

import { createDatasetSchema } from '@datascope/shared';
import { Database, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useCreateDatasetMutation } from '@/services/datasetsApi';
import { useAppDispatch } from '@/store';
import { addToast } from '@/store/slices/uiPreferencesSlice';

export interface CreateDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateDatasetModal({ isOpen, onClose }: CreateDatasetModalProps) {
  const dispatch = useAppDispatch();
  const [createDataset, { isLoading }] = useCreateDatasetMutation();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('Corporate Intelligence');
  const [dataSource, setDataSource] = useState('Enterprise Data Warehouse');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      category: category.trim(),
      dataSource: dataSource.trim(),
      description: description.trim(),
    };

    const parsed = createDatasetSchema.safeParse(payload);
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? 'Invalid dataset details.');
      return;
    }

    try {
      const res = await createDataset(parsed.data).unwrap();
      dispatch(
        addToast({
          variant: 'success',
          title: 'Dataset created',
          description: `"${res.data.name}" created with default core schema and Admin permissions.`,
        })
      );
      setName('');
      setSlug('');
      setDescription('');
      onClose();
    } catch (err) {
      const apiMsg =
        err && typeof err === 'object' && 'data' in err
          ? (err.data as { error?: { message?: string } })?.error?.message
          : undefined;
      setErrorMsg(apiMsg || 'Failed to create dataset.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create enterprise dataset"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Create Dataset Collection
            </h2>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Dataset Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., APAC Vendor Compliance Registry"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Financial Risk"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Data Source
              </label>
              <input
                type="text"
                required
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                placeholder="Snowflake Sync"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Custom Slug (Optional)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="apac-vendor-compliance-registry"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the entities, refresh cadence, and governance classification..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
              Create Dataset
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
