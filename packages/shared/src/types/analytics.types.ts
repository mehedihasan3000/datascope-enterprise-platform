/**
 * Data Analytics Contracts (Section 9)
 * Powered strictly by PostgreSQL backend SQL aggregations for Recharts
 */

export interface CategoryDistributionItem {
  category: string;
  count: number;
  totalRevenue: number;
  avgRiskScore: number;
}

export interface StatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface DataGrowthTrendItem {
  period: string; // e.g. '2026-06', '2026-07'
  recordsCreated: number;
  cumulativeRecords: number;
  totalRevenueAdded: number;
}

export interface SearchActivityItem {
  date: string;
  queryCount: number;
  avgExecutionTimeMs: number;
  avgResultCount: number;
}

export interface FrequentFilterItem {
  fieldKey: string;
  operator: string;
  usageCount: number;
}

export interface CountryDistributionItem {
  country: string;
  count: number;
  totalRevenue: number;
}

export interface AnalyticsOverviewDTO {
  datasetId: string | 'ALL';
  summary: {
    totalRecords: number;
    activeRecords: number;
    totalRevenue: number;
    averageRevenue: number;
    averageRiskScore: number;
    totalDatasets: number;
    totalSavedViews: number;
    totalSearchesExecuted: number;
    avgSearchLatencyMs: number;
  };
  recordsByCategory: CategoryDistributionItem[];
  recordsByStatus: StatusDistributionItem[];
  recordsByCountry: CountryDistributionItem[];
  dataGrowthTrends: DataGrowthTrendItem[];
  searchActivity: SearchActivityItem[];
  mostFrequentFilters: FrequentFilterItem[];
}
