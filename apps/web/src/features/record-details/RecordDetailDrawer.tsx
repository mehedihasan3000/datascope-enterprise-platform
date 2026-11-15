'use client';

import { Layers, X } from 'lucide-react';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveDetailRecordId } from '@/store/slices/uiPreferencesSlice';
import { RecordDetailContent } from './RecordDetailContent';

export function RecordDetailDrawer() {
  const dispatch = useAppDispatch();
  const activeDetailRecordId = useAppSelector(
    (s) => s.uiPreferences.activeDetailRecordId
  );
  const activeDatasetId = useAppSelector((s) => s.dataset.activeDatasetId);

  useEffect(() => {
    if (!activeDetailRecordId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch(setActiveDetailRecordId(null));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeDetailRecordId, dispatch]);

  if (!activeDetailRecordId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Record intelligence details"
    >
      {/* Backdrop */}
      <div
        onClick={() => dispatch(setActiveDetailRecordId(null))}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Panel */}
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 dark:border-slate-800 bg-[var(--ds-bg)] shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090e1a] px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Layers className="h-4 w-4 text-indigo-500" />
            Record Intelligence Inspector
          </div>
          <button
            type="button"
            onClick={() => dispatch(setActiveDetailRecordId(null))}
            aria-label="Close record details drawer"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <RecordDetailContent
            recordId={activeDetailRecordId}
            datasetId={activeDatasetId ?? undefined}
            isDrawer
            onSelectRelatedRecord={(nextId) =>
              dispatch(setActiveDetailRecordId(nextId))
            }
          />
        </div>
      </aside>
    </div>
  );
}
