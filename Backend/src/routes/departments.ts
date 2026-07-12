import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Screen 3 — Organization Setup. Reads: any authenticated user.
// Writes: Admin only (spec §8).
export const departmentsRouter = Router();
departmentsRouter.use(requireAuth);

interface DeptRow {
  id: string;
  name: string;
  head_id: string | null;
  head_name: string | null;
  parent_id: string | null;
  status: string;
  created_at: string;
  employee_count: string;
  asset_count: string;
}

const publicDept = (d: DeptRow) => ({
  id: d.id,
  name: d.name,
  head: d.head_id ? { id: d.head_id, name: d.head_name } : null,
  parentId: d.parent_id,
  status: d.status,
  employeeCount: Number(d.employee_count),
  assetCount: Number(d.asset_count),
});

const DEPT_SELECT = `
  SELECT dep.id, dep.name, dep.head_id, h.name AS head_name, dep.parent_id, dep.status, dep.created_at,
         (SELECT COUNT(*) FROM users u WHERE u.department_id = dep.id) AS employee_count,
         (SELECT COUNT(*) FROM assets a WHERE a.department_id = dep.id) AS asset_count
  FROM departments dep LEFT JOIN users h ON h.id = dep.head_id`;

// GET /api/departments — list (any authenticated user).
departmentsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await query<DeptRow>(`${DEPT_SELECT} ORDER BY dep.name ASC`);
    return ok(res, 200, 'Departments fetched', { departments: result.rows.map(publicDept) });
  } catch (error) {
    next(error);
  }
});

// GET /api/departments/:id — detail (spec §13.1).
departmentsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Department not found');
    const result = await query<DeptRow>(`${DEPT_SELECT} WHERE dep.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Department not found');
    return ok(res, 200, 'Department fetched', { department: publicDept(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// GET /api/departments/:id/employees — members of a department (Screen 3 Tab A).
departmentsRouter.get('/:id/employees', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Department not found');
    const dept = await query('SELECT 1 FROM departments WHERE id = $1', [req.params.id]);
    if (!dept.rowCount) return fail(res, 404, 'Department not found');
    const rows = await query(
      `SELECT id, name, email, role, status, created_at FROM users
       WHERE department_id = $1 ORDER BY name`,
      [req.params.id],
    );
    return ok(res, 200, 'Department employees fetched', {
      employees: rows.rows.map((u) => ({
        id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/departments/:id/assets — assets owned by a department.
departmentsRouter.get('/:id/assets', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Department not found');
    const dept = await query('SELECT 1 FROM departments WHERE id = $1', [req.params.id]);
    if (!dept.rowCount) return fail(res, 404, 'Department not found');
    const rows = await query(
      `SELECT a.id, a.tag, a.name, a.status, a.condition, a.location, c.name AS category
       FROM assets a LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.department_id = $1 ORDER BY a.tag`,
      [req.params.id],
    );
    return ok(res, 200, 'Department assets fetched', { assets: rows.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/departments — Admin only.
departmentsRouter.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const headId = req.body.headId ?? null;
    const parentId = req.body.parentId ?? null;
    if (name.length < 2 || name.length > 100) return fail(res, 400, 'Name must be 2–100 characters');
    if (headId !== null && !isUuid(headId)) return fail(res, 404, 'User not found');
    if (parentId !== null && !isUuid(parentId)) return fail(res, 404, 'Department not found');

    try {
      const inserted = await query<{ id: string }>(
        `INSERT INTO departments (name, head_id, parent_id) VALUES ($1, $2, $3) RETURNING id`,
        [name, headId, parentId],
      );
      const created = await query<DeptRow>(`${DEPT_SELECT} WHERE dep.id = $1`, [inserted.rows[0].id]);
      req.log.info({ adminId: req.user!.userId, departmentId: inserted.rows[0].id }, 'Department created');
      return ok(res, 201, 'Department created', { department: publicDept(created.rows[0]) });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') return fail(res, 409, 'Department name already exists');
      if (code === '23503') return fail(res, 404, 'User not found');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// PATCH /api/departments/:id — Admin only; partial update.
departmentsRouter.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Department not found');

    const sets: string[] = [];
    const params: unknown[] = [id];
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 100) return fail(res, 400, 'Name must be 2–100 characters');
      params.push(name);
      sets.push(`name = $${params.length}`);
    }
    if (req.body.headId !== undefined) {
      const headId = req.body.headId ?? null;
      if (headId !== null && !isUuid(headId)) return fail(res, 404, 'User not found');
      params.push(headId);
      sets.push(`head_id = $${params.length}`);
    }
    if (req.body.parentId !== undefined) {
      const parentId = req.body.parentId ?? null;
      if (parentId !== null && !isUuid(parentId)) return fail(res, 404, 'Department not found');
      if (parentId === id) return fail(res, 400, 'A department cannot be its own parent');
      params.push(parentId);
      sets.push(`parent_id = $${params.length}`);
    }
    if (req.body.status !== undefined) {
      const status = String(req.body.status);
      if (status !== 'ACTIVE' && status !== 'INACTIVE') return fail(res, 400, 'Invalid status');
      params.push(status);
      sets.push(`status = $${params.length}`);
    }
    if (!sets.length) return fail(res, 400, 'Nothing to update');

    try {
      const updated = await query<{ id: string }>(
        `UPDATE departments SET ${sets.join(', ')} WHERE id = $1 RETURNING id`,
        params,
      );
      if (!updated.rowCount) return fail(res, 404, 'Department not found');
      const result = await query<DeptRow>(`${DEPT_SELECT} WHERE dep.id = $1`, [id]);
      req.log.info({ adminId: req.user!.userId, departmentId: id }, 'Department updated');
      return ok(res, 200, 'Department updated', { department: publicDept(result.rows[0]) });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') return fail(res, 409, 'Department name already exists');
      if (code === '23503') return fail(res, 404, 'User not found');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/departments/:id — Admin only. users.department_id is set NULL by the FK.
departmentsRouter.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Department not found');
    try {
      const deleted = await query('DELETE FROM departments WHERE id = $1', [id]);
      if (!deleted.rowCount) return fail(res, 404, 'Department not found');
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        return fail(res, 409, 'Department has child departments. Reassign them first.');
      }
      throw error;
    }
    req.log.info({ adminId: req.user!.userId, departmentId: id }, 'Department deleted');
    return ok(res, 200, 'Department deleted');
  } catch (error) {
    next(error);
  }
});
