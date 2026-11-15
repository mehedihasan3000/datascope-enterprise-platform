'use client';

import type { RecordHistoryDTO, RecordRelationshipDTO } from '@datascope/shared';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  Globe2,
  History,
  Layers,
  ShieldAlert,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { useGetRecordDetailQuery } from '@/services/recordsApi';
import { cn } from '@/utils/cn';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from '@/utils/formatters';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  Active: 'success',
  Pending: 'warning',
  Suspended: 'danger',
  Archived: 'default',
};

const CHANGE_BADGE: Record<string, BadgeVariant> = {
  CREATED: 'success',
  UPDATED: 'indigo',
  STATUS_CHANGED: 'warning',
  ENRICHED: 'info',
};

function renderAttributeValue(val: unknown): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-slate-400 italic">null</span>;
  }
  if (typeof val === 'boolean') {
    return <Badge variant={val ? 'success' : 'outline'}>{val ? 'True' : 'False'}</Badge>;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-slate-400">[]</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {val.map((item, i) => (
          <Badge key={i} variant="outline" className="text-[11px]">
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </Badge>
        ))}
      </div>
    );
  }
  if (typeof val === 'object') {
    return (
      <pre className="rounded-md bg-slate-100 dark:bg-slate-900 p-2 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  }
  return (
    <span className="text-xs font-medium text-slate-900 dark:text-slate-100 break-words">
      {String(val)}
    </span>
  );
}

function RelationshipCard({
  rel,
  datasetId,
  onSelectRecord,
}: {
  rel: RecordRelationshipDTO;
  datasetId?: string;
  onSelectRecord?: (recordId: string) => void;
}) {
  const target = rel.targetRecord;
  const href = target
    ? datasetId
      ? `/records/${target.id}?datasetId=${datasetId}`
      : `/records/${target.id}`
    : '#';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 transition-colors hover:border-indigo-500/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="indigo">
              <GitBranch className="h-3 w-3" />
              {rel.relationshipType.replace(/_/g, ' ')}
            </Badge>
            {target && (
              <Badge variant={STATUS_BADGE[target.status] ?? 'outline'}>
                {target.status}
              </Badge>
            )}
          </div>

          {target ? (
            <>
              <div className="flex items-center gap-2 pt-1">
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  {target.recordCode}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {target.title}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {target.category} · {target.country} · Revenue:{' '}
                <strong className="text-slate-700 dark:text-slate-200 tabular-nums">
                  {formatCurrency(target.revenue)}
                </strong>
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Linked Record ID: {rel.targetRecordId}
            </p>
          )}
        </div>

        {target && (
          <div className="flex items-center gap-1.5 shrink-0">
            {onSelectRecord && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectRecord(target.id)}
              >
                Inspect
              </Button>
            )}
            <Link
              href={href}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>

      {Object.keys(rel.metadata ?? {}).length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {Object.entries(rel.metadata).map(([k, v]) => (
            <span key={k} className="rounded bg-white dark:bg-slate-900 px-2 py-0.5 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-600 dark:text-slate-300">{k}:</strong>{' '}
              {String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTimelineItem({ entry }: { entry: RecordHistoryDTO }) {
  const previousEntries = Object.entries(entry.previousValues ?? {});
  const nextEntries = Object.entries(entry.newValues ?? {});

  return (
    <div className="relative pl-6 pb-5 last:pb-0">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/15" />
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={CHANGE_BADGE[entry.changeType] ?? 'outline'}>
              {entry.changeType}
            </Badge>
            <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
              {entry.summary}
            </span>
          </div>
          <span
            title={formatDateTime(entry.changedAt)}
            className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums"
          >
            {formatRelativeTime(entry.changedAt)} · {formatDateTime(entry.changedAt)}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Modified by:{' '}
          <strong className="text-slate-700 dark:text-slate-200">
            {entry.changedByName || 'System Pipeline'}
          </strong>
        </p>

        {(previousEntries.length > 0 || nextEntries.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
            {previousEntries.length > 0 && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2">
                <div className="font-semibold text-rose-600 dark:text-rose-400 mb-1">
                  Previous Values
                </div>
                {previousEntries.map(([k, v]) => (
                  <div key={k} className="truncate font-mono text-slate-600 dark:text-slate-300">
                    {k}: {JSON.stringify(v)}
                  </div>
                ))}
              </div>
            )}
            {nextEntries.length > 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  Updated Values
                </div>
                {nextEntries.map(([k, v]) => (
                  <div key={k} className="truncate font-mono text-slate-600 dark:text-slate-300">
                    {k}: {JSON.stringify(v)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface RecordDetailContentProps {
  recordId: string;
  datasetId?: string;
  isDrawer?: boolean;
  onSelectRelatedRecord?: (recordId: string) => void;
}

export function RecordDetailContent({
  recordId,
  datasetId,
  isDrawer = false,
  onSelectRelatedRecord,
}: RecordDetailContentProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'history'>(
    'overview'
  );
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const { data, isLoading, isError, error, refetch } = useGetRecordDetailQuery({
    recordId,
    datasetId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError || !data?.data) {
    const apiErrMsg =
      error && 'data' in error
        ? (error.data as { error?: { message?: string } })?.error?.message
        : undefined;
    return (
      <ErrorState
        title="Unable to load record intelligence"
        message={
          apiErrMsg ||
          'The requested record could not be loaded or is restricted by dataset permissions.'
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const record = data.data;
  const attributeEntries = Object.entries(record.attributes ?? {});

  const handleCopyCode = () => {
    void navigator.clipboard.writeText(record.recordCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="space-y-5">
      {/* Identity Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="indigo" className="font-mono">
                {record.recordCode}
              </Badge>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy Entity ID"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
              <Badge variant={STATUS_BADGE[record.status] ?? 'outline'}>
                {record.status}
              </Badge>
            </div>

            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {record.title}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                {record.category}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-cyan-500" />
                {record.country}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                Created: {formatDateTime(record.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                Updated: {formatDateTime(record.updatedAt)}
              </span>
            </div>
          </div>

          {isDrawer ? (
            <Link
              href={`/records/${record.id}?datasetId=${record.datasetId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors shrink-0"
            >
              Full Page
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href={`/explorer?dataset=${record.datasetId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Explorer
            </Link>
          )}
        </div>

        {/* Key Core Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Annual Revenue (USD)
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(record.revenue)}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>Workforce Headcount</span>
              <Users className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {formatNumber(record.employeeCount)}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>Intelligence Risk Score</span>
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {record.riskScore.toFixed(1)}
              </span>
              <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    record.riskScore >= 75
                      ? 'bg-rose-500'
                      : record.riskScore >= 45
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, record.riskScore))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer',
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Attributes ({attributeEntries.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('relationships')}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer',
              activeTab === 'relationships'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Related Records ({record.relationships.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer',
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            )}
          >
            <History className="h-3.5 w-3.5" />
            Audit History ({record.history.length})
          </button>
        </div>

        {activeTab === 'overview' && (
          <button
            type="button"
            onClick={() => setShowRawJson((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Code2 className="h-3.5 w-3.5" />
            {showRawJson ? 'Formatted Grid' : 'Raw JSON'}
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-4 shadow-sm">
          {showRawJson ? (
            <pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs font-mono text-indigo-200">
              {JSON.stringify(record, null, 2)}
            </pre>
          ) : attributeEntries.length === 0 ? (
            <EmptyState
              title="No extended attributes"
              description="This record only uses core indexed schema columns."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attributeEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3 space-y-1"
                >
                  <div className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                    {key}
                  </div>
                  <div>{renderAttributeValue(value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'relationships' && (
        <div className="space-y-3">
          {record.relationships.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No linked entity relationships"
              description="No parent companies, subsidiaries, suppliers, or strategic partners are currently linked to this record."
            />
          ) : (
            record.relationships.map((rel) => (
              <RelationshipCard
                key={rel.id}
                rel={rel}
                datasetId={record.datasetId}
                onSelectRecord={onSelectRelatedRecord}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
          {record.history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No historical audit entries"
              description="Historical change snapshots for this record will appear here when modifications occur."
            />
          ) : (
            <div className="relative before:absolute before:left-[4px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
              {record.history.map((entry) => (
                <HistoryTimelineItem key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
