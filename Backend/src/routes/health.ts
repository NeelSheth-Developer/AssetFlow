import { Router, type Response } from 'express';
import { pingDb } from '../db/neon.js';
import { config } from '../config.js';

export const healthRouter = Router();

const response = (res: Response, status: number, success: boolean, message: string, data?: object) =>
  res.status(status).json({ success, message, ...(data && { data }), timestamp: new Date().toISOString() });

// GET /health — liveness + readiness in one: verifies the Neon connection
// and reports uptime so load balancers and uptime monitors get a real signal.
healthRouter.get('/', async (_req, res) => {
  const startedAt = process.hrtime.bigint();
  try {
    await pingDb();
    const dbLatencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    return response(res, 200, true, 'API is healthy', {
      status: 'ok',
      environment: config.nodeEnv,
      uptime_seconds: Math.round(process.uptime()),
      database: { status: 'connected', latency_ms: Math.round(dbLatencyMs * 100) / 100 },
    });
  } catch {
    return response(res, 503, false, 'API is degraded', {
      status: 'degraded',
      environment: config.nodeEnv,
      uptime_seconds: Math.round(process.uptime()),
      database: { status: 'disconnected' },
    });
  }
});
