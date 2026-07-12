import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { aiRouter } from './routes/ai.js';
import { imagesRouter } from './routes/images.js';
import { sanitize } from './middleware/sanitize.js';
import { logger } from './lib/logger.js';

export const app = express();
app.use(helmet());
app.use(cors());

// Request logging: one line per request with id, method, url, status, duration.
// Never logs bodies (OTPs/tokens) and redacts the Authorization header.
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
app.use(sanitize);

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/images', imagesRouter);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  (req.log ?? logger).error({ err: error }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});
