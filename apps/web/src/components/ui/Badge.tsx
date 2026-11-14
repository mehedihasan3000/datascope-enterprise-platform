import { cn } from '@/utils/cn';
import type { HTMLAttributes } from 'react';

export type BadgeVariant =
  | 'default'
  | 'indigo'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default:
    'bg-slate-200/80 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-transparent',
  indigo:
    'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30',
  success:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  warning:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  danger:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  info:
    'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
  outline:
    'bg-transparent text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight whitespace-nowrap',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
