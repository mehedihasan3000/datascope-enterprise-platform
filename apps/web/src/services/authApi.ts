import type {
  ApiResponse,
  LoginInput,
  RegisterInput,
  UserDTO,
} from '@datascope/shared';
import { apiSlice } from './apiSlice';

export interface AuthResponsePayload {
  user: UserDTO;
  accessToken: string;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<ApiResponse<AuthResponsePayload>, LoginInput>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: [
        'Auth',
        'Datasets',
        'SavedViews',
        'SearchHistory',
        'Analytics',
        'Preferences',
      ],
    }),

    register: builder.mutation<ApiResponse<AuthResponsePayload>, RegisterInput>({
      query: (payload) => ({
        url: '/auth/register',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Auth', 'Datasets', 'Preferences'],
    }),

    refreshToken: builder.mutation<ApiResponse<AuthResponsePayload>, void>({
      query: () => ({
        url: '/auth/refresh',
        method: 'POST',
      }),
    }),

    logout: builder.mutation<ApiResponse<{ message: string }>, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(apiSlice.util.resetApiState());
        }
      },
    }),

    getMe: builder.query<ApiResponse<UserDTO>, void>({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
} = authApi;
