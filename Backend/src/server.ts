import { app } from './app.js';
import { config } from './config.js';
import { pingDb } from './db/neon.js';
import { logger } from './lib/logger.js';

await pingDb();
logger.info('Database connection verified');
app.listen(config.port, () => logger.info(`API listening on http://localhost:${config.port}`));

process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception — shutting down');
  process.exit(1);
});
