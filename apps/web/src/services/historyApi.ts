import type { ApiResponse, SearchHistoryDTO } from '@datascope/shared';
import { apiSlice } from './apiSlice';

export interface GetSearchHistoryArgs {
  datasetId?: string;
  limit?: number;
}

export const historyApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSearchHistory: builder.query<
      ApiResponse<SearchHistoryDTO[]>,
      GetSearchHistoryArgs | void
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args && args.datasetId) params.set('datasetId', args.datasetId);
        if (args && args.limit) params.set('limit', String(args.limit));
        const qs = params.toString();
        return qs ? `/search-history?${qs}` : '/search-history';
      },
      providesTags: ['SearchHistory'],
    }),

    clearSearchHistory: builder.mutation<ApiResponse<{ cleared: true }>, string | void>({
      query: (datasetId) => ({
        url: datasetId ? `/search-history?datasetId=${datasetId}` : '/search-history',
        method: 'DELETE',
      }),
      invalidatesTags: ['SearchHistory', 'Analytics'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetSearchHistoryQuery, useClearSearchHistoryMutation } = historyApi;
