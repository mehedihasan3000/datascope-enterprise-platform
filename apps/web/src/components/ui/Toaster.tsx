'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  dismissToast,
  type ToastNotification,
} from '@/store/slices/uiPreferencesSlice';
import { cn } from '@/utils/cn';

const VARIANT_META = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100',
    iconColor: 'text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    border: 'border-rose-500/40 bg-rose-950/90 text-rose-100',
    iconColor: 'text-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/40 bg-amber-950/90 text-amber-100',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: Info,
    border: 'border-indigo-500/40 bg-slate-900/95 text-slate-100',
    iconColor: 'text-indigo-400',
  },
};

function ToastItem({ toast }: { toast: ToastNotification }) {
  const dispatch = useAppDispatch();
  const meta = VARIANT_META[toast.variant];
  const Icon = meta.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(dismissToast(toast.id));
    }, toast.durationMs ?? 4500);
    return () => clearTimeout(timer);
  }, [dispatch, toast.durationMs, toast.id]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-80 sm:w-96 items-start gap-3 rounded-xl border p-3.5 shadow-xl backdrop-blur-md transition-all',
        meta.border
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', meta.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs opacity-80 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dispatch(dismissToast(toast.id))}
        aria-label="Dismiss notification"
        className="rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useAppSelector((state) => state.uiPreferences.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2.5"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
