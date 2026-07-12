import { Router } from 'express';
import { query, getClient } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';
import { notify } from '../lib/notify.js';

export const transfersRouter = Router();
transfersRouter.use(requireAuth);

interface TransferRow {
  id: string;
  status: string;
  reason: string | null;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  from_id: string | null;
  from_name: string | null;
  to_id: string;
  to_name: string;
  to_dept: string | null;
  decided_by_name: string | null;
}

const TRANSFER_SELECT = `
  SELECT t.id, t.status, t.reason, t.decision_reason, t.created_at, t.decided_at,
         a.id AS asset_id, a.tag AS asset_tag, a.name AS asset_name,
         fu.id AS from_id, fu.name AS from_name,
         tu.id AS to_id, tu.name AS to_name, tu.department_id AS to_dept,
         db.name AS decided_by_name
  FROM transfer_requests t
  JOIN assets a ON a.id = t.asset_id
  LEFT JOIN users fu ON fu.id = t.from_user
  JOIN users tu ON tu.id = t.to_user
  LEFT JOIN users db ON db.id = t.decided_by`;

const publicTransfer = (t: TransferRow) => ({
  id: t.id,
  status: t.status,
  reason: t.reason,
  decisionReason: t.decision_reason,
  asset: { id: t.asset_id, tag: t.asset_tag, name: t.asset_name },
  from: t.from_id ? { id: t.from_id, name: t.from_name } : null,
  to: { id: t.to_id, name: t.to_name },
  decidedBy: t.decided_by_name,
  createdAt: t.created_at,
  decidedAt: t.decided_at,
});

// GET /api/transfers — Employee → own (either side), Dept Head → own dept, Admin/AM → all.
transfersRouter.get('/', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    const filters: string[] = [];
    if (req.user!.role === 'EMPLOYEE') {
      params.push(req.user!.userId);
      filters.push(`(t.from_user = $${params.length} OR t.to_user = $${params.length})`);
    } else if (req.user!.role === 'DEPT_HEAD' && req.user!.departmentId) {
      params.push(req.user!.departmentId);
      filters.push(`(fu.department_id = $${params.length} OR tu.department_id = $${params.length})`);
    }
    const status = String(req.query.status ?? '');
    if (['REQUESTED', 'APPROVED', 'REJECTED'].includes(status)) {
      params.push(status);
      filters.push(`t.status = $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query<TransferRow>(`${TRANSFER_SELECT} ${where} ORDER BY t.created_at DESC LIMIT 200`, params);
    return ok(res, 200, 'Transfer requests fetched', { transfers: rows.rows.map(publicTransfer) });
  } catch (error) {
    next(error);
  }
});

// GET /api/transfers/:id
transfersRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Transfer request not found');
    const result = await query<TransferRow>(`${TRANSFER_SELECT} WHERE t.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Transfer request not found');
    const t = result.rows[0];
    if (req.user!.role === 'EMPLOYEE' && t.from_id !== req.user!.userId && t.to_id !== req.user!.userId) {
      return fail(res, 403, 'Insufficient permissions');
    }
    return ok(res, 200, 'Transfer request fetched', { transfer: publicTransfer(t) });
  } catch (error) {
    next(error);
  }
});

