import { query } from '../db/neon.js';
import { logger } from './logger.js';

export type ActionType =
  | 'ALLOCATION' | 'RETURN' | 'TRANSFER' | 'BOOKING' | 'MAINTENANCE'
  | 'AUDIT' | 'ASSET' | 'USER_CHANGE' | 'SYSTEM';

/**
 * Append to the activity trail (Screen 10 / dashboard feed).
 * Fire-and-forget: a logging failure must never fail the request.
 */
export function logActivity(
  actorId: string | null,
  actionType: ActionType,
  entityType: string,
  entityId: string | null,
  description: string,
  metadata?: object,
): void {
  query(
    `INSERT INTO activity_logs (actor_id, action_type, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId, actionType, entityType, entityId, description, metadata ? JSON.stringify(metadata) : null],
  ).catch((error) => logger.error({ err: error }, 'Failed to write activity log'));
}
