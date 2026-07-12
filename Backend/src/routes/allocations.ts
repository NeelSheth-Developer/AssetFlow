import { Router } from 'express';
import { query, getClient } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scopeByUserColumn } from '../lib/scope.js';
import { logActivity } from '../lib/activity.js';
import { notify } from '../lib/notify.js';

export const allocationsRouter = Router();
allocationsRouter.use(requireAuth);

interface AllocRow {
  id: string;
  status: string;
  purpose: string | null;
  expected_return_date: string | null;
  allocated_at: string;
  return_requested_at: string | null;
  condition_on_return: string | null;
  return_notes: string | null;
  returned_at: string | null;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  holder_id: string;
  holder_name: string;
  allocated_by_name: string | null;
}

const ALLOC_SELECT = `
  SELECT al.id, al.status, al.purpose, al.expected_return_date, al.allocated_at,
         al.return_requested_at, al.condition_on_return, al.return_notes, al.returned_at,
         a.id AS asset_id, a.tag AS asset_tag, a.name AS asset_name,
         u.id AS holder_id, u.name AS holder_name, ab.name AS allocated_by_name
  FROM allocations al
  JOIN assets a ON a.id = al.asset_id
  JOIN users u ON u.id = al.holder_id
  LEFT JOIN users ab ON ab.id = al.allocated_by`;

const publicAlloc = (r: AllocRow) => ({
  id: r.id,
  status: r.status,
  purpose: r.purpose,
  asset: { id: r.asset_id, tag: r.asset_tag, name: r.asset_name },
  holder: { id: r.holder_id, name: r.holder_name },
  allocatedBy: r.allocated_by_name,
  allocatedAt: r.allocated_at,
  expectedReturnDate: r.expected_return_date,
  returnRequestedAt: r.return_requested_at,
  conditionOnReturn: r.condition_on_return,
  returnNotes: r.return_notes,
  returnedAt: r.returned_at,
  isOverdue:
    ['ACTIVE', 'RETURN_REQUESTED'].includes(r.status) &&
    !!r.expected_return_date && new Date(r.expected_return_date) < new Date(),
});

function listFilters(req: Parameters<Parameters<typeof allocationsRouter.get>[1]>[0], params: unknown[]): string[] {
  const filters: string[] = [];
  const scope = scopeByUserColumn(req, 'al.holder_id', params);
  if (scope) filters.push(scope);
  if (isUuid(req.query.assetId)) { params.push(req.query.assetId); filters.push(`al.asset_id = $${params.length}`); }
  if (isUuid(req.query.employeeId)) { params.push(req.query.employeeId); filters.push(`al.holder_id = $${params.length}`); }
  if (isUuid(req.query.departmentId)) {
    params.push(req.query.departmentId);
    filters.push(`u.department_id = $${params.length}`);
  }
  const status = String(req.query.status ?? '');
  if (['PENDING', 'ACTIVE', 'RETURN_REQUESTED', 'RETURNED', 'REJECTED'].includes(status)) {
    params.push(status);
    filters.push(`al.status = $${params.length}`);
  }
  return filters;
}

// GET /api/allocations — scoped list.
allocationsRouter.get('/', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    const filters = listFilters(req, params);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query<AllocRow>(`${ALLOC_SELECT} ${where} ORDER BY al.allocated_at DESC LIMIT 200`, params);
    return ok(res, 200, 'Allocations fetched', { allocations: rows.rows.map(publicAlloc) });
  } catch (error) {
    next(error);
  }
});

// GET /api/allocations/kanban — grouped by status column (Screen 5 board).
allocationsRouter.get('/kanban', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    const scope = scopeByUserColumn(req, 'al.holder_id', params);
    const rows = await query<AllocRow>(
      `${ALLOC_SELECT} ${scope ? `WHERE ${scope}` : ''} ORDER BY al.allocated_at DESC LIMIT 500`,
      params,
    );
    const columns: Record<string, { count: number; items: object[] }> = {
      PENDING: { count: 0, items: [] },
      ACTIVE: { count: 0, items: [] },
      RETURN_REQUESTED: { count: 0, items: [] },
      OVERDUE: { count: 0, items: [] },
    };
    for (const r of rows.rows) {
      const a = publicAlloc(r);
      const key = a.isOverdue ? 'OVERDUE' : r.status;
      if (!columns[key]) continue; // RETURNED/REJECTED are not board columns
      columns[key].count++;
      if (columns[key].items.length < 50) columns[key].items.push(a);
    }
    return ok(res, 200, 'Kanban data fetched', { columns });
  } catch (error) {
    next(error);
  }
});

