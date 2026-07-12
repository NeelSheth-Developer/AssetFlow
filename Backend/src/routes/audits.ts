import { Router, type Request } from 'express';
import { query, getClient } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';
import { notify } from '../lib/notify.js';

export const auditsRouter = Router();
auditsRouter.use(requireAuth);

const VERIFICATIONS = ['PENDING', 'VERIFIED', 'DISCREPANCY', 'MISSING'];

interface CycleRow {
  id: string;
  name: string;
  scope_type: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  total: string;
  verified: string;
  discrepancy: string;
  missing: string;
}

const CYCLE_SELECT = `
  SELECT c.id, c.name, c.scope_type, c.start_date, c.end_date, c.status, c.created_at, c.closed_at,
         (SELECT COUNT(*) FROM audit_items i WHERE i.cycle_id = c.id) AS total,
         (SELECT COUNT(*) FROM audit_items i WHERE i.cycle_id = c.id AND i.verification = 'VERIFIED') AS verified,
         (SELECT COUNT(*) FROM audit_items i WHERE i.cycle_id = c.id AND i.verification = 'DISCREPANCY') AS discrepancy,
         (SELECT COUNT(*) FROM audit_items i WHERE i.cycle_id = c.id AND i.verification = 'MISSING') AS missing
  FROM audit_cycles c`;

const publicCycle = (c: CycleRow) => {
  const total = Number(c.total);
  const done = Number(c.verified) + Number(c.discrepancy) + Number(c.missing);
  return {
    id: c.id,
    name: c.name,
    scopeType: c.scope_type,
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status,
    createdAt: c.created_at,
    closedAt: c.closed_at,
    stats: {
      total,
      verified: Number(c.verified),
      discrepancy: Number(c.discrepancy),
      missing: Number(c.missing),
      pending: total - done,
      completionPercent: total ? Math.round((done / total) * 100) : 0,
    },
  };
};

async function isAssignedAuditor(cycleId: string, userId: string): Promise<boolean> {
  const result = await query('SELECT 1 FROM audit_cycle_auditors WHERE cycle_id = $1 AND user_id = $2', [cycleId, userId]);
  return Boolean(result.rowCount);
}

const canMarkItems = async (req: Request, cycleId: string): Promise<boolean> =>
  req.user!.role === 'ADMIN' || (await isAssignedAuditor(cycleId, req.user!.userId));

// GET /api/audit-cycles — Dept Head sees cycles covering their dept (or org-wide ones).
auditsRouter.get('/', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    let where = '';
    const status = String(req.query.status ?? '');
    const filters: string[] = [];
    if (req.user!.role === 'DEPT_HEAD' && req.user!.departmentId) {
      params.push(req.user!.departmentId);
      filters.push(`(c.scope_type = 'ALL' OR c.id IN (SELECT cycle_id FROM audit_cycle_departments WHERE department_id = $${params.length}))`);
    }
    if (['ACTIVE', 'CLOSED'].includes(status)) { params.push(status); filters.push(`c.status = $${params.length}`); }
    if (filters.length) where = `WHERE ${filters.join(' AND ')}`;
    const rows = await query<CycleRow>(`${CYCLE_SELECT} ${where} ORDER BY c.created_at DESC`, params);
    return ok(res, 200, 'Audit cycles fetched', { cycles: rows.rows.map(publicCycle) });
  } catch (error) {
    next(error);
  }
});

