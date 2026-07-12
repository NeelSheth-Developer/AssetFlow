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
import { assetsRouter } from './routes/assets.js';
import { locationsRouter } from './routes/locations.js';
import { allocationsRouter } from './routes/allocations.js';
import { transfersRouter } from './routes/transfers.js';
import { resourcesRouter, bookingsRouter } from './routes/bookings.js';
import { maintenanceRouter } from './routes/maintenance.js';
import { auditsRouter } from './routes/audits.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { notificationsRouter } from './routes/notifications.js';
import { activityLogsRouter } from './routes/activity-logs.js';
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
app.use('/api/assets', assetsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/audit-cycles', auditsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/activity-logs', activityLogsRouter);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found', data: null }));
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  (req.log ?? logger).error({ err: error }, 'Unhandled error');
  res.status(500).json({ success: false, message: 'Internal server error', data: null });
});
