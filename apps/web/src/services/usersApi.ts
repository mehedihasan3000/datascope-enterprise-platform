import type {
  ApiResponse,
  RoleDTO,
  UpdateUserPreferencesInput,
  UpdateUserRoleInput,
  UserDTO,
  UserPreferencesDTO,
} from '@datascope/shared';
import { apiSlice } from './apiSlice';

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<ApiResponse<UserDTO[]>, void>({
      query: () => '/users',
      providesTags: ['Users'],
    }),

    getRoles: builder.query<ApiResponse<RoleDTO[]>, void>({
      query: () => '/users/roles',
      providesTags: ['Users'],
    }),

    updateUserRole: builder.mutation<
      ApiResponse<UserDTO>,
      { userId: string; body: UpdateUserRoleInput }
    >({
      query: ({ userId, body }) => ({
        url: `/users/${userId}/role`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Users'],
    }),

    getMyPreferences: builder.query<ApiResponse<UserPreferencesDTO>, void>({
      query: () => '/users/me/preferences',
      providesTags: ['Preferences'],
    }),

    updateMyPreferences: builder.mutation<
      ApiResponse<UserPreferencesDTO>,
      UpdateUserPreferencesInput
    >({
      query: (body) => ({
        url: '/users/me/preferences',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Preferences', 'Auth'],
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          usersApi.util.updateQueryData('getMyPreferences', undefined, (draft) => {
            if (draft?.data) {
              Object.assign(draft.data, patch);
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetRolesQuery,
  useUpdateUserRoleMutation,
  useGetMyPreferencesQuery,
  useUpdateMyPreferencesMutation,
} = usersApi;
