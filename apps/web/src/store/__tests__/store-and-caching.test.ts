// @vitest-environment node
import type { SavedViewDTO, UserDTO } from '@datascope/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildExplorerSearchParamsString,
  parseExplorerSearchParams,
} from '@/hooks/useUrlSearchState';
import { apiSlice } from '@/services/apiSlice';
import { datasetsApi } from '@/services/datasetsApi';
import { recordsApi } from '@/services/recordsApi';
import { savedViewsApi } from '@/services/savedViewsApi';
import { makeStore } from '@/store';
import {
  clearCredentials,
  setCredentials,
  setInitialized,
  setUser,
} from '@/store/slices/authSlice';
import {
  clearSelectedRows,
  setActiveDatasetId,
  setColumnVisibility,
  setColumnWidth,
  toggleColumnVisibility,
  toggleRowSelection,
} from '@/store/slices/datasetSlice';
import {
  clearActiveView,
  closeSaveModal,
  closeShareModal,
  openSaveModal,
  openShareModal,
  setActiveViewId,
} from '@/store/slices/savedViewsSlice';
import {
  addFilter,
  applySavedViewConfig,
  clearFilters,
  DEFAULT_SORTING,
  removeFilter,
  setCursor,
  setGlobalQuery,
  setLogicOperator,
  setPage,
  setPageSize,
  toggleColumnSort,
  updateFilter,
} from '@/store/slices/searchConfigSlice';
import {
  addToast,
  dismissToast,
  setTableDensity,
  setTheme,
  toggleSidebar,
} from '@/store/slices/uiPreferencesSlice';

