import type { UserDTO } from '@datascope/shared';
import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '@/services/authApi';

export interface AuthState {
  user: UserDTO | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: UserDTO; accessToken?: string | null }>
    ) {
      state.user = action.payload.user;
      if (action.payload.accessToken !== undefined) {
        state.accessToken = action.payload.accessToken;
      }
      state.isAuthenticated = true;
      state.isInitialized = true;
    },
    setUser(state, action: PayloadAction<UserDTO>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isInitialized = true;
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
    },
    setInitialized(state, action: PayloadAction<boolean>) {
      state.isInitialized = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      isAnyOf(
        authApi.endpoints.login.matchFulfilled,
        authApi.endpoints.register.matchFulfilled,
        authApi.endpoints.refreshToken.matchFulfilled
      ),
      (state, action) => {
        if (action.payload?.success && action.payload.data?.user) {
          state.user = action.payload.data.user;
          state.accessToken = action.payload.data.accessToken;
          state.isAuthenticated = true;
          state.isInitialized = true;
        }
      }
    );

    builder.addMatcher(authApi.endpoints.getMe.matchFulfilled, (state, action) => {
      if (action.payload?.success && action.payload.data) {
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.isInitialized = true;
      }
    });

    builder.addMatcher(authApi.endpoints.getMe.matchRejected, (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
    });

    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
    });
  },
});

export const { setCredentials, setUser, clearCredentials, setInitialized } =
  authSlice.actions;

export default authSlice.reducer;
