'use client';

import type {
  DatasetFieldDTO,
  DatasetRecordDTO,
  EffectiveDatasetPermissions,
  PaginationMeta,
  SortRule,
} from '@datascope/shared';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type Row,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  ExternalLink,
  Eye,
  Layers,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  clearSelectedRows,
  setColumnSizing,
  setColumnVisibility,
  setSelectedRowIds,
  toggleColumnVisibility,
  toggleRowSelection,
} from '@/store/slices/datasetSlice';
import {
  setCursor,
  setPage,
  setPageSize,
  setPaginationMode,
  setSorting,
  toggleColumnSort,
} from '@/store/slices/searchConfigSlice';
import { addToast } from '@/store/slices/uiPreferencesSlice';
import { cn } from '@/utils/cn';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '@/utils/formatters';
import { HighlightText } from './HighlightText';

const ROW_HEIGHT_BY_DENSITY = {
  compact: 40,
  comfortable: 48,
  spacious: 58,
} as const;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  recordCode: 135,
  title: 245,
  category: 185,
  status: 120,
  country: 150,
  revenue: 160,
  employeeCount: 115,
  riskScore: 120,
  region: 140,
  accountTier: 175,
  complianceRating: 150,
  cloudProvider: 155,
  createdAt: 130,
  updatedAt: 130,
};

const STATUS_BADGE_MAP: Record<string, BadgeVariant> = {
  Active: 'success',
  Pending: 'warning',
  Suspended: 'danger',
  Archived: 'default',
};

