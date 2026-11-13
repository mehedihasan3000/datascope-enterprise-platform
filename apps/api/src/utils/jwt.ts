import type { RoleName } from '@datascope/shared';
import type { CookieOptions, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_COOKIE_NAME = 'ds_access_token';
export const REFRESH_COOKIE_NAME = 'ds_refresh_token';

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName;
  roleId: string;
  type: 'access' | 'refresh';
}

export type JwtUserClaims = Omit<JwtPayload, 'type'>;

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function signAccessToken(payload: JwtUserClaims): string {
  const fullPayload: JwtPayload = { ...payload, type: 'access' };
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(fullPayload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: JwtUserClaims): string {
  const fullPayload: JwtPayload = { ...payload, type: 'refresh' };
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(fullPayload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  if (!decoded || decoded.type !== 'access' || !decoded.sub) {
    throw new Error('Invalid access token type');
  }
  return decoded;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  if (!decoded || decoded.type !== 'refresh' || !decoded.sub) {
    throw new Error('Invalid refresh token type');
  }
  return decoded;
}

function getBaseCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === 'production';
  const secure = env.COOKIE_SECURE || isProd;

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    ...(env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost'
      ? { domain: env.COOKIE_DOMAIN }
      : {}),
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  const base = getBaseCookieOptions();

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...base,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...base,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  const base = getBaseCookieOptions();
  res.clearCookie(ACCESS_COOKIE_NAME, base);
  res.clearCookie(REFRESH_COOKIE_NAME, base);
}
