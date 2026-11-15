import { Suspense } from 'react';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { DataExplorerView } from '@/features/data-explorer/DataExplorerView';

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <CardSkeleton />
          <TableSkeleton rows={12} columns={7} />
        </div>
      }
    >
      <DataExplorerView />
    </Suspense>
  );
}
