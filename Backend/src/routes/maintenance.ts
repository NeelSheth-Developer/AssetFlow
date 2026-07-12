import { Router } from 'express';
import { query, getClient } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scopeByUserColumn } from '../lib/scope.js';
import { logActivity } from '../lib/activity.js';
import { notify } from '../lib/notify.js';

export const maintenanceRouter = Router();
maintenanceRouter.use(requireAuth);

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED'];

interface MaintRow {
  id: string;
  issue: string;
  issue_type: string | null;
  priority: string;
  status: string;
  technician_id: string | null;
  technician_name: string | null;
  started_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  cost: string | null;
  rejected_reason: string | null;
  escalated: unknown;
  created_at: string;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  raised_by_id: string | null;
  raised_by_name: string | null;
}

const MAINT_SELECT = `
  SELECT m.id, m.issue, m.issue_type, m.priority, m.status, m.technician_id, m.technician_name,
         m.started_at, m.resolved_at, m.resolution_notes, m.cost, m.rejected_reason, m.escalated, m.created_at,
         a.id AS asset_id, a.tag AS asset_tag, a.name AS asset_name,
         u.id AS raised_by_id, u.name AS raised_by_name
  FROM maintenance_requests m
  JOIN assets a ON a.id = m.asset_id
  LEFT JOIN users u ON u.id = m.raised_by`;

const publicMaint = (m: MaintRow) => ({
  id: m.id,
  issue: m.issue,
  issueType: m.issue_type,
  priority: m.priority,
  status: m.status,
  asset: { id: m.asset_id, tag: m.asset_tag, name: m.asset_name },
  raisedBy: m.raised_by_id ? { id: m.raised_by_id, name: m.raised_by_name } : null,
  technician: m.technician_id || m.technician_name
    ? { id: m.technician_id, name: m.technician_name }
    : null,
  startedAt: m.started_at,
  resolvedAt: m.resolved_at,
  resolutionNotes: m.resolution_notes,
  cost: m.cost !== null ? Number(m.cost) : null,
  rejectedReason: m.rejected_reason,
  escalated: m.escalated,
  createdAt: m.created_at,
});

