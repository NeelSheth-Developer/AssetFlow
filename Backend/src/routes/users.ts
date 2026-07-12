import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';
import type { Role } from '../lib/tokens.js';

// Screen 3, Tab C — Employee Directory. The ONLY place users.role is ever
// written by a request (spec §5). Everything below is Admin-only except
// PATCH /me/profile, which any authenticated user can call on themselves.
export const usersRouter = Router();
usersRouter.use(requireAuth);

// PATCH /api/users/me/profile — update own name / designation (never role).
usersRouter.patch('/me/profile', async (req, res, next) => {
  try {
    const sets: string[] = [];
    const params: unknown[] = [req.user!.userId];
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 100) return fail(res, 400, 'Name must be 2–100 characters');
      params.push(name);
      sets.push(`name = $${params.length}`);
    }
    if (req.body.designation !== undefined) {
      params.push(String(req.body.designation).trim() || null);
      sets.push(`designation = $${params.length}`);
    }
    if (!sets.length) return fail(res, 400, 'Nothing to update');
    sets.push('updated_at = now()');
    const updated = await query<{ id: string; name: string; designation: string | null }>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING id, name, designation`,
      params,
    );
    return ok(res, 200, 'Profile updated', { user: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

usersRouter.use(requireRole('ADMIN'));

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee',
  ASSET_MANAGER: 'Asset Manager',
  DEPT_HEAD: 'Department Head',
};
const ROLES: Role[] = ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'];

interface DirectoryRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  department_id: string | null;
  dept_name: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

// 5.1 GET /api/users — paginated directory with filters.
usersRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filters: string[] = [];
    const params: unknown[] = [];

    const q = String(req.query.q ?? '').trim();
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    const role = String(req.query.role ?? '');
    if (ROLES.includes(role as Role)) {
      params.push(role);
      filters.push(`u.role = $${params.length}::user_role`);
    }
    if (isUuid(req.query.departmentId)) {
      params.push(req.query.departmentId);
      filters.push(`u.department_id = $${params.length}`);
    }
    const status = String(req.query.status ?? '');
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      params.push(status);
      filters.push(`u.status = $${params.length}::user_status`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const total = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users u ${where}`,
      params,
    );
    const rows = await query<DirectoryRow>(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS dept_name, u.status, u.created_at
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );

    return ok(res, 200, 'Users fetched', {
      users: rows.rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department_id ? { id: u.department_id, name: u.dept_name } : null,
        status: u.status,
        createdAt: u.created_at,
      })),
      total: Number(total.rows[0].count),
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id/assets — assets currently held by a user (directory slide-out).
usersRouter.get('/:id/assets', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'User not found');
    const rows = await query(
      `SELECT a.id, a.tag, a.name, a.status, al.allocated_at, al.expected_return_date
       FROM allocations al JOIN assets a ON a.id = al.asset_id
       WHERE al.holder_id = $1 AND al.status IN ('ACTIVE','RETURN_REQUESTED')
       ORDER BY al.allocated_at DESC`,
      [req.params.id],
    );
    return ok(res, 200, 'User assets fetched', {
      assets: rows.rows.map((a) => ({
        id: a.id, tag: a.tag, name: a.name, status: a.status,
        allocatedAt: a.allocated_at, expectedReturnDate: a.expected_return_date,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id/activity — recent activity by a user (directory slide-out).
usersRouter.get('/:id/activity', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'User not found');
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const rows = await query(
      `SELECT id, action_type, entity_type, description, created_at
       FROM activity_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [req.params.id, limit],
    );
    return ok(res, 200, 'User activity fetched', {
      activities: rows.rows.map((a) => ({
        id: a.id, actionType: a.action_type, entityType: a.entity_type,
        description: a.description, createdAt: a.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// 5.2 PATCH /api/users/:id/role — the promotion feature. ADMIN is never accepted.
usersRouter.patch('/:id/role', async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = String(req.body.role ?? '');
    if (!isUuid(id)) return fail(res, 404, 'User not found');
    if (!(role in ROLE_LABELS)) return fail(res, 400, 'Invalid role');
    if (id === req.user!.userId) return fail(res, 403, 'You cannot change your own role');

    const target = await query<{ id: string; department_id: string | null }>(
      'SELECT id, department_id FROM users WHERE id = $1',
      [id],
    );
    if (!target.rowCount) return fail(res, 404, 'User not found');
    if (role === 'DEPT_HEAD' && !target.rows[0].department_id) {
      return fail(res, 400, 'Assign a department before promoting to Department Head');
    }

    const updated = await query<{ id: string; name: string; role: Role; department_id: string | null }>(
      `UPDATE users SET role = $2::user_role, updated_at = now()
       WHERE id = $1 RETURNING id, name, role, department_id`,
      [id, role],
    );
    const user = updated.rows[0];

    req.log.info({ adminId: req.user!.userId, userId: id, role }, 'Role updated');
    logActivity(req.user!.userId, 'USER_CHANGE', 'USER', id, `Changed ${user.name}'s role to ${ROLE_LABELS[role]}`);
    return ok(res, 200, `Role updated to ${ROLE_LABELS[role]}`, {
      user: { id: user.id, name: user.name, role: user.role, departmentId: user.department_id },
    });
  } catch (error) {
    next(error);
  }
});

// 5.3 PATCH /api/users/:id/department — assign or unassign (null) a department.
usersRouter.patch('/:id/department', async (req, res, next) => {
  try {
    const { id } = req.params;
    const departmentId = req.body.departmentId ?? null;
    if (!isUuid(id)) return fail(res, 404, 'User not found');
    if (departmentId !== null && !isUuid(departmentId)) return fail(res, 404, 'Department not found');

    const target = await query<{ id: string; role: Role }>('SELECT id, role FROM users WHERE id = $1', [id]);
    if (!target.rowCount) return fail(res, 404, 'User not found');
    if (departmentId === null && target.rows[0].role === 'DEPT_HEAD') {
      return fail(res, 400, 'Cannot unassign department from a Department Head');
    }

    let deptName: string | null = null;
    if (departmentId) {
      const dept = await query<{ name: string }>('SELECT name FROM departments WHERE id = $1', [departmentId]);
      if (!dept.rowCount) return fail(res, 404, 'Department not found');
      deptName = dept.rows[0].name;
    }

    const updated = await query<{ id: string; department_id: string | null }>(
      `UPDATE users SET department_id = $2, updated_at = now() WHERE id = $1 RETURNING id, department_id`,
      [id, departmentId],
    );
    const user = updated.rows[0];

    req.log.info({ adminId: req.user!.userId, userId: id, departmentId }, 'Department updated');
    return ok(res, 200, 'Department updated', {
      user: {
        id: user.id,
        departmentId: user.department_id,
        department: user.department_id ? { id: user.department_id, name: deptName } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 5.4 PATCH /api/users/:id/status — deactivating revokes ALL refresh tokens.
usersRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = String(req.body.status ?? '');
    if (!isUuid(id)) return fail(res, 404, 'User not found');
    if (status !== 'ACTIVE' && status !== 'INACTIVE') return fail(res, 400, 'Invalid status');
    if (id === req.user!.userId) return fail(res, 403, 'You cannot deactivate yourself');

    const updated = await query<{ id: string; status: string }>(
      `UPDATE users SET status = $2::user_status, updated_at = now() WHERE id = $1 RETURNING id, status`,
      [id, status],
    );
    if (!updated.rowCount) return fail(res, 404, 'User not found');

    if (status === 'INACTIVE') {
      // Their access token dies within 15 minutes and cannot be renewed.
      await query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [id],
      );
    }

    req.log.info({ adminId: req.user!.userId, userId: id, status }, 'User status updated');
    logActivity(req.user!.userId, 'USER_CHANGE', 'USER', id,
      status === 'INACTIVE' ? 'Deactivated a user account' : 'Reactivated a user account');
    return ok(res, 200, status === 'INACTIVE' ? 'User deactivated' : 'User activated', {
      user: { id: updated.rows[0].id, status: updated.rows[0].status },
    });
  } catch (error) {
    next(error);
  }
});
