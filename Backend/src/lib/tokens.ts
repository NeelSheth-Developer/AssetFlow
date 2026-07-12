import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';

export type Role = 'ADMIN' | 'ASSET_MANAGER' | 'DEPT_HEAD' | 'EMPLOYEE';

export interface AccessPayload {
  userId: string;
  role: Role;
  departmentId: string | null;
}

/** Short-lived JWT (spec §2): { userId, role, departmentId }, 15 minutes. */
export const signAccessToken = (payload: AccessPayload): string =>
  jwt.sign(payload, config.accessSecret, {
    expiresIn: config.accessTokenTtl as SignOptions['expiresIn'],
    issuer: 'assetflow-api',
    audience: 'api',
  });

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, config.accessSecret, {
    issuer: 'assetflow-api',
    audience: 'api',
  }) as jwt.JwtPayload;
  if (!decoded.userId || !decoded.role) throw new Error('malformed access token');
  return {
    userId: String(decoded.userId),
    role: decoded.role as Role,
    departmentId: decoded.departmentId ?? null,
  };
}

/** Opaque random 64-byte refresh token (spec §2) — only its SHA-256 lands in the DB. */
export const createRefreshToken = (): string => randomBytes(64).toString('hex');
