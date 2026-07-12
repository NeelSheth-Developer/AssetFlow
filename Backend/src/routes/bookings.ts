import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { scopeByUserColumn } from '../lib/scope.js';
import { logActivity } from '../lib/activity.js';
import { notify } from '../lib/notify.js';

export const resourcesRouter = Router();
export const bookingsRouter = Router();
resourcesRouter.use(requireAuth);
bookingsRouter.use(requireAuth);

interface BookingRow {
  id: string;
  start_ts: string;
  end_ts: string;
  purpose: string | null;
  status: string;
  series_id: string | null;
  attendees: unknown;
  created_at: string;
  resource_id: string;
  resource_name: string;
  resource_tag: string;
  booked_by_id: string;
  booked_by_name: string;
}

const BOOKING_SELECT = `
  SELECT b.id, b.start_ts, b.end_ts, b.purpose, b.status, b.series_id, b.attendees, b.created_at,
         a.id AS resource_id, a.name AS resource_name, a.tag AS resource_tag,
         u.id AS booked_by_id, u.name AS booked_by_name
  FROM bookings b
  JOIN assets a ON a.id = b.resource_id
  JOIN users u ON u.id = b.booked_by`;

function derivedStatus(b: BookingRow): string {
  if (b.status === 'CANCELLED') return 'CANCELLED';
  const now = Date.now();
  if (now < new Date(b.start_ts).getTime()) return 'UPCOMING';
  if (now <= new Date(b.end_ts).getTime()) return 'ONGOING';
  return 'COMPLETED';
}

const publicBooking = (b: BookingRow) => ({
  id: b.id,
  resource: { id: b.resource_id, tag: b.resource_tag, name: b.resource_name },
  bookedBy: { id: b.booked_by_id, name: b.booked_by_name },
  start: b.start_ts,
  end: b.end_ts,
  purpose: b.purpose,
  attendees: b.attendees,
  seriesId: b.series_id,
  status: derivedStatus(b),
  createdAt: b.created_at,
});