// POST /api/transfers — any authenticated user requests a transfer to another user.
transfersRouter.post('/', async (req, res, next) => {
  try {
    const assetId = req.body.assetId;
    const toUserId = req.body.toUserId ?? req.body.to;
    if (!isUuid(assetId)) return fail(res, 404, 'Asset not found');
    if (!isUuid(toUserId)) return fail(res, 404, 'Target user not found');
    if (toUserId === req.user!.userId) return fail(res, 400, 'Cannot transfer an asset to yourself');

    const asset = await query<{ tag: string; name: string; status: string }>(
      'SELECT tag, name, status FROM assets WHERE id = $1',
      [assetId],
    );
    if (!asset.rowCount) return fail(res, 404, 'Asset not found');
    if (asset.rows[0].status !== 'ALLOCATED') return fail(res, 400, 'Only allocated assets can be transferred');

    const holder = await query<{ holder_id: string }>(
      `SELECT holder_id FROM allocations WHERE asset_id = $1 AND status IN ('ACTIVE','RETURN_REQUESTED')
       ORDER BY allocated_at DESC LIMIT 1`,
      [assetId],
    );
    const fromUser = holder.rows[0]?.holder_id ?? null;

    const target = await query<{ name: string; status: string }>('SELECT name, status FROM users WHERE id = $1', [toUserId]);
    if (!target.rowCount) return fail(res, 404, 'Target user not found');
    if (target.rows[0].status !== 'ACTIVE') return fail(res, 400, 'Target user is inactive');

    const open = await query(
      `SELECT 1 FROM transfer_requests WHERE asset_id = $1 AND status = 'REQUESTED' LIMIT 1`,
      [assetId],
    );
    if (open.rowCount) return fail(res, 409, 'A transfer request for this asset is already pending');

    const inserted = await query<{ id: string }>(
      `INSERT INTO transfer_requests (asset_id, from_user, to_user, reason)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [assetId, fromUser, toUserId, req.body.reason ?? null],
    );
    const created = await query<TransferRow>(`${TRANSFER_SELECT} WHERE t.id = $1`, [inserted.rows[0].id]);
    logActivity(req.user!.userId, 'TRANSFER', 'TRANSFER', inserted.rows[0].id,
      `Requested transfer of ${asset.rows[0].tag} to ${target.rows[0].name}`);
    return ok(res, 201, 'Transfer requested', { transfer: publicTransfer(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Shared approve/reject guard: AM/Admin anywhere; Dept Head only within their department.
async function loadForDecision(id: string): Promise<TransferRow | null> {
  const result = await query<TransferRow>(`${TRANSFER_SELECT} WHERE t.id = $1`, [id]);
  return result.rows[0] ?? null;
}

const deptHeadBlocked = (req: { user?: { role: string; departmentId: string | null } }, t: TransferRow): boolean =>
  req.user!.role === 'DEPT_HEAD' && t.to_dept !== req.user!.departmentId;

// POST /api/transfers/:id/approve — moves the active allocation to the target user.
transfersRouter.post('/:id/approve', requireRole('ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Transfer request not found');
    const t = await loadForDecision(id);
    if (!t) return fail(res, 404, 'Transfer request not found');
    if (deptHeadBlocked(req, t)) return fail(res, 403, 'This record is outside your department');
    if (t.status !== 'REQUESTED') return fail(res, 400, 'Transfer request is already decided');

    await client.query('BEGIN');
    await client.query(
      `UPDATE transfer_requests SET status = 'APPROVED', decided_by = $2, decided_at = now() WHERE id = $1`,
      [id, req.user!.userId],
    );
    // Close the old holder's allocation and open one for the new holder.
    await client.query(
      `UPDATE allocations SET status = 'RETURNED', returned_at = now()
       WHERE asset_id = $1 AND status IN ('ACTIVE','RETURN_REQUESTED')`,
      [t.asset_id],
    );
    await client.query(
      `INSERT INTO allocations (asset_id, holder_id, allocated_by, purpose, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [t.asset_id, t.to_id, req.user!.userId, `Transfer from ${t.from_name ?? 'previous holder'}`],
    );
    await client.query(`UPDATE assets SET status = 'ALLOCATED', updated_at = now() WHERE id = $1`, [t.asset_id]);
    await client.query('COMMIT');

    logActivity(req.user!.userId, 'TRANSFER', 'TRANSFER', id, `Approved transfer of ${t.asset_tag} to ${t.to_name}`);
    notify(t.to_id, 'TRANSFER', 'Transfer approved', `${t.asset_tag} — ${t.asset_name} is now allocated to you.`, 'TRANSFER', id);
    if (t.from_id) notify(t.from_id, 'TRANSFER', 'Transfer approved', `${t.asset_tag} was transferred to ${t.to_name}.`, 'TRANSFER', id);
    return ok(res, 200, 'Transfer approved', { transfer: { id, status: 'APPROVED' } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/transfers/:id/reject — with reason.
transfersRouter.post('/:id/reject', requireRole('ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Transfer request not found');
    const t = await loadForDecision(id);
    if (!t) return fail(res, 404, 'Transfer request not found');
    if (deptHeadBlocked(req, t)) return fail(res, 403, 'This record is outside your department');
    if (t.status !== 'REQUESTED') return fail(res, 400, 'Transfer request is already decided');

    await query(
      `UPDATE transfer_requests SET status = 'REJECTED', decided_by = $2, decided_at = now(), decision_reason = $3
       WHERE id = $1`,
      [id, req.user!.userId, req.body.reason ?? null],
    );
    logActivity(req.user!.userId, 'TRANSFER', 'TRANSFER', id, `Rejected transfer of ${t.asset_tag}`);
    if (t.from_id) notify(t.from_id, 'TRANSFER', 'Transfer rejected', `Transfer of ${t.asset_tag} was rejected.`, 'TRANSFER', id);
    return ok(res, 200, 'Transfer rejected', { transfer: { id, status: 'REJECTED' } });
  } catch (error) {
    next(error);
  }
});
