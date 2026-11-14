'use client';

import { ROLE_LABELS, type RoleName } from '@datascope/shared';
import {
  BarChart3,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  SearchCode,
  Settings,
  Table2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { useLogoutMutation } from '@/services/authApi';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  addToast,
  setMobileSidebarOpen,
  toggleSidebar,
} from '@/store/slices/uiPreferencesSlice';
import { cn } from '@/utils/cn';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  roles?: RoleName[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Discovery',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Data Explorer', href: '/explorer', icon: Table2, badge: 'Core' },
      { label: 'Advanced Search', href: '/search', icon: SearchCode },
    ],
  },
  {
    title: 'Data & Views',
    items: [
      { label: 'Dataset Library', href: '/datasets', icon: Database },
      { label: 'Saved Views', href: '/saved-views', icon: BookmarkCheck },
      { label: 'Search History', href: '/history', icon: History },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
        roles: ['ADMIN', 'ANALYST'],
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Settings & Admin',
        href: '/settings',
        icon: Settings,
        roles: ['ADMIN'],
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        roles: ['ANALYST', 'VIEWER'],
      },
    ],
  },
];

const ROLE_BADGE_VARIANT: Record<RoleName, BadgeVariant> = {
  ADMIN: 'danger',
  ANALYST: 'indigo',
  VIEWER: 'info',
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const collapsed = useAppSelector((s) => s.uiPreferences.sidebarCollapsed);
  const mobileOpen = useAppSelector((s) => s.uiPreferences.mobileSidebarOpen);
  const user = useAppSelector((s) => s.auth.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const closeMobileBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const raf = window.requestAnimationFrame(() => {
      closeMobileBtnRef.current?.focus();
    });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch(setMobileSidebarOpen(false));
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [dispatch, mobileOpen]);

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      dispatch(
        addToast({
          variant: 'info',
          title: 'Signed out',
          description: 'Your DataScope session cookies have been cleared.',
        })
      );
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const renderSidebarBody = (isMobile = false) => {
    const isCompact = !isMobile && collapsed;

    return (
      <div className="flex h-full flex-col bg-white dark:bg-[#090e1a] border-r border-slate-200 dark:border-slate-800/90 select-none">
        {/* Brand Header */}
        <div
          className={cn(
            'shrink-0 border-b border-slate-200 dark:border-slate-800/90',
            isCompact
              ? 'flex flex-col items-center justify-center gap-2 px-2 py-3'
              : 'flex h-15 items-center justify-between px-4'
          )}
        >
          <Link
            href="/explorer"
            onClick={() => isMobile && dispatch(setMobileSidebarOpen(false))}
            aria-label={isCompact ? 'DataScope Explorer' : undefined}
            className="flex items-center gap-2.5 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div
              aria-hidden={!isCompact}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/20 font-bold text-sm"
            >
              DS
            </div>
            {!isCompact && (
              <div className="truncate">
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  DataScope
                </div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-indigo-700 dark:text-indigo-400 mt-1">
                  Enterprise Intel
                </div>
              </div>
            )}
          </Link>

          {isMobile ? (
            <button
              ref={closeMobileBtnRef}
              type="button"
              onClick={() => dispatch(setMobileSidebarOpen(false))}
              className="rounded-lg p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dispatch(toggleSidebar())}
              className={cn(
                'hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer',
                isCompact &&
                  'border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900'
              )}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          aria-label="Primary sidebar navigation"
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            isCompact ? 'px-2 py-2.5 space-y-2.5' : 'px-3 py-2.5 space-y-3'
          )}
        >
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || (user && item.roles.includes(user.role))
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title}>
                {!isCompact && (
                  <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {group.title}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() =>
                            isMobile && dispatch(setMobileSidebarOpen(false))
                          }
                          title={isCompact ? item.label : undefined}
                          aria-label={isCompact ? item.label : undefined}
                          className={cn(
                            'group flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                            isCompact && 'justify-center px-2 py-2',
                            isActive
                              ? 'bg-indigo-600/12 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-500/25'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100 border border-transparent'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-colors',
                              isActive
                                ? 'text-indigo-700 dark:text-indigo-400'
                                : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                            )}
                          />
                          {!isCompact && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badge && (
                                <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:text-indigo-300">
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div
          className={cn(
            'shrink-0 border-t border-slate-200 dark:border-slate-800/90',
            isCompact ? 'p-2' : 'p-2.5'
          )}
        >
          {user ? (
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-2',
                isCompact && 'flex-col justify-center gap-2 p-2'
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-semibold text-white">
                {user.fullName
                  .split(' ')
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </div>
              {!isCompact && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {user.fullName}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge
                      variant={ROLE_BADGE_VARIANT[user.role]}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Sign out"
                aria-label="Sign out"
                className={cn(
                  'shrink-0 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer',
                  isCompact
                    ? 'h-8 w-8 border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60'
                    : 'p-1.5'
                )}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="h-12 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 transition-all duration-200',
          collapsed ? 'w-[76px]' : 'w-64'
        )}
      >
        <div className="sticky top-0 h-dvh">{renderSidebarBody(false)}</div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation"
        >
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => dispatch(setMobileSidebarOpen(false))}
          />
          <aside className="relative z-10 w-68 max-w-[85vw] h-dvh">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
}
