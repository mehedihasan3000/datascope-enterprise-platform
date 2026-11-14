import type {
  ApiResponse,
  CreateSavedViewInput,
  SavedViewDTO,
  ShareSavedViewInput,
  UpdateSavedViewInput,
} from '@datascope/shared';
import { apiSlice } from './apiSlice';

export const savedViewsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSavedViews: builder.query<ApiResponse<SavedViewDTO[]>, string | void>({
      query: (datasetId) =>
        datasetId ? `/saved-views?datasetId=${datasetId}` : '/saved-views',
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id }) => ({ type: 'SavedViews' as const, id })),
              { type: 'SavedViews', id: 'LIST' },
            ]
          : [{ type: 'SavedViews', id: 'LIST' }],
    }),

    getSavedViewById: builder.query<ApiResponse<SavedViewDTO>, string>({
      query: (id) => `/saved-views/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'SavedViews', id }],
    }),

    createSavedView: builder.mutation<ApiResponse<SavedViewDTO>, CreateSavedViewInput>({
      query: (body) => ({
        url: '/saved-views',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'SavedViews', id: 'LIST' }, 'Analytics'],
    }),

    updateSavedView: builder.mutation<
      ApiResponse<SavedViewDTO>,
      { id: string; body: UpdateSavedViewInput }
    >({
      query: ({ id, body }) => ({
        url: `/saved-views/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'SavedViews', id },
        { type: 'SavedViews', id: 'LIST' },
      ],
    }),

    shareSavedView: builder.mutation<
      ApiResponse<SavedViewDTO>,
      { id: string; body: ShareSavedViewInput }
    >({
      query: ({ id, body }) => ({
        url: `/saved-views/${id}/share`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'SavedViews', id },
        { type: 'SavedViews', id: 'LIST' },
      ],
    }),

    deleteSavedView: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/saved-views/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'SavedViews', id },
        { type: 'SavedViews', id: 'LIST' },
        'Analytics',
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSavedViewsQuery,
  useGetSavedViewByIdQuery,
  useLazyGetSavedViewByIdQuery,
  useCreateSavedViewMutation,
  useUpdateSavedViewMutation,
  useShareSavedViewMutation,
  useDeleteSavedViewMutation,
} = savedViewsApi;
