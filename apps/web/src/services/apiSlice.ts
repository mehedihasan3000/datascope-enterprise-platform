import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

function resolveClientApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return '/api/v1';
    }
  } else if (process.env.NODE_ENV === 'production') {
    return '/api/v1';
  }

  return 'http://localhost:4000/api/v1';
}

export const API_BASE_URL = resolveClientApiBaseUrl();

interface RefreshApiResponse {
  success: boolean;
  data?: {
    user: unknown;
    accessToken: string;
  };
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as { auth?: { accessToken?: string | null } };
    const token = state.auth?.accessToken;
    if (token && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// Mutex lock so concurrent 401 responses trigger a single /auth/refresh request
let refreshInFlight: Promise<boolean> | null = null;

const AUTH_SKIP_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function getRequestUrl(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : args.url;
}

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  const url = getRequestUrl(args);

  const shouldSkipRefresh = AUTH_SKIP_REFRESH_URLS.some((path) =>
    url.startsWith(path)
  );

  if (result.error && result.error.status === 401 && !shouldSkipRefresh) {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          const refreshResult = await rawBaseQuery(
            { url: '/auth/refresh', method: 'POST' },
            api,
            extraOptions
          );

          const body = refreshResult.data as RefreshApiResponse | undefined;
          if (body?.success && body.data?.user) {
            api.dispatch({
              type: 'auth/setCredentials',
              payload: {
                user: body.data.user,
                accessToken: body.data.accessToken,
              },
            });
            return true;
          }

          api.dispatch({ type: 'auth/clearCredentials' });
          return false;
        } finally {
          refreshInFlight = null;
        }
      })();
    }

    const refreshed = await refreshInFlight;
    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'Users',
    'Preferences',
    'Datasets',
    'DatasetPermissions',
    'Records',
    'RecordDetail',
    'SavedViews',
    'SearchHistory',
    'Analytics',
  ],
  endpoints: () => ({}),
});
