import { createHmac, createHash, randomInt } from 'node:crypto';
import { config } from '../config.js';

export const createOtp = (): string => randomInt(100000, 1000000).toString();

export const hashOtp = (email: string, otp: string): string =>
  createHmac('sha256', config.otpSecret).update(`${email}:${otp}`).digest('hex');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
