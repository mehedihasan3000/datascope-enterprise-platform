'use client';

import {
  ALLOWED_OPERATORS_BY_TYPE,
  FILTER_OPERATORS,
  OPERATOR_LABELS,
  type DatasetFieldDTO,
  type FilterCondition,
  type FilterOperator,
} from '@datascope/shared';
import {
  Filter,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  clearFilters,
  setFilters,
  setLogicOperator,
} from '@/store/slices/searchConfigSlice';
import { cn } from '@/utils/cn';

interface DraftFilterRow {
  localId: string;
  field: string;
  operator: FilterOperator;
  enabled: boolean;
  rawValueA: string;
  rawValueB: string;
  rawList: string[];
}

interface FilterPreset {
  id: string;
  label: string;
  description: string;
  logicOperator: 'AND' | 'OR';
  conditions: FilterCondition[];
}

const BUILTIN_PRESETS: FilterPreset[] = [
  {
    id: 'sec-3c-germany-active',
    label: 'Active • Germany • >$10k • 30d',
    description:
      'Section 3.C Canonical Query: Status = Active, Country = Germany, Revenue > $10,000, Created in Last 30 Days',
    logicOperator: 'AND',
    conditions: [
      { field: 'status', operator: 'eq', value: 'Active' },
      { field: 'country', operator: 'eq', value: 'Germany' },
      { field: 'revenue', operator: 'gt', value: 10000 },
      { field: 'createdAt', operator: 'lastNDays', value: 30 },
    ],
  },
  {
    id: 'high-risk-entities',
    label: 'High Risk (≥75)',
    description: 'Entities with elevated intelligence risk score >= 75',
    logicOperator: 'AND',
    conditions: [{ field: 'riskScore', operator: 'gte', value: 75 }],
  },
  {
    id: 'strategic-enterprise-1m',
    label: 'Enterprise Tier ($1M+)',
    description: 'Strategic Enterprise accounts with revenue >= $1,000,000',
    logicOperator: 'AND',
    conditions: [
      { field: 'accountTier', operator: 'eq', value: 'Strategic Enterprise' },
      { field: 'revenue', operator: 'gte', value: 1000000 },
    ],
  },
];

