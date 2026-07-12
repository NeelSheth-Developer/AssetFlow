import { query } from '../db/neon.js';
import { logger } from './logger.js';

/**
 * Create an in-app notification for a user (Screen 10 feed).
 * Fire-and-forget: a notification failure must never fail the request.
 */
export function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string,
): void {
  query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, entityType ?? null, entityId ?? null],
  ).catch((error) => logger.error({ err: error }, 'Failed to create notification'));
}
