import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import { savedViewsApi } from '@/services/savedViewsApi';
import {
  addFilter,
  applySavedViewConfig,
  clearFilters,
  removeFilter,
  resetSearchConfig,
  setFilters,
  setGlobalQuery,
  setLogicOperator,
  setSearchMode,
  setSorting,
  toggleColumnSort,
  updateFilter,
} from './searchConfigSlice';

export interface SavedViewsState {
  activeViewId: string | null;
  isDirty: boolean;
  isSaveModalOpen: boolean;
  isShareModalOpen: boolean;
  editingViewId: string | null;
  sharingViewId: string | null;
}

const initialState: SavedViewsState = {
  activeViewId: null,
  isDirty: false,
  isSaveModalOpen: false,
  isShareModalOpen: false,
  editingViewId: null,
  sharingViewId: null,
};

const savedViewsSlice = createSlice({
  name: 'savedViews',
  initialState,
  reducers: {
    setActiveViewId(state, action: PayloadAction<string | null>) {
      state.activeViewId = action.payload;
      state.isDirty = false;
    },
    setDirty(state, action: PayloadAction<boolean>) {
      state.isDirty = action.payload;
    },
    openSaveModal(state, action: PayloadAction<{ editingViewId?: string | null } | undefined>) {
      state.isSaveModalOpen = true;
      state.editingViewId = action?.payload?.editingViewId ?? null;
    },
    closeSaveModal(state) {
      state.isSaveModalOpen = false;
      state.editingViewId = null;
    },
    openShareModal(state, action: PayloadAction<string>) {
      state.isShareModalOpen = true;
      state.sharingViewId = action.payload;
    },
    closeShareModal(state) {
      state.isShareModalOpen = false;
      state.sharingViewId = null;
    },
    clearActiveView(state) {
      state.activeViewId = null;
      state.isDirty = false;
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      isAnyOf(
        setGlobalQuery,
        setSearchMode,
        setFilters,
        addFilter,
        updateFilter,
        removeFilter,
        clearFilters,
        setLogicOperator,
        setSorting,
        toggleColumnSort
      ),
      (state) => {
        if (state.activeViewId) {
          state.isDirty = true;
        }
      }
    );

    builder.addMatcher(applySavedViewConfig.match, (state) => {
      state.isDirty = false;
    });

    builder.addMatcher(resetSearchConfig.match, (state) => {
      state.activeViewId = null;
      state.isDirty = false;
    });

    builder.addMatcher(
      isAnyOf(
        savedViewsApi.endpoints.createSavedView.matchFulfilled,
        savedViewsApi.endpoints.updateSavedView.matchFulfilled
      ),
      (state, action) => {
        if (action.payload?.success && action.payload.data) {
          state.activeViewId = action.payload.data.id;
          state.isDirty = false;
          state.isSaveModalOpen = false;
          state.editingViewId = null;
        }
      }
    );

    builder.addMatcher(
      savedViewsApi.endpoints.shareSavedView.matchFulfilled,
      (state) => {
        state.isShareModalOpen = false;
        state.sharingViewId = null;
      }
    );
  },
});

export const {
  setActiveViewId,
  setDirty,
  openSaveModal,
  closeSaveModal,
  openShareModal,
  closeShareModal,
  clearActiveView,
} = savedViewsSlice.actions;

export default savedViewsSlice.reducer;
