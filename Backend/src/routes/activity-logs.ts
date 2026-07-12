import { Router, type Request } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Screen 10 — full audit trail. Admin only.
export const activityLogsRouter = Router();
activityLogsRouter.use(requireAuth, requireRole('ADMIN'));

const ACTION_TYPES = ['ALLOCATION', 'RETURN', 'TRANSFER', 'BOOKING', 'MAINTENANCE', 'AUDIT', 'ASSET', 'USER_CHANGE', 'SYSTEM'];

function buildFilters(req: Request, params: unknown[]): string {
  const filters: string[] = [];
  const actionType = String(req.query.actionType ?? '').toUpperCase();
  if (ACTION_TYPES.includes(actionType)) { params.push(actionType); filters.push(`l.action_type = $${params.length}`); }
  if (isUuid(req.query.userId)) { params.push(req.query.userId); filters.push(`l.actor_id = $${params.length}`); }
  const entityType = String(req.query.entityType ?? '').toUpperCase();
  if (entityType) { params.push(entityType); filters.push(`l.entity_type = $${params.length}`); }
  const from = String(req.query.from ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { params.push(from); filters.push(`l.created_at >= $${params.length}::date`); }
  const to = String(req.query.to ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { params.push(to); filters.push(`l.created_at < ($${params.length}::date + 1)`); }
  return filters.length ? `WHERE ${filters.join(' AND ')}` : '';
}

const LOG_SELECT = `
  SELECT l.id, l.action_type, l.entity_type, l.entity_id, l.description, l.metadata, l.created_at,
         u.id AS actor_id, u.name AS actor_name, u.email AS actor_email
  FROM activity_logs l LEFT JOIN users u ON u.id = l.actor_id`;

// GET /api/activity-logs — filterable: actionType, userId, entityType, from, to.
activityLogsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const params: unknown[] = [];
    const where = buildFilters(req, params);
    const total = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM activity_logs l ${where}`, params);
    const rows = await query(
      `${LOG_SELECT} ${where} ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return ok(res, 200, 'Activity logs fetched', {
      logs: rows.rows.map((l) => ({
        id: l.id,
        actionType: l.action_type,
        entityType: l.entity_type,
        entityId: l.entity_id,
        description: l.description,
        metadata: l.metadata,
        actor: l.actor_id ? { id: l.actor_id, name: l.actor_name, email: l.actor_email } : null,
        createdAt: l.created_at,
      })),
      total: Number(total.rows[0].count),
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/activity-logs/export?format=csv&from=&to=&actionType=
activityLogsRouter.get('/export', async (req, res, next) => {
  try {
    if (String(req.query.format ?? 'csv') !== 'csv') return fail(res, 400, 'Only format=csv is supported');
    const params: unknown[] = [];
    const where = buildFilters(req, params);
    const rows = await query(`${LOG_SELECT} ${where} ORDER BY l.created_at DESC LIMIT 5000`, params);
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      'timestamp,actor,action_type,entity_type,description',
      ...rows.rows.map((l) =>
        [l.created_at, l.actor_name ?? 'system', l.action_type, l.entity_type ?? '', l.description].map(escape).join(','),
      ),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assetflow-activity-logs.csv"');
    return res.send(csv);
  } catch (error) {
    next(error);
  }
});
