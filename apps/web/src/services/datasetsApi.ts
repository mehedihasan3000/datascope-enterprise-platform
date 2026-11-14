import type {
  AccessPermissionDTO,
  ApiResponse,
  CreateDatasetInput,
  DatasetDTO,
  UpdateDatasetInput,
  UpdateDatasetPermissionsInput,
} from '@datascope/shared';
import { apiSlice } from './apiSlice';

export const datasetsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDatasets: builder.query<ApiResponse<DatasetDTO[]>, void>({
      query: () => '/datasets',
      keepUnusedDataFor: 300,
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id }) => ({ type: 'Datasets' as const, id })),
              { type: 'Datasets', id: 'LIST' },
            ]
          : [{ type: 'Datasets', id: 'LIST' }],
    }),

    getDatasetById: builder.query<ApiResponse<DatasetDTO>, string>({
      query: (id) => `/datasets/${id}`,
      keepUnusedDataFor: 300,
      providesTags: (_result, _err, id) => [{ type: 'Datasets', id }],
    }),

    createDataset: builder.mutation<ApiResponse<DatasetDTO>, CreateDatasetInput>({
      query: (body) => ({
        url: '/datasets',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Datasets', id: 'LIST' }, 'Analytics'],
    }),

    updateDataset: builder.mutation<
      ApiResponse<DatasetDTO>,
      { id: string; body: UpdateDatasetInput }
    >({
      query: ({ id, body }) => ({
        url: `/datasets/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Datasets', id },
        { type: 'Datasets', id: 'LIST' },
      ],
    }),

    deleteDataset: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/datasets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Datasets', id },
        { type: 'Datasets', id: 'LIST' },
        'Analytics',
      ],
    }),

    getDatasetPermissions: builder.query<ApiResponse<AccessPermissionDTO[]>, string>({
      query: (datasetId) => `/datasets/${datasetId}/permissions`,
      providesTags: (_res, _err, datasetId) => [
        { type: 'DatasetPermissions', id: datasetId },
      ],
    }),

    updateDatasetPermissions: builder.mutation<
      ApiResponse<AccessPermissionDTO[]>,
      { datasetId: string; body: UpdateDatasetPermissionsInput }
    >({
      query: ({ datasetId, body }) => ({
        url: `/datasets/${datasetId}/permissions`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { datasetId }) => [
        { type: 'DatasetPermissions', id: datasetId },
        { type: 'Datasets', id: datasetId },
        { type: 'Datasets', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDatasetsQuery,
  useGetDatasetByIdQuery,
  useCreateDatasetMutation,
  useUpdateDatasetMutation,
  useDeleteDatasetMutation,
  useGetDatasetPermissionsQuery,
  useUpdateDatasetPermissionsMutation,
} = datasetsApi;
