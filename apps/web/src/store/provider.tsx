'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { useGetMeQuery } from '@/services/authApi';
import { makeStore, useAppSelector, type AppStore } from './index';

function ThemeAndAuthSynchronizer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useAppSelector((state) => state.uiPreferences.theme);
  const isInitialized = useAppSelector((state) => state.auth.isInitialized);

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register' ||
    pathname.startsWith('/register/');

  // Hydrate current authenticated session from HttpOnly cookies on protected app routes
  useGetMeQuery(undefined, { skip: isInitialized || isPublicRoute });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <ThemeAndAuthSynchronizer>{children}</ThemeAndAuthSynchronizer>
    </Provider>
  );
}