// GET /api/maintenance — scoped list (filters: status, priority, assetId).
maintenanceRouter.get('/', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    const filters: string[] = [];
    const scope = scopeByUserColumn(req, 'm.raised_by', params);
    if (scope) {
      // Employees also see requests where they are the assigned technician.
      filters.push(req.user!.role === 'EMPLOYEE' ? `(${scope} OR m.technician_id = $${params.length})` : scope);
    }
    if (isUuid(req.query.assetId)) { params.push(req.query.assetId); filters.push(`m.asset_id = $${params.length}`); }
    const status = String(req.query.status ?? '');
    if (STATUSES.includes(status)) { params.push(status); filters.push(`m.status = $${params.length}`); }
    const priority = String(req.query.priority ?? '');
    if (PRIORITIES.includes(priority)) { params.push(priority); filters.push(`m.priority = $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query<MaintRow>(`${MAINT_SELECT} ${where} ORDER BY m.created_at DESC LIMIT 200`, params);
    return ok(res, 200, 'Maintenance requests fetched', { requests: rows.rows.map(publicMaint) });
  } catch (error) {
    next(error);
  }
});

// GET /api/maintenance/:id — detail incl. comments count.
maintenanceRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Maintenance request not found');
    const result = await query<MaintRow>(`${MAINT_SELECT} WHERE m.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Maintenance request not found');
    const comments = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM maintenance_comments WHERE request_id = $1',
      [req.params.id],
    );
    return ok(res, 200, 'Maintenance request fetched', {
      request: { ...publicMaint(result.rows[0]), commentCount: Number(comments.rows[0].count) },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/maintenance — anyone raises a request.
maintenanceRouter.post('/', async (req, res, next) => {
  try {
    const assetId = req.body.assetId;
    if (!isUuid(assetId)) return fail(res, 404, 'Asset not found');
    const issue = String(req.body.issue ?? '').trim();
    if (issue.length < 3) return fail(res, 400, 'issue is required');
    const priority = PRIORITIES.includes(String(req.body.priority)) ? String(req.body.priority) : 'MEDIUM';

    const asset = await query<{ tag: string; name: string }>('SELECT tag, name FROM assets WHERE id = $1', [assetId]);
    if (!asset.rowCount) return fail(res, 404, 'Asset not found');

    const inserted = await query<{ id: string }>(
      `INSERT INTO maintenance_requests (asset_id, raised_by, issue, issue_type, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [assetId, req.user!.userId, issue, req.body.issueType ?? null, priority],
    );
    const created = await query<MaintRow>(`${MAINT_SELECT} WHERE m.id = $1`, [inserted.rows[0].id]);
    logActivity(req.user!.userId, 'MAINTENANCE', 'MAINTENANCE', inserted.rows[0].id,
      `Raised maintenance request for ${asset.rows[0].tag}: ${issue}`);
    return ok(res, 201, 'Maintenance request raised', { request: publicMaint(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Small helper for status transitions with validation.
async function loadRequest(id: string): Promise<MaintRow | null> {
  if (!isUuid(id)) return null;
  const result = await query<MaintRow>(`${MAINT_SELECT} WHERE m.id = $1`, [id]);
  return result.rows[0] ?? null;
}

// POST /api/maintenance/:id/approve — AM. Asset goes UNDER_MAINTENANCE.
maintenanceRouter.post('/:id/approve', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  const client = await getClient();
  try {
    const m = await loadRequest(req.params.id);
    if (!m) return fail(res, 404, 'Maintenance request not found');
    if (m.status !== 'PENDING') return fail(res, 400, 'Request must be PENDING to approve');
    await client.query('BEGIN');
    await client.query(`UPDATE maintenance_requests SET status = 'APPROVED', updated_at = now() WHERE id = $1`, [m.id]);
    await client.query(`UPDATE assets SET status = 'UNDER_MAINTENANCE', updated_at = now() WHERE id = $1`, [m.asset_id]);
    await client.query('COMMIT');
    logActivity(req.user!.userId, 'MAINTENANCE', 'MAINTENANCE', m.id, `Approved maintenance for ${m.asset_tag}`);
    if (m.raised_by_id) notify(m.raised_by_id, 'MAINTENANCE', 'Request approved', `Maintenance for ${m.asset_tag} was approved.`, 'MAINTENANCE', m.id);
    return ok(res, 200, 'Request approved — asset is Under Maintenance', { request: { id: m.id, status: 'APPROVED' } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/maintenance/:id/reject — AM, with reason.
maintenanceRouter.post('/:id/reject', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const m = await loadRequest(req.params.id);
    if (!m) return fail(res, 404, 'Maintenance request not found');
    if (m.status !== 'PENDING') return fail(res, 400, 'Request must be PENDING to reject');
    await query(
      `UPDATE maintenance_requests SET status = 'REJECTED', rejected_reason = $2, updated_at = now() WHERE id = $1`,
      [m.id, req.body.reason ?? null],
    );
    logActivity(req.user!.userId, 'MAINTENANCE', 'MAINTENANCE', m.id, `Rejected maintenance for ${m.asset_tag}`);
    if (m.raised_by_id) notify(m.raised_by_id, 'MAINTENANCE', 'Request rejected', `Maintenance for ${m.asset_tag} was rejected.`, 'MAINTENANCE', m.id);
    return ok(res, 200, 'Request rejected', { request: { id: m.id, status: 'REJECTED' } });
  } catch (error) {
    next(error);
  }
});

// POST /api/maintenance/:id/assign — AM assigns a technician (a user id, or just a name).
maintenanceRouter.post('/:id/assign', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const m = await loadRequest(req.params.id);
    if (!m) return fail(res, 404, 'Maintenance request not found');
    if (!['APPROVED', 'TECHNICIAN_ASSIGNED'].includes(m.status)) {
      return fail(res, 400, 'Request must be APPROVED before assigning a technician');
    }
    const technicianId = isUuid(req.body.technicianId) ? req.body.technicianId : null;
    let technicianName = String(req.body.technicianName ?? '').trim() || null;
    if (technicianId) {
      const tech = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [technicianId]);
      if (!tech.rowCount) return fail(res, 404, 'Technician user not found');
      technicianName = tech.rows[0].name;
    }
    if (!technicianId && !technicianName) return fail(res, 400, 'technicianId or technicianName is required');

    await query(
      `UPDATE maintenance_requests SET status = 'TECHNICIAN_ASSIGNED', technician_id = $2, technician_name = $3, updated_at = now()
       WHERE id = $1`,
      [m.id, technicianId, technicianName],
    );
    logActivity(req.user!.userId, 'MAINTENANCE', 'MAINTENANCE', m.id, `Assigned ${technicianName} to ${m.asset_tag}`);
    if (technicianId) notify(technicianId, 'MAINTENANCE', 'Job assigned to you', `${m.asset_tag}: ${m.issue}`, 'MAINTENANCE', m.id);
    return ok(res, 200, 'Technician assigned', {
      request: { id: m.id, status: 'TECHNICIAN_ASSIGNED', technician: { id: technicianId, name: technicianName } },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/maintenance/:id/start — only the assigned technician.
maintenanceRouter.post('/:id/start', async (req, res, next) => {
  try {
    const m = await loadRequest(req.params.id);
    if (!m) return fail(res, 404, 'Maintenance request not found');
    if (m.status !== 'TECHNICIAN_ASSIGNED') return fail(res, 400, 'Request must be in ASSIGNED status');
    const isTech = m.technician_id === req.user!.userId;
    const isManager = req.user!.role === 'ADMIN' || req.user!.role === 'ASSET_MANAGER';
    if (!isTech && !isManager) return fail(res, 403, 'Only the assigned technician can start work');

    await query(`UPDATE maintenance_requests SET status = 'IN_PROGRESS', started_at = now(), updated_at = now() WHERE id = $1`, [m.id]);
    logActivity(req.user!.userId, 'MAINTENANCE', 'MAINTENANCE', m.id, `Started work on ${m.asset_tag}`);
    return ok(res, 200, 'Work started', { request: { id: m.id, status: 'IN_PROGRESS' } });
  } catch (error) {
    next(error);
  }
});

// POST /api/maintenance/:id/resolve — technician or AM; asset returns to AVAILABLE.
maintenanceRouter.post('/:id/resolve', async (req, res, next) => {
  const client = await getClient();
  try {
    const m = await loadRequest(req.params.id);
    if (!m) return fail(res, 404, 'Maintenance request not found');
    if (!['IN_PROGRESS', 'TECHNICIAN_ASSIGNED', 'ESCALATED'].includes(m.status)) {
      return fail(res, 400, 'Request is not in progress');
    }
    const isTech = m.technician_id === req.user!.userId;
    const isManager = req.user!.role === 'ADMIN' || req.user!.role === 'ASSET_MANAGER';
    if (!isTech && !isManager) return fail(res, 403, 'Only the assigned technician or an Asset Manager can resolve');

    await client.query('BEGIN');
    await client.query(
      `UPDATE maintenance_requests SET status = 'RESOLVED', resolved_at = now(), resolution_notes = $2, cost = $3, updated_at = now()
       WHERE id = $1`,
      [m.id, req.body.notes ?? null, req.body.cost ?? null],
    );
    // Asset returns to service unless it is still actively allocated.
    const activeAlloc = await client.query(
      `SELECT 1 FROM allocations WHERE asset_id = $1 AND status IN ('ACTIVE','RETURN_REQUESTED') LIMIT 1`,
      [m.asset_id],
    );
    await client.query(`UPDATE assets SET status = $2, updated_at = now() WHERE id = $1`, [
      m.asset_id, activeAlloc.rowCount ? 'ALLOCATED' : 'AVAILABLE',
    ]);
    await client.query('COMMIT');
    logActivity(req.user!.userId, 'MAINTENANCE', 'MAINTENANCE', m.id, `Resolved maintenance on ${m.asset_tag}`);
    if (m.raised_by_id) notify(m.raised_by_id, 'MAINTENANCE', 'Request resolved', `Maintenance for ${m.asset_tag} is resolved.`, 'MAINTENANCE', m.id);
    return ok(res, 200, 'Request resolved', { request: { id: m.id, status: 'RESOLVED' } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/maintenance/:id/escalate — AM; bumps priority to CRITICAL.
maintenanceRouter.post('/:id/escalate', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const m = await loadRequest(req.params.id);
    if (!m) return fail(res, 404, 'Maintenance request not found');
    if (['RESOLVED', 'REJECTED'].includes(m.status)) return fail(res, 400, 'Cannot escalate a closed request');
    await query(
      `UPDATE maintenance_requests SET status = 'ESCALATED', priority = 'CRITICAL', escalated = $2, updated_at = now()
       WHERE id = $1`,
      [m.id, JSON.stringify({ reason: req.body.reason ?? null, escalateTo: req.body.escalateTo ?? 'ADMIN', by: req.user!.userId })],
    );
    logActivity(req.user!.userId, 'MAINTENANCE', 'MAINTENANCE', m.id, `Escalated maintenance on ${m.asset_tag}`);
    return ok(res, 200, 'Request escalated', { request: { id: m.id, status: 'ESCALATED', priority: 'CRITICAL' } });
  } catch (error) {
    next(error);
  }
});

// GET /api/maintenance/:id/comments
maintenanceRouter.get('/:id/comments', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Maintenance request not found');
    const rows = await query(
      `SELECT c.id, c.text, c.created_at, u.id AS author_id, u.name AS author_name, u.role AS author_role
       FROM maintenance_comments c LEFT JOIN users u ON u.id = c.author_id
       WHERE c.request_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id],
    );
    return ok(res, 200, 'Comments fetched', {
      comments: rows.rows.map((c) => ({
        id: c.id,
        author: c.author_id ? { id: c.author_id, name: c.author_name, role: c.author_role } : null,
        text: c.text,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/maintenance/:id/comments
maintenanceRouter.post('/:id/comments', async (req, res, next) => {
  try {
    const m = await loadRequest(req.params.id);
    if (!m) return fail(res, 404, 'Maintenance request not found');
    const text = String(req.body.text ?? '').trim();
    if (!text) return fail(res, 400, 'text is required');
    const inserted = await query<{ id: string; created_at: string }>(
      `INSERT INTO maintenance_comments (request_id, author_id, text) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [m.id, req.user!.userId, text],
    );
    return ok(res, 201, 'Comment added', {
      comment: { id: inserted.rows[0].id, text, createdAt: inserted.rows[0].created_at },
    });
  } catch (error) {
    next(error);
  }
});
