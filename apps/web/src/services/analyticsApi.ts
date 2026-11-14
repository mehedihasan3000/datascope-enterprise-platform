import type { AnalyticsOverviewDTO, ApiResponse } from '@datascope/shared';
import { apiSlice } from './apiSlice';

export const analyticsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAnalyticsOverview: builder.query<
      ApiResponse<AnalyticsOverviewDTO>,
      string | void
    >({
      query: (datasetId) =>
        datasetId
          ? `/analytics/overview?datasetId=${datasetId}`
          : '/analytics/overview',
      keepUnusedDataFor: 180,
      providesTags: ['Analytics'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAnalyticsOverviewQuery } = analyticsApi;
