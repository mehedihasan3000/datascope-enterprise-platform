import {
  FILTER_OPERATORS,
  SEARCH_MODES,
  type FilterCondition,
  type SearchMode,
  type SearchQueryRequest,
  type SortRule,
} from '@datascope/shared';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { datasetRecords } from '../db/schema/index.js';
import { AppError } from '../middleware/error.middleware.js';

const CORE_COLUMN_MAP: Record<string, PgColumn> = {
  recordCode: datasetRecords.recordCode,
  title: datasetRecords.title,
  category: datasetRecords.category,
  status: datasetRecords.status,
  country: datasetRecords.country,
  revenue: datasetRecords.revenue,
  employeeCount: datasetRecords.employeeCount,
  riskScore: datasetRecords.riskScore,
  createdAt: datasetRecords.createdAt,
  updatedAt: datasetRecords.updatedAt,
};

const NUMERIC_CORE_FIELDS = new Set(['revenue', 'employeeCount', 'riskScore']);
const DATE_CORE_FIELDS = new Set(['createdAt', 'updatedAt']);
const SAFE_JSON_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export interface CursorPayload {
  createdAt: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as Partial<CursorPayload>;
    if (
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      throw new Error('Malformed cursor payload');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Provided pagination cursor is invalid');
  }
}

/**
 * Compiles global search query (`fts`, `partial`, or `exact`) into parameterized SQL.
 */
export function buildGlobalSearchSql(
  rawQuery: string,
  searchMode: SearchMode = SEARCH_MODES.FTS
): SQL | undefined {
  const query = rawQuery.trim();
  if (!query) {
    return undefined;
  }

  if (searchMode === SEARCH_MODES.EXACT) {
    return or(
      eq(datasetRecords.recordCode, query),
      eq(datasetRecords.title, query),
      eq(datasetRecords.category, query),
      eq(datasetRecords.status, query),
      eq(datasetRecords.country, query)
    );
  }

  if (searchMode === SEARCH_MODES.PARTIAL) {
    const pattern = `%${query}%`;
    return or(
      ilike(datasetRecords.searchText, pattern),
      ilike(datasetRecords.recordCode, pattern)
    );
  }

  // Default: PostgreSQL Full-Text Search (tsvector + websearch_to_tsquery + prefix matching)
  const sanitizedTokens = query
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (/^[A-Za-z]+-\d+/i.test(query) || /^\d+$/.test(query)) {
    const pattern = `%${query}%`;
    return or(
      sql`to_tsvector('english', ${datasetRecords.searchText}) @@ websearch_to_tsquery('english', ${query})`,
      ilike(datasetRecords.recordCode, pattern)
    );
  }

  if (sanitizedTokens.length > 0) {
    const prefixTsQuery = sanitizedTokens.map((t) => `${t}:*`).join(' & ');
    return or(
      sql`to_tsvector('english', ${datasetRecords.searchText}) @@ websearch_to_tsquery('english', ${query})`,
      sql`to_tsvector('english', ${datasetRecords.searchText}) @@ to_tsquery('english', ${prefixTsQuery})`
    );
  }

  return sql`to_tsvector('english', ${datasetRecords.searchText}) @@ websearch_to_tsquery('english', ${query})`;
}

/**
 * Compiles a single field filter condition on either a core indexed column or a JSONB attribute.
 */
