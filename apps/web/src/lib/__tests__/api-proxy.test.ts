import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/[...path]/route';
import {
  normalizeSetCookieHeader,
  resolveUpstreamBaseUrl,
} from '@/lib/api-proxy';

describe('api-proxy', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('normalizeSetCookieHeader', () => {
    it('strips upstream Domain and keeps Secure for HTTPS requests', () => {
      const raw =
        'ds_access_token=abc123; Max-Age=900; Domain=.onrender.com; Path=/; HttpOnly; Secure; SameSite=Lax';
      const normalized = normalizeSetCookieHeader(raw, true);

      expect(normalized).not.toMatch(/Domain=/i);
      expect(normalized).toContain('HttpOnly');
      expect(normalized).toContain('Secure');
      expect(normalized).toContain('SameSite=Lax');
      expect(normalized).toContain('Path=/');
    });

    it('strips Secure flag when incoming request is plain HTTP', () => {
      const raw =
        'ds_refresh_token=xyz789; Domain=api.example.com; Path=/; HttpOnly; Secure; SameSite=Lax';
      const normalized = normalizeSetCookieHeader(raw, false);

      expect(normalized).not.toMatch(/Domain=/i);
      expect(normalized).not.toMatch(/\bSecure\b/i);
      expect(normalized).toContain('HttpOnly');
    });
  });

  describe('resolveUpstreamBaseUrl', () => {
    it('normalizes INTERNAL_API_URL by trimming slashes and ensuring /api/v1 suffix', () => {
      vi.stubEnv('INTERNAL_API_URL', 'https://datascope-api.onrender.com///');
      expect(resolveUpstreamBaseUrl('https://datascope.vercel.app')).toBe(
        'https://datascope-api.onrender.com/api/v1'
      );

      vi.stubEnv('INTERNAL_API_URL', 'https://datascope-api.onrender.com/api/v1/');
      expect(resolveUpstreamBaseUrl('https://datascope.vercel.app')).toBe(
        'https://datascope-api.onrender.com/api/v1'
      );
    });

    it('avoids self-proxying NEXT_PUBLIC_API_URL on the same origin and returns null in prod when unset', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('INTERNAL_API_URL', '');
      vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://datascope.vercel.app/api/v1');

      expect(resolveUpstreamBaseUrl('https://datascope.vercel.app')).toBeNull();
    });
  });

  describe('BFF /api/v1/[...path] POST proxy', () => {
    it('preserves multiple Set-Cookie headers individually with Domain stripped and Cache-Control no-store', async () => {
      vi.stubEnv('INTERNAL_API_URL', 'https://datascope-api.onrender.com');

      const upstreamHeaders = new Headers({
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': '999',
      });
      upstreamHeaders.append(
        'set-cookie',
        'ds_access_token=token-a; Domain=datascope-api.onrender.com; Path=/; HttpOnly; Secure; SameSite=Lax'
      );
      upstreamHeaders.append(
        'set-cookie',
        'ds_refresh_token=token-r; Domain=datascope-api.onrender.com; Path=/; HttpOnly; Secure; SameSite=Lax'
      );

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { ok: true } }), {
          status: 200,
          headers: upstreamHeaders,
        })
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const request = new NextRequest('https://datascope.vercel.app/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://datascope.vercel.app',
          host: 'datascope.vercel.app',
        },
        body: JSON.stringify({ email: 'analyst@datascope.io', password: 'Password123!' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ path: ['auth', 'login'] }),
      });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe('https://datascope-api.onrender.com/api/v1/auth/login');
      const sentHeaders = calledInit.headers as Headers;
      expect(sentHeaders.has('origin')).toBe(false);
      expect(sentHeaders.has('host')).toBe(false);

      const cookies = response.headers.getSetCookie();
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toContain('ds_access_token=token-a');
      expect(cookies[0]).not.toMatch(/Domain=/i);
      expect(cookies[0]).toContain('Secure');
      expect(cookies[1]).toContain('ds_refresh_token=token-r');
      expect(cookies[1]).not.toMatch(/Domain=/i);

      expect(response.headers.get('cache-control')).toBe(
        'private, no-store, no-cache, must-revalidate'
      );
      expect(response.headers.get('content-encoding')).toBeNull();
      expect(response.headers.get('content-length')).toBeNull();
    });

    it('returns 502 JSON when upstream fetch rejects', async () => {
      vi.stubEnv('INTERNAL_API_URL', 'https://datascope-api.onrender.com');
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));

      const request = new NextRequest('https://datascope.vercel.app/api/v1/auth/login', {
        method: 'POST',
        body: '{}',
      });

      const response = await POST(request, {
        params: Promise.resolve({ path: ['auth', 'login'] }),
      });

      expect(response.status).toBe(502);
      const body = (await response.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BAD_GATEWAY');
    });
  });
});
