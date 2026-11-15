import { NextRequest, NextResponse } from 'next/server';

const STRIPPED_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'origin',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'accept-encoding',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'set-cookie',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

export function normalizeApiBase(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

export function resolveUpstreamBaseUrl(requestOrigin: string): string | null {
  const internalUrl = process.env.INTERNAL_API_URL?.trim();
  if (internalUrl && /^https?:\/\//i.test(internalUrl)) {
    return normalizeApiBase(internalUrl);
  }

  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicUrl && /^https?:\/\//i.test(publicUrl)) {
    const normalized = normalizeApiBase(publicUrl);
    if (!normalized.startsWith(requestOrigin)) {
      return normalized;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:4000/api/v1';
  }

  return null;
}

/**
 * Strips any upstream Domain attribute so Set-Cookie binds as a first-party host-only
 * cookie on the frontend domain (e.g. *.vercel.app), and removes Secure over local HTTP.
 */
export function normalizeSetCookieHeader(cookie: string, isHttps: boolean): string {
  let normalized = cookie.replace(/;\s*Domain=[^;]*/gi, '');
  if (!isHttps) {
    normalized = normalized.replace(/;\s*Secure\b/gi, '');
  }
  return normalized;
}

export function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto) {
    return forwardedProto.toLowerCase() === 'https';
  }
  return request.nextUrl.protocol === 'https:';
}

export function readSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

export async function proxyApiRequest(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  const upstreamBase = resolveUpstreamBaseUrl(request.nextUrl.origin);
  if (!upstreamBase) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_MISCONFIGURED',
          message: 'INTERNAL_API_URL is not configured on the frontend server.',
        },
      },
      { status: 503 }
    );
  }

  const { path = [] } = await context.params;
  const joinedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const targetUrl = `${upstreamBase}/${joinedPath}${request.nextUrl.search}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream service unavailable';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BAD_GATEWAY',
          message: `Failed to reach upstream API: ${message}`,
        },
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  const isHttps = isSecureRequest(request);
  for (const rawCookie of readSetCookies(upstreamResponse.headers)) {
    responseHeaders.append('set-cookie', normalizeSetCookieHeader(rawCookie, isHttps));
  }

  // Prevent CDN or intermediary layers from caching API responses or stripping Set-Cookie
  responseHeaders.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  responseHeaders.set('Pragma', 'no-cache');

  const isNullBodyStatus =
    upstreamResponse.status === 204 ||
    upstreamResponse.status === 205 ||
    upstreamResponse.status === 304 ||
    method === 'HEAD';

  const responseBody = isNullBodyStatus ? null : await upstreamResponse.arrayBuffer();

  return new NextResponse(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
