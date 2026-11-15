import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { RecordDetailContent } from '@/features/record-details/RecordDetailContent';

interface RecordDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ datasetId?: string }>;
}

export default async function RecordDetailPage({
  params,
  searchParams,
}: RecordDetailPageProps) {
  const { id } = await params;
  const { datasetId } = await searchParams;

  return (
    <div className="mx-auto max-w-5xl">
      <ErrorBoundary fallbackTitle="Failed to render record details">
        <RecordDetailContent recordId={id} datasetId={datasetId} />
      </ErrorBoundary>
    </div>
  );
}
