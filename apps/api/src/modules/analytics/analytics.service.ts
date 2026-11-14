import {
  CAPABILITIES,
  hasCapability,
  ROLES,
  type AnalyticsOverviewDTO,
  type CategoryDistributionItem,
  type CountryDistributionItem,
  type DataGrowthTrendItem,
  type FrequentFilterItem,
  type StatusDistributionItem,
  type SearchActivityItem,
} from '@datascope/shared';
import { pool } from '../../db/index.js';
import type { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error.middleware.js';
import { resolveEffectiveDatasetPermissions } from '../../middleware/rbac.middleware.js';
import { TtlCache } from '../../utils/ttl-cache.js';
import { listDatasetsForUser } from '../datasets/datasets.service.js';

const analyticsCache = new TtlCache<AnalyticsOverviewDTO>({
  maxEntries: 100,
  ttlMs: 60_000, // 60 seconds server-side aggregation cache
});

export function invalidateAnalyticsCache(): void {
  analyticsCache.clear();
}

export async function getAnalyticsOverview(
  user: AuthenticatedUser,
  datasetId?: string
): Promise<AnalyticsOverviewDTO> {
  const authorizedDatasets = await listDatasetsForUser(user);
  const authorizedIds = authorizedDatasets.map((d) => d.id);

  if (datasetId) {
    const perms = await resolveEffectiveDatasetPermissions(datasetId, user);
    if (!perms.canView) {
      throw new AppError(
        403,
        'DATASET_ACCESS_DENIED',
        'You do not have permission to view analytics for this dataset'
      );
    }
  }

  const targetIds = datasetId ? [datasetId] : authorizedIds;

  if (targetIds.length === 0) {
    return {
      datasetId: datasetId ?? 'ALL',
      summary: {
        totalRecords: 0,
        activeRecords: 0,
        totalRevenue: 0,
        averageRevenue: 0,
        averageRiskScore: 0,
        totalDatasets: 0,
        totalSavedViews: 0,
        totalSearchesExecuted: 0,
        avgSearchLatencyMs: 0,
      },
      recordsByCategory: [],
      recordsByStatus: [],
      recordsByCountry: [],
      dataGrowthTrends: [],
      searchActivity: [],
      mostFrequentFilters: [],
    };
  }

  const canViewFullAnalytics = hasCapability(
    user.role,
    CAPABILITIES.VIEW_PLATFORM_ANALYTICS
  );
  const cacheKey = `${user.id}:${user.role}:${[...targetIds].sort().join(',')}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Summary KPIs via SQL Aggregation
  const summaryPromise = pool.query<{
    total_records: string;
    active_records: string;
    total_revenue: string;
    avg_revenue: string;
    avg_risk_score: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_records,
       COUNT(*) FILTER (WHERE status = 'Active')::text AS active_records,
       COALESCE( ROUND(SUM(revenue), 2), 0 )::text AS total_revenue,
       COALESCE( ROUND(AVG(revenue), 2), 0 )::text AS avg_revenue,
       COALESCE( ROUND(AVG(risk_score), 2), 0 )::text AS avg_risk_score
     FROM dataset_records
     WHERE dataset_id = ANY($1::uuid[])`,
    [targetIds]
  );

  // 2. Meta counts (RBAC-scoped Saved Views & Search History telemetry)
  const metaCountsPromise = pool.query<{
    saved_views_count: string;
    searches_count: string;
    avg_latency_ms: string;
  }>(
    `SELECT
       (
         SELECT COUNT(*)::text
         FROM saved_views
         WHERE dataset_id = ANY($1::uuid[])
           AND (
             $3::text = '${ROLES.ADMIN}'
             OR user_id = $2::uuid
             OR (
               is_shared = true
               AND (
                 jsonb_array_length(shared_with_roles) = 0
                 OR shared_with_roles @> jsonb_build_array($3::text)
               )
             )
           )
       ) AS saved_views_count,
       (
         SELECT COUNT(*)::text
         FROM search_history
         WHERE dataset_id = ANY($1::uuid[])
           AND ($4::boolean = true OR user_id = $2::uuid)
       ) AS searches_count,
       (
         SELECT COALESCE(ROUND(AVG(execution_time_ms), 1), 0)::text
         FROM search_history
         WHERE dataset_id = ANY($1::uuid[])
           AND ($4::boolean = true OR user_id = $2::uuid)
       ) AS avg_latency_ms`,
    [targetIds, user.id, user.role, canViewFullAnalytics]
  );

  if (!canViewFullAnalytics) {
    const [summaryRes, metaRes] = await Promise.all([
      summaryPromise,
      metaCountsPromise,
    ]);
    const sRow = summaryRes.rows[0];
    const mRow = metaRes.rows[0];

    const viewerOverview: AnalyticsOverviewDTO = {
      datasetId: datasetId ?? 'ALL',
      summary: {
        totalRecords: Number(sRow?.total_records ?? 0),
        activeRecords: Number(sRow?.active_records ?? 0),
        totalRevenue: Number(sRow?.total_revenue ?? 0),
        averageRevenue: Number(sRow?.avg_revenue ?? 0),
        averageRiskScore: Number(sRow?.avg_risk_score ?? 0),
        totalDatasets: authorizedIds.length,
        totalSavedViews: Number(mRow?.saved_views_count ?? 0),
        totalSearchesExecuted: Number(mRow?.searches_count ?? 0),
        avgSearchLatencyMs: Number(mRow?.avg_latency_ms ?? 0),
      },
      recordsByCategory: [],
      recordsByStatus: [],
      recordsByCountry: [],
      dataGrowthTrends: [],
      searchActivity: [],
      mostFrequentFilters: [],
    };

    analyticsCache.set(cacheKey, viewerOverview);
    return viewerOverview;
  }

  // 3. Records by Category
  const categoryPromise = pool.query<{
    category: string;
    count: string;
    total_revenue: string;
    avg_risk_score: string;
  }>(
    `SELECT
       category,
       COUNT(*)::text AS count,
       COALESCE(ROUND(SUM(revenue), 2), 0)::text AS total_revenue,
       COALESCE(ROUND(AVG(risk_score), 2), 0)::text AS avg_risk_score
     FROM dataset_records
     WHERE dataset_id = ANY($1::uuid[])
     GROUP BY category
     ORDER BY COUNT(*) DESC, category ASC`,
    [targetIds]
  );

  // 4. Records by Status
  const statusPromise = pool.query<{
    status: string;
    count: string;
  }>(
    `SELECT
       status,
       COUNT(*)::text AS count
     FROM dataset_records
     WHERE dataset_id = ANY($1::uuid[])
     GROUP BY status
     ORDER BY COUNT(*) DESC`,
    [targetIds]
  );

  // 5. Records by Country
  const countryPromise = pool.query<{
    country: string;
    count: string;
    total_revenue: string;
  }>(
    `SELECT
       country,
       COUNT(*)::text AS count,
       COALESCE(ROUND(SUM(revenue), 2), 0)::text AS total_revenue
     FROM dataset_records
     WHERE dataset_id = ANY($1::uuid[])
     GROUP BY country
     ORDER BY COUNT(*) DESC, total_revenue DESC
     LIMIT 12`,
    [targetIds]
  );

  // 6. Data Growth Trends (Monthly Aggregation + Cumulative Window Function)
  const growthPromise = pool.query<{
    period: string;
    records_created: string;
    cumulative_records: string;
    total_revenue_added: string;
  }>(
    `WITH monthly AS (
       SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
         COUNT(*) AS records_created,
         COALESCE(ROUND(SUM(revenue), 2), 0) AS total_revenue_added
       FROM dataset_records
       WHERE dataset_id = ANY($1::uuid[])
       GROUP BY DATE_TRUNC('month', created_at)
     )
     SELECT
       period,
       records_created::text,
       SUM(records_created) OVER (ORDER BY period ASC)::text AS cumulative_records,
       total_revenue_added::text
     FROM monthly
     ORDER BY period ASC`,
    [targetIds]
  );

  // 7. Search Activity (Daily over last 14 days)
  const searchActivityPromise = pool.query<{
    date: string;
    query_count: string;
    avg_execution_time_ms: string;
    avg_result_count: string;
  }>(
    `SELECT
       TO_CHAR(DATE_TRUNC('day', executed_at), 'YYYY-MM-DD') AS date,
       COUNT(*)::text AS query_count,
       COALESCE(ROUND(AVG(execution_time_ms), 1), 0)::text AS avg_execution_time_ms,
       COALESCE(ROUND(AVG(result_count), 0), 0)::text AS avg_result_count
     FROM search_history
     WHERE dataset_id = ANY($1::uuid[])
     GROUP BY DATE_TRUNC('day', executed_at)
     ORDER BY date ASC
     LIMIT 30`,
    [targetIds]
  );

  // 8. Most Frequently Used Filters (Extracted via jsonb_array_elements)
  const frequentFiltersPromise = pool.query<{
    field_key: string;
    operator: string;
    usage_count: string;
  }>(
    `SELECT
       elem->>'field' AS field_key,
       elem->>'operator' AS operator,
       COUNT(*)::text AS usage_count
     FROM search_history sh,
          LATERAL jsonb_array_elements(sh.filters) AS elem
     WHERE sh.dataset_id = ANY($1::uuid[])
       AND elem->>'field' IS NOT NULL
     GROUP BY elem->>'field', elem->>'operator'
     ORDER BY COUNT(*) DESC
     LIMIT 10`,
    [targetIds]
  );

  const [
    summaryRes,
    metaRes,
    categoryRes,
    statusRes,
    countryRes,
    growthRes,
    activityRes,
    filtersRes,
  ] = await Promise.all([
    summaryPromise,
    metaCountsPromise,
    categoryPromise,
    statusPromise,
    countryPromise,
    growthPromise,
    searchActivityPromise,
    frequentFiltersPromise,
  ]);

  const sRow = summaryRes.rows[0];
  const mRow = metaRes.rows[0];
  const totalRecords = Number(sRow?.total_records ?? 0);

  const recordsByCategory: CategoryDistributionItem[] = categoryRes.rows.map((r) => ({
    category: r.category,
    count: Number(r.count),
    totalRevenue: Number(r.total_revenue),
    avgRiskScore: Number(r.avg_risk_score),
  }));

  const recordsByStatus: StatusDistributionItem[] = statusRes.rows.map((r) => {
    const count = Number(r.count);
    return {
      status: r.status,
      count,
      percentage:
        totalRecords > 0 ? Number(((count / totalRecords) * 100).toFixed(2)) : 0,
    };
  });

  const recordsByCountry: CountryDistributionItem[] = countryRes.rows.map((r) => ({
    country: r.country,
    count: Number(r.count),
    totalRevenue: Number(r.total_revenue),
  }));

  const dataGrowthTrends: DataGrowthTrendItem[] = growthRes.rows.map((r) => ({
    period: r.period,
    recordsCreated: Number(r.records_created),
    cumulativeRecords: Number(r.cumulative_records),
    totalRevenueAdded: Number(r.total_revenue_added),
  }));

  const searchActivity: SearchActivityItem[] = activityRes.rows.map((r) => ({
    date: r.date,
    queryCount: Number(r.query_count),
    avgExecutionTimeMs: Number(r.avg_execution_time_ms),
    avgResultCount: Number(r.avg_result_count),
  }));

  const mostFrequentFilters: FrequentFilterItem[] = filtersRes.rows.map((r) => ({
    fieldKey: r.field_key,
    operator: r.operator,
    usageCount: Number(r.usage_count),
  }));

  const overview: AnalyticsOverviewDTO = {
    datasetId: datasetId ?? 'ALL',
    summary: {
      totalRecords,
      activeRecords: Number(sRow?.active_records ?? 0),
      totalRevenue: Number(sRow?.total_revenue ?? 0),
      averageRevenue: Number(sRow?.avg_revenue ?? 0),
      averageRiskScore: Number(sRow?.avg_risk_score ?? 0),
      totalDatasets: authorizedIds.length,
      totalSavedViews: Number(mRow?.saved_views_count ?? 0),
      totalSearchesExecuted: Number(mRow?.searches_count ?? 0),
      avgSearchLatencyMs: Number(mRow?.avg_latency_ms ?? 0),
    },
    recordsByCategory,
    recordsByStatus,
    recordsByCountry,
    dataGrowthTrends,
    searchActivity,
    mostFrequentFilters,
  };

  analyticsCache.set(cacheKey, overview);
  return overview;
}
