import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { departmentsRouter } from './routes/departments.js';
import { categoriesRouter } from './routes/categories.js';
import { sanitize } from './middleware/sanitize.js';
import { logger } from './lib/logger.js';

export const app = express();
app.use(helmet());

// credentials: true is required on BOTH sides (here and fetch's credentials:
// 'include') for the HttpOnly auth cookies to cross origins (spec §2).
app.use(
  cors({
    origin: config.clientUrl.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);

// Request logging: one line per request with id, method, url, status, duration.
// Never logs bodies (passwords/OTPs) and redacts auth headers + cookies.
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' },
    customLogLevel: (_req, res, error) =>
      error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    autoLogging: { ignore: (req) => req.url === '/health' },
  }),
);

app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(sanitize);

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/categories', categoriesRouter);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found', data: null }));
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  (req.log ?? logger).error({ err: error }, 'Unhandled error');
  res.status(500).json({ success: false, message: 'Internal server error', data: null });
});
