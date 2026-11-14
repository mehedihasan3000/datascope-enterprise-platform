import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

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

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  const hasValidAccess = await isValidAccessToken(accessToken);

  if (isProtectedPath(pathname)) {
    if (hasValidAccess) {
      return NextResponse.next();
    }

    // Attempt silent server-side token rotation if refresh cookie exists
    if (refreshToken) {
      const internalApiUrl =
        process.env.INTERNAL_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:4000/api/v1';
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
          const setCookies = refreshResponse.headers.getSetCookie?.() ?? [];
          for (const cookieStr of setCookies) {
            nextResponse.headers.append('set-cookie', cookieStr);
          }
          return nextResponse;
        }
      } catch {
        // Fall through to login redirect
      }
    }

    const loginUrl = new URL('/login', request.url);
    const redirectTarget = `${pathname}${search}`;
    if (redirectTarget && redirectTarget !== '/') {
      loginUrl.searchParams.set('redirect', redirectTarget);
    }

    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.cookies.delete(ACCESS_COOKIE_NAME);
    redirectRes.cookies.delete(REFRESH_COOKIE_NAME);
    return redirectRes;
  }

  if (isAuthPath(pathname) && hasValidAccess) {
    const requestedRedirect = request.nextUrl.searchParams.get('redirect');
    const safeDestination =
      requestedRedirect && requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
        ? requestedRedirect
        : '/explorer';
    return NextResponse.redirect(new URL(safeDestination, request.url));
  }

  return NextResponse.next();
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
