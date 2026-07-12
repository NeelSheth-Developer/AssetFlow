import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

// Screen 10 — everything here is scoped to the logged-in user only.
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /api/notifications — own feed (?unread=true to filter).
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const unreadOnly = String(req.query.unread ?? '') === 'true';
    const rows = await query(
      `SELECT id, type, title, message, entity_type, entity_id, read, created_at
       FROM notifications WHERE user_id = $1 ${unreadOnly ? 'AND read = FALSE' : ''}
       ORDER BY created_at DESC LIMIT 100`,
      [req.user!.userId],
    );
    const unread = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [req.user!.userId],
    );
    return ok(res, 200, 'Notifications fetched', {
      notifications: rows.rows,
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
