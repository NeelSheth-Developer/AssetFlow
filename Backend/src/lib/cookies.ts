import type { CookieOptions, Response } from 'express';
import { config } from '../config.js';

// Secure + SameSite=None is required for cross-site cookies (Vercel ↔ Render),
// but Secure cookies are dropped over plain http — so dev uses Lax without Secure.
const base: CookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: config.isProd ? 'none' : 'lax',
};

function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 15 * 60 * 1000;
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * unit;
}

const AT_OPTS: CookieOptions = { ...base, path: '/', maxAge: ttlToMs(config.accessTokenTtl) };
// Path=/api/auth → the rt cookie is only ever sent to auth endpoints (spec §2).
const RT_OPTS: CookieOptions = {
  ...base,
  path: '/api/auth',
  maxAge: config.refreshTokenTtlDays * 86_400_000,
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('at', accessToken, AT_OPTS);
  res.cookie('rt', refreshToken, RT_OPTS);
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('at', { ...base, path: '/' });
  res.clearCookie('rt', { ...base, path: '/api/auth' });
}
