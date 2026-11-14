'use client';

import { ROLE_LABELS, type RoleName } from '@datascope/shared';
import { Database, Menu, Moon, ShieldCheck, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { useGetDatasetsQuery } from '@/services/datasetsApi';
import { useUpdateMyPreferencesMutation } from '@/services/usersApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveDatasetId } from '@/store/slices/datasetSlice';
import { resetSearchConfig } from '@/store/slices/searchConfigSlice';
import {
  setMobileSidebarOpen,
  setTheme,
} from '@/store/slices/uiPreferencesSlice';
import { formatCompactNumber } from '@/utils/formatters';

const ROUTE_TITLES: Array<{ prefix: string; title: string; subtitle: string }> = [
  {
    prefix: '/explorer',
    title: 'Data Explorer',
    subtitle: 'High-speed discovery, multi-condition filtering & column inspection',
  },
  {
    prefix: '/dashboard',
    title: 'Overview Dashboard',
    subtitle: 'Enterprise data health, recent views & workspace metrics',
  },
  {
    prefix: '/datasets',
    title: 'Dataset Library',
    subtitle: 'Collections, field schemas & dataset-level access permissions',
  },
  {
    prefix: '/search',
    title: 'Advanced Search Workbench',
    subtitle: 'Construct multi-clause full-text, trigram & range queries',
  },
  {
    prefix: '/saved-views',
    title: 'Saved Views',
    subtitle: 'Reusable query configurations & shared team views',
  },
  {
    prefix: '/history',
    title: 'Search History',
    subtitle: 'Audit log of recently executed queries & latencies',
  },
  {
    prefix: '/analytics',
    title: 'Data & Search Analytics',
    subtitle: 'Server-side SQL aggregations across authorized datasets',
  },
  {
    prefix: '/records',
    title: 'Record Intelligence',
    subtitle: 'Complete entity profile, relationships & historical audit trail',
  },
  {
    prefix: '/settings',
    title: 'User Settings & Administration',
    subtitle: 'Workspace preferences, security profile & role administration',
  },
];

const ROLE_VARIANT: Record<RoleName, BadgeVariant> = {
  ADMIN: 'danger',
  ANALYST: 'indigo',
  VIEWER: 'info',
};

export function Topbar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const user = useAppSelector((s) => s.auth.user);
  const theme = useAppSelector((s) => s.uiPreferences.theme);
  const activeDatasetId = useAppSelector((s) => s.dataset.activeDatasetId);

  const { data: datasetsResponse } = useGetDatasetsQuery(undefined, {
    skip: !user,
  });
  const [updatePreferences] = useUpdateMyPreferencesMutation();

  const datasets = datasetsResponse?.data ?? [];

  // Initialize activeDatasetId automatically when datasets load (unless deep-linked via URL)
  useEffect(() => {
    if (!activeDatasetId && datasets.length > 0) {
      const urlParams =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      if (urlParams?.has('dataset') || urlParams?.has('viewId')) {
        return;
      }
      const preferredId = user?.preferences?.defaultDatasetId;
      const validPreferred = datasets.find((d) => d.id === preferredId);
      dispatch(setActiveDatasetId(validPreferred ? validPreferred.id : datasets[0]!.id));
    }
  }, [activeDatasetId, datasets, dispatch, user?.preferences?.defaultDatasetId]);

  const currentMeta = (() => {
    if (pathname.startsWith('/settings')) {
      return user?.role === 'ADMIN'
        ? {
            title: 'User Settings & Administration',
            subtitle:
              'Workspace preferences, security profile & role administration',
          }
        : {
            title: 'Workspace Preferences & Profile',
            subtitle:
              'Personal theme, table density & default dataset settings',
          };
    }

    return (
      ROUTE_TITLES.find((r) => pathname.startsWith(r.prefix)) ?? {
        title: 'DataScope Platform',
        subtitle: 'Enterprise Data Discovery & Intelligence',
      }
    );
  })();

  const handleDatasetChange = (nextDatasetId: string) => {
    if (nextDatasetId !== activeDatasetId) {
      dispatch(setActiveDatasetId(nextDatasetId));
      dispatch(resetSearchConfig());
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    dispatch(setTheme(nextTheme));
    if (user) {
      void updatePreferences({ theme: nextTheme });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/90 bg-white/90 dark:bg-[#090e1a]/90 backdrop-blur-md px-4 sm:px-6">
      {/* Left: Mobile Trigger + Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => dispatch(setMobileSidebarOpen(true))}
          className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
            {currentMeta.title}
          </h1>
          <p className="hidden md:block truncate text-xs text-slate-600 dark:text-slate-400">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Dataset Switcher + Role + Theme */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {datasets.length > 0 && !pathname.startsWith('/analytics') && (
          <div
            className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-2.5 py-1.5"
            title="Default dataset context for Data Explorer and Advanced Search"
          >
            <Database className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <label
              htmlFor="topbar-active-dataset"
              className="hidden lg:inline text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
            >
              Explorer:
            </label>
            <select
              id="topbar-active-dataset"
              name="activeDataset"
              aria-label="Explorer active dataset context"
              value={activeDatasetId ?? ''}
              onChange={(e) => handleDatasetChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none max-w-[200px] truncate cursor-pointer"
            >
              {datasets.map((ds) => (
                <option
                  key={ds.id}
                  value={ds.id}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {ds.name} ({formatCompactNumber(ds.totalRecords)})
                </option>
              ))}
            </select>
          </div>
        )}

        {user && (
          <Badge
            variant={ROLE_VARIANT[user.role]}
            className="hidden md:inline-flex py-1"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {ROLE_LABELS[user.role]}
          </Badge>
        )}

        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label="Toggle color theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-600" />
          )}
        </button>
      </div>
    </header>
  );
}
