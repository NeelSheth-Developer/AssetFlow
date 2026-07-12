/**
 * Seeds admins (spec §3.6), the demo accounts (spec §11), dummy employees,
 * departments, and categories. Idempotent — safe to re-run; it resets the
 * seeded accounts' passwords/roles/status to the documented values.
 */
import bcrypt from 'bcryptjs';
import { query, closeDb } from './neon.js';

type SeedUser = {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'ASSET_MANAGER' | 'DEPT_HEAD' | 'EMPLOYEE';
  dept?: string;
  status?: 'ACTIVE' | 'INACTIVE';
};

const USERS: SeedUser[] = [
  // Admins
  { name: 'System Admin', email: 'admin@assetflow.com', password: 'Admin@123', role: 'ADMIN' },
  { name: 'Neel Sheth', email: 'neelsheth708@gmail.com', password: 'Neel@123', role: 'ADMIN' },
  // Demo accounts (README §14)
  { name: 'Asset Manager', email: 'manager@assetflow.com', password: 'Manager@123', role: 'ASSET_MANAGER' },
  { name: 'Department Head', email: 'head@assetflow.com', password: 'Head@123', role: 'DEPT_HEAD', dept: 'Engineering' },
  { name: 'Employee', email: 'employee@assetflow.com', password: 'Employee@123', role: 'EMPLOYEE', dept: 'Engineering' },
  // Dummy directory data
  { name: 'Priya Shah', email: 'priya@assetflow.com', password: 'Priya@123', role: 'EMPLOYEE', dept: 'Engineering' },
  { name: 'Arjun Nair', email: 'arjun@assetflow.com', password: 'Arjun@123', role: 'EMPLOYEE', dept: 'Sales' },
  { name: 'Aditi Rao', email: 'aditi@assetflow.com', password: 'Aditi@123', role: 'DEPT_HEAD', dept: 'Sales' },
  { name: 'Rohan Verma', email: 'rohan@assetflow.com', password: 'Rohan@123', role: 'ASSET_MANAGER', dept: 'Operations' },
  { name: 'Sneha Iyer', email: 'sneha@assetflow.com', password: 'Sneha@123', role: 'EMPLOYEE', dept: 'Marketing' },
  { name: 'Vikram Joshi', email: 'vikram@assetflow.com', password: 'Vikram@123', role: 'EMPLOYEE', dept: 'Human Resources', status: 'INACTIVE' },
  { name: 'Kavya Menon', email: 'kavya@assetflow.com', password: 'Kavya@123', role: 'EMPLOYEE', dept: 'Operations' },
];

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Human Resources', 'Operations'];

// Department → head email (users.role must be DEPT_HEAD for these).
const HEADS: Record<string, string> = {
  Engineering: 'head@assetflow.com',
  Sales: 'aditi@assetflow.com',
};

const CATEGORIES: Array<{ name: string; fields: object[] }> = [
  {
    name: 'Electronics',
    fields: [
      { key: 'warrantyPeriod', label: 'Warranty Period (months)', type: 'number' },
      { key: 'serialNumber', label: 'Serial Number', type: 'text' },
    ],
  },
  { name: 'Furniture', fields: [{ key: 'material', label: 'Material', type: 'text' }] },
  {
    name: 'Vehicles',
    fields: [
      { key: 'registrationNo', label: 'Registration Number', type: 'text' },
      { key: 'serviceIntervalKm', label: 'Service Interval (km)', type: 'number' },
    ],
  },
  { name: 'Office Equipment', fields: [] },
  { name: 'Meeting Rooms', fields: [{ key: 'capacity', label: 'Capacity (people)', type: 'number' }] },
];

