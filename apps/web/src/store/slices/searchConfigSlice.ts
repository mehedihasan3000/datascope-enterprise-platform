import type { FilterCondition, SearchMode, SortRule } from '@datascope/shared';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface SearchConfigState {
  globalQuery: string;
  searchMode: SearchMode;
  filters: FilterCondition[];
  logicOperator: 'AND' | 'OR';
  sorting: SortRule[];
  pagination: {
    page: number;
    pageSize: number;
    mode: 'offset' | 'cursor';
    cursor: string | null;
  };
}

export const DEFAULT_SORTING: SortRule[] = [{ field: 'createdAt', direction: 'desc' }];

const initialState: SearchConfigState = {
  globalQuery: '',
  searchMode: 'fts',
  filters: [],
  logicOperator: 'AND',
  sorting: DEFAULT_SORTING,
  pagination: {
    page: 1,
    pageSize: 50,
    mode: 'offset',
    cursor: null,
  },
};

function resetPaginationToFirstPage(state: SearchConfigState): void {
  state.pagination.page = 1;
  state.pagination.cursor = null;
}

const searchConfigSlice = createSlice({
  name: 'searchConfig',
  initialState,
  reducers: {
    setGlobalQuery(state, action: PayloadAction<string>) {
      state.globalQuery = action.payload;
      resetPaginationToFirstPage(state);
    },
    setSearchMode(state, action: PayloadAction<SearchMode>) {
      state.searchMode = action.payload;
      resetPaginationToFirstPage(state);
    },
    setFilters(state, action: PayloadAction<FilterCondition[]>) {
      state.filters = action.payload;
      resetPaginationToFirstPage(state);
    },
    addFilter(state, action: PayloadAction<FilterCondition>) {
      state.filters.push(action.payload);
      resetPaginationToFirstPage(state);
    },
    updateFilter(
      state,
      action: PayloadAction<{ index: number; condition: FilterCondition }>
    ) {
      const { index, condition } = action.payload;
      if (index >= 0 && index < state.filters.length) {
        state.filters[index] = condition;
        resetPaginationToFirstPage(state);
      }
    },
    removeFilter(state, action: PayloadAction<number>) {
      state.filters.splice(action.payload, 1);
      resetPaginationToFirstPage(state);
    },
    clearFilters(state) {
      state.filters = [];
      resetPaginationToFirstPage(state);
    },
    setLogicOperator(state, action: PayloadAction<'AND' | 'OR'>) {
      state.logicOperator = action.payload;
      resetPaginationToFirstPage(state);
    },
    setSorting(state, action: PayloadAction<SortRule[]>) {
      state.sorting = action.payload.length > 0 ? action.payload : DEFAULT_SORTING;
      resetPaginationToFirstPage(state);
    },
    toggleColumnSort(
      state,
      action: PayloadAction<{ field: string; multi?: boolean }>
    ) {
      const { field, multi = false } = action.payload;
      const existingIndex = state.sorting.findIndex((s) => s.field === field);

      if (!multi) {
        if (existingIndex === -1) {
          state.sorting = [{ field, direction: 'asc' }];
        } else if (state.sorting[existingIndex]!.direction === 'asc') {
          state.sorting = [{ field, direction: 'desc' }];
        } else {
          state.sorting = DEFAULT_SORTING;
        }
      } else {
        if (existingIndex === -1) {
          if (state.sorting.length < 5) {
            state.sorting.push({ field, direction: 'asc' });
          }
        } else if (state.sorting[existingIndex]!.direction === 'asc') {
          state.sorting[existingIndex] = { field, direction: 'desc' };
        } else {
          state.sorting.splice(existingIndex, 1);
          if (state.sorting.length === 0) {
            state.sorting = DEFAULT_SORTING;
          }
        }
      }
      resetPaginationToFirstPage(state);
    },
    setPage(state, action: PayloadAction<number>) {
      state.pagination.mode = 'offset';
      state.pagination.page = Math.max(1, action.payload);
      state.pagination.cursor = null;
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pagination.pageSize = action.payload;
      resetPaginationToFirstPage(state);
    },
    setPaginationMode(state, action: PayloadAction<'offset' | 'cursor'>) {
      state.pagination.mode = action.payload;
      resetPaginationToFirstPage(state);
    },
    setCursor(state, action: PayloadAction<{ cursor: string | null; page?: number }>) {
      state.pagination.mode = 'cursor';
      state.pagination.cursor = action.payload.cursor;
      if (action.payload.page !== undefined) {
        state.pagination.page = Math.max(1, action.payload.page);
      }
    },
    applySavedViewConfig(
      state,
      action: PayloadAction<{
        searchQuery: string;
        searchMode: SearchMode;
        filters: FilterCondition[];
        sorting: SortRule[];
      }>
    ) {
      state.globalQuery = action.payload.searchQuery ?? '';
      state.searchMode = action.payload.searchMode ?? 'fts';
      state.filters = action.payload.filters ?? [];
      state.sorting =
        action.payload.sorting && action.payload.sorting.length > 0
          ? action.payload.sorting
          : DEFAULT_SORTING;
      resetPaginationToFirstPage(state);
    },
    hydrateSearchConfigFromUrl(
      state,
      action: PayloadAction<Partial<SearchConfigState>>
    ) {
      if (action.payload.globalQuery !== undefined) {
        state.globalQuery = action.payload.globalQuery;
      }
      if (action.payload.searchMode !== undefined) {
        state.searchMode = action.payload.searchMode;
      }
      if (action.payload.filters !== undefined) {
        state.filters = action.payload.filters;
      }
      if (action.payload.logicOperator !== undefined) {
        state.logicOperator = action.payload.logicOperator;
      }
      if (action.payload.sorting !== undefined) {
        state.sorting =
          action.payload.sorting.length > 0 ? action.payload.sorting : DEFAULT_SORTING;
      }
      if (action.payload.pagination !== undefined) {
        state.pagination = action.payload.pagination;
      }
    },
    resetSearchConfig(state) {
      state.globalQuery = '';
      state.searchMode = 'fts';
      state.filters = [];
      state.logicOperator = 'AND';
      state.sorting = DEFAULT_SORTING;
      state.pagination.page = 1;
      state.pagination.cursor = null;
    },
  },
});

export const {
  setGlobalQuery,
  setSearchMode,
  setFilters,
  addFilter,
  updateFilter,
  removeFilter,
  clearFilters,
  setLogicOperator,
  setSorting,
  toggleColumnSort,
  setPage,
  setPageSize,
  setPaginationMode,
  setCursor,
  applySavedViewConfig,
  hydrateSearchConfigFromUrl,
  resetSearchConfig,
} = searchConfigSlice.actions;

export default searchConfigSlice.reducer;