// POST /api/audit-cycles — Admin. Generates checklist items from assets in scope.
auditsRouter.post('/', requireRole('ADMIN'), async (req, res, next) => {
  const client = await getClient();
  try {
    const name = String(req.body.name ?? '').trim();
    if (name.length < 3) return fail(res, 400, 'name is required');
    const departmentIds = Array.isArray(req.body.departmentIds) ? req.body.departmentIds.filter(isUuid) : [];
    const scopeType = departmentIds.length ? 'DEPARTMENT' : 'ALL';

    await client.query('BEGIN');
    const cycle = await client.query<{ id: string }>(
      `INSERT INTO audit_cycles (name, scope_type, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, scopeType, req.body.startDate || null, req.body.endDate || null, req.user!.userId],
    );
    const cycleId = cycle.rows[0].id;
    for (const deptId of departmentIds) {
      await client.query('INSERT INTO audit_cycle_departments (cycle_id, department_id) VALUES ($1, $2)', [cycleId, deptId]);
    }
    // Snapshot the checklist from assets currently in scope.
    const items = await client.query<{ count: string }>(
      `WITH inserted AS (
         INSERT INTO audit_items (cycle_id, asset_id, expected_location)
         SELECT $1, a.id, a.location FROM assets a
         WHERE a.status NOT IN ('DISPOSED')
           AND ($2::uuid[] = '{}' OR a.department_id = ANY($2::uuid[]))
         RETURNING 1
       ) SELECT COUNT(*) AS count FROM inserted`,
      [cycleId, departmentIds],
    );
    await client.query('COMMIT');
    logActivity(req.user!.userId, 'AUDIT', 'AUDIT_CYCLE', cycleId, `Created audit cycle "${name}" (${items.rows[0].count} items)`);
    const created = await query<CycleRow>(`${CYCLE_SELECT} WHERE c.id = $1`, [cycleId]);
    return ok(res, 201, 'Audit cycle created', { cycle: publicCycle(created.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// GET /api/audit-cycles/:id — cycle detail + auditors.
auditsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Audit cycle not found');
    const result = await query<CycleRow>(`${CYCLE_SELECT} WHERE c.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Audit cycle not found');
    const auditors = await query(
      `SELECT u.id, u.name, u.email FROM audit_cycle_auditors aa JOIN users u ON u.id = aa.user_id WHERE aa.cycle_id = $1`,
      [req.params.id],
    );
    const departments = await query(
      `SELECT d.id, d.name FROM audit_cycle_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.cycle_id = $1`,
      [req.params.id],
    );
    return ok(res, 200, 'Audit cycle fetched', {
      cycle: { ...publicCycle(result.rows[0]), auditors: auditors.rows, departments: departments.rows },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/audit-cycles/:id/auditors — Admin assigns auditors ({ userIds: [] }).
auditsRouter.post('/:id/auditors', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Audit cycle not found');
    const cycle = await query<{ name: string }>('SELECT name FROM audit_cycles WHERE id = $1', [id]);
    if (!cycle.rowCount) return fail(res, 404, 'Audit cycle not found');
    const userIds = Array.isArray(req.body.userIds) ? req.body.userIds.filter(isUuid) : [];
    if (!userIds.length) return fail(res, 400, 'userIds must be a non-empty array');

    let added = 0;
    for (const userId of userIds) {
      const result = await query(
        `INSERT INTO audit_cycle_auditors (cycle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, userId],
      );
      if (result.rowCount) {
        added++;
        notify(userId, 'AUDIT', 'Audit assignment', `You were assigned as an auditor on "${cycle.rows[0].name}".`, 'AUDIT_CYCLE', id);
      }
    }
    logActivity(req.user!.userId, 'AUDIT', 'AUDIT_CYCLE', id, `Assigned ${added} auditor(s)`);
    return ok(res, 200, `${added} auditor(s) assigned`, { addedCount: added });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit-cycles/:id/items — the checklist. Filters: status, q.
auditsRouter.get('/:id/items', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Audit cycle not found');
    const params: unknown[] = [id];
    const filters = ['i.cycle_id = $1'];
    const status = String(req.query.status ?? '').toUpperCase();
    if (VERIFICATIONS.includes(status)) { params.push(status); filters.push(`i.verification = $${params.length}`); }
    const q = String(req.query.q ?? '').trim();
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(a.tag ILIKE $${params.length} OR a.name ILIKE $${params.length} OR a.serial_no ILIKE $${params.length})`);
    }
    const rows = await query(
      `SELECT i.id, i.expected_location, i.verification, i.notes, i.photo_url, i.verified_at,
              a.id AS asset_id, a.tag, a.name, a.serial_no, a.status AS asset_status,
              v.name AS verified_by_name
       FROM audit_items i
       JOIN assets a ON a.id = i.asset_id
       LEFT JOIN users v ON v.id = i.verified_by
       WHERE ${filters.join(' AND ')} ORDER BY a.tag`,
      params,
    );
    const counts = await query<{ verification: string; count: string }>(
      `SELECT verification, COUNT(*) AS count FROM audit_items WHERE cycle_id = $1 GROUP BY verification`,
      [id],
    );
    const byStatus = Object.fromEntries(counts.rows.map((r) => [r.verification, Number(r.count)]));
    return ok(res, 200, 'Audit items fetched', {
      items: rows.rows.map((i) => ({
        id: i.id,
        asset: { id: i.asset_id, tag: i.tag, name: i.name, serial: i.serial_no, status: i.asset_status },
        expectedLocation: i.expected_location,
        verification: i.verification,
        notes: i.notes,
        photo: i.photo_url,
        verifiedBy: i.verified_by_name,
        verifiedAt: i.verified_at,
      })),
      total: rows.rowCount,
      verified: byStatus.VERIFIED ?? 0,
      discrepancy: byStatus.DISCREPANCY ?? 0,
      missing: byStatus.MISSING ?? 0,
      pending: byStatus.PENDING ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/audit-cycles/:id/items/bulk-update — assigned auditor (or Admin).
auditsRouter.patch('/:id/items/bulk-update', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Audit cycle not found');
    if (!(await canMarkItems(req, id))) return fail(res, 403, 'Only an assigned auditor can mark items');
    const verification = String(req.body.verification ?? '').toUpperCase();
    if (!VERIFICATIONS.includes(verification) || verification === 'PENDING') {
      return fail(res, 400, 'verification must be VERIFIED, DISCREPANCY or MISSING');
    }
    const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds.filter(isUuid) : [];
    if (!itemIds.length) return fail(res, 400, 'itemIds must be a non-empty array');

    const updated = await query(
      `UPDATE audit_items SET verification = $3, notes = COALESCE($4, notes), verified_by = $5, verified_at = now()
       WHERE cycle_id = $1 AND id = ANY($2::uuid[])`,
      [id, itemIds, verification, req.body.notes ?? null, req.user!.userId],
    );
    logActivity(req.user!.userId, 'AUDIT', 'AUDIT_CYCLE', id, `Marked ${updated.rowCount} item(s) as ${verification}`);
    return ok(res, 200, `${updated.rowCount} items updated`, { updatedCount: updated.rowCount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/audit-cycles/:id/items/:itemId — mark a single item.
auditsRouter.patch('/:id/items/:itemId', async (req, res, next) => {
  try {
    const { id, itemId } = req.params;
    if (!isUuid(id) || !isUuid(itemId)) return fail(res, 404, 'Audit item not found');
    if (!(await canMarkItems(req, id))) return fail(res, 403, 'Only an assigned auditor can mark items');
    const verification = String(req.body.verification ?? '').toUpperCase();
    if (!VERIFICATIONS.includes(verification)) return fail(res, 400, 'Invalid verification value');

    const updated = await query(
      `UPDATE audit_items SET verification = $3, notes = $4, photo_url = COALESCE($5, photo_url),
              verified_by = $6, verified_at = now()
       WHERE cycle_id = $1 AND id = $2 RETURNING id`,
      [id, itemId, verification, req.body.notes ?? null, req.body.photoUrl ?? null, req.user!.userId],
    );
    if (!updated.rowCount) return fail(res, 404, 'Audit item not found');
    return ok(res, 200, 'Item updated', { item: { id: itemId, verification } });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit-cycles/:id/progress — totals + per-auditor breakdown.
auditsRouter.get('/:id/progress', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Audit cycle not found');
    const cycle = await query<CycleRow>(`${CYCLE_SELECT} WHERE c.id = $1`, [id]);
    if (!cycle.rowCount) return fail(res, 404, 'Audit cycle not found');
    const byAuditor = await query(
      `SELECT u.id, u.name, COUNT(i.id) AS completed
       FROM audit_cycle_auditors aa
       JOIN users u ON u.id = aa.user_id
       LEFT JOIN audit_items i ON i.verified_by = u.id AND i.cycle_id = aa.cycle_id
       WHERE aa.cycle_id = $1 GROUP BY u.id, u.name ORDER BY completed DESC`,
      [id],
    );
    const stats = publicCycle(cycle.rows[0]).stats;
    return ok(res, 200, 'Progress fetched', {
      ...stats,
      byAuditor: byAuditor.rows.map((a) => ({
        auditor: { id: a.id, name: a.name },
        completed: Number(a.completed),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit-cycles/:id/discrepancy-report — derived read over flagged rows.
auditsRouter.get('/:id/discrepancy-report', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Audit cycle not found');
    const rows = await query(
      `SELECT i.id, i.verification, i.notes, i.verified_at, a.tag, a.name, v.name AS verified_by
       FROM audit_items i JOIN assets a ON a.id = i.asset_id LEFT JOIN users v ON v.id = i.verified_by
       WHERE i.cycle_id = $1 AND i.verification IN ('DISCREPANCY','MISSING')
       ORDER BY i.verification, a.tag`,
      [id],
    );
    return ok(res, 200, 'Discrepancy report fetched', {
      flaggedCount: rows.rowCount,
      items: rows.rows.map((i) => ({
        assetTag: i.tag,
        assetName: i.name,
        verificationStatus: i.verification,
        notes: i.notes,
        verifiedBy: i.verified_by,
        verifiedAt: i.verified_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit-cycles/:id/summary — historical summary (esp. for closed cycles).
auditsRouter.get('/:id/summary', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Audit cycle not found');
    const cycle = await query<CycleRow>(`${CYCLE_SELECT} WHERE c.id = $1`, [id]);
    if (!cycle.rowCount) return fail(res, 404, 'Audit cycle not found');
    return ok(res, 200, 'Audit summary fetched', { summary: publicCycle(cycle.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// POST /api/audit-cycles/:id/close — Admin. Locks the cycle; MISSING items mark assets LOST.
auditsRouter.post('/:id/close', requireRole('ADMIN'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Audit cycle not found');
    await client.query('BEGIN');
    const cycle = await client.query<{ status: string; name: string }>(
      'SELECT status, name FROM audit_cycles WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!cycle.rowCount) { await client.query('ROLLBACK'); return fail(res, 404, 'Audit cycle not found'); }
    if (cycle.rows[0].status === 'CLOSED') { await client.query('ROLLBACK'); return fail(res, 400, 'Cycle is already closed'); }

    const lost = await client.query(
      `UPDATE assets SET status = 'LOST', updated_at = now()
       WHERE id IN (SELECT asset_id FROM audit_items WHERE cycle_id = $1 AND verification = 'MISSING')`,
      [id],
    );
    await client.query(`UPDATE audit_cycles SET status = 'CLOSED', closed_at = now() WHERE id = $1`, [id]);
    await client.query('COMMIT');
    logActivity(req.user!.userId, 'AUDIT', 'AUDIT_CYCLE', id,
      `Closed audit cycle "${cycle.rows[0].name}" (${lost.rowCount} asset(s) marked LOST)`);
    return ok(res, 200, 'Audit cycle closed', { cycle: { id, status: 'CLOSED', assetsMarkedLost: lost.rowCount } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});