// Accepts { start, end } ISO or { date, startTime, endTime } ("2026-07-14", "09:30").
function parseRange(body: Record<string, unknown>): { start: Date; end: Date } | null {
  let start: Date, end: Date;
  if (body.start && body.end) {
    start = new Date(String(body.start));
    end = new Date(String(body.end));
  } else if (body.date && body.startTime && body.endTime) {
    start = new Date(`${body.date}T${body.startTime}:00`);
    end = new Date(`${body.date}T${body.endTime}:00`);
  } else {
    return null;
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return { start, end };
}

async function findConflict(resourceId: string, start: Date, end: Date, excludeId?: string) {
  const params: unknown[] = [resourceId, start.toISOString(), end.toISOString()];
  let exclude = '';
  if (excludeId) { params.push(excludeId); exclude = `AND b.id <> $${params.length}`; }
  const result = await query<BookingRow>(
    `${BOOKING_SELECT}
     WHERE b.resource_id = $1 AND b.status = 'CONFIRMED' ${exclude}
       AND b.start_ts < $3 AND b.end_ts > $2
     ORDER BY b.start_ts LIMIT 1`,
    params,
  );
  return result.rows[0] ?? null;
}

/* ---------------- resources ---------------- */

// GET /api/resources — bookable assets (Screen 6 picker).
resourcesRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, tag, name, location, status FROM assets
       WHERE is_bookable = TRUE AND status NOT IN ('RETIRED','DISPOSED','LOST')
       ORDER BY name`,
    );
    return ok(res, 200, 'Resources fetched', { resources: rows.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/resources/:id/calendar?from=&to=
resourcesRouter.get('/:id/calendar', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Resource not found');
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 7 * 86_400_000);
    const rows = await query<BookingRow>(
      `${BOOKING_SELECT}
       WHERE b.resource_id = $1 AND b.status = 'CONFIRMED' AND b.start_ts < $3 AND b.end_ts > $2
       ORDER BY b.start_ts`,
      [req.params.id, from.toISOString(), to.toISOString()],
    );
    return ok(res, 200, 'Calendar fetched', { bookings: rows.rows.map(publicBooking) });
  } catch (error) {
    next(error);
  }
});

// GET /api/resources/:id/availability?date= — free slots (09:00–18:00 hour grid).
resourcesRouter.get('/:id/availability', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Resource not found');
    const date = String(req.query.date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 400, 'date (YYYY-MM-DD) is required');
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    const rows = await query<{ start_ts: string; end_ts: string }>(
      `SELECT start_ts, end_ts FROM bookings
       WHERE resource_id = $1 AND status = 'CONFIRMED' AND start_ts < $3 AND end_ts > $2
       ORDER BY start_ts`,
      [req.params.id, dayStart.toISOString(), dayEnd.toISOString()],
    );
    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      const s = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
      const e = new Date(`${date}T${String(hour + 1).padStart(2, '0')}:00:00`);
      const busy = rows.rows.some((b) => new Date(b.start_ts) < e && new Date(b.end_ts) > s);
      slots.push({ start: `${String(hour).padStart(2, '0')}:00`, end: `${String(hour + 1).padStart(2, '0')}:00`, available: !busy });
    }
    return ok(res, 200, 'Availability fetched', { date, slots });
  } catch (error) {
    next(error);
  }
});

/* ---------------- bookings ---------------- */

// GET /api/bookings — scoped list. Filters: resourceId, status, date.
bookingsRouter.get('/', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    const filters: string[] = [];
    const scope = scopeByUserColumn(req, 'b.booked_by', params);
    if (scope) filters.push(scope);
    if (isUuid(req.query.resourceId)) { params.push(req.query.resourceId); filters.push(`b.resource_id = $${params.length}`); }
    const date = String(req.query.date ?? '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      params.push(date);
      filters.push(`b.start_ts::date = $${params.length}::date`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query<BookingRow>(`${BOOKING_SELECT} ${where} ORDER BY b.start_ts DESC LIMIT 200`, params);
    let bookings = rows.rows.map(publicBooking);
    const status = String(req.query.status ?? '');
    if (['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      bookings = bookings.filter((b) => b.status === status);
    }
    return ok(res, 200, 'Bookings fetched', { bookings });
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings/my — the current user's bookings.
bookingsRouter.get('/my', async (req, res, next) => {
  try {
    const rows = await query<BookingRow>(
      `${BOOKING_SELECT} WHERE b.booked_by = $1 ORDER BY b.start_ts DESC LIMIT 100`,
      [req.user!.userId],
    );
    return ok(res, 200, 'Your bookings fetched', { bookings: rows.rows.map(publicBooking) });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/check-availability — real-time overlap validation.
bookingsRouter.post('/check-availability', async (req, res, next) => {
  try {
    const resourceId = req.body.resourceId;
    if (!isUuid(resourceId)) return fail(res, 404, 'Resource not found');
    const range = parseRange(req.body);
    if (!range) return fail(res, 400, 'Provide start/end (ISO) or date + startTime + endTime');

    const conflict = await findConflict(resourceId, range.start, range.end);
    if (!conflict) return ok(res, 200, 'Slot is available', { available: true });

    // Suggest other free resources for the same window.
    const others = await query<{ id: string; name: string }>(
      `SELECT id, name FROM assets
       WHERE is_bookable = TRUE AND id <> $1 AND status NOT IN ('RETIRED','DISPOSED','LOST')
         AND id NOT IN (
           SELECT resource_id FROM bookings
           WHERE status = 'CONFIRMED' AND start_ts < $3 AND end_ts > $2
         )
       LIMIT 3`,
      [resourceId, range.start.toISOString(), range.end.toISOString()],
    );
    return ok(res, 200, 'Slot conflicts with existing booking', {
      available: false,
      conflict: { bookedBy: conflict.booked_by_name, start: conflict.start_ts, end: conflict.end_ts },
      alternatives: others.rows.map((r) => ({ resourceId: r.id, resourceName: r.name })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings — create (conflict-checked).
bookingsRouter.post('/', async (req, res, next) => {
  try {
    const resourceId = req.body.resourceId;
    if (!isUuid(resourceId)) return fail(res, 404, 'Resource not found');
    const resource = await query<{ is_bookable: boolean; name: string }>(
      'SELECT is_bookable, name FROM assets WHERE id = $1',
      [resourceId],
    );
    if (!resource.rowCount) return fail(res, 404, 'Resource not found');
    if (!resource.rows[0].is_bookable) return fail(res, 400, 'This asset is not bookable');
    const range = parseRange(req.body);
    if (!range) return fail(res, 400, 'Provide start/end (ISO) or date + startTime + endTime');

    const conflict = await findConflict(resourceId, range.start, range.end);
    if (conflict) return fail(res, 409, 'Requested slot conflicts with an existing booking');

    const inserted = await query<{ id: string }>(
      `INSERT INTO bookings (resource_id, booked_by, start_ts, end_ts, purpose, attendees)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [resourceId, req.user!.userId, range.start.toISOString(), range.end.toISOString(),
       req.body.purpose ?? null, JSON.stringify(req.body.attendees ?? [])],
    );
    const created = await query<BookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [inserted.rows[0].id]);
    logActivity(req.user!.userId, 'BOOKING', 'BOOKING', inserted.rows[0].id, `Booked ${resource.rows[0].name}`);
    return ok(res, 201, 'Booking created', { booking: publicBooking(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/recurring — weekly/daily series between startDate and endDate.
bookingsRouter.post('/recurring', async (req, res, next) => {
  try {
    const resourceId = req.body.resourceId;
    if (!isUuid(resourceId)) return fail(res, 404, 'Resource not found');
    const frequency = String(req.body.frequency ?? 'WEEKLY').toUpperCase();
    if (!['DAILY', 'WEEKLY'].includes(frequency)) return fail(res, 400, 'frequency must be DAILY or WEEKLY');
    const { startDate, endDate, startTime, endTime } = req.body;
    if (!startDate || !endDate || !startTime || !endTime) {
      return fail(res, 400, 'startDate, endDate, startTime and endTime are required');
    }
    const first = new Date(`${startDate}T${startTime}:00`);
    const last = new Date(`${endDate}T23:59:59`);
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || last < first) {
      return fail(res, 400, 'Invalid date range');
    }

    const series = await query<{ id: string }>(
      `INSERT INTO booking_series (resource_id, frequency, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [resourceId, frequency, startDate, endDate, req.user!.userId],
    );

    const stepDays = frequency === 'DAILY' ? 1 : 7;
    let created = 0;
    const conflicts: string[] = [];
    for (let d = new Date(first); d <= last; d = new Date(d.getTime() + stepDays * 86_400_000)) {
      if (created + conflicts.length >= 60) break; // safety cap
      const dateStr = d.toISOString().slice(0, 10);
      const s = new Date(`${dateStr}T${startTime}:00`);
      const e = new Date(`${dateStr}T${endTime}:00`);
      if (await findConflict(resourceId, s, e)) {
        conflicts.push(dateStr);
        continue;
      }
      await query(
        `INSERT INTO bookings (resource_id, booked_by, series_id, start_ts, end_ts, purpose, attendees)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [resourceId, req.user!.userId, series.rows[0].id, s.toISOString(), e.toISOString(),
         req.body.purpose ?? null, JSON.stringify(req.body.attendees ?? [])],
      );
      created++;
    }
    logActivity(req.user!.userId, 'BOOKING', 'BOOKING', series.rows[0].id, `Created recurring booking (${created} slots)`);
    return ok(res, 201, `Recurring booking created (${created} slots)`, {
      seriesId: series.rows[0].id,
      bookingsCreated: created,
      conflicts,
    });
  } catch (error) {
    next(error);
  }
});

// Owner or Dept Head of the booker's department (Admin/AM bypass).
async function canManage(req: { user?: { userId: string; role: string; departmentId: string | null } }, b: BookingRow): Promise<boolean> {
  if (b.booked_by_id === req.user!.userId) return true;
  if (req.user!.role === 'ADMIN' || req.user!.role === 'ASSET_MANAGER') return true;
  if (req.user!.role === 'DEPT_HEAD' && req.user!.departmentId) {
    const booker = await query<{ department_id: string | null }>(
      'SELECT department_id FROM users WHERE id = $1',
      [b.booked_by_id],
    );
    return booker.rows[0]?.department_id === req.user!.departmentId;
  }
  return false;
}

// GET /api/bookings/:id
bookingsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Booking not found');
    const result = await query<BookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Booking not found');
    if (!(await canManage(req, result.rows[0]))) return fail(res, 403, 'Insufficient permissions');
    return ok(res, 200, 'Booking fetched', { booking: publicBooking(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/cancel
bookingsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Booking not found');
    const result = await query<BookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Booking not found');
    const b = result.rows[0];
    if (!(await canManage(req, b))) return fail(res, 403, 'Insufficient permissions');
    if (b.status === 'CANCELLED') return fail(res, 400, 'Booking is already cancelled');

    await query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`, [req.params.id]);
    logActivity(req.user!.userId, 'BOOKING', 'BOOKING', req.params.id, `Cancelled booking of ${b.resource_name}`);
    if (b.booked_by_id !== req.user!.userId) {
      notify(b.booked_by_id, 'BOOKING', 'Booking cancelled', `Your booking of ${b.resource_name} was cancelled.`, 'BOOKING', req.params.id);
    }
    return ok(res, 200, 'Booking cancelled', { booking: { id: req.params.id, status: 'CANCELLED' } });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/reschedule — re-runs the overlap check.
bookingsRouter.post('/:id/reschedule', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Booking not found');
    const result = await query<BookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Booking not found');
    const b = result.rows[0];
    if (!(await canManage(req, b))) return fail(res, 403, 'Insufficient permissions');
    if (b.status === 'CANCELLED') return fail(res, 400, 'Cannot reschedule a cancelled booking');
    const range = parseRange(req.body);
    if (!range) return fail(res, 400, 'Provide start/end (ISO) or date + startTime + endTime');

    const conflict = await findConflict(b.resource_id, range.start, range.end, req.params.id);
    if (conflict) return fail(res, 409, 'Requested slot conflicts with an existing booking');

    await query(`UPDATE bookings SET start_ts = $2, end_ts = $3 WHERE id = $1`, [
      req.params.id, range.start.toISOString(), range.end.toISOString(),
    ]);
    logActivity(req.user!.userId, 'BOOKING', 'BOOKING', req.params.id, `Rescheduled booking of ${b.resource_name}`);
    return ok(res, 200, 'Booking rescheduled', {
      booking: { id: req.params.id, start: range.start.toISOString(), end: range.end.toISOString(), status: 'UPCOMING' },
    });
  } catch (error) {
    next(error);
  }
});
