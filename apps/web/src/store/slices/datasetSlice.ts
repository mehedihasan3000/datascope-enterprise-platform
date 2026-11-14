import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface DatasetSliceState {
  activeDatasetId: string | null;
  columnVisibility: Record<string, Record<string, boolean>>;
  columnSizing: Record<string, Record<string, number>>;
  selectedRowIds: string[];
}

const initialState: DatasetSliceState = {
  activeDatasetId: null,
  columnVisibility: {},
  columnSizing: {},
  selectedRowIds: [],
};

const datasetSlice = createSlice({
  name: 'dataset',
  initialState,
  reducers: {
    setActiveDatasetId(state, action: PayloadAction<string | null>) {
      if (state.activeDatasetId !== action.payload) {
        state.activeDatasetId = action.payload;
        state.selectedRowIds = [];
      }
    },
    setColumnVisibility(
      state,
      action: PayloadAction<{ datasetId: string; visibility: Record<string, boolean> }>
    ) {
      state.columnVisibility[action.payload.datasetId] = action.payload.visibility;
    },
    toggleColumnVisibility(
      state,
      action: PayloadAction<{ datasetId: string; fieldKey: string; visible: boolean }>
    ) {
      const { datasetId, fieldKey, visible } = action.payload;
      if (!state.columnVisibility[datasetId]) {
        state.columnVisibility[datasetId] = {};
      }
      state.columnVisibility[datasetId][fieldKey] = visible;
    },
    setColumnSizing(
      state,
      action: PayloadAction<{ datasetId: string; sizing: Record<string, number> }>
    ) {
      state.columnSizing[action.payload.datasetId] = action.payload.sizing;
    },
    setColumnWidth(
      state,
      action: PayloadAction<{ datasetId: string; fieldKey: string; width: number }>
    ) {
      const { datasetId, fieldKey, width } = action.payload;
      if (!state.columnSizing[datasetId]) {
        state.columnSizing[datasetId] = {};
      }
      state.columnSizing[datasetId][fieldKey] = width;
    },
    setSelectedRowIds(state, action: PayloadAction<string[]>) {
      state.selectedRowIds = action.payload;
    },
    toggleRowSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      const exists = state.selectedRowIds.includes(id);
      if (exists) {
        state.selectedRowIds = state.selectedRowIds.filter((r) => r !== id);
      } else {
        state.selectedRowIds.push(id);
      }
    },
    clearSelectedRows(state) {
      state.selectedRowIds = [];
    },
  },
});

export const {
  setActiveDatasetId,
  setColumnVisibility,
  toggleColumnVisibility,
  setColumnSizing,
  setColumnWidth,
  setSelectedRowIds,
  toggleRowSelection,
  clearSelectedRows,
} = datasetSlice.actions;

export default datasetSlice.reducer;
