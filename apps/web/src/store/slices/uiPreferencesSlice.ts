import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '@/services/authApi';
import { usersApi } from '@/services/usersApi';

export interface ToastNotification {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info' | 'warning';
  durationMs?: number;
}

export interface UiPreferencesState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  tableDensity: 'compact' | 'comfortable' | 'spacious';
  activeDetailRecordId: string | null;
  isFilterDrawerOpen: boolean;
  theme: 'dark' | 'light';
  toasts: ToastNotification[];
}

const initialState: UiPreferencesState = {
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  tableDensity: 'compact',
  activeDetailRecordId: null,
  isFilterDrawerOpen: false,
  theme: 'dark',
  toasts: [],
};

const uiPreferencesSlice = createSlice({
  name: 'uiPreferences',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    setMobileSidebarOpen(state, action: PayloadAction<boolean>) {
      state.mobileSidebarOpen = action.payload;
    },
    setTableDensity(
      state,
      action: PayloadAction<'compact' | 'comfortable' | 'spacious'>
    ) {
      state.tableDensity = action.payload;
    },
    setActiveDetailRecordId(state, action: PayloadAction<string | null>) {
      state.activeDetailRecordId = action.payload;
    },
    setFilterDrawerOpen(state, action: PayloadAction<boolean>) {
      state.isFilterDrawerOpen = action.payload;
    },
    setTheme(state, action: PayloadAction<'dark' | 'light'>) {
      state.theme = action.payload;
    },
    addToast(
      state,
      action: PayloadAction<Omit<ToastNotification, 'id'> & { id?: string }>
    ) {
      const id =
        action.payload.id ??
        `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      state.toasts.push({
        ...action.payload,
        id,
      });
      if (state.toasts.length > 5) {
        state.toasts.shift();
      }
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      isAnyOf(
        authApi.endpoints.login.matchFulfilled,
        authApi.endpoints.register.matchFulfilled
      ),
      (state, action) => {
        const prefs = action.payload?.data?.user?.preferences;
        if (prefs) {
          state.tableDensity = prefs.tableDensity;
          if (prefs.theme === 'dark' || prefs.theme === 'light') {
            state.theme = prefs.theme;
          }
        }
      }
    );

    builder.addMatcher(authApi.endpoints.getMe.matchFulfilled, (state, action) => {
      const prefs = action.payload?.data?.preferences;
      if (prefs) {
        state.tableDensity = prefs.tableDensity;
        if (prefs.theme === 'dark' || prefs.theme === 'light') {
          state.theme = prefs.theme;
        }
      }
    });

    builder.addMatcher(
      usersApi.endpoints.updateMyPreferences.matchFulfilled,
      (state, action) => {
        const prefs = action.payload?.data;
        if (prefs) {
          state.tableDensity = prefs.tableDensity;
          if (prefs.theme === 'dark' || prefs.theme === 'light') {
            state.theme = prefs.theme;
          }
        }
      }
    );
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  setMobileSidebarOpen,
  setTableDensity,
  setActiveDetailRecordId,
  setFilterDrawerOpen,
  setTheme,
  addToast,
  dismissToast,
} = uiPreferencesSlice.actions;

export default uiPreferencesSlice.reducer;
