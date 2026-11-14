'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while communicating with the DataScope API.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-xl border border-rose-500/30 bg-rose-500/5 px-6 py-10',
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500 mb-3">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Request
        </Button>
      )}
    </div>
  );
}
