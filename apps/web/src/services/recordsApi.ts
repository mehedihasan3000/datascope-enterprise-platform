import type {
  ApiResponse,
  DatasetRecordDTO,
  PaginationMeta,
  RecordDetailDTO,
  SearchQueryRequest,
} from '@datascope/shared';
import { apiSlice } from './apiSlice';

export interface SearchRecordsArgs {
  datasetId: string;
  query: Partial<SearchQueryRequest>;
}

export interface SearchRecordsApiResponse extends ApiResponse<DatasetRecordDTO[]> {
  meta: PaginationMeta;
}

export interface RecordDetailArgs {
  datasetId?: string;
  recordId: string;
}

export const recordsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    searchRecords: builder.query<SearchRecordsApiResponse, SearchRecordsArgs>({
      query: ({ datasetId, query }) => ({
        url: `/datasets/${datasetId}/records/search`,
        method: 'POST',
        body: query,
      }),
      keepUnusedDataFor: 120,
      providesTags: (_result, _err, { datasetId }) => [
        { type: 'Records', id: datasetId },
      ],
      async onQueryStarted({ query }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          if (
            query.recordHistoryLog !== false &&
            (Boolean(query.searchQuery?.trim()) || (query.filters?.length ?? 0) > 0)
          ) {
            dispatch(apiSlice.util.invalidateTags(['SearchHistory']));
          }
        } catch {
          // Non-fatal: search errors are handled by caller
        }
      },
    }),

    getRecordDetail: builder.query<ApiResponse<RecordDetailDTO>, RecordDetailArgs>({
      query: ({ datasetId, recordId }) =>
        datasetId
          ? `/datasets/${datasetId}/records/${recordId}`
          : `/records/${recordId}`,
      keepUnusedDataFor: 180,
      providesTags: (_result, _err, { recordId }) => [
        { type: 'RecordDetail', id: recordId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useSearchRecordsQuery,
  useLazySearchRecordsQuery,
  useGetRecordDetailQuery,
} = recordsApi;