export function buildSingleFilterConditionSql(condition: FilterCondition): SQL {
  const { field, operator, value } = condition;

  if (!SAFE_JSON_KEY_REGEX.test(field)) {
    throw new AppError(400, 'INVALID_FILTER_FIELD', `Invalid filter field key: ${field}`);
  }

  const coreCol = CORE_COLUMN_MAP[field];

  // Handle Core Indexed Columns
  if (coreCol) {
    const isNumeric = NUMERIC_CORE_FIELDS.has(field);
    const isDate = DATE_CORE_FIELDS.has(field);

    switch (operator) {
      case FILTER_OPERATORS.EQ: {
        if (isDate) {
          const d = new Date(String(value));
          if (Number.isNaN(d.getTime())) {
            throw new AppError(400, 'INVALID_DATE_FILTER', `Invalid date value for ${field}`);
          }
          const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
          return and(gte(coreCol, startOfDay), lt(coreCol, endOfDay))!;
        }
        return eq(coreCol, isNumeric ? String(Number(value)) : String(value));
      }

      case FILTER_OPERATORS.NEQ:
        return ne(coreCol, isNumeric ? String(Number(value)) : String(value));

      case FILTER_OPERATORS.CONTAINS:
        return ilike(coreCol, `%${String(value)}%`);

      case FILTER_OPERATORS.STARTS_WITH:
        return ilike(coreCol, `${String(value)}%`);

      case FILTER_OPERATORS.GT: {
        if (isDate) {
          return gt(coreCol, new Date(String(value)));
        }
        return field === 'employeeCount'
          ? gt(coreCol, Number(value))
          : gt(coreCol, String(Number(value)));
      }

      case FILTER_OPERATORS.GTE: {
        if (isDate) {
          return gte(coreCol, new Date(String(value)));
        }
        return field === 'employeeCount'
          ? gte(coreCol, Number(value))
          : gte(coreCol, String(Number(value)));
      }

      case FILTER_OPERATORS.LT: {
        if (isDate) {
          return lt(coreCol, new Date(String(value)));
        }
        return field === 'employeeCount'
          ? lt(coreCol, Number(value))
          : lt(coreCol, String(Number(value)));
      }

      case FILTER_OPERATORS.LTE: {
        if (isDate) {
          return lte(coreCol, new Date(String(value)));
        }
        return field === 'employeeCount'
          ? lte(coreCol, Number(value))
          : lte(coreCol, String(Number(value)));
      }

      case FILTER_OPERATORS.BETWEEN: {
        if (!Array.isArray(value) || value.length !== 2) {
          throw new AppError(
            400,
            'INVALID_FILTER_VALUE',
            `Operator 'between' requires a 2-element range array for field '${field}'`
          );
        }
        const [minVal, maxVal] = value;
        if (isDate) {
          return and(
            gte(coreCol, new Date(String(minVal))),
            lte(coreCol, new Date(String(maxVal)))
          )!;
        }
        if (field === 'employeeCount') {
          return and(gte(coreCol, Number(minVal)), lte(coreCol, Number(maxVal)))!;
        }
        return and(
          gte(coreCol, String(Number(minVal))),
          lte(coreCol, String(Number(maxVal)))
        )!;
      }

      case FILTER_OPERATORS.IN: {
        const list = Array.isArray(value) ? value : [value];
        if (list.length === 0) {
          throw new AppError(400, 'INVALID_FILTER_VALUE', `Operator 'in' requires at least 1 value`);
        }
        return inArray(
          coreCol,
          list.map((item) => (field === 'employeeCount' ? Number(item) : String(item)))
        );
      }

      case FILTER_OPERATORS.LAST_N_DAYS: {
        const days = Number(value);
        if (!Number.isFinite(days) || days <= 0) {
          throw new AppError(
            400,
            'INVALID_FILTER_VALUE',
            `Operator 'lastNDays' requires a positive number of days`
          );
        }
        const cutoff = new Date(Date.now() - days * 86_400_000);
        return gte(coreCol, cutoff);
      }

      default:
        throw new AppError(400, 'UNSUPPORTED_OPERATOR', `Unsupported filter operator: ${operator}`);
    }
  }

  // Handle Dynamic JSONB Attribute Fields (`attributes->>field` or `@>`)
  const jsonTextExpr = sql`(${datasetRecords.attributes} ->> ${field})`;
  const jsonNumericExpr = sql`((${datasetRecords.attributes} ->> ${field})::numeric)`;

  switch (operator) {
    case FILTER_OPERATORS.EQ: {
      // Use GIN-index-friendly `@>` containment operator for primitive equality on JSONB!
      const containmentObj = JSON.stringify({ [field]: value });
      return sql`${datasetRecords.attributes} @> ${containmentObj}::jsonb`;
    }
    case FILTER_OPERATORS.NEQ:
      return sql`${jsonTextExpr} IS DISTINCT FROM ${String(value)}`;
    case FILTER_OPERATORS.CONTAINS:
      return sql`${jsonTextExpr} ILIKE ${`%${String(value)}%`}`;
    case FILTER_OPERATORS.STARTS_WITH:
      return sql`${jsonTextExpr} ILIKE ${`${String(value)}%`}`;
    case FILTER_OPERATORS.GT:
      return sql`${jsonNumericExpr} > ${Number(value)}`;
    case FILTER_OPERATORS.GTE:
      return sql`${jsonNumericExpr} >= ${Number(value)}`;
    case FILTER_OPERATORS.LT:
      return sql`${jsonNumericExpr} < ${Number(value)}`;
    case FILTER_OPERATORS.LTE:
      return sql`${jsonNumericExpr} <= ${Number(value)}`;
    case FILTER_OPERATORS.BETWEEN: {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new AppError(
          400,
          'INVALID_FILTER_VALUE',
          `Operator 'between' requires a 2-element range array for field '${field}'`
        );
      }
      return sql`${jsonNumericExpr} BETWEEN ${Number(value[0])} AND ${Number(value[1])}`;
    }
    case FILTER_OPERATORS.IN: {
      const list = (Array.isArray(value) ? value : [value]).map((v) => String(v));
      if (list.length === 0) {
        throw new AppError(400, 'INVALID_FILTER_VALUE', `Operator 'in' requires at least 1 value`);
      }
      return inArray(jsonTextExpr, list);
    }
    default:
      throw new AppError(
        400,
        'UNSUPPORTED_OPERATOR',
        `Operator '${operator}' is not supported on dynamic attribute '${field}'`
      );
  }
}

