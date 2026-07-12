import { Router, type Request } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { log } from 'node:console';

// Screen 10. Feed visibility: Admin → all, Asset Manager → asset-related
// (ALLOCATION/RETURN/TRANSFER/MAINTENANCE) + own, Dept Head → their department,
// Employee → own only. Writes (mark-read/delete) stay owner-only.
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const ASSET_TYPES = ['ALLOCATION', 'RETURN', 'TRANSFER', 'MAINTENANCE'];

// Returns a WHERE fragment over notifications n JOIN users u (the recipient),
// pushing bind values onto params. '' means org-wide (Admin).

// GET /api/notifications — role-scoped feed (?unread=true to filter).
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const unreadOnly = String(req.query.unread ?? '') === 'true';
    const params: unknown[] = [req.user!.userId];
    const filters = ['n.user_id = $1'];

    if (unreadOnly) {
      filters.push('n.read = FALSE');
    }

    const where = `WHERE ${filters.join(' AND ')}`;

    const rows = await query(
      `SELECT n.id, n.type, n.title, n.message, n.entity_type, n.entity_id, n.read, n.created_at,
              u.id AS recipient_id, u.name AS recipient_name
       FROM notifications n JOIN users u ON u.id = n.user_id
       ${where} ORDER BY n.created_at DESC LIMIT 100`,
      params,
    );

    const unread = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = $1
      AND read = FALSE`,
      [req.user!.userId],
    );

    return ok(res, 200, 'Notifications fetched', {
      notifications: rows.rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        entity_type: n.entity_type,
        entity_id: n.entity_id,
        read: n.read,
        created_at: n.created_at,
        recipient: { id: n.recipient_id, name: n.recipient_name },
        isMine: n.recipient_id === req.user!.userId,
      })),
      unreadCount: Number(unread.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/preferences
notificationsRouter.get('/preferences', async (req, res, next) => {
  try {
    const result = await query<{ prefs: object }>(
      'SELECT prefs FROM notification_preferences WHERE user_id = $1',
      [req.user!.userId],
    );
    const defaults = { allocation: true, transfer: true, maintenance: true, booking: true, audit: true, email: false };
    return ok(res, 200, 'Preferences fetched', {
      preferences: { ...defaults, ...(result.rows[0]?.prefs ?? {}) },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/preferences — upsert own settings.
notificationsRouter.patch('/preferences', async (req, res, next) => {
  try {
    const prefs = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await query<{ prefs: object }>(
      `INSERT INTO notification_preferences (user_id, prefs, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET prefs = notification_preferences.prefs || $2, updated_at = now()
       RETURNING prefs`,
      [req.user!.userId, JSON.stringify(prefs)],
    );
    return ok(res, 200, 'Preferences updated', { preferences: result.rows[0].prefs });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', async (req, res, next) => {
  try {
    const updated = await query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [req.user!.userId],
    );
    return ok(res, 200, 'All notifications marked as read', { updatedCount: updated.rowCount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/:id/read — owner only.
notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Notification not found');
    const updated = await query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.userId],
    );
    if (!updated.rowCount) return fail(res, 404, 'Notification not found');
    return ok(res, 200, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/:id — dismiss (owner only).
notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Notification not found');
    const deleted = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.userId],
    );
    if (!deleted.rowCount) return fail(res, 404, 'Notification not found');
    return ok(res, 200, 'Notification dismissed');
  } catch (error) {
    next(error);
  }
});
