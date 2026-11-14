import { cn } from '@/utils/cn';
import type { HTMLAttributes } from 'react';

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80',
        className
      )}
      {...props}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-3',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-44" />
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, idx) => (
          <Skeleton key={`head-${idx}`} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={`row-${rowIdx}`} className="px-4 py-3 flex items-center gap-4">
            {Array.from({ length: columns }).map((__, colIdx) => (
              <Skeleton
                key={`cell-${rowIdx}-${colIdx}`}
                className={cn('h-4 flex-1', colIdx === 0 && 'max-w-[110px]')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
