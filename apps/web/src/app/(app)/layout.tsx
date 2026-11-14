'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { useAppSelector } from '@/store';

export default function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isInitialized } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const target = pathname ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${target}`);
    }
  }, [isAuthenticated, isInitialized, pathname, router]);

  if (!isInitialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-[var(--ds-bg)]">
        <div className="hidden lg:block w-64 border-r border-slate-200 dark:border-slate-800 p-4 space-y-4">
          <div className="h-10 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton rows={6} columns={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--ds-bg)] text-[var(--ds-text)]">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