// GET /api/allocations/overdue — feeds dashboard + notifications.
allocationsRouter.get('/overdue', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    const scope = scopeByUserColumn(req, 'al.holder_id', params);
    const rows = await query<AllocRow>(
      `${ALLOC_SELECT}
       WHERE ${scope ? scope + ' AND ' : ''} al.status IN ('ACTIVE','RETURN_REQUESTED')
         AND al.expected_return_date IS NOT NULL AND al.expected_return_date < CURRENT_DATE
       ORDER BY al.expected_return_date ASC`,
      params,
    );
    return ok(res, 200, 'Overdue allocations fetched', {
      overdue: rows.rows.map((r) => ({
        ...publicAlloc(r),
        daysOverdue: Math.floor((Date.now() - new Date(r.expected_return_date!).getTime()) / 86_400_000),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/allocations/:id
allocationsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Allocation not found');
    const params: unknown[] = [];
    const scope = scopeByUserColumn(req, 'al.holder_id', params);
    params.push(req.params.id);
    const result = await query<AllocRow>(
      `${ALLOC_SELECT} WHERE ${scope ? scope + ' AND ' : ''} al.id = $${params.length}`,
      params,
    );
    if (!result.rowCount) return fail(res, 404, 'Allocation not found');
    return ok(res, 200, 'Allocation fetched', { allocation: publicAlloc(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// POST /api/allocations — Admin / Asset Manager assigns an asset to an employee.
allocationsRouter.post('/', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  const client = await getClient();
  try {
    const assetId = req.body.assetId;
    const holderId = req.body.employeeId ?? req.body.holderId;
    if (!isUuid(assetId)) return fail(res, 404, 'Asset not found');
    if (!isUuid(holderId)) return fail(res, 404, 'User not found');

    await client.query('BEGIN');
    const asset = await client.query<{ status: string; tag: string; name: string }>(
      'SELECT status, tag, name FROM assets WHERE id = $1 FOR UPDATE',
      [assetId],
    );
    if (!asset.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, 'Asset not found'); }
    if (asset.rows[0].status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      return fail(res, 400, `Asset is ${asset.rows[0].status} — only Available assets can be allocated`);
    }
    const holder = await client.query<{ name: string; status: string }>(
      'SELECT name, status FROM users WHERE id = $1',
      [holderId],
    );
    if (!holder.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, 'User not found'); }
    if (holder.rows[0].status !== 'ACTIVE') { await client.query('ROLLBACK'); return fail(res, 400, 'User is inactive'); }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO allocations (asset_id, holder_id, allocated_by, purpose, expected_return_date, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
      [assetId, holderId, req.user!.userId, req.body.purpose ?? null, req.body.expectedReturnDate || null],
    );
    await client.query(`UPDATE assets SET status = 'ALLOCATED', updated_at = now() WHERE id = $1`, [assetId]);
    await client.query('COMMIT');

    const created = await query<AllocRow>(`${ALLOC_SELECT} WHERE al.id = $1`, [inserted.rows[0].id]);
    logActivity(req.user!.userId, 'ALLOCATION', 'ALLOCATION', inserted.rows[0].id,
      `Allocated ${asset.rows[0].tag} (${asset.rows[0].name}) to ${holder.rows[0].name}`);
    notify(holderId, 'ALLOCATION', 'Asset allocated to you',
      `${asset.rows[0].tag} — ${asset.rows[0].name} has been allocated to you.`, 'ALLOCATION', inserted.rows[0].id);
    return ok(res, 201, 'Asset allocated', { allocation: publicAlloc(created.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/allocations/:id/approve — approve a PENDING request (AM, or Dept Head of holder's dept).
allocationsRouter.post('/:id/approve', requireRole('ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Allocation not found');
    await client.query('BEGIN');
    const row = await client.query<{ status: string; asset_id: string; holder_id: string; holder_dept: string | null }>(
      `SELECT al.status, al.asset_id, al.holder_id, u.department_id AS holder_dept
       FROM allocations al JOIN users u ON u.id = al.holder_id WHERE al.id = $1 FOR UPDATE`,
      [id],
    );
    if (!row.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, 'Allocation not found'); }
    if (req.user!.role === 'DEPT_HEAD' && row.rows[0].holder_dept !== req.user!.departmentId) {
      await client.query('ROLLBACK');
      return fail(res, 403, 'This record is outside your department');
    }
    if (row.rows[0].status !== 'PENDING') {
      await client.query('ROLLBACK');
      return fail(res, 400, 'Only pending allocations can be approved');
    }
    await client.query(
      `UPDATE allocations SET status = 'ACTIVE', approved_by = $2 WHERE id = $1`,
      [id, req.user!.userId],
    );
    await client.query(`UPDATE assets SET status = 'ALLOCATED', updated_at = now() WHERE id = $1`, [row.rows[0].asset_id]);
    await client.query('COMMIT');
    logActivity(req.user!.userId, 'ALLOCATION', 'ALLOCATION', id, 'Approved allocation request');
    notify(row.rows[0].holder_id, 'ALLOCATION', 'Allocation approved', 'Your allocation request was approved.', 'ALLOCATION', id);
    return ok(res, 200, 'Allocation approved', { allocation: { id, status: 'ACTIVE' } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/allocations/:id/return — holder initiates return with condition check-in.
allocationsRouter.post('/:id/return', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Allocation not found');
    const row = await query<{ holder_id: string; status: string; asset_id: string }>(
      'SELECT holder_id, status, asset_id FROM allocations WHERE id = $1',
      [id],
    );
    if (!row.rowCount) return fail(res, 404, 'Allocation not found');
    if (row.rows[0].holder_id !== req.user!.userId) return fail(res, 403, 'Only the current holder can initiate a return');
    if (row.rows[0].status !== 'ACTIVE') return fail(res, 400, 'Only active allocations can be returned');

    await query(
      `UPDATE allocations SET status = 'RETURN_REQUESTED', return_requested_at = now(),
              condition_on_return = $2, return_notes = $3 WHERE id = $1`,
      [id, req.body.condition ?? 'GOOD', req.body.notes ?? null],
    );
    logActivity(req.user!.userId, 'RETURN', 'ALLOCATION', id, 'Initiated asset return');
    return ok(res, 200, 'Return requested — awaiting Asset Manager approval', {
      allocation: { id, status: 'RETURN_REQUESTED' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/allocations/:id/return/approve — Asset Manager confirms check-in.
allocationsRouter.post('/:id/return/approve', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Allocation not found');
    await client.query('BEGIN');
    const row = await client.query<{ status: string; asset_id: string; holder_id: string }>(
      'SELECT status, asset_id, holder_id FROM allocations WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!row.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, 'Allocation not found'); }
    if (row.rows[0].status !== 'RETURN_REQUESTED') {
      await client.query('ROLLBACK');
      return fail(res, 400, 'No pending return on this allocation');
    }
    await client.query(
      `UPDATE allocations SET status = 'RETURNED', returned_at = now(), approved_by = $2 WHERE id = $1`,
      [id, req.user!.userId],
    );
    await client.query(`UPDATE assets SET status = 'AVAILABLE', updated_at = now() WHERE id = $1`, [row.rows[0].asset_id]);
    await client.query('COMMIT');
    logActivity(req.user!.userId, 'RETURN', 'ALLOCATION', id, 'Approved asset return');
    notify(row.rows[0].holder_id, 'RETURN', 'Return approved', 'Your asset return was approved and checked in.', 'ALLOCATION', id);
    return ok(res, 200, 'Return approved — asset is Available again', { allocation: { id, status: 'RETURNED' } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});