try {
  for (const name of DEPARTMENTS) {
    await query('INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
  console.log(`Departments: ${DEPARTMENTS.join(', ')}`);

  for (const cat of CATEGORIES) {
    await query(
      'INSERT INTO categories (name, custom_fields) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [cat.name, JSON.stringify(cat.fields)],
    );
  }
  console.log(`Categories: ${CATEGORIES.map((c) => c.name).join(', ')}`);

  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ($1, $2, $3, $4::user_role, $5::user_status,
               (SELECT id FROM departments WHERE name = $6))
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             status = EXCLUDED.status,
             department_id = EXCLUDED.department_id,
             updated_at = now()`,
      [user.name, user.email, passwordHash, user.role, user.status ?? 'ACTIVE', user.dept ?? null],
    );
    console.log(`Seeded ${user.role.padEnd(13)} ${user.email}${user.status === 'INACTIVE' ? ' (INACTIVE)' : ''}`);
  }

  for (const [dept, email] of Object.entries(HEADS)) {
    await query(
      `UPDATE departments SET head_id = (SELECT id FROM users WHERE email = $2) WHERE name = $1`,
      [dept, email],
    );
  }
  console.log('Department heads assigned.');

  /* ---------- module dummy data (Screens 2–10) ---------- */

  // Locations: one building, two floors, four rooms.
  const hasLocations = await query<{ count: string }>('SELECT COUNT(*) AS count FROM locations');
  if (!Number(hasLocations.rows[0].count)) {
    const loc = await query<{ id: string }>(
      `INSERT INTO locations (building, city) VALUES ('Nexora Tower, BKC', 'Mumbai') RETURNING id`,
    );
    for (const floorName of ['Floor 1', 'Floor 2']) {
      const floor = await query<{ id: string }>(
        `INSERT INTO floors (location_id, name) VALUES ($1, $2) RETURNING id`,
        [loc.rows[0].id, floorName],
      );
      const base = floorName === 'Floor 1' ? 101 : 201;
      for (const n of [base, base + 1]) {
        await query(`INSERT INTO rooms (floor_id, name) VALUES ($1, $2)`, [floor.rows[0].id, `Room ${n}`]);
      }
    }
    console.log('Locations seeded.');
  }

  // Assets — a spread of categories, departments, statuses, and two bookable resources.
  const ASSETS: Array<[tag: string, name: string, category: string, dept: string | null, bookable: boolean]> = [
    ['AF-0001', 'MacBook Pro M3', 'Electronics', 'Engineering', false],
    ['AF-0002', 'Dell XPS 15', 'Electronics', 'Engineering', false],
    ['AF-0003', 'iPad Pro 12.9', 'Electronics', 'Sales', false],
    ['AF-0004', 'Herman Miller Chair', 'Furniture', 'Engineering', false],
    ['AF-0005', 'Standing Desk', 'Furniture', 'Marketing', false],
    ['AF-0006', 'Projector Epson X41', 'Office Equipment', null, false],
    ['AF-0007', 'Conference Room B2', 'Meeting Rooms', null, true],
    ['AF-0008', 'Conference Room 3A', 'Meeting Rooms', null, true],
    ['AF-0009', 'Delivery Van MH-01', 'Vehicles', 'Operations', false],
    ['AF-0010', 'Canon EOS R6 Camera', 'Electronics', 'Marketing', false],
  ];
  for (const [tag, name, category, dept, bookable] of ASSETS) {
    await query(
      `INSERT INTO assets (tag, name, serial_no, category_id, department_id, is_bookable, location, purchase_date)
       VALUES ($1, $2, $3,
               (SELECT id FROM categories WHERE name = $4),
               (SELECT id FROM departments WHERE name = $5),
               $6, 'Nexora Tower, BKC — Mumbai', CURRENT_DATE - 700)
       ON CONFLICT (tag) DO NOTHING`,
      [tag, name, `NX-${tag}`, category, dept, bookable],
    );
  }
  console.log(`Assets: ${ASSETS.length} seeded.`);

  // Allocations: one active, one overdue, one returned.
  const hasAllocs = await query<{ count: string }>('SELECT COUNT(*) AS count FROM allocations');
  if (!Number(hasAllocs.rows[0].count)) {
    await query(`
      INSERT INTO allocations (asset_id, holder_id, allocated_by, purpose, status, expected_return_date, allocated_at)
      VALUES
        ((SELECT id FROM assets WHERE tag = 'AF-0001'), (SELECT id FROM users WHERE email = 'priya@assetflow.com'),
         (SELECT id FROM users WHERE email = 'manager@assetflow.com'), 'Development laptop', 'ACTIVE', CURRENT_DATE + 30, now() - INTERVAL '10 days'),
        ((SELECT id FROM assets WHERE tag = 'AF-0003'), (SELECT id FROM users WHERE email = 'arjun@assetflow.com'),
         (SELECT id FROM users WHERE email = 'manager@assetflow.com'), 'Client demos', 'ACTIVE', CURRENT_DATE - 3, now() - INTERVAL '40 days'),
        ((SELECT id FROM assets WHERE tag = 'AF-0002'), (SELECT id FROM users WHERE email = 'employee@assetflow.com'),
         (SELECT id FROM users WHERE email = 'manager@assetflow.com'), 'Temporary workstation', 'RETURNED', CURRENT_DATE - 20, now() - INTERVAL '60 days')`);
    await query(`UPDATE allocations SET returned_at = now() - INTERVAL '20 days' WHERE status = 'RETURNED'`);
    await query(`UPDATE assets SET status = 'ALLOCATED' WHERE tag IN ('AF-0001','AF-0003')`);
    console.log('Allocations seeded.');
  }

  // A pending transfer request.
  const hasTransfers = await query<{ count: string }>('SELECT COUNT(*) AS count FROM transfer_requests');
  if (!Number(hasTransfers.rows[0].count)) {
    await query(`
      INSERT INTO transfer_requests (asset_id, from_user, to_user, reason)
      VALUES ((SELECT id FROM assets WHERE tag = 'AF-0001'),
              (SELECT id FROM users WHERE email = 'priya@assetflow.com'),
              (SELECT id FROM users WHERE email = 'kavya@assetflow.com'),
              'Priya moving to a new project — laptop needed in Operations')`);
    console.log('Transfer request seeded.');
  }

  // Bookings: one today, one tomorrow on Room B2.
  const hasBookings = await query<{ count: string }>('SELECT COUNT(*) AS count FROM bookings');
  if (!Number(hasBookings.rows[0].count)) {
    await query(`
      INSERT INTO bookings (resource_id, booked_by, start_ts, end_ts, purpose)
      VALUES
        ((SELECT id FROM assets WHERE tag = 'AF-0007'), (SELECT id FROM users WHERE email = 'sneha@assetflow.com'),
         date_trunc('day', now()) + INTERVAL '14 hours', date_trunc('day', now()) + INTERVAL '15 hours', 'Marketing sync'),
        ((SELECT id FROM assets WHERE tag = 'AF-0007'), (SELECT id FROM users WHERE email = 'employee@assetflow.com'),
         date_trunc('day', now()) + INTERVAL '33 hours', date_trunc('day', now()) + INTERVAL '34 hours', 'Sprint planning')`);
    console.log('Bookings seeded.');
  }

  // Maintenance: one pending, one assigned to Kavya (technician), one resolved.
  const hasMaint = await query<{ count: string }>('SELECT COUNT(*) AS count FROM maintenance_requests');
  if (!Number(hasMaint.rows[0].count)) {
    await query(`
      INSERT INTO maintenance_requests (asset_id, raised_by, issue, issue_type, priority, status, technician_id, technician_name)
      VALUES
        ((SELECT id FROM assets WHERE tag = 'AF-0006'), (SELECT id FROM users WHERE email = 'sneha@assetflow.com'),
         'Projector bulb flickering', 'REPAIR', 'MEDIUM', 'PENDING', NULL, NULL),
        ((SELECT id FROM assets WHERE tag = 'AF-0009'), (SELECT id FROM users WHERE email = 'rohan@assetflow.com'),
         'AC compressor noisy on long routes', 'SERVICE', 'HIGH', 'TECHNICIAN_ASSIGNED',
         (SELECT id FROM users WHERE email = 'kavya@assetflow.com'), 'Kavya Menon'),
        ((SELECT id FROM assets WHERE tag = 'AF-0004'), (SELECT id FROM users WHERE email = 'priya@assetflow.com'),
         'Hydraulic lift not holding height', 'REPAIR', 'LOW', 'RESOLVED', NULL, 'External vendor')`);
    await query(`UPDATE maintenance_requests SET resolved_at = now() - INTERVAL '2 days', resolution_notes = 'Cylinder replaced' WHERE status = 'RESOLVED'`);
    await query(`
      INSERT INTO maintenance_comments (request_id, author_id, text)
      VALUES ((SELECT id FROM maintenance_requests WHERE status = 'TECHNICIAN_ASSIGNED' LIMIT 1),
              (SELECT id FROM users WHERE email = 'manager@assetflow.com'),
              'Technician assigned. ETA: 2 hours.')`);
    console.log('Maintenance requests seeded.');
  }

  // Audit cycle: org-wide, two auditors, a couple of items pre-marked.
  const hasAudits = await query<{ count: string }>('SELECT COUNT(*) AS count FROM audit_cycles');
  if (!Number(hasAudits.rows[0].count)) {
    const cycle = await query<{ id: string }>(`
      INSERT INTO audit_cycles (name, scope_type, start_date, end_date, created_by)
      VALUES ('Q3 2026 Full Audit', 'ALL', CURRENT_DATE - 7, CURRENT_DATE + 21,
              (SELECT id FROM users WHERE email = 'admin@assetflow.com')) RETURNING id`);
    await query(`
      INSERT INTO audit_items (cycle_id, asset_id, expected_location)
      SELECT $1, id, location FROM assets WHERE status <> 'DISPOSED'`, [cycle.rows[0].id]);
    await query(`
      INSERT INTO audit_cycle_auditors (cycle_id, user_id)
      SELECT $1, id FROM users WHERE email IN ('rohan@assetflow.com', 'priya@assetflow.com')`, [cycle.rows[0].id]);
    await query(`
      UPDATE audit_items SET verification = 'VERIFIED', verified_by = (SELECT id FROM users WHERE email = 'rohan@assetflow.com'), verified_at = now()
      WHERE cycle_id = $1 AND asset_id IN (SELECT id FROM assets WHERE tag IN ('AF-0001','AF-0004','AF-0007'))`, [cycle.rows[0].id]);
    await query(`
      UPDATE audit_items SET verification = 'MISSING', notes = 'Not found at expected location',
             verified_by = (SELECT id FROM users WHERE email = 'priya@assetflow.com'), verified_at = now()
      WHERE cycle_id = $1 AND asset_id = (SELECT id FROM assets WHERE tag = 'AF-0010')`, [cycle.rows[0].id]);
    console.log('Audit cycle seeded.');
  }

  // A few notifications + activity log entries so the feeds aren't empty.
  const hasActivity = await query<{ count: string }>('SELECT COUNT(*) AS count FROM activity_logs');
  if (!Number(hasActivity.rows[0].count)) {
    await query(`
      INSERT INTO activity_logs (actor_id, action_type, entity_type, description)
      VALUES
        ((SELECT id FROM users WHERE email = 'manager@assetflow.com'), 'ALLOCATION', 'ALLOCATION', 'Allocated AF-0001 (MacBook Pro M3) to Priya Shah'),
        ((SELECT id FROM users WHERE email = 'manager@assetflow.com'), 'ALLOCATION', 'ALLOCATION', 'Allocated AF-0003 (iPad Pro 12.9) to Arjun Nair'),
        ((SELECT id FROM users WHERE email = 'sneha@assetflow.com'), 'MAINTENANCE', 'MAINTENANCE', 'Raised maintenance request: Projector bulb flickering'),
        ((SELECT id FROM users WHERE email = 'admin@assetflow.com'), 'AUDIT', 'AUDIT_CYCLE', 'Created audit cycle "Q3 2026 Full Audit"'),
        ((SELECT id FROM users WHERE email = 'sneha@assetflow.com'), 'BOOKING', 'BOOKING', 'Booked Conference Room B2 for Marketing sync')`);
    await query(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES
        ((SELECT id FROM users WHERE email = 'priya@assetflow.com'), 'ALLOCATION', 'Asset allocated to you', 'AF-0001 — MacBook Pro M3 has been allocated to you.'),
        ((SELECT id FROM users WHERE email = 'arjun@assetflow.com'), 'RETURN', 'Return due soon', 'AF-0003 — iPad Pro 12.9 return is overdue by 3 days.'),
        ((SELECT id FROM users WHERE email = 'rohan@assetflow.com'), 'AUDIT', 'Audit assignment', 'You were assigned as an auditor on "Q3 2026 Full Audit".')`);
    console.log('Notifications + activity logs seeded.');
  }

  console.log('Seed complete.');
} finally {
  await closeDb();
}
