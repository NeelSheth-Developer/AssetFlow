import type { Response } from 'express';

/**
 * The single response envelope (spec §1). Every endpoint returns
 * { success, message, data } — data is null when there is no payload.
 */
export const ok = (res: Response, status: number, message: string, data: object | null = null) =>
  res.status(status).json({ success: true, message, data });

export const fail = (res: Response, status: number, message: string) =>
  res.status(status).json({ success: false, message, data: null });