const MOCK_USER: UserDTO = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'analyst@datascope.io',
  fullName: 'Marcus Sterling',
  role: 'ANALYST',
  roleId: '22222222-2222-4222-8222-222222222222',
  permissions: ['datasets:view', 'datasets:search', 'views:create'],
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Frontend Redux Store (5 Slices), URL Sync & RTK Query Caching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Redux Slices Unit & Cross-Slice Integration', () => {
    it('manages authSlice credentials lifecycle cleanly', () => {
      const store = makeStore();
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.isInitialized).toBe(false);

      store.dispatch(setCredentials({ user: MOCK_USER, accessToken: 'token-123' }));
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.accessToken).toBe('token-123');

      store.dispatch(setUser({ ...MOCK_USER, fullName: 'Updated Analyst' }));
      expect(store.getState().auth.user?.fullName).toBe('Updated Analyst');

      store.dispatch(clearCredentials());
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.user).toBeNull();
      expect(store.getState().auth.accessToken).toBeNull();

      store.dispatch(setInitialized(true));
      expect(store.getState().auth.isInitialized).toBe(true);
    });

    it('manages datasetSlice selection, column visibility & sizing and resets selection on dataset switch', () => {
      const store = makeStore();
      store.dispatch(setActiveDatasetId('ds-1'));
      store.dispatch(toggleRowSelection('row-1'));
      store.dispatch(toggleRowSelection('row-2'));
      expect(store.getState().dataset.selectedRowIds).toEqual(['row-1', 'row-2']);

      store.dispatch(toggleRowSelection('row-1'));
      expect(store.getState().dataset.selectedRowIds).toEqual(['row-2']);

      store.dispatch(clearSelectedRows());
      expect(store.getState().dataset.selectedRowIds).toEqual([]);

      store.dispatch(toggleRowSelection('row-3'));
      // Switching dataset must clear stale selected row IDs
      store.dispatch(setActiveDatasetId('ds-2'));
      expect(store.getState().dataset.activeDatasetId).toBe('ds-2');
      expect(store.getState().dataset.selectedRowIds).toEqual([]);

      store.dispatch(
        setColumnVisibility({ datasetId: 'ds-2', visibility: { title: true, revenue: false } })
      );
      store.dispatch(
        toggleColumnVisibility({ datasetId: 'ds-2', fieldKey: 'revenue', visible: true })
      );
      store.dispatch(setColumnWidth({ datasetId: 'ds-2', fieldKey: 'title', width: 320 }));

      expect(store.getState().dataset.columnVisibility['ds-2']?.revenue).toBe(true);
      expect(store.getState().dataset.columnSizing['ds-2']?.title).toBe(320);
    });

    it('manages searchConfigSlice filters, multi-column sorting & resets pagination on query edits', () => {
      const store = makeStore();

      store.dispatch(setPage(4));
      expect(store.getState().searchConfig.pagination.page).toBe(4);

      store.dispatch(setGlobalQuery('Quantum'));
      expect(store.getState().searchConfig.pagination.page).toBe(1);
      expect(store.getState().searchConfig.globalQuery).toBe('Quantum');

      store.dispatch(
        addFilter({ field: 'status', operator: 'eq', value: 'Active' })
      );
      store.dispatch(
        addFilter({ field: 'revenue', operator: 'gt', value: 10000 })
      );
      store.dispatch(
        updateFilter({
          index: 1,
          condition: { field: 'revenue', operator: 'gt', value: 25000 },
        })
      );
      store.dispatch(setLogicOperator('OR'));
      expect(store.getState().searchConfig.filters).toHaveLength(2);
      expect(store.getState().searchConfig.filters[1]?.value).toBe(25000);
      expect(store.getState().searchConfig.logicOperator).toBe('OR');

      store.dispatch(removeFilter(0));
      expect(store.getState().searchConfig.filters).toHaveLength(1);
      store.dispatch(clearFilters());
      expect(store.getState().searchConfig.filters).toHaveLength(0);

      // Single & multi-column sort transitions
      store.dispatch(toggleColumnSort({ field: 'revenue' }));
      expect(store.getState().searchConfig.sorting).toEqual([
        { field: 'revenue', direction: 'asc' },
      ]);
      store.dispatch(toggleColumnSort({ field: 'revenue' }));
      expect(store.getState().searchConfig.sorting).toEqual([
        { field: 'revenue', direction: 'desc' },
      ]);
      store.dispatch(toggleColumnSort({ field: 'revenue' }));
      expect(store.getState().searchConfig.sorting).toEqual(DEFAULT_SORTING);

      store.dispatch(setPageSize(100));
      store.dispatch(setCursor({ cursor: 'abc-cursor', page: 2 }));
      expect(store.getState().searchConfig.pagination.mode).toBe('cursor');
      expect(store.getState().searchConfig.pagination.cursor).toBe('abc-cursor');

      store.dispatch(setPage(1));
      expect(store.getState().searchConfig.pagination.mode).toBe('offset');
      expect(store.getState().searchConfig.pagination.cursor).toBeNull();
    });

    it('tracks savedViewsSlice dirty state automatically across searchConfigSlice mutations', () => {
      const store = makeStore();

      store.dispatch(setActiveViewId('view-uuid-1'));
      expect(store.getState().savedViews.activeViewId).toBe('view-uuid-1');
      expect(store.getState().savedViews.isDirty).toBe(false);

      // Mutating search query/filters while an active view is loaded marks view dirty
      store.dispatch(setGlobalQuery('Cybersecurity'));
      expect(store.getState().savedViews.isDirty).toBe(true);

      // Applying a saved view clears dirty flag
      store.dispatch(
        applySavedViewConfig({
          searchQuery: 'FinTech',
          searchMode: 'fts',
          filters: [],
          sorting: [{ field: 'createdAt', direction: 'desc' }],
        })
      );
      expect(store.getState().savedViews.isDirty).toBe(false);

      store.dispatch(openSaveModal({ editingViewId: 'view-uuid-1' }));
      expect(store.getState().savedViews.isSaveModalOpen).toBe(true);
      store.dispatch(closeSaveModal());
      expect(store.getState().savedViews.isSaveModalOpen).toBe(false);

      store.dispatch(openShareModal('view-uuid-1'));
      expect(store.getState().savedViews.isShareModalOpen).toBe(true);
      store.dispatch(closeShareModal());
      expect(store.getState().savedViews.isShareModalOpen).toBe(false);

      store.dispatch(clearActiveView());
      expect(store.getState().savedViews.activeViewId).toBeNull();
    });

    it('manages uiPreferencesSlice theme, density & bounded toast notifications', () => {
      const store = makeStore();
      expect(store.getState().uiPreferences.sidebarCollapsed).toBe(false);

      store.dispatch(toggleSidebar());
      store.dispatch(setTableDensity('comfortable'));
      store.dispatch(setTheme('light'));
      expect(store.getState().uiPreferences.sidebarCollapsed).toBe(true);
      expect(store.getState().uiPreferences.tableDensity).toBe('comfortable');
      expect(store.getState().uiPreferences.theme).toBe('light');

      for (let i = 1; i <= 7; i += 1) {
        store.dispatch(
          addToast({ id: `t-${i}`, title: `Toast ${i}`, variant: 'info' })
        );
      }
      // Queue is bounded to max 5 items
      expect(store.getState().uiPreferences.toasts).toHaveLength(5);
      expect(store.getState().uiPreferences.toasts[0]?.id).toBe('t-3');

      store.dispatch(dismissToast('t-3'));
      expect(store.getState().uiPreferences.toasts).toHaveLength(4);
    });
  });

  describe('URL Search State Serialization & Resilience (ADR-09)', () => {
    it('round-trips complete Explorer query state and safely rejects malformed parameters', () => {
      const validDsId = '33333333-3333-4333-8333-333333333333';
      const validViewId = '44444444-4444-4444-8444-444444444444';

      const queryString = buildExplorerSearchParamsString({
        activeDatasetId: validDsId,
        activeViewId: validViewId,
        isDirty: false,
        searchConfig: {
          globalQuery: 'Quantum Germany',
          searchMode: 'partial',
          filters: [
            { field: 'status', operator: 'eq', value: 'Active' },
            { field: 'revenue', operator: 'gt', value: 10000 },
          ],
          logicOperator: 'OR',
          sorting: [{ field: 'revenue', direction: 'desc' }],
          pagination: {
            page: 3,
            pageSize: 100,
            mode: 'offset',
            cursor: null,
          },
        },
      });

      const parsed = parseExplorerSearchParams(new URLSearchParams(queryString));
      expect(parsed.datasetId).toBe(validDsId);
      expect(parsed.viewId).toBe(validViewId);
      expect(parsed.hasExplicitQueryState).toBe(true);
      expect(parsed.searchConfig.globalQuery).toBe('Quantum Germany');
      expect(parsed.searchConfig.searchMode).toBe('partial');
      expect(parsed.searchConfig.filters).toHaveLength(2);
      expect(parsed.searchConfig.logicOperator).toBe('OR');
      expect(parsed.searchConfig.pagination.page).toBe(3);
      expect(parsed.searchConfig.pagination.pageSize).toBe(100);

      // Hostile/malformed params fallback gracefully
      const hostile = parseExplorerSearchParams(
        new URLSearchParams('dataset=not-uuid&filters=%7Bbroken_json&page=-99&limit=99999&mode=sql')
      );
      expect(hostile.datasetId).toBeNull();
      expect(hostile.searchConfig.filters).toEqual([]);
      expect(hostile.searchConfig.searchMode).toBe('fts');
      expect(hostile.searchConfig.pagination.page).toBe(1);
      expect(hostile.searchConfig.pagination.pageSize).toBe(50);
    });
  });

  describe('RTK Query Caching, Request Deduplication, Tag Invalidation & 401 Re-Auth', () => {
    it('deduplicates concurrent searchRecords requests and serves subsequent cached queries with zero refetch', async () => {
      const store = makeStore();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return jsonResponse({
            success: true,
            data: [],
            meta: {
              page: 1,
              pageSize: 50,
              totalRecords: 0,
              totalPages: 1,
              nextCursor: null,
              hasNextPage: false,
              hasPreviousPage: false,
              executionTimeMs: 4,
              cacheHit: false,
            },
          });
        });

      const args = {
        datasetId: '33333333-3333-4333-8333-333333333333',
        query: { searchQuery: 'DedupeTest', page: 1, pageSize: 50 },
      };

      const [sub1, sub2] = [
        store.dispatch(recordsApi.endpoints.searchRecords.initiate(args)),
        store.dispatch(recordsApi.endpoints.searchRecords.initiate(args)),
      ];
      await Promise.all([sub1, sub2]);

      // In-flight deduplication ensures only 1 network request
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Subsequent dispatch reads directly from RTK Query cache
      await store.dispatch(recordsApi.endpoints.searchRecords.initiate(args));
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      store.dispatch(apiSlice.util.resetApiState());
    });

    it('invalidates SavedViews tag cache automatically on createSavedView mutation', async () => {
      const store = makeStore();
      const views: SavedViewDTO[] = [
        {
          id: 'view-1',
          name: 'Initial View',
          description: null,
          datasetId: 'ds-1',
          userId: MOCK_USER.id,
          searchQuery: '',
          searchMode: 'fts',
          filters: [],
          sorting: [],
          visibleColumns: [],
          isShared: false,
          sharedWithRoles: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      let getCalls = 0;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const req = input as Request;
        if (req.url.includes('/saved-views') && req.method === 'POST') {
          const created: SavedViewDTO = {
            ...views[0]!,
            id: 'view-2',
            name: 'Created View',
          };
          views.push(created);
          return jsonResponse({ success: true, data: created }, 201);
        }

        getCalls += 1;
        return jsonResponse({ success: true, data: [...views] }, 200);
      });

      const sub = store.dispatch(savedViewsApi.endpoints.getSavedViews.initiate('ds-1'));
      await sub;
      expect(getCalls).toBe(1);

      await store.dispatch(
        savedViewsApi.endpoints.createSavedView.initiate({
          name: 'Created View',
          datasetId: '33333333-3333-4333-8333-333333333333',
          searchQuery: '',
          searchMode: 'fts',
          filters: [],
          sorting: [],
          visibleColumns: [],
          isShared: false,
          sharedWithRoles: [],
        })
      );

      // Active subscription automatically refetched due to invalidatesTags: ['SavedViews']
      await vi.waitFor(() => {
        expect(getCalls).toBe(2);
      });

      sub.unsubscribe();
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      store.dispatch(apiSlice.util.resetApiState());
    });

    it('transparently refreshes expired tokens via /auth/refresh mutex on 401 and retries once', async () => {
      const store = makeStore();
      let datasetAttempts = 0;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const req = input as Request;
        if (req.url.includes('/auth/refresh')) {
          return jsonResponse({
            success: true,
            data: { user: MOCK_USER, accessToken: 'refreshed-jwt-token' },
          });
        }

        if (req.url.includes('/datasets')) {
          datasetAttempts += 1;
          if (datasetAttempts === 1) {
            return jsonResponse(
              { success: false, error: { code: 'UNAUTHORIZED', message: 'Expired' } },
              401
            );
          }
          return jsonResponse({ success: true, data: [{ id: 'ds-1', name: 'Global' }] });
        }

        return jsonResponse({ success: true, data: null });
      });

      const result = await store.dispatch(datasetsApi.endpoints.getDatasets.initiate());
      expect(result.data?.success).toBe(true);
      expect(datasetAttempts).toBe(2);
      expect(store.getState().auth.accessToken).toBe('refreshed-jwt-token');
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      store.dispatch(apiSlice.util.resetApiState());
    });
  });
});
