import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

export interface AuthUser {
  id: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function issueTokens(user: AuthUser): TokenPair {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, type: 'access' },
    config.accessSecret,
    {
      expiresIn: config.accessTokenTtl as SignOptions['expiresIn'],
      issuer: 'assetflow-api',
      audience: 'api',
    },
  );

  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh', jti: randomUUID() },
    config.refreshSecret,
    {
      expiresIn: `${config.refreshTokenTtlDays}d` as SignOptions['expiresIn'],
      issuer: 'assetflow-api',
      audience: 'api',
    },
  );

  return { accessToken, refreshToken };
}