/**
 * Compiles the full WHERE clause combining datasetId, global search, filter tree, and optional cursor.
 */
export function buildSearchWhereClause(
  datasetId: string,
  request: SearchQueryRequest
): {
  baseWhereSql: SQL;
  paginatedWhereSql: SQL;
  isUnfilteredDatasetQuery: boolean;
} {
  const baseClauses: SQL[] = [eq(datasetRecords.datasetId, datasetId)];

  const globalSearchSql = buildGlobalSearchSql(
    request.searchQuery ?? '',
    request.searchMode ?? SEARCH_MODES.FTS
  );
  if (globalSearchSql) {
    baseClauses.push(globalSearchSql);
  }

  const filterClauses = (request.filters ?? []).map((cond) =>
    buildSingleFilterConditionSql(cond)
  );

  if (filterClauses.length > 0) {
    const combinedFilters =
      request.logicOperator === 'OR' ? or(...filterClauses)! : and(...filterClauses)!;
    baseClauses.push(combinedFilters);
  }

  const baseWhereSql = and(...baseClauses)!;
  const isUnfilteredDatasetQuery = !globalSearchSql && filterClauses.length === 0;

  if (request.paginationMode === 'cursor' && request.cursor) {
    const decoded = decodeCursor(request.cursor);
    const cursorDate = new Date(decoded.createdAt);
    const cursorCondition = sql`(${datasetRecords.createdAt}, ${datasetRecords.id}) < (${cursorDate.toISOString()}::timestamptz, ${decoded.id}::uuid)`;
    return {
      baseWhereSql,
      paginatedWhereSql: and(baseWhereSql, cursorCondition)!,
      isUnfilteredDatasetQuery,
    };
  }

  return {
    baseWhereSql,
    paginatedWhereSql: baseWhereSql,
    isUnfilteredDatasetQuery,
  };
}

/**
 * Compiles multi-column ORDER BY expressions with deterministic UUID tie-breaking.
 */
export function buildOrderByClauses(
  sorting: SortRule[] = [],
  paginationMode: 'offset' | 'cursor' = 'offset'
): SQL[] {
  if (paginationMode === 'cursor') {
    return [desc(datasetRecords.createdAt), desc(datasetRecords.id)];
  }

  const orderClauses: SQL[] = [];

  for (const rule of sorting) {
    const { field, direction } = rule;
    if (!SAFE_JSON_KEY_REGEX.test(field)) {
      continue;
    }

    const coreCol = CORE_COLUMN_MAP[field];
    if (coreCol) {
      orderClauses.push(direction === 'asc' ? asc(coreCol) : desc(coreCol));
    } else {
      const jsonExpr = sql`(${datasetRecords.attributes} ->> ${field})`;
      orderClauses.push(direction === 'asc' ? asc(jsonExpr) : desc(jsonExpr));
    }
  }

  if (orderClauses.length === 0) {
    orderClauses.push(desc(datasetRecords.createdAt));
  }

  // Deterministic tie-breaker for pagination consistency
  orderClauses.push(desc(datasetRecords.id));

  return orderClauses;
}
