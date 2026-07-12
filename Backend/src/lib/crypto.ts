import { createHash, randomInt } from 'node:crypto';

/** 6-digit password-reset code (spec §4.6). The raw code is only ever emailed. */
export const createOtp = (): string => randomInt(100000, 1000000).toString();

/** SHA-256 of a refresh token — the DB never sees the raw token (spec §3.4). */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
