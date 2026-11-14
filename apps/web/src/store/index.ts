import { configureStore } from '@reduxjs/toolkit';
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from 'react-redux';
import { apiSlice } from '@/services/apiSlice';
import authReducer from './slices/authSlice';
import datasetReducer from './slices/datasetSlice';
import savedViewsReducer from './slices/savedViewsSlice';
import searchConfigReducer from './slices/searchConfigSlice';
import uiPreferencesReducer from './slices/uiPreferencesSlice';

export function makeStore() {
  return configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
      dataset: datasetReducer,
      searchConfig: searchConfigReducer,
      savedViews: savedViewsReducer,
      uiPreferences: uiPreferencesReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: true,
      }).concat(apiSlice.middleware),
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