function createLocalId(): string {
  return `flt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getDefaultOperatorForField(field?: DatasetFieldDTO): FilterOperator {
  if (!field) return FILTER_OPERATORS.EQ;
  const allowed = ALLOWED_OPERATORS_BY_TYPE[field.dataType];
  return allowed?.[0] ?? FILTER_OPERATORS.EQ;
}

function toInputDateValue(raw: unknown): string {
  const str = String(raw ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return str;
}

function conditionToDraft(condition: FilterCondition): DraftFilterRow {
  const localId = condition.id || createLocalId();

  if (condition.operator === FILTER_OPERATORS.BETWEEN) {
    const pair = Array.isArray(condition.value) ? condition.value : ['', ''];
    return {
      localId,
      field: condition.field,
      operator: condition.operator,
      enabled: true,
      rawValueA: toInputDateValue(pair[0]),
      rawValueB: toInputDateValue(pair[1]),
      rawList: [],
    };
  }

  if (condition.operator === FILTER_OPERATORS.IN) {
    const arr = Array.isArray(condition.value)
      ? condition.value.map((v) => String(v))
      : [String(condition.value ?? '')].filter(Boolean);
    return {
      localId,
      field: condition.field,
      operator: condition.operator,
      enabled: true,
      rawValueA: arr.join(', '),
      rawValueB: '',
      rawList: arr,
    };
  }

  return {
    localId,
    field: condition.field,
    operator: condition.operator,
    enabled: true,
    rawValueA: toInputDateValue(condition.value),
    rawValueB: '',
    rawList: [],
  };
}

function compileDraftToCondition(
  draft: DraftFilterRow,
  fieldMeta?: DatasetFieldDTO
): FilterCondition | null {
  if (!draft.enabled || !fieldMeta) return null;

  const isNumericField =
    fieldMeta.dataType === 'number' || fieldMeta.dataType === 'currency';
  const isDateField = fieldMeta.dataType === 'date';

  if (draft.operator === FILTER_OPERATORS.LAST_N_DAYS) {
    const days = Number(draft.rawValueA);
    if (!Number.isFinite(days) || days <= 0) return null;
    return {
      field: draft.field,
      operator: draft.operator,
      value: Math.round(days),
    };
  }

  if (draft.operator === FILTER_OPERATORS.BETWEEN) {
    const a = draft.rawValueA.trim();
    const b = draft.rawValueB.trim();
    if (!a || !b) return null;

    if (isNumericField) {
      const numA = Number(a);
      const numB = Number(b);
      if (!Number.isFinite(numA) || !Number.isFinite(numB)) return null;
      const min = Math.min(numA, numB);
      const max = Math.max(numA, numB);
      return {
        field: draft.field,
        operator: draft.operator,
        value: [min, max],
      };
    }

    if (isDateField) {
      const startIso = `${a}T00:00:00.000Z`;
      const endIso = `${b}T23:59:59.999Z`;
      if (Number.isNaN(Date.parse(startIso)) || Number.isNaN(Date.parse(endIso))) {
        return null;
      }
      return {
        field: draft.field,
        operator: draft.operator,
        value: startIso <= endIso ? [startIso, endIso] : [endIso, startIso],
      };
    }

    return {
      field: draft.field,
      operator: draft.operator,
      value: [a, b],
    };
  }

  if (draft.operator === FILTER_OPERATORS.IN) {
    const items =
      fieldMeta.enumValues && fieldMeta.enumValues.length > 0
        ? draft.rawList
        : draft.rawValueA
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

    if (items.length === 0) return null;

    if (isNumericField) {
      const parsedNums = items.map(Number).filter(Number.isFinite);
      if (parsedNums.length === 0) return null;
      return {
        field: draft.field,
        operator: draft.operator,
        value: parsedNums,
      };
    }

    return {
      field: draft.field,
      operator: draft.operator,
      value: items,
    };
  }

  const trimmed = draft.rawValueA.trim();
  if (!trimmed) return null;

  if (fieldMeta.dataType === 'boolean') {
    return {
      field: draft.field,
      operator: draft.operator,
      value: trimmed === 'true',
    };
  }

  if (isNumericField) {
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    return {
      field: draft.field,
      operator: draft.operator,
      value: num,
    };
  }

  return {
    field: draft.field,
    operator: draft.operator,
    value: trimmed,
  };
}

function formatFilterSummary(
  condition: FilterCondition,
  fieldMap: Map<string, DatasetFieldDTO>
): string {
  const label = fieldMap.get(condition.field)?.displayName ?? condition.field;
  if (condition.operator === FILTER_OPERATORS.LAST_N_DAYS) {
    return `${label}: Last ${condition.value}d`;
  }
  if (condition.operator === FILTER_OPERATORS.BETWEEN && Array.isArray(condition.value)) {
    return `${label}: ${toInputDateValue(condition.value[0])} – ${toInputDateValue(condition.value[1])}`;
  }
  if (condition.operator === FILTER_OPERATORS.IN && Array.isArray(condition.value)) {
    return `${label} in [${condition.value.join(', ')}]`;
  }
  const shortOp: Record<FilterOperator, string> = {
    eq: '=',
    neq: '≠',
    contains: '~',
    startsWith: '^',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    between: 'between',
    in: 'in',
    lastNDays: 'last',
  };
  return `${label} ${shortOp[condition.operator]} ${String(condition.value)}`;
}

export interface DynamicFilterBuilderProps {
  fields: DatasetFieldDTO[];
  isExpanded: boolean;
  onToggleExpanded?: () => void;
}

export function DynamicFilterBuilder({
  fields,
  isExpanded,
  onToggleExpanded,
}: DynamicFilterBuilderProps) {
  const dispatch = useAppDispatch();
  const reduxFilters = useAppSelector((s) => s.searchConfig.filters);
  const logicOperator = useAppSelector((s) => s.searchConfig.logicOperator);

  const filterableFields = useMemo(
    () =>
      [...fields]
        .filter((f) => f.isFilterable)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [fields]
  );

  const fieldMap = useMemo(() => {
    const map = new Map<string, DatasetFieldDTO>();
    for (const f of filterableFields) {
      map.set(f.fieldKey, f);
    }
    return map;
  }, [filterableFields]);

  const [draftRows, setDraftRows] = useState<DraftFilterRow[]>(() =>
    reduxFilters.map(conditionToDraft)
  );
  const lastCommittedJsonRef = useRef<string>(JSON.stringify(reduxFilters));
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync downward when Redux filters change externally (URL hydration, Saved Views, Reset)
  useEffect(() => {
    const incomingJson = JSON.stringify(reduxFilters);
    if (incomingJson !== lastCommittedJsonRef.current) {
      lastCommittedJsonRef.current = incomingJson;
      setDraftRows(reduxFilters.map(conditionToDraft));
    }
  }, [reduxFilters]);

  const commitDraftRows = useCallback(
    (rows: DraftFilterRow[], immediate = false) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const executeCommit = () => {
        const compiled: FilterCondition[] = [];
        for (const row of rows) {
          const condition = compileDraftToCondition(row, fieldMap.get(row.field));
          if (condition) {
            compiled.push(condition);
          }
        }
        const nextJson = JSON.stringify(compiled);
        if (nextJson !== lastCommittedJsonRef.current) {
          lastCommittedJsonRef.current = nextJson;
          dispatch(setFilters(compiled));
        }
      };

      if (immediate) {
        executeCommit();
      } else {
        debounceTimerRef.current = setTimeout(executeCommit, 300);
      }
    },
    [dispatch, fieldMap]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleAddRow = () => {
    if (filterableFields.length === 0) return;
    const usedKeys = new Set(draftRows.map((d) => d.field));
    const defaultField =
      filterableFields.find((f) => !usedKeys.has(f.fieldKey)) ??
      filterableFields[0]!;
    const defaultOp = getDefaultOperatorForField(defaultField);

    const newRow: DraftFilterRow = {
      localId: createLocalId(),
      field: defaultField.fieldKey,
      operator: defaultOp,
      enabled: true,
      rawValueA:
        defaultOp === FILTER_OPERATORS.LAST_N_DAYS
          ? '30'
          : defaultField.dataType === 'boolean'
            ? 'true'
            : '',
      rawValueB: '',
      rawList: [],
    };
    setDraftRows((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (localId: string) => {
    setDraftRows((prev) => {
      const next = prev.filter((r) => r.localId !== localId);
      commitDraftRows(next, true);
      return next;
    });
  };

  const handleToggleRowEnabled = (localId: string) => {
    setDraftRows((prev) => {
      const next = prev.map((r) =>
        r.localId === localId ? { ...r, enabled: !r.enabled } : r
      );
      commitDraftRows(next, true);
      return next;
    });
  };

  const handleFieldChange = (localId: string, nextFieldKey: string) => {
    const meta = fieldMap.get(nextFieldKey);
    const nextOp = getDefaultOperatorForField(meta);

    setDraftRows((prev) => {
      const next = prev.map((r) =>
        r.localId === localId
          ? {
              ...r,
              field: nextFieldKey,
              operator: nextOp,
              rawValueA: meta?.dataType === 'boolean' ? 'true' : '',
              rawValueB: '',
              rawList: [],
            }
          : r
      );
      commitDraftRows(next, true);
      return next;
    });
  };

  const handleOperatorChange = (localId: string, nextOp: FilterOperator) => {
    setDraftRows((prev) => {
      const next = prev.map((r) => {
        if (r.localId !== localId) return r;
        return {
          ...r,
          operator: nextOp,
          rawValueA:
            nextOp === FILTER_OPERATORS.LAST_N_DAYS && !r.rawValueA
              ? '30'
              : r.rawValueA,
          rawList:
            nextOp === FILTER_OPERATORS.IN && r.rawList.length === 0 && r.rawValueA
              ? [r.rawValueA]
              : r.rawList,
        };
      });
      commitDraftRows(next, true);
      return next;
    });
  };

  const handleValueUpdate = (
    localId: string,
    patch: Partial<Pick<DraftFilterRow, 'rawValueA' | 'rawValueB' | 'rawList'>>,
    immediate = false
  ) => {
    setDraftRows((prev) => {
      const next = prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r));
      commitDraftRows(next, immediate);
      return next;
    });
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    const validConditions = preset.conditions.filter((c) => fieldMap.has(c.field));
    if (validConditions.length === 0) return;

    const nextDrafts = validConditions.map(conditionToDraft);
    lastCommittedJsonRef.current = JSON.stringify(validConditions);
    setDraftRows(nextDrafts);
    dispatch(setLogicOperator(preset.logicOperator));
    dispatch(setFilters(validConditions));
  };

  const handleClearAll = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastCommittedJsonRef.current = '[]';
    setDraftRows([]);
    dispatch(clearFilters());
  };

  const availablePresets = useMemo(
    () =>
      BUILTIN_PRESETS.filter((preset) =>
        preset.conditions.every((c) => fieldMap.has(c.field))
      ),
    [fieldMap]
  );

  return (
    <div className="space-y-2.5">
      {/* Quick Presets & Active Filter Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            Quick Filters:
          </span>

          {availablePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              title={preset.description}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500/60 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {(reduxFilters.length > 0 || draftRows.length > 0) && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            Clear all filters ({reduxFilters.length})
          </button>
        )}
      </div>

      {/* Collapsed Active Filter Chips */}
      {!isExpanded && reduxFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-3 py-2">
          <Badge variant="indigo" className="mr-1">
            {logicOperator}
          </Badge>
          {reduxFilters.map((cond, idx) => (
            <Badge
              key={`${cond.field}-${cond.operator}-${idx}`}
              variant="outline"
              className="gap-1.5 bg-white dark:bg-slate-900 pr-1.5"
            >
              <span>{formatFilterSummary(cond, fieldMap)}</span>
              <button
                type="button"
                aria-label={`Remove filter ${cond.field}`}
                onClick={() => {
                  const next = reduxFilters.filter((_, i) => i !== idx);
                  lastCommittedJsonRef.current = JSON.stringify(next);
                  setDraftRows(next.map(conditionToDraft));
                  dispatch(setFilters(next));
                }}
                className="rounded p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {onToggleExpanded && (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="ml-auto text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Edit conditions
            </button>
          )}
        </div>
      )}

      {/* Expanded Multi-Condition Filter Builder Panel */}
      {isExpanded && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500">
                <Filter className="h-3.5 w-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Dynamic Query Filter Builder
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Typed to active dataset schema · Compiled safely to parameterized SQL
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => dispatch(setLogicOperator('AND'))}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-semibold transition-colors cursor-pointer',
                    logicOperator === 'AND'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  Match ALL (AND)
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setLogicOperator('OR'))}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-semibold transition-colors cursor-pointer',
                    logicOperator === 'OR'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  Match ANY (OR)
                </button>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleAddRow}
                disabled={draftRows.length >= 30}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Condition
              </Button>
            </div>
          </div>

          {draftRows.length === 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              <span>
                No field filters applied. Add a condition or pick a quick preset above.
              </span>
              <Button variant="outline" size="sm" onClick={handleAddRow}>
                <Plus className="h-3.5 w-3.5" />
                Add First Filter
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {draftRows.map((row, idx) => {
                const fieldMeta = fieldMap.get(row.field);
                const allowedOps = fieldMeta
                  ? ALLOWED_OPERATORS_BY_TYPE[fieldMeta.dataType]
                  : [FILTER_OPERATORS.EQ];
                const isEnumSelect = Boolean(
                  fieldMeta?.enumValues && fieldMeta.enumValues.length > 0
                );
                const isNumeric =
                  fieldMeta?.dataType === 'number' ||
                  fieldMeta?.dataType === 'currency';
                const isDate = fieldMeta?.dataType === 'date';

                return (
                  <div
                    key={row.localId}
                    className={cn(
                      'flex flex-col lg:flex-row lg:items-center gap-2 rounded-lg border p-2.5 transition-opacity',
                      row.enabled
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50'
                        : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/20 opacity-60'
                    )}
                  >
                    {/* Logic Prefix + Toggle Enable */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleRowEnabled(row.localId)}
                        title={
                          row.enabled
                            ? 'Pause this filter without deleting'
                            : 'Re-enable this filter'
                        }
                        aria-label={
                          row.enabled ? 'Pause filter' : 'Enable filter'
                        }
                        className="rounded-md p-1 text-slate-500 hover:text-indigo-500 transition-colors cursor-pointer"
                      >
                        {row.enabled ? (
                          <PauseCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <PlayCircle className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      <span className="w-11 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {idx === 0 ? 'Where' : logicOperator}
                      </span>
                    </div>

                    {/* Field Selector */}
                    <select
                      aria-label="Filter field"
                      value={row.field}
                      onChange={(e) =>
                        handleFieldChange(row.localId, e.target.value)
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 lg:w-48 cursor-pointer"
                    >
                      {filterableFields.map((f) => (
                        <option key={f.id} value={f.fieldKey}>
                          {f.displayName}
                        </option>
                      ))}
                    </select>

                    {/* Operator Selector */}
                    <select
                      aria-label="Filter operator"
                      value={row.operator}
                      onChange={(e) =>
                        handleOperatorChange(
                          row.localId,
                          e.target.value as FilterOperator
                        )
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 lg:w-44 cursor-pointer"
                    >
                      {allowedOps.map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </select>

                    {/* Dynamically Typed Value Input(s) */}
                    <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                      {row.operator === FILTER_OPERATORS.LAST_N_DAYS ? (
                        <div className="flex flex-wrap items-center gap-1.5 w-full">
                          <input
                            type="number"
                            min={1}
                            max={3650}
                            value={row.rawValueA}
                            onChange={(e) =>
                              handleValueUpdate(row.localId, {
                                rawValueA: e.target.value,
                              })
                            }
                            placeholder="Days (e.g. 30)"
                            className="w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          {[7, 30, 90, 365].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() =>
                                handleValueUpdate(
                                  row.localId,
                                  { rawValueA: String(days) },
                                  true
                                )
                              }
                              className={cn(
                                'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                                row.rawValueA === String(days)
                                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                              )}
                            >
                              {days}d
                            </button>
                          ))}
                        </div>
                      ) : row.operator === FILTER_OPERATORS.BETWEEN ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type={isDate ? 'date' : 'number'}
                            step={isNumeric ? 'any' : undefined}
                            value={row.rawValueA}
                            onChange={(e) =>
                              handleValueUpdate(row.localId, {
                                rawValueA: e.target.value,
                              })
                            }
                            placeholder={isDate ? 'From' : 'Min'}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-[11px] text-slate-400 shrink-0">
                            to
                          </span>
                          <input
                            type={isDate ? 'date' : 'number'}
                            step={isNumeric ? 'any' : undefined}
                            value={row.rawValueB}
                            onChange={(e) =>
                              handleValueUpdate(row.localId, {
                                rawValueB: e.target.value,
                              })
                            }
                            placeholder={isDate ? 'To' : 'Max'}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      ) : row.operator === FILTER_OPERATORS.IN && isEnumSelect ? (
                        <div className="flex flex-wrap gap-1.5">
                          {fieldMeta!.enumValues!.map((opt) => {
                            const checked = row.rawList.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  const nextList = checked
                                    ? row.rawList.filter((v) => v !== opt)
                                    : [...row.rawList, opt];
                                  handleValueUpdate(
                                    row.localId,
                                    { rawList: nextList },
                                    true
                                  );
                                }}
                                className={cn(
                                  'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                                  checked
                                    ? 'border-indigo-500 bg-indigo-600 text-white'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                                )}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (row.operator === FILTER_OPERATORS.EQ ||
                          row.operator === FILTER_OPERATORS.NEQ) &&
                        isEnumSelect ? (
                        <select
                          aria-label="Filter option value"
                          value={row.rawValueA}
                          onChange={(e) =>
                            handleValueUpdate(
                              row.localId,
                              { rawValueA: e.target.value },
                              true
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="">Select {fieldMeta?.displayName}...</option>
                          {fieldMeta!.enumValues!.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : fieldMeta?.dataType === 'boolean' ? (
                        <select
                          aria-label="Boolean filter value"
                          value={row.rawValueA}
                          onChange={(e) =>
                            handleValueUpdate(
                              row.localId,
                              { rawValueA: e.target.value },
                              true
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : (
                        <input
                          type={isDate ? 'date' : isNumeric ? 'number' : 'text'}
                          step={isNumeric ? 'any' : undefined}
                          value={row.rawValueA}
                          onChange={(e) =>
                            handleValueUpdate(row.localId, {
                              rawValueA: e.target.value,
                            })
                          }
                          placeholder={
                            row.operator === FILTER_OPERATORS.IN
                              ? 'Comma-separated values...'
                              : `Enter ${fieldMeta?.displayName.toLowerCase() ?? 'value'}...`
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      )}
                    </div>

                    {/* Delete Condition */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.localId)}
                      aria-label="Remove filter condition"
                      className="self-end lg:self-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
