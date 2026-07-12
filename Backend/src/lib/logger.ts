import pino from 'pino';
import { config } from '../config.js';

// Structured JSON logs in production; human-readable colored logs in dev.
// Level via LOG_LEVEL env (default: debug in dev, info in production).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.nodeEnv === 'production' ? 'info' : 'debug'),
  ...(config.nodeEnv !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});
