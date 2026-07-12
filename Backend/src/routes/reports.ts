import { Router, type Request } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Screen 9 — Reports. ADMIN / ASSET_MANAGER / DEPT_HEAD (dept heads scoped to their dept).
export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole('ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'));

function deptFilter(req: Request, column: string, params: unknown[]): string {
  if (req.user!.role === 'DEPT_HEAD' && req.user!.departmentId) {
    params.push(req.user!.departmentId);
    return `AND ${column} = $${params.length}`;
  }
  return '';
}

async function utilization(req: Request) {
  const params: unknown[] = [];
  const dept = deptFilter(req, 'a.department_id', params);
  const mostUsed = await query(
    `SELECT a.tag, a.name, COUNT(al.id) AS count
     FROM assets a JOIN allocations al ON al.asset_id = a.id
     WHERE TRUE ${dept} GROUP BY a.id ORDER BY count DESC LIMIT 5`,
    params,
  );
  const idle = await query(
    `SELECT a.tag, a.name,
            COALESCE((CURRENT_DATE - MAX(al.returned_at)::date), (CURRENT_DATE - a.created_at::date)) AS idle_days
     FROM assets a LEFT JOIN allocations al ON al.asset_id = a.id AND al.returned_at IS NOT NULL
     WHERE a.status = 'AVAILABLE' ${dept}
     GROUP BY a.id ORDER BY idle_days DESC LIMIT 5`,
    params,
  );
  return {
    mostUsed: mostUsed.rows.map((r) => ({ asset: `${r.tag} — ${r.name}`, count: Number(r.count) })),
    idle: idle.rows.map((r) => ({ asset: `${r.tag} — ${r.name}`, idleDays: Number(r.idle_days) })),
  };
}

async function maintenanceFrequency(req: Request) {
  const params: unknown[] = [];
  const dept = deptFilter(req, 'a.department_id', params);
  const rows = await query(
    `SELECT COALESCE(c.name, 'Uncategorised') AS category, COUNT(m.id) AS count
     FROM maintenance_requests m
     JOIN assets a ON a.id = m.asset_id
     LEFT JOIN categories c ON c.id = a.category_id
     WHERE TRUE ${dept} GROUP BY c.name ORDER BY count DESC`,
    params,
  );
  return { byCategory: rows.rows.map((r) => ({ category: r.category, count: Number(r.count) })) };
}

async function dueForMaintenance(req: Request) {
  const params: unknown[] = [];
  const dept = deptFilter(req, 'a.department_id', params);
  const rows = await query(
    `SELECT a.tag, a.name, COUNT(m.id) AS repair_count,
            (CURRENT_DATE - a.purchase_date) AS age_days
     FROM assets a LEFT JOIN maintenance_requests m ON m.asset_id = a.id
     WHERE a.status NOT IN ('RETIRED','DISPOSED','LOST') ${dept}
     GROUP BY a.id
     HAVING COUNT(m.id) >= 2 OR (a.purchase_date IS NOT NULL AND CURRENT_DATE - a.purchase_date > 1460)
     ORDER BY repair_count DESC LIMIT 20`,
    params,
  );
  return {
    dueOrNearingRetirement: rows.rows.map((r) => ({
      asset: `${r.tag} — ${r.name}`,
      note: Number(r.repair_count) >= 2
        ? `${r.repair_count} repairs on record`
        : `${Math.floor(Number(r.age_days) / 365)} years old`,
    })),
  };
}

async function allocationSummary(req: Request) {
  const params: unknown[] = [];
  const dept = deptFilter(req, 'u.department_id', params);
  const rows = await query(
    `SELECT COALESCE(d.name, 'Unassigned') AS department, COUNT(al.id) AS allocated_count
     FROM allocations al
     JOIN users u ON u.id = al.holder_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE al.status IN ('ACTIVE','RETURN_REQUESTED') ${dept}
     GROUP BY d.name ORDER BY allocated_count DESC`,
    params,
  );
  return { byDepartment: rows.rows.map((r) => ({ department: r.department, allocatedCount: Number(r.allocated_count) })) };
}

async function bookingHeatmap(_req: Request) {
  const rows = await query(
    `SELECT a.name AS resource, EXTRACT(HOUR FROM b.start_ts)::int AS hour, COUNT(*) AS bookings
     FROM bookings b JOIN assets a ON a.id = b.resource_id
     WHERE b.status = 'CONFIRMED'
     GROUP BY a.name, hour ORDER BY bookings DESC LIMIT 40`,
  );
  return {
    heatmap: rows.rows.map((r) => ({
      resource: r.resource,
      peakHour: `${String(r.hour).padStart(2, '0')}:00-${String(r.hour + 1).padStart(2, '0')}:00`,
      bookings: Number(r.bookings),
    })),
  };
}

const REPORTS: Record<string, (req: Request) => Promise<object>> = {
  'utilization': utilization,
  'maintenance-frequency': maintenanceFrequency,
  'due-for-maintenance': dueForMaintenance,
  'allocation-summary': allocationSummary,
  'booking-heatmap': bookingHeatmap,
};

for (const [name, run] of Object.entries(REPORTS)) {
  reportsRouter.get(`/${name}`, async (req, res, next) => {
    try {
      return ok(res, 200, `${name.replace(/-/g, ' ')} report fetched`, await run(req));
    } catch (error) {
      next(error);
    }
  });
}

// GET /api/reports/export?type=<report>&format=csv — CSV download.
reportsRouter.get('/export', async (req, res, next) => {
  try {
    const type = String(req.query.type ?? '');
    const format = String(req.query.format ?? 'csv');
    if (!REPORTS[type]) return fail(res, 400, `type must be one of: ${Object.keys(REPORTS).join(', ')}`);
    if (format !== 'csv') return fail(res, 400, 'Only format=csv is supported');

    const data = await REPORTS[type](req);
    // Flatten the first array property in the report into CSV rows.
    const [key, rows] = Object.entries(data).find(([, v]) => Array.isArray(v)) ?? ['data', []];
    const list = rows as Record<string, unknown>[];
    const headers = list.length ? Object.keys(list[0]) : [];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...list.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="assetflow-${type}-${key}.csv"`);
    return res.send(csv);
  } catch (error) {
    next(error);
  }
});