function getFieldValue(record: DatasetRecordDTO, field: DatasetFieldDTO): unknown {
  if (field.isCoreColumn && field.fieldKey in record) {
    return record[field.fieldKey as keyof DatasetRecordDTO];
  }
  return record.attributes?.[field.fieldKey];
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

interface TableRowProps {
  row: Row<DatasetRecordDTO>;
  start: number;
  height: number;
  isSelected: boolean;
  isActiveDetail: boolean;
  totalWidth: number;
  onRowClick: (recordId: string) => void;
}

const VirtualizedTableRow = memo(function VirtualizedTableRow({
  row,
  start,
  height,
  isSelected,
  isActiveDetail,
  totalWidth,
  onRowClick,
}: TableRowProps) {
  return (
    <tr
      data-index={row.index}
      onClick={() => onRowClick(row.original.id)}
      style={{
        height: `${height}px`,
        transform: `translateY(${start}px)`,
        width: `${totalWidth}px`,
      }}
      className={cn(
        'absolute left-0 top-0 flex items-center border-b border-slate-200/70 dark:border-slate-800/70 transition-colors cursor-pointer select-text',
        isActiveDetail
          ? 'bg-indigo-500/12 dark:bg-indigo-500/15'
          : isSelected
            ? 'bg-indigo-50/80 dark:bg-indigo-950/35'
            : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/45'
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          style={{ width: `${cell.column.getSize()}px` }}
          className="flex h-full shrink-0 items-center overflow-hidden px-3 text-xs text-slate-700 dark:text-slate-200"
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
});

export interface EnterpriseDataTableProps {
  datasetId: string;
  fields: DatasetFieldDTO[];
  records: DatasetRecordDTO[];
  meta?: PaginationMeta;
  effectivePermissions?: EffectiveDatasetPermissions;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onInspectRecord: (recordId: string) => void;
  onClearAllFilters?: () => void;
}

export function EnterpriseDataTable({
  datasetId,
  fields,
  records,
  meta,
  effectivePermissions,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  onRetry,
  onInspectRecord,
  onClearAllFilters,
}: EnterpriseDataTableProps) {
  const dispatch = useAppDispatch();
  const { can } = usePermissions();

  const tableDensity = useAppSelector((s) => s.uiPreferences.tableDensity);
  const activeDetailRecordId = useAppSelector(
    (s) => s.uiPreferences.activeDetailRecordId
  );
  const persistedVisibility = useAppSelector(
    (s) => s.dataset.columnVisibility[datasetId]
  );
  const persistedSizing = useAppSelector(
    (s) => s.dataset.columnSizing[datasetId]
  );
  const selectedRowIds = useAppSelector((s) => s.dataset.selectedRowIds);

  const globalQuery = useAppSelector((s) => s.searchConfig.globalQuery);
  const filters = useAppSelector((s) => s.searchConfig.filters);
  const sorting = useAppSelector((s) => s.searchConfig.sorting);
  const pagination = useAppSelector((s) => s.searchConfig.pagination);

  const [isColumnPopoverOpen, setIsColumnPopoverOpen] = useState(false);
  const [isMultiSortMode, setIsMultiSortMode] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState(String(pagination.page));
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [localColumnSizing, setLocalColumnSizing] = useState<ColumnSizingState>(
    persistedSizing ?? {}
  );

  const popoverRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJumpPageInput(String(pagination.page));
  }, [pagination.page]);

  useEffect(() => {
    setLocalColumnSizing(persistedSizing ?? {});
  }, [datasetId, persistedSizing]);

  // Reset local cursor stack when dataset or query conditions reset to page 1 without cursor
  useEffect(() => {
    if (pagination.mode !== 'cursor' || !pagination.cursor) {
      setCursorHistory([]);
    }
  }, [
    datasetId,
    filters,
    globalQuery,
    pagination.cursor,
    pagination.mode,
    pagination.pageSize,
  ]);

  // Close column visibility popover on outside click or Escape
  useEffect(() => {
    if (!isColumnPopoverOpen) return;
    const handlePointerDown = (e: globalThis.MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsColumnPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsColumnPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isColumnPopoverOpen]);

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.sortOrder - b.sortOrder),
    [fields]
  );

  const resolvedVisibility: VisibilityState = useMemo(() => {
    const map: VisibilityState = {};
    for (const field of sortedFields) {
      if (persistedVisibility && field.fieldKey in persistedVisibility) {
        map[field.fieldKey] = Boolean(persistedVisibility[field.fieldKey]);
      } else {
        map[field.fieldKey] = field.isDefaultVisible;
      }
    }
    return map;
  }, [persistedVisibility, sortedFields]);

  const filterTermsByField = useMemo(() => {
    const termsMap: Record<string, string[]> = {};
    for (const f of filters) {
      if (
        f.operator === 'contains' ||
        f.operator === 'startsWith' ||
        f.operator === 'eq'
      ) {
        const val = String(f.value ?? '').trim();
        if (val) {
          termsMap[f.field] = [...(termsMap[f.field] ?? []), val];
        }
      } else if (f.operator === 'in' && Array.isArray(f.value)) {
        termsMap[f.field] = [
          ...(termsMap[f.field] ?? []),
          ...f.value.map((v) => String(v)),
        ];
      }
    }
    return termsMap;
  }, [filters]);

  const selectedSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);

  const currentPageIds = useMemo(() => records.map((r) => r.id), [records]);
  const allCurrentSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedSet.has(id));
  const someCurrentSelected =
    currentPageIds.some((id) => selectedSet.has(id)) && !allCurrentSelected;

  const handleToggleAllCurrentPage = useCallback(() => {
    if (allCurrentSelected) {
      const next = selectedRowIds.filter((id) => !currentPageIds.includes(id));
      dispatch(setSelectedRowIds(next));
    } else {
      const merged = Array.from(new Set([...selectedRowIds, ...currentPageIds]));
      dispatch(setSelectedRowIds(merged));
    }
  }, [allCurrentSelected, currentPageIds, dispatch, selectedRowIds]);

  const sortOrderLookup = useMemo(() => {
    const map = new Map<string, { rule: SortRule; rank: number }>();
    sorting.forEach((rule, index) => {
      map.set(rule.field, { rule, rank: index + 1 });
    });
    return map;
  }, [sorting]);

  const columns = useMemo<ColumnDef<DatasetRecordDTO>[]>(() => {
    const selectCol: ColumnDef<DatasetRecordDTO> = {
      id: '_select',
      size: 44,
      minSize: 44,
      maxSize: 44,
      enableResizing: false,
      header: () => (
        <input
          type="checkbox"
          aria-label="Select all records on this page"
          checked={allCurrentSelected}
          ref={(el) => {
            if (el) el.indeterminate = someCurrentSelected;
          }}
          onChange={handleToggleAllCurrentPage}
          className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-indigo-600 cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center w-full"
        >
          <input
            type="checkbox"
            aria-label={`Select record ${row.original.recordCode}`}
            checked={selectedSet.has(row.original.id)}
            onChange={() => dispatch(toggleRowSelection(row.original.id))}
            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-indigo-600 cursor-pointer"
          />
        </div>
      ),
    };

    const dynamicCols: ColumnDef<DatasetRecordDTO>[] = sortedFields.map(
      (field) => ({
        id: field.fieldKey,
        accessorFn: (row) => getFieldValue(row, field),
        size: DEFAULT_COLUMN_WIDTHS[field.fieldKey] ?? 155,
        minSize: 85,
        maxSize: 480,
        enableResizing: true,
        header: () => {
          const activeSort = sortOrderLookup.get(field.fieldKey);
          const isCursorMode = pagination.mode === 'cursor';

          const handleHeaderSort = (e: MouseEvent<HTMLButtonElement>) => {
            if (!field.isSortable || isCursorMode) return;
            dispatch(
              toggleColumnSort({
                field: field.fieldKey,
                multi: e.shiftKey || isMultiSortMode,
              })
            );
          };

          return (
            <button
              type="button"
              onClick={handleHeaderSort}
              disabled={!field.isSortable || isCursorMode}
              title={
                isCursorMode
                  ? 'Cursor pagination fixes sort order to Created Date DESC'
                  : field.isSortable
                    ? 'Click to sort · Shift+Click for multi-column sort'
                    : 'This field is not sortable'
              }
              className={cn(
                'flex w-full items-center justify-between gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300',
                field.isSortable && !isCursorMode
                  ? 'hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
                  : 'cursor-default opacity-80'
              )}
            >
              <span className="truncate">{field.displayName}</span>
              {field.isSortable && !isCursorMode && (
                <span className="flex items-center gap-0.5 shrink-0">
                  {activeSort ? (
                    <>
                      {activeSort.rule.direction === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-indigo-500" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-indigo-500" />
                      )}
                      {sorting.length > 1 && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                          {activeSort.rank}
                        </span>
                      )}
                    </>
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-35" />
                  )}
                </span>
              )}
            </button>
          );
        },
        cell: ({ row }) => {
          const rawVal = getFieldValue(row.original, field);
          const fieldFilterTerms = filterTermsByField[field.fieldKey] ?? [];
          const highlightTerms = field.isSearchable ? globalQuery : '';

          if (rawVal === null || rawVal === undefined || rawVal === '') {
            return <span className="text-slate-400 dark:text-slate-600">—</span>;
          }

          if (field.fieldKey === 'recordCode') {
            return (
              <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
                <HighlightText
                  text={String(rawVal)}
                  query={highlightTerms}
                  extraTerms={fieldFilterTerms}
                />
              </span>
            );
          }

          if (field.fieldKey === 'status') {
            const statusStr = String(rawVal);
            return (
              <Badge variant={STATUS_BADGE_MAP[statusStr] ?? 'outline'}>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    statusStr === 'Active'
                      ? 'bg-emerald-500'
                      : statusStr === 'Pending'
                        ? 'bg-amber-500'
                        : statusStr === 'Suspended'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                  )}
                />
                <HighlightText
                  text={statusStr}
                  query={highlightTerms}
                  extraTerms={fieldFilterTerms}
                />
              </Badge>
            );
          }

          if (field.fieldKey === 'riskScore') {
            const score = Number(rawVal);
            const barColor =
              score >= 75
                ? 'bg-rose-500'
                : score >= 45
                  ? 'bg-amber-500'
                  : 'bg-emerald-500';
            const textColor =
              score >= 75
                ? 'text-rose-600 dark:text-rose-400'
                : score >= 45
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400';

            return (
              <div className="flex w-full items-center gap-2">
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 shrink-0">
                  <div
                    className={cn('h-full rounded-full', barColor)}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                  />
                </div>
                <span className={cn('tabular-nums font-medium', textColor)}>
                  {score.toFixed(1)}
                </span>
              </div>
            );
          }

          if (field.dataType === 'currency') {
            return (
              <span className="w-full text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(Number(rawVal))}
              </span>
            );
          }

          if (field.dataType === 'number') {
            return (
              <span className="w-full text-right tabular-nums text-slate-700 dark:text-slate-300">
                {formatNumber(Number(rawVal))}
              </span>
            );
          }

          if (field.dataType === 'date') {
            return (
              <span className="tabular-nums text-slate-600 dark:text-slate-400">
                {formatDate(String(rawVal))}
              </span>
            );
          }

          if (field.dataType === 'boolean') {
            return (
              <Badge variant={rawVal ? 'success' : 'outline'}>
                {rawVal ? 'Yes' : 'No'}
              </Badge>
            );
          }

          return (
            <span
              title={String(rawVal)}
              className={cn(
                'truncate',
                field.fieldKey === 'title' &&
                  'font-medium text-slate-900 dark:text-slate-100'
              )}
            >
              <HighlightText
                text={String(rawVal)}
                query={highlightTerms}
                extraTerms={fieldFilterTerms}
              />
            </span>
          );
        },
      })
    );

    const actionsCol: ColumnDef<DatasetRecordDTO> = {
      id: '_actions',
      size: 96,
      minSize: 96,
      maxSize: 96,
      enableResizing: false,
      header: () => (
        <span className="w-full text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Inspect
        </span>
      ),
      cell: ({ row }) => (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex w-full items-center justify-end gap-1"
        >
          <button
            type="button"
            onClick={() => onInspectRecord(row.original.id)}
            title="Open quick record drawer"
            aria-label={`Inspect record ${row.original.recordCode}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-indigo-500/15 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <Link
            href={`/records/${row.original.id}?datasetId=${datasetId}`}
            title="Open full record page"
            aria-label={`Open full page for ${row.original.recordCode}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
    };

    return [selectCol, ...dynamicCols, actionsCol];
  }, [
    allCurrentSelected,
    datasetId,
    dispatch,
    filterTermsByField,
    globalQuery,
    handleToggleAllCurrentPage,
    isMultiSortMode,
    onInspectRecord,
    pagination.mode,
    selectedSet,
    someCurrentSelected,
    sortOrderLookup,
    sortedFields,
    sorting.length,
  ]);

  const handleColumnSizingChange = useCallback(
    (
      updater:
        | ColumnSizingState
        | ((prev: ColumnSizingState) => ColumnSizingState)
    ) => {
      setLocalColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        dispatch(setColumnSizing({ datasetId, sizing: next }));
        return next;
      });
    },
    [datasetId, dispatch]
  );

  const table = useReactTable({
    data: records,
    columns,
    state: {
      columnVisibility: resolvedVisibility,
      columnSizing: localColumnSizing,
    },
    onColumnSizingChange: handleColumnSizingChange,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const { rows } = table.getRowModel();
  const rowHeight = ROW_HEIGHT_BY_DENSITY[tableDensity];

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

  const visibleDataColumnCount = sortedFields.filter(
    (f) => resolvedVisibility[f.fieldKey] !== false
  ).length;

  const canExport =
    effectivePermissions?.canExport ?? can('data:export');

  const handleExportSelectedCsv = () => {
    if (!canExport) {
      dispatch(
        addToast({
          variant: 'warning',
          title: 'Export restricted by role',
          description:
            'Your current role or dataset permissions do not permit CSV export.',
        })
      );
      return;
    }

    const selectedRecords = records.filter((r) => selectedSet.has(r.id));
    if (selectedRecords.length === 0) {
      dispatch(
        addToast({
          variant: 'info',
          title: 'Select records on the current page',
          description:
            'Selected records from the current view will be exported as CSV.',
        })
      );
      return;
    }

    const visibleFields = sortedFields.filter(
      (f) => resolvedVisibility[f.fieldKey] !== false
    );
    const headerRow = visibleFields.map((f) => escapeCsvCell(f.displayName)).join(',');
    const bodyRows = selectedRecords.map((record) =>
      visibleFields.map((f) => escapeCsvCell(getFieldValue(record, f))).join(',')
    );

    const csvContent = [headerRow, ...bodyRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `datascope-export-${selectedRecords.length}-rows.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    dispatch(
      addToast({
        variant: 'success',
        title: `Exported ${selectedRecords.length} selected records`,
        description: 'CSV download generated cleanly.',
      })
    );
  };

  const handleJumpPageSubmit = (e: FormEvent) => {
    e.preventDefault();
    const targetPage = Number.parseInt(jumpPageInput, 10);
    const maxPages = Math.max(1, meta?.totalPages ?? 1);
    if (!Number.isFinite(targetPage)) return;
    const clamped = Math.min(maxPages, Math.max(1, targetPage));
    setJumpPageInput(String(clamped));
    dispatch(setPage(clamped));
  };

  const handleCursorNext = () => {
    if (!meta?.nextCursor) return;
    setCursorHistory((prev) => [...prev, pagination.cursor]);
    dispatch(
      setCursor({
        cursor: meta.nextCursor,
        page: pagination.page + 1,
      })
    );
  };

  const handleCursorPrev = () => {
    if (cursorHistory.length === 0) {
      dispatch(setCursor({ cursor: null, page: 1 }));
      return;
    }
    const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
    setCursorHistory((prev) => prev.slice(0, -1));
    dispatch(
      setCursor({
        cursor: previousCursor,
        page: Math.max(1, pagination.page - 1),
      })
    );
  };

  const handleShowAllColumns = () => {
    const next: Record<string, boolean> = {};
    for (const field of sortedFields) {
      next[field.fieldKey] = true;
    }
    dispatch(setColumnVisibility({ datasetId, visibility: next }));
  };

  const handleResetDefaultColumns = () => {
    const next: Record<string, boolean> = {};
    for (const field of sortedFields) {
      next[field.fieldKey] = field.isDefaultVisible;
    }
    dispatch(setColumnVisibility({ datasetId, visibility: next }));
    dispatch(setColumnSizing({ datasetId, sizing: {} }));
    setLocalColumnSizing({});
  };

  const totalTableWidth = table.getTotalSize();

  if (isLoading) {
    return <TableSkeleton rows={12} columns={7} />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load dataset records"
        message={
          errorMessage ||
          'The search engine encountered an error executing this query.'
        }
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] shadow-sm overflow-hidden">
      {/* Table Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/50 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-Column Sort Toggle + Active Sort Pills */}
          <button
            type="button"
            onClick={() => setIsMultiSortMode((v) => !v)}
            disabled={pagination.mode === 'cursor'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
              isMultiSortMode
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            title="Enable multi-column sorting (or hold Shift while clicking any column header)"
          >
            <Layers className="h-3.5 w-3.5" />
            Multi-Sort {isMultiSortMode ? 'ON' : 'OFF'}
          </button>

          {pagination.mode === 'cursor' ? (
            <Badge variant="info">Cursor Keyset Order (createdAt ↓)</Badge>
          ) : (
            sorting.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>Sort:</span>
                {sorting.map((rule, idx) => {
                  const fieldLabel =
                    sortedFields.find((f) => f.fieldKey === rule.field)
                      ?.displayName ?? rule.field;
                  return (
                    <Badge key={rule.field} variant="outline" className="gap-1">
                      {sorting.length > 1 && (
                        <span className="text-[10px] font-bold text-indigo-500">
                          {idx + 1}
                        </span>
                      )}
                      {fieldLabel} {rule.direction === 'asc' ? '↑' : '↓'}
                    </Badge>
                  );
                })}
                {!(
                  sorting.length === 1 &&
                  sorting[0]?.field === 'createdAt' &&
                  sorting[0]?.direction === 'desc'
                ) && (
                  <button
                    type="button"
                    onClick={() => dispatch(setSorting([]))}
                    className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            )
          )}
        </div>

        {/* Right Controls: Selection Actions + Columns Popover */}
        <div className="flex items-center gap-2">
          {selectedRowIds.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1">
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 tabular-nums">
                {selectedRowIds.length} selected
              </span>
              <button
                type="button"
                onClick={handleExportSelectedCsv}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300 cursor-pointer"
                title={
                  canExport
                    ? 'Export selected records on current page as CSV'
                    : 'Export restricted to Analyst/Admin roles'
                }
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => dispatch(clearSelectedRows())}
                aria-label="Clear row selection"
                className="rounded p-0.5 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Column Visibility Popover */}
          <div className="relative" ref={popoverRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsColumnPopoverOpen((o) => !o)}
              aria-expanded={isColumnPopoverOpen}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns ({visibleDataColumnCount}/{sortedFields.length})
            </Button>

            {isColumnPopoverOpen && (
              <div className="absolute right-0 top-10 z-40 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Visible Columns
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleShowAllColumns}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Show All
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDefaultColumns}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>
                </div>

                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {sortedFields.map((field) => {
                    const isChecked = resolvedVisibility[field.fieldKey] !== false;
                    return (
                      <label
                        key={field.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              dispatch(
                                toggleColumnVisibility({
                                  datasetId,
                                  fieldKey: field.fieldKey,
                                  visible: e.target.checked,
                                })
                              )
                            }
                            className="h-3.5 w-3.5 rounded accent-indigo-600 cursor-pointer"
                          />
                          <span className="truncate text-slate-700 dark:text-slate-200">
                            {field.displayName}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {field.isCoreColumn ? 'core' : 'jsonb'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Background Revalidation Progress Bar (ADR-08 / Section 4.9) */}
      <div className="relative h-0.5 w-full bg-transparent overflow-hidden">
        {isFetching && (
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 animate-pulse" />
        )}
      </div>

      {/* Virtualized Table Viewport */}
      {records.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={Sparkles}
            title="No matching records found"
            description="Adjust your global search query, search mode, or active filter conditions to explore additional records."
            action={
              onClearAllFilters ? (
                <Button variant="outline" size="sm" onClick={onClearAllFilters}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear Search & Filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className={cn(
            'relative w-full overflow-auto transition-opacity duration-150',
            isFetching ? 'opacity-70' : 'opacity-100'
          )}
          style={{ height: 'min(62vh, 580px)', minHeight: '360px' }}
        >
          <table
            className="grid border-collapse"
            style={{ width: `${Math.max(totalTableWidth, 800)}px` }}
          >
            <thead className="sticky top-0 z-20 grid bg-slate-100/95 dark:bg-[#0f172a]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="flex items-center"
                  style={{ width: `${totalTableWidth}px` }}
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className="relative flex h-10 shrink-0 items-center px-3 select-none group"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}

                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          title="Drag to resize column width"
                          className={cn(
                            'absolute right-0 top-1.5 bottom-1.5 w-1 cursor-col-resize rounded-full transition-colors',
                            header.column.getIsResizing()
                              ? 'bg-indigo-500 w-1.5'
                              : 'bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-700'
                          )}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody
              className="relative grid"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]!;
                return (
                  <VirtualizedTableRow
                    key={row.id}
                    row={row}
                    start={virtualRow.start}
                    height={virtualRow.size}
                    isSelected={selectedSet.has(row.original.id)}
                    isActiveDetail={activeDetailRecordId === row.original.id}
                    totalWidth={totalTableWidth}
                    onRowClick={onInspectRecord}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hybrid Offset & Keyset Cursor Pagination Footer (Section 3.D / ADR-04) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/50 px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400">
          <span className="tabular-nums">
            Showing{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {records.length === 0
                ? 0
                : formatNumber((pagination.page - 1) * pagination.pageSize + 1)}
            </strong>
            –
            <strong className="text-slate-900 dark:text-slate-100">
              {formatNumber(
                (pagination.page - 1) * pagination.pageSize + records.length
              )}
            </strong>{' '}
            of{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {formatNumber(meta?.totalRecords ?? records.length)}
            </strong>{' '}
            records
          </span>

          {/* Page Size Selector */}
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Rows:</span>
            <select
              aria-label="Rows per page"
              value={pagination.pageSize}
              onChange={(e) => dispatch(setPageSize(Number(e.target.value)))}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {[25, 50, 100, 250].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          {/* Hybrid Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => dispatch(setPaginationMode('offset'))}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                pagination.mode === 'offset'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              Offset
            </button>
            <button
              type="button"
              onClick={() => dispatch(setPaginationMode('cursor'))}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                pagination.mode === 'cursor'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
              title="Keyset cursor pagination maintains O(1) latency at row 1M+"
            >
              Cursor
            </button>
          </div>
        </div>

        {/* Navigation + Jump-to-Page */}
        <div className="flex flex-wrap items-center gap-2">
          {pagination.mode === 'offset' && (
            <form
              onSubmit={handleJumpPageSubmit}
              className="flex items-center gap-1.5"
            >
              <span className="text-slate-500">Jump:</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, meta?.totalPages ?? 1)}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                aria-label="Jump to page number"
                className="w-16 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button type="submit" variant="outline" size="sm" className="h-7 px-2">
                Go
              </Button>
            </form>
          )}

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={
                pagination.mode === 'cursor'
                  ? pagination.page <= 1
                  : !meta?.hasPreviousPage && pagination.page <= 1
              }
              onClick={() =>
                pagination.mode === 'cursor'
                  ? handleCursorPrev()
                  : dispatch(setPage(pagination.page - 1))
              }
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>

            <span className="px-2 tabular-nums text-slate-600 dark:text-slate-300">
              {pagination.mode === 'cursor' ? (
                <>Cursor #{pagination.page}</>
              ) : (
                <>
                  Page <strong>{formatNumber(pagination.page)}</strong> /{' '}
                  {formatNumber(Math.max(1, meta?.totalPages ?? 1))}
                </>
              )}
            </span>

            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={
                pagination.mode === 'cursor'
                  ? !meta?.nextCursor
                  : !meta?.hasNextPage
              }
              onClick={() =>
                pagination.mode === 'cursor'
                  ? handleCursorNext()
                  : dispatch(setPage(pagination.page + 1))
              }
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
