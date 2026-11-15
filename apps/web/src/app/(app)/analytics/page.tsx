'use client';

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Clock,
  Database,
  DollarSign,
  Filter,
  Globe2,
  ShieldAlert,
  ShieldOff,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useGetAnalyticsOverviewQuery } from '@/services/analyticsApi';
import { useGetDatasetsQuery } from '@/services/datasetsApi';
import { useAppSelector } from '@/store';
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatNumber,
} from '@/utils/formatters';

const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Pending: '#f59e0b',
  Suspended: '#f43f5e',
  Archived: '#64748b',
};

const PALETTE = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function AnalyticsPage() {
  const { can } = usePermissions();
  const theme = useAppSelector((s) => s.uiPreferences.theme);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('ALL');

  const axisColor = theme === 'dark' ? '#cbd5e1' : '#475569';
  const surfaceBgColor = theme === 'dark' ? '#0d1322' : '#ffffff';

  const canViewAnalytics = can('analytics:view');

  const { data: datasetsRes } = useGetDatasetsQuery(undefined, {
    skip: !canViewAnalytics,
  });

  const {
    data: analyticsRes,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetAnalyticsOverviewQuery(
    selectedDatasetId === 'ALL' ? undefined : selectedDatasetId,
    { skip: !canViewAnalytics }
  );

  if (!canViewAnalytics) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <EmptyState
          icon={ShieldOff}
          title="Analytics Restricted to Analyst & Administrator Roles"
          description="Platform-wide SQL aggregation dashboards require Data Analyst or Administrator privileges. You can continue exploring authorized datasets in Data Explorer."
          action={
            <Link
              href="/explorer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Data Explorer
            </Link>
          }
        />
      </div>
    );
  }

  const datasets = datasetsRes?.data ?? [];
  const analytics = analyticsRes?.data;

  const frequentFiltersChartData = (analytics?.mostFrequentFilters ?? []).map(
    (item) => ({
      label: `${item.fieldKey} (${item.operator})`,
      usageCount: item.usageCount,
    })
  );

  return (
    <div className="space-y-6">
      {/* Header Scope Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Server-Side SQL Intelligence Aggregations
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Computed via PostgreSQL GROUP BY & window queries across 104,000+ records (zero raw rows downloaded)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFetching && <Badge variant="info">Refreshing metrics...</Badge>}
          <label
            htmlFor="analytics-dataset-scope"
            className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
          >
            Scope:
          </label>
          <select
            id="analytics-dataset-scope"
            name="analyticsDatasetScope"
            aria-label="Analytics dataset scope"
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            <option value="ALL">All Authorized Datasets</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({formatCompactNumber(ds.totalRecords)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      ) : isError || !analytics ? (
        <ErrorState
          title="Unable to compute SQL analytics"
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          {/* Summary KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Total Indexed Records</span>
                <Database className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {formatNumber(analytics.summary.totalRecords)}
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                {formatNumber(analytics.summary.activeRecords)} Active (
                {analytics.summary.totalRecords > 0
                  ? (
                      (analytics.summary.activeRecords /
                        analytics.summary.totalRecords) *
                      100
                    ).toFixed(1)
                  : '0'}
                %)
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Total Portfolio Revenue</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {formatCompactCurrency(analytics.summary.totalRevenue)}
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                Mean Revenue: {formatCurrency(analytics.summary.averageRevenue)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Search Engine Throughput</span>
                <Clock className="h-4 w-4 text-cyan-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {analytics.summary.avgSearchLatencyMs} ms
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                {formatNumber(analytics.summary.totalSearchesExecuted)} queries ·{' '}
                {analytics.summary.totalSavedViews} saved views
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Mean Risk Score</span>
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {analytics.summary.averageRiskScore.toFixed(2)} / 100
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Across {analytics.recordsByCategory.length} categories
              </div>
            </div>
          </div>

          {/* Row 1 Charts: Records by Category + Records by Status Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Records by Category Bar Chart */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Records by Industry Category
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Record distribution grouped across domain categories
                  </p>
                </div>
                <Badge variant="indigo" className="shrink-0">
                  Bar Chart
                </Badge>
              </div>

              {analytics.recordsByCategory.length === 0 ? (
                <EmptyState
                  title="No category data"
                  description="No records available for the selected dataset scope."
                />
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.recordsByCategory}
                      margin={{ top: 12, right: 16, left: 20, bottom: 14 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis
                        dataKey="category"
                        tick={{ fontSize: 11, fill: axisColor }}
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                        height={84}
                        tickMargin={6}
                      />
                      <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Records" radius={[6, 6, 0, 0]}>
                        {analytics.recordsByCategory.map((_, index) => (
                          <Cell
                            key={`cat-${index}`}
                            fill={PALETTE[index % PALETTE.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Records by Status Donut Chart */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Records by Status
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Lifecycle share across records
                  </p>
                </div>
                <Badge variant="success" className="shrink-0">
                  Donut
                </Badge>
              </div>

              {analytics.recordsByStatus.length === 0 ? (
                <EmptyState
                  title="No status breakdown"
                  description="No records found for status calculation."
                />
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.recordsByStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="44%"
                        innerRadius={58}
                        outerRadius={90}
                        paddingAngle={3}
                        stroke={surfaceBgColor}
                        strokeWidth={2}
                      >
                        {analytics.recordsByStatus.map((entry, idx) => (
                          <Cell
                            key={entry.status}
                            fill={
                              STATUS_COLORS[entry.status] ??
                              PALETTE[idx % PALETTE.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', color: axisColor }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Row 2 Charts: Data Growth Trends + Search Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Growth Trends Area Chart */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="h-4 w-4 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Data Growth Trends
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Monthly ingestion & cumulative SQL window running total
                    </p>
                  </div>
                </div>
                <Badge variant="indigo" className="shrink-0">
                  Area Chart
                </Badge>
              </div>

              {analytics.dataGrowthTrends.length === 0 ? (
                <EmptyState
                  title="No ingestion history"
                  description="No monthly timestamp trends available."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={analytics.dataGrowthTrends}
                      margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: axisColor }} />
                      <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', color: axisColor }} />
                      <Area
                        type="monotone"
                        dataKey="cumulativeRecords"
                        name="Cumulative Records"
                        stroke="#6366f1"
                        fill="url(#cumGrad)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="recordsCreated"
                        name="Monthly Created"
                        stroke="#06b6d4"
                        fill="url(#newGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Search Activity Line Chart */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="h-4 w-4 text-cyan-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Search Activity & Latency
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Daily search query volume vs avg execution latency (ms)
                    </p>
                  </div>
                </div>
                <Badge variant="info" className="shrink-0">
                  Line Chart
                </Badge>
              </div>

              {analytics.searchActivity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No search telemetry yet"
                  description="Execute queries in Data Explorer to chart daily query activity and latency."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={analytics.searchActivity}
                      margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: axisColor }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: axisColor }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', color: axisColor }} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="queryCount"
                        name="Queries"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgExecutionTimeMs"
                        name="Avg Latency (ms)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Row 3 Charts: Most Frequently Used Filters + Top Markets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Frequently Used Filters Horizontal Bar */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Filter className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Most Frequently Used Filters
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Top field + operator pairs from search_history JSONB logs
                    </p>
                  </div>
                </div>
                <Badge variant="success" className="shrink-0">
                  Horizontal Bar
                </Badge>
              </div>

              {frequentFiltersChartData.length === 0 ? (
                <EmptyState
                  icon={Filter}
                  title="No filter usage recorded yet"
                  description="Apply field filters in Data Explorer to track team filter preferences."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={frequentFiltersChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={130}
                        tick={{ fontSize: 11, fill: axisColor }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Bar
                        dataKey="usageCount"
                        name="Filter Executions"
                        fill="#10b981"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Geographic Country Breakdown Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0d1322] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe2 className="h-4 w-4 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Regional Country Concentration
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Top global territories by entity count & aggregate revenue
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  Top 12 Markets
                </Badge>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Country</th>
                      <th className="px-3 py-2 text-right">Entities</th>
                      <th className="px-3 py-2 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                    {analytics.recordsByCountry.map((row) => (
                      <tr
                        key={row.country}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                          {row.country}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {formatNumber(row.count)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                          {formatCompactCurrency(row.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
