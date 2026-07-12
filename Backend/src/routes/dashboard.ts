import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok } from '../lib/respond.js';
import { requireAuth } from '../middleware/auth.js';
import { scopeByUserColumn, scopeAssets } from '../lib/scope.js';

// Screen 2 — Dashboard. Scope everywhere: Employee → own, Dept Head → dept, Admin/AM → org.
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// GET /api/dashboard/kpis
dashboardRouter.get('/kpis', async (req, res, next) => {
  try {
    const aParams: unknown[] = [];
    const aScope = scopeAssets(req, 'a', aParams);
    const aWhere = aScope ? `AND ${aScope}` : '';
    const assets = await query<{ status: string; count: string }>(
      `SELECT a.status, COUNT(*) AS count FROM assets a WHERE TRUE ${aWhere} GROUP BY a.status`,
      aParams,
    );
    const byStatus = Object.fromEntries(assets.rows.map((r) => [r.status, Number(r.count)]));

    const alParams: unknown[] = [];
    const alScope = scopeByUserColumn(req, 'al.holder_id', alParams);
    const alWhere = alScope ? `AND ${alScope}` : '';
    const pendingReturns = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM allocations al
       WHERE al.status IN ('ACTIVE','RETURN_REQUESTED')
         AND al.expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 ${alWhere}`,
      alParams,
    );

    const mParams: unknown[] = [];
    const mScope = scopeByUserColumn(req, 'm.raised_by', mParams);
    const maintenance = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM maintenance_requests m
       WHERE m.status NOT IN ('RESOLVED','REJECTED') ${mScope ? `AND ${mScope}` : ''}`,
      mParams,
    );

    const bParams: unknown[] = [];
    const bScope = scopeByUserColumn(req, 'b.booked_by', bParams);
    const bookings = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM bookings b
       WHERE b.status = 'CONFIRMED' AND b.end_ts >= now() ${bScope ? `AND ${bScope}` : ''}`,
      bParams,
    );

    const tParams: unknown[] = [];
    let tWhere = '';
    if (req.user!.role === 'EMPLOYEE') {
      tParams.push(req.user!.userId);
      tWhere = `AND (t.from_user = $${tParams.length} OR t.to_user = $${tParams.length})`;
    } else if (req.user!.role === 'DEPT_HEAD' && req.user!.departmentId) {
      tParams.push(req.user!.departmentId);
      tWhere = `AND t.to_user IN (SELECT id FROM users WHERE department_id = $${tParams.length})`;
    }
    const transfers = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM transfer_requests t WHERE t.status = 'REQUESTED' ${tWhere}`,
      tParams,
    );

    return ok(res, 200, 'KPIs fetched', {
      assetsAvailable: byStatus.AVAILABLE ?? 0,
      assetsAllocated: byStatus.ALLOCATED ?? 0,
      underMaintenance: byStatus.UNDER_MAINTENANCE ?? 0,
      maintenanceOpen: Number(maintenance.rows[0].count),
      activeBookings: Number(bookings.rows[0].count),
      pendingTransfers: Number(transfers.rows[0].count),
      upcomingReturns: Number(pendingReturns.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/overdue — overdue returns + overdue (past, uncancelled) bookings.
dashboardRouter.get('/overdue', async (req, res, next) => {
  try {
    const alParams: unknown[] = [];
    const alScope = scopeByUserColumn(req, 'al.holder_id', alParams);
    const overdueReturns = await query(
      `SELECT a.tag AS asset_tag, a.name AS asset_name, u.name AS holder, al.expected_return_date,
              (CURRENT_DATE - al.expected_return_date) AS days_overdue
       FROM allocations al JOIN assets a ON a.id = al.asset_id JOIN users u ON u.id = al.holder_id
       WHERE al.status IN ('ACTIVE','RETURN_REQUESTED') AND al.expected_return_date < CURRENT_DATE
         ${alScope ? `AND ${alScope}` : ''}
       ORDER BY al.expected_return_date ASC LIMIT 20`,
      alParams,
    );
    return ok(res, 200, 'Overdue items fetched', {
      overdueReturns: overdueReturns.rows.map((r) => ({
        assetTag: r.asset_tag,
        assetName: r.asset_name,
        holder: r.holder,
        expectedReturnDate: r.expected_return_date,
        daysOverdue: Number(r.days_overdue),
      })),
      overdueBookings: [],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/activity-feed — recent activity timeline.
dashboardRouter.get('/activity-feed', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const params: unknown[] = [];
    const scope = scopeByUserColumn(req, 'l.actor_id', params);
    params.push(limit);
    const rows = await query(
      `SELECT l.id, l.action_type, l.entity_type, l.entity_id, l.description, l.created_at,
              u.id AS actor_id, u.name AS actor_name
       FROM activity_logs l LEFT JOIN users u ON u.id = l.actor_id
       ${scope ? `WHERE ${scope}` : ''}
       ORDER BY l.created_at DESC LIMIT $${params.length}`,
      params,
    );
    return ok(res, 200, 'Activity feed fetched', {
      activities: rows.rows.map((a) => ({
        id: a.id,
        type: a.action_type,
        description: a.description,
        actor: a.actor_id ? { id: a.actor_id, name: a.actor_name } : null,
        entityType: a.entity_type,
        entityId: a.entity_id,
        createdAt: a.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/utilization-chart?days=30 — % of assets allocated per day.
dashboardRouter.get('/utilization-chart', async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const rows = await query<{ day: string; utilization: string }>(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day')::date AS day
       ),
       totals AS (
         SELECT COUNT(*)::numeric AS total FROM assets WHERE status NOT IN ('DISPOSED','RETIRED','LOST')
       )
       SELECT d.day::text AS day,
              CASE WHEN t.total = 0 THEN 0
                   ELSE ROUND(100.0 * (
                     SELECT COUNT(DISTINCT al.asset_id) FROM allocations al
                     WHERE al.allocated_at::date <= d.day
                       AND (al.returned_at IS NULL OR al.returned_at::date > d.day)
                       AND al.status <> 'REJECTED'
                   ) / t.total)
              END AS utilization
       FROM days d CROSS JOIN totals t ORDER BY d.day`,
      [days],
    );
    return ok(res, 200, 'Utilization data fetched', {
      dataPoints: rows.rows.map((r) => ({ date: r.day, utilization: Number(r.utilization) })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/upcoming-returns?limit=5
dashboardRouter.get('/upcoming-returns', async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const params: unknown[] = [];
    const scope = scopeByUserColumn(req, 'al.holder_id', params);
    params.push(limit);
    const rows = await query(
      `SELECT al.id, al.expected_return_date, a.tag, a.name AS asset_name, u.id AS holder_id, u.name AS holder_name
       FROM allocations al JOIN assets a ON a.id = al.asset_id JOIN users u ON u.id = al.holder_id
       WHERE al.status IN ('ACTIVE','RETURN_REQUESTED') AND al.expected_return_date IS NOT NULL
         ${scope ? `AND ${scope}` : ''}
       ORDER BY al.expected_return_date ASC LIMIT $${params.length}`,
      params,
    );
    return ok(res, 200, 'Upcoming returns fetched', {
      returns: rows.rows.map((r) => {
        const overdueDays = Math.floor((Date.now() - new Date(r.expected_return_date).getTime()) / 86_400_000);
        return {
          allocationId: r.id,
          asset: { tag: r.tag, name: r.asset_name },
          holder: { id: r.holder_id, name: r.holder_name },
          expectedReturnDate: r.expected_return_date,
          status: overdueDays > 0 ? 'OVERDUE' : 'ON_TIME',
          ...(overdueDays > 0 && { daysOverdue: overdueDays }),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/health-score — fleet health % (donut widget).
dashboardRouter.get('/health-score', async (_req, res, next) => {
  try {
    const stats = await query<{ total: string; available: string; open_maint: string; overdue: string; audited: string; audit_total: string }>(
      `SELECT
         (SELECT COUNT(*) FROM assets WHERE status NOT IN ('DISPOSED')) AS total,
         (SELECT COUNT(*) FROM assets WHERE status IN ('AVAILABLE','ALLOCATED')) AS available,
         (SELECT COUNT(*) FROM maintenance_requests WHERE status NOT IN ('RESOLVED','REJECTED')) AS open_maint,
         (SELECT COUNT(*) FROM allocations WHERE status IN ('ACTIVE','RETURN_REQUESTED') AND expected_return_date < CURRENT_DATE) AS overdue,
         (SELECT COUNT(*) FROM audit_items WHERE verification = 'VERIFIED') AS audited,
         (SELECT COUNT(*) FROM audit_items) AS audit_total`,
    );
    const s = stats.rows[0];
    const total = Number(s.total) || 1;
    const availableRatio = Number(s.available) / total;
    const maintenanceBacklog = Math.max(0, 1 - Number(s.open_maint) / total);
    const overdueRate = Number(s.overdue) / total;
    const auditCompliance = Number(s.audit_total) ? Number(s.audited) / Number(s.audit_total) : 1;
    const score = Math.round(
      100 * (0.4 * availableRatio + 0.25 * maintenanceBacklog + 0.2 * auditCompliance + 0.15 * (1 - overdueRate)),
    );
    return ok(res, 200, 'Health score fetched', {
      score,
      label: score >= 80 ? 'Good standing' : score >= 60 ? 'Needs attention' : 'At risk',
      breakdown: {
        availableRatio: Math.round(availableRatio * 100) / 100,
        maintenanceBacklog: Math.round(maintenanceBacklog * 100) / 100,
        auditCompliance: Math.round(auditCompliance * 100) / 100,
        overdueRate: Math.round(overdueRate * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
});
