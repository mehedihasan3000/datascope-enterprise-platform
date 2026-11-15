import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isSecureRequest,
  normalizeSetCookieHeader,
  readSetCookies,
  resolveUpstreamBaseUrl,
} from '@/lib/api-proxy';

const ACCESS_COOKIE_NAME = 'ds_access_token';
const REFRESH_COOKIE_NAME = 'ds_refresh_token';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/datasets',
  '/explorer',
  '/search',
  '/saved-views',
  '/history',
  '/records',
  '/analytics',
  '/settings',
];

const AUTH_ROUTES = ['/login', '/register'];

function getAccessSecret(): Uint8Array {
  const secret =
    process.env.JWT_ACCESS_SECRET ||
    'datascope-dev-access-secret-change-in-production-64-characters-min';
  return new TextEncoder().encode(secret);
}

async function isValidAccessToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getAccessSecret());
    return payload.type === 'access' && typeof payload.sub === 'string';
  } catch {
    return false;
  }
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthPath(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function withNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('x-middleware-cache', 'no-cache');
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate'
  );
  return response;
}

function isPrefetchRequest(request: NextRequest): boolean {
  return (
    request.headers.has('next-router-prefetch') ||
    request.headers.has('x-middleware-prefetch') ||
    request.headers.get('purpose') === 'prefetch'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  const hasValidAccess = await isValidAccessToken(accessToken);
  const isPrefetch = isPrefetchRequest(request);

  if (isProtectedPath(pathname)) {
    if (hasValidAccess) {
      return withNoStoreHeaders(NextResponse.next());
    }

    let shouldClearCookies = Boolean(accessToken && !refreshToken);

    // Attempt silent server-side token rotation if refresh cookie exists
    if (refreshToken && !isPrefetch) {
      const internalApiUrl = resolveUpstreamBaseUrl(request.nextUrl.origin);
      if (internalApiUrl) {
        try {
          const refreshResponse = await fetch(`${internalApiUrl}/auth/refresh`, {
            method: 'POST',
            headers: {
              cookie: request.headers.get('cookie') ?? '',
            },
            cache: 'no-store',
          });

          if (refreshResponse.ok) {
            const nextResponse = NextResponse.next();
            const isHttps = isSecureRequest(request);
            for (const cookieStr of readSetCookies(refreshResponse.headers)) {
              nextResponse.headers.append(
                'set-cookie',
                normalizeSetCookieHeader(cookieStr, isHttps)
              );
            }
            return withNoStoreHeaders(nextResponse);
          }

          if (refreshResponse.status === 401 || refreshResponse.status === 403) {
            shouldClearCookies = true;
          }
        } catch {
          // Fall through to login redirect without clearing cookies on transient network error
        }
      }
    }

    const loginUrl = new URL('/login', request.url);
    const redirectTarget = `${pathname}${search}`;
    if (redirectTarget && redirectTarget !== '/') {
      loginUrl.searchParams.set('redirect', redirectTarget);
    }

    const redirectRes = NextResponse.redirect(loginUrl);
    if (!isPrefetch && shouldClearCookies) {
      redirectRes.cookies.delete(ACCESS_COOKIE_NAME);
      redirectRes.cookies.delete(REFRESH_COOKIE_NAME);
    }
    return withNoStoreHeaders(redirectRes);
  }

  if (isAuthPath(pathname) && hasValidAccess) {
    const requestedRedirect = request.nextUrl.searchParams.get('redirect');
    const safeDestination =
      requestedRedirect && requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
        ? requestedRedirect
        : '/explorer';
    return withNoStoreHeaders(
      NextResponse.redirect(new URL(safeDestination, request.url))
    );
  }

  return withNoStoreHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/datasets/:path*',
    '/explorer/:path*',
    '/search/:path*',
    '/saved-views/:path*',
    '/history/:path*',
    '/records/:path*',
    '/analytics/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
};
