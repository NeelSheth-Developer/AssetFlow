/**
 * Seeds admins (spec §3.6), the demo accounts (spec §11), departments,
 * categories — idempotent upserts — and then rebuilds a rich, internally
 * consistent demo dataset for every module (Screens 2–10).
 *
 * Module tables (assets, allocations, transfers, bookings, maintenance,
 * audits, notifications, activity logs, locations) are WIPED and re-created
 * on every run so the demo data always matches this file. Auth data
 * (users, refresh tokens, OTPs) is never touched.
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
  { name: 'System Admin', email: 'admin@assetflow.com', password: 'Admin@123', role: 'ADMIN' },
  { name: 'Neel Sheth', email: 'neelsheth708@gmail.com', password: 'Neel@123', role: 'ADMIN' },
  { name: 'Asset Manager', email: 'manager@assetflow.com', password: 'Manager@123', role: 'ASSET_MANAGER' },
  { name: 'Department Head', email: 'head@assetflow.com', password: 'Head@123', role: 'DEPT_HEAD', dept: 'Engineering' },
  { name: 'Employee', email: 'employee@assetflow.com', password: 'Employee@123', role: 'EMPLOYEE', dept: 'Engineering' },
  { name: 'Priya Shah', email: 'priya@assetflow.com', password: 'Priya@123', role: 'EMPLOYEE', dept: 'Engineering' },
  { name: 'Arjun Nair', email: 'arjun@assetflow.com', password: 'Arjun@123', role: 'EMPLOYEE', dept: 'Sales' },
  { name: 'Aditi Rao', email: 'aditi@assetflow.com', password: 'Aditi@123', role: 'DEPT_HEAD', dept: 'Sales' },
  { name: 'Rohan Verma', email: 'rohan@assetflow.com', password: 'Rohan@123', role: 'ASSET_MANAGER', dept: 'Operations' },
  { name: 'Sneha Iyer', email: 'sneha@assetflow.com', password: 'Sneha@123', role: 'EMPLOYEE', dept: 'Marketing' },
  { name: 'Vikram Joshi', email: 'vikram@assetflow.com', password: 'Vikram@123', role: 'EMPLOYEE', dept: 'Human Resources', status: 'INACTIVE' },
  { name: 'Kavya Menon', email: 'kavya@assetflow.com', password: 'Kavya@123', role: 'EMPLOYEE', dept: 'Operations' },
  { name: 'Rohit Joshi', email: 'rohit@assetflow.com', password: 'Rohit@123', role: 'EMPLOYEE', dept: 'Sales' },
  { name: 'Meera Kulkarni', email: 'meera@assetflow.com', password: 'Meera@123', role: 'EMPLOYEE', dept: 'Human Resources' },
];

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Human Resources', 'Operations'];
const HEADS: Record<string, string> = { Engineering: 'head@assetflow.com', Sales: 'aditi@assetflow.com' };

const CATEGORIES: Array<{ name: string; icon: string; fields: object[] }> = [
  {
    name: 'Electronics', icon: 'laptop',
    fields: [
      { id: 'f-el-1', key: 'warrantyPeriod', label: 'Warranty Period (months)', type: 'number', required: true },
      { id: 'f-el-2', key: 'serialNumber', label: 'Serial Number', type: 'text', required: false },
    ],
  },
  { name: 'Furniture', icon: 'armchair', fields: [{ id: 'f-fu-1', key: 'material', label: 'Material', type: 'text', required: false }] },
  {
    name: 'Vehicles', icon: 'truck',
    fields: [
      { id: 'f-ve-1', key: 'registrationNo', label: 'Registration Number', type: 'text', required: true },
      { id: 'f-ve-2', key: 'fuelType', label: 'Fuel Type', type: 'select', required: true, options: ['Petrol', 'Diesel', 'Electric'] },
    ],
  },
  { name: 'Office Equipment', icon: 'printer', fields: [] },
  { name: 'Meeting Rooms', icon: 'users', fields: [{ id: 'f-mr-1', key: 'capacity', label: 'Capacity (people)', type: 'number', required: true }] },
];

// [tag, name, category, dept | null, status, bookable, condition, ageDays]
type SeedAsset = [string, string, string, string | null, string, boolean, string, number];
const ASSETS: SeedAsset[] = [
  ['AF-0001', 'MacBook Pro M3', 'Electronics', 'Engineering', 'ALLOCATED', false, 'GOOD', 400],
  ['AF-0002', 'Dell XPS 15', 'Electronics', 'Engineering', 'ALLOCATED', false, 'GOOD', 700],
  ['AF-0003', 'iPad Pro 12.9', 'Electronics', 'Sales', 'ALLOCATED', false, 'FAIR', 500],
  ['AF-0004', 'ThinkPad X1 Carbon', 'Electronics', 'Engineering', 'AVAILABLE', false, 'GOOD', 300],
  ['AF-0005', 'iPhone 15 Pro', 'Electronics', 'Sales', 'ALLOCATED', false, 'GOOD', 250],
  ['AF-0006', 'Samsung 32" Monitor', 'Electronics', 'Engineering', 'AVAILABLE', false, 'GOOD', 600],
  ['AF-0007', 'Canon EOS R6 Camera', 'Electronics', 'Marketing', 'LOST', false, 'GOOD', 800],
  ['AF-0008', 'Logitech MX Keyboard Set', 'Electronics', null, 'AVAILABLE', false, 'NEW', 90],
  ['AF-0009', 'Herman Miller Aeron Chair', 'Furniture', 'Engineering', 'ALLOCATED', false, 'GOOD', 1200],
  ['AF-0010', 'Standing Desk Pro', 'Furniture', 'Marketing', 'AVAILABLE', false, 'GOOD', 900],
  ['AF-0011', 'Ergonomic Chair Basic', 'Furniture', 'Human Resources', 'AVAILABLE', false, 'FAIR', 1500],
  ['AF-0012', 'Storage Cabinet Steel', 'Furniture', 'Operations', 'AVAILABLE', false, 'GOOD', 2000],
  ['AF-0013', 'Delivery Van MH-01-AB-4321', 'Vehicles', 'Operations', 'UNDER_MAINTENANCE', false, 'FAIR', 1600],
  ['AF-0014', 'Forklift Toyota 8FG', 'Vehicles', 'Operations', 'AVAILABLE', false, 'FAIR', 1800],
  ['AF-0015', 'Company Car Honda City', 'Vehicles', 'Sales', 'ALLOCATED', false, 'GOOD', 1000],
  ['AF-0016', 'Projector Epson X41', 'Office Equipment', null, 'UNDER_MAINTENANCE', false, 'FAIR', 1100],
  ['AF-0017', 'HP LaserJet Printer', 'Office Equipment', null, 'AVAILABLE', false, 'GOOD', 950],
  ['AF-0018', 'Paper Shredder Fellowes', 'Office Equipment', 'Human Resources', 'AVAILABLE', false, 'GOOD', 700],
  ['AF-0019', 'Xerox WorkCentre', 'Office Equipment', null, 'RETIRED', false, 'POOR', 2600],
  ['AF-0020', 'Conference Room B2', 'Meeting Rooms', null, 'AVAILABLE', true, 'GOOD', 2000],
  ['AF-0021', 'Conference Room 3A', 'Meeting Rooms', null, 'AVAILABLE', true, 'GOOD', 2000],
  ['AF-0022', 'Huddle Room H1', 'Meeting Rooms', null, 'AVAILABLE', true, 'GOOD', 1400],
  ['AF-0023', 'Training Hall T1', 'Meeting Rooms', null, 'AVAILABLE', true, 'GOOD', 2200],
  ['AF-0024', 'Dell Latitude 5440', 'Electronics', 'Human Resources', 'AVAILABLE', false, 'GOOD', 350],
];

const uid = async (email: string): Promise<string> => {
  const r = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  return r.rows[0].id;
};
const aid = async (tag: string): Promise<string> => {
  const r = await query<{ id: string }>('SELECT id FROM assets WHERE tag = $1', [tag]);
  return r.rows[0].id;
};

try {
  /* ---------- auth-side data (idempotent upserts, never wiped) ---------- */

  for (const name of DEPARTMENTS) {
    await query('INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
  for (const cat of CATEGORIES) {
    await query(
      `INSERT INTO categories (name, custom_fields, icon) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET custom_fields = EXCLUDED.custom_fields, icon = EXCLUDED.icon`,
      [cat.name, JSON.stringify(cat.fields), cat.icon],
    );
  }
  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ($1, $2, $3, $4::user_role, $5::user_status, (SELECT id FROM departments WHERE name = $6))
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
             status = EXCLUDED.status, department_id = EXCLUDED.department_id, updated_at = now()`,
      [user.name, user.email, passwordHash, user.role, user.status ?? 'ACTIVE', user.dept ?? null],
    );
  }
  for (const [dept, email] of Object.entries(HEADS)) {
    await query(`UPDATE departments SET head_id = (SELECT id FROM users WHERE email = $2) WHERE name = $1`, [dept, email]);
  }
  console.log(`Upserted ${USERS.length} users, ${DEPARTMENTS.length} departments, ${CATEGORIES.length} categories.`);

  /* ---------- module demo data (wiped and rebuilt every run) ---------- */

  await query(`TRUNCATE asset_documents, audit_items, audit_cycle_auditors, audit_cycle_departments,
               audit_cycles, maintenance_comments, maintenance_requests, bookings, booking_series,
               transfer_requests, allocations, notifications, activity_logs, assets, rooms, floors, locations`);
  console.log('Module tables cleared.');

  // Locations: two buildings.
  const buildings: Array<[string, string, Array<[string, string[]]>]> = [
    ['Nexora Tower, BKC', 'Mumbai', [['Floor 1', ['Room 101', 'Room 102']], ['Floor 2', ['Room 201', 'Room 202']]]],
    ['Innov8 Park', 'Bengaluru', [['Ground Floor', ['Room G1', 'Room G2']]]],
  ];
  for (const [building, city, floors] of buildings) {
    const loc = await query<{ id: string }>(`INSERT INTO locations (building, city) VALUES ($1, $2) RETURNING id`, [building, city]);
    for (const [floorName, rooms] of floors) {
      const floor = await query<{ id: string }>(`INSERT INTO floors (location_id, name) VALUES ($1, $2) RETURNING id`, [loc.rows[0].id, floorName]);
      for (const room of rooms) await query(`INSERT INTO rooms (floor_id, name) VALUES ($1, $2)`, [floor.rows[0].id, room]);
    }
  }
  console.log('Locations: 2 buildings, 3 floors, 6 rooms.');

  // Assets.
  const createdBy = await uid('manager@assetflow.com');
  for (const [tag, name, category, dept, status, bookable, condition, ageDays] of ASSETS) {
    const customValues =
      category === 'Electronics' ? { warrantyPeriod: 24, serialNumber: `NX-${tag}` } :
      category === 'Vehicles' ? { registrationNo: `MH-01-${tag.slice(-4)}`, fuelType: 'Diesel' } :
      category === 'Meeting Rooms' ? { capacity: tag === 'AF-0023' ? 40 : 8 } : {};
    await query(
      `INSERT INTO assets (tag, name, serial_no, category_id, department_id, status, condition,
                           is_bookable, location, purchase_date, purchase_cost, custom_values, created_by)
       VALUES ($1, $2, $3, (SELECT id FROM categories WHERE name = $4),
               (SELECT id FROM departments WHERE name = $5), $6, $7, $8,
               'Nexora Tower, BKC — Mumbai', CURRENT_DATE - $9::int, $10, $11, $12)`,
      [tag, name, `NX-${tag}`, category, dept, status, condition, bookable, ageDays,
       50000 + (ageDays % 7) * 12000, JSON.stringify(customValues), createdBy],
    );
  }
  await query(`UPDATE assets SET retirement = '{"reason":"End of life — repeated paper-feed failures","by":"seed"}'
               WHERE tag = 'AF-0019'`);
  console.log(`Assets: ${ASSETS.length} seeded.`);

  // Allocations — active, overdue, return-requested, pending, and history for the charts.
  const manager = await uid('manager@assetflow.com');
  type SeedAlloc = [tag: string, holder: string, status: string, allocatedDaysAgo: number, expectedInDays: number | null, returnedDaysAgo: number | null, purpose: string];
  const ALLOCS: SeedAlloc[] = [
    ['AF-0001', 'priya@assetflow.com', 'ACTIVE', 40, 30, null, 'Development laptop'],
    ['AF-0002', 'employee@assetflow.com', 'ACTIVE', 25, 60, null, 'Workstation'],
    ['AF-0003', 'arjun@assetflow.com', 'ACTIVE', 45, -3, null, 'Client demos'],            // overdue by 3 days
    ['AF-0005', 'rohit@assetflow.com', 'ACTIVE', 90, -12, null, 'Sales phone'],            // overdue by 12 days
    ['AF-0009', 'head@assetflow.com', 'ACTIVE', 200, 180, null, 'Office chair'],
    ['AF-0015', 'aditi@assetflow.com', 'RETURN_REQUESTED', 120, 7, null, 'Client visits'],
    ['AF-0004', 'kavya@assetflow.com', 'PENDING', 1, 30, null, 'Field ops laptop'],        // awaiting approval
    // History (returned) — spread out so the utilization chart has a trend.
    ['AF-0004', 'sneha@assetflow.com', 'RETURNED', 150, 100, 95, 'Campaign work'],
    ['AF-0006', 'priya@assetflow.com', 'RETURNED', 80, 40, 35, 'Second monitor'],
    ['AF-0010', 'sneha@assetflow.com', 'RETURNED', 60, 20, 15, 'Desk trial'],
    ['AF-0024', 'meera@assetflow.com', 'RETURNED', 30, 10, 5, 'Onboarding laptop'],
  ];
  for (const [tag, holder, status, agoDays, expectedInDays, returnedDaysAgo, purpose] of ALLOCS) {
    await query(
      `INSERT INTO allocations (asset_id, holder_id, allocated_by, purpose, status,
                                expected_return_date, allocated_at, returned_at, condition_on_return, return_notes, return_requested_at)
       VALUES ($1, $2, $3, $4, $5,
               CASE WHEN $6::int IS NULL THEN NULL ELSE CURRENT_DATE + $6::int END,
               now() - make_interval(days => $7),
               CASE WHEN $8::int IS NULL THEN NULL ELSE now() - make_interval(days => $8) END,
               CASE WHEN $5 = 'RETURNED' THEN 'GOOD' WHEN $5 = 'RETURN_REQUESTED' THEN 'FAIR' ELSE NULL END,
               CASE WHEN $5 = 'RETURN_REQUESTED' THEN 'Minor scratches on the boot lid' ELSE NULL END,
               CASE WHEN $5 = 'RETURN_REQUESTED' THEN now() - INTERVAL '1 day' ELSE NULL END)`,
      [await aid(tag), await uid(holder), manager, purpose, status, expectedInDays, agoDays, returnedDaysAgo],
    );
  }
  console.log(`Allocations: ${ALLOCS.length} seeded (2 overdue, 1 return-requested, 1 pending).`);

  // Transfers — one of each status.
  await query(
    `INSERT INTO transfer_requests (asset_id, from_user, to_user, reason, status, decided_by, decision_reason, created_at, decided_at)
     VALUES
       ($1, $2, $3, 'Priya moving to the platform team — laptop needed in Operations', 'REQUESTED', NULL, NULL, now() - INTERVAL '2 days', NULL),
       ($4, $5, $6, 'Arjun off the account — iPad goes to Rohit', 'REJECTED', $7, 'Asset still needed by current holder', now() - INTERVAL '10 days', now() - INTERVAL '9 days'),
       ($8, $9, $10, 'Workstation handover after team switch', 'APPROVED', $7, NULL, now() - INTERVAL '20 days', now() - INTERVAL '19 days')`,
    [
      await aid('AF-0001'), await uid('priya@assetflow.com'), await uid('kavya@assetflow.com'),
      await aid('AF-0003'), await uid('arjun@assetflow.com'), await uid('rohit@assetflow.com'),
      manager,
      await aid('AF-0002'), await uid('priya@assetflow.com'), await uid('employee@assetflow.com'),
    ],
  );
  console.log('Transfers: 3 seeded (requested / approved / rejected).');

  // Bookings — a busy week on the meeting rooms + one recurring series + one cancelled.
  const roomB2 = await aid('AF-0020');
  const room3A = await aid('AF-0021');
  const huddle = await aid('AF-0022');
  const series = await query<{ id: string }>(
    `INSERT INTO booking_series (resource_id, frequency, start_date, end_date, created_by)
     VALUES ($1, 'WEEKLY', CURRENT_DATE, CURRENT_DATE + 56, $2) RETURNING id`,
    [roomB2, await uid('employee@assetflow.com')],
  );
  type SeedBooking = [resource: string, booker: string, dayOffset: number, startHour: number, hours: number, purpose: string, status: string, seriesId: string | null];
  const BOOKINGS: SeedBooking[] = [
    [roomB2, 'sneha@assetflow.com', 0, 14, 1, 'Marketing sync', 'CONFIRMED', null],
    [roomB2, 'employee@assetflow.com', 0, 10, 1, 'Sprint planning', 'CONFIRMED', series.rows[0].id],
    [roomB2, 'employee@assetflow.com', 7, 10, 1, 'Sprint planning', 'CONFIRMED', series.rows[0].id],
    [roomB2, 'employee@assetflow.com', 14, 10, 1, 'Sprint planning', 'CONFIRMED', series.rows[0].id],
    [room3A, 'aditi@assetflow.com', 1, 11, 2, 'Quarterly sales review', 'CONFIRMED', null],
    [room3A, 'arjun@assetflow.com', 2, 15, 1, 'Client call — Nexora account', 'CONFIRMED', null],
    [huddle, 'priya@assetflow.com', 1, 9, 1, 'Design pairing', 'CONFIRMED', null],
    [huddle, 'meera@assetflow.com', 3, 12, 1, 'HR 1:1', 'CONFIRMED', null],
    [room3A, 'sneha@assetflow.com', -2, 16, 1, 'Campaign retro', 'CONFIRMED', null],       // past → COMPLETED
    [roomB2, 'rohit@assetflow.com', 2, 9, 1, 'Cancelled sales huddle', 'CANCELLED', null],
  ];
  for (const [resource, booker, dayOffset, startHour, hours, purpose, status, seriesId] of BOOKINGS) {
    await query(
      `INSERT INTO bookings (resource_id, booked_by, series_id, start_ts, end_ts, purpose, status)
       VALUES ($1, $2, $3,
               date_trunc('day', now()) + make_interval(days => $4, hours => $5),
               date_trunc('day', now()) + make_interval(days => $4, hours => $6), $7, $8)`,
      [resource, await uid(booker), seriesId, dayOffset, startHour, startHour + hours, purpose, status],
    );
  }
  console.log(`Bookings: ${BOOKINGS.length} seeded (incl. weekly series + 1 cancelled).`);

  // Maintenance — every pipeline stage, with a comment thread on the assigned one.
  const kavya = await uid('kavya@assetflow.com');
  type SeedMaint = [tag: string, raisedBy: string, issue: string, type: string, priority: string, status: string, daysAgo: number];
  const MAINTS: SeedMaint[] = [
    ['AF-0016', 'sneha@assetflow.com', 'Projector bulb flickering during presentations', 'REPAIR', 'MEDIUM', 'APPROVED', 3],
    ['AF-0017', 'meera@assetflow.com', 'Printer jams on duplex printing', 'REPAIR', 'LOW', 'PENDING', 1],
    ['AF-0013', 'rohan@assetflow.com', 'AC compressor noisy on long routes', 'SERVICE', 'HIGH', 'IN_PROGRESS', 6],
    ['AF-0014', 'kavya@assetflow.com', 'Hydraulic lift not holding height under load', 'REPAIR', 'CRITICAL', 'ESCALATED', 8],
    ['AF-0009', 'priya@assetflow.com', 'Chair recline lever loose', 'REPAIR', 'LOW', 'RESOLVED', 15],
    ['AF-0018', 'meera@assetflow.com', 'Shredder overheating after 10 minutes', 'INSPECTION', 'MEDIUM', 'REJECTED', 12],
  ];
  for (const [tag, raisedBy, issue, type, priority, status, daysAgo] of MAINTS) {
    await query(
      `INSERT INTO maintenance_requests (asset_id, raised_by, issue, issue_type, priority, status,
                                         technician_id, technician_name, started_at, resolved_at, resolution_notes, cost, rejected_reason, escalated, created_at)
       VALUES ($1, $2, $3, $4, $5, $6,
               CASE WHEN $6 IN ('IN_PROGRESS','ESCALATED') THEN $7::uuid ELSE NULL END,
               CASE WHEN $6 IN ('IN_PROGRESS','ESCALATED') THEN 'Kavya Menon' WHEN $6 = 'RESOLVED' THEN 'External vendor' ELSE NULL END,
               CASE WHEN $6 IN ('IN_PROGRESS','ESCALATED') THEN now() - make_interval(days => $8) + INTERVAL '1 day' ELSE NULL END,
               CASE WHEN $6 = 'RESOLVED' THEN now() - make_interval(days => $8) + INTERVAL '3 days' ELSE NULL END,
               CASE WHEN $6 = 'RESOLVED' THEN 'Lever assembly replaced under warranty' ELSE NULL END,
               CASE WHEN $6 = 'RESOLVED' THEN 1200 ELSE NULL END,
               CASE WHEN $6 = 'REJECTED' THEN 'Within normal operating temperature — no fault found' ELSE NULL END,
               CASE WHEN $6 = 'ESCALATED' THEN '{"reason":"SLA breached — critical equipment down 48h","escalateTo":"ADMIN"}'::jsonb ELSE NULL END,
               now() - make_interval(days => $8))`,
      [await aid(tag), await uid(raisedBy), issue, type, priority, status, kavya, daysAgo],
    );
  }
  const vanReq = await query<{ id: string }>(`SELECT id FROM maintenance_requests WHERE status = 'IN_PROGRESS' LIMIT 1`);
  await query(
    `INSERT INTO maintenance_comments (request_id, author_id, text, created_at) VALUES
       ($1, $2, 'Technician assigned. ETA: 2 hours.', now() - INTERVAL '5 days'),
       ($1, $3, 'Compressor mount worn out — part ordered, arrives tomorrow.', now() - INTERVAL '4 days'),
       ($1, $2, 'Please prioritise, van is needed for Friday deliveries.', now() - INTERVAL '3 days')`,
    [vanReq.rows[0].id, manager, kavya],
  );
  console.log(`Maintenance: ${MAINTS.length} requests seeded (full pipeline) + comment thread.`);

  // Audit — one ACTIVE cycle with mixed results, one CLOSED historical cycle.
  const admin = await uid('admin@assetflow.com');
  const rohan = await uid('rohan@assetflow.com');
  const priya = await uid('priya@assetflow.com');
  const active = await query<{ id: string }>(
    `INSERT INTO audit_cycles (name, scope_type, start_date, end_date, status, created_by)
     VALUES ('Q3 2026 Full Audit', 'ALL', CURRENT_DATE - 7, CURRENT_DATE + 21, 'ACTIVE', $1) RETURNING id`,
    [admin],
  );
  await query(
    `INSERT INTO audit_items (cycle_id, asset_id, expected_location)
     SELECT $1, id, location FROM assets WHERE status <> 'DISPOSED'`,
    [active.rows[0].id],
  );
  await query(`INSERT INTO audit_cycle_auditors (cycle_id, user_id) VALUES ($1, $2), ($1, $3)`, [active.rows[0].id, rohan, priya]);
  await query(
    `UPDATE audit_items SET verification = 'VERIFIED', verified_by = $2, verified_at = now() - INTERVAL '2 days'
     WHERE cycle_id = $1 AND asset_id IN (SELECT id FROM assets WHERE tag IN ('AF-0001','AF-0002','AF-0004','AF-0009','AF-0020','AF-0021','AF-0017'))`,
    [active.rows[0].id, rohan],
  );
  await query(
    `UPDATE audit_items SET verification = 'DISCREPANCY', notes = 'Found on Floor 2, expected Floor 1', verified_by = $2, verified_at = now() - INTERVAL '1 day'
     WHERE cycle_id = $1 AND asset_id = (SELECT id FROM assets WHERE tag = 'AF-0010')`,
    [active.rows[0].id, priya],
  );
  await query(
    `UPDATE audit_items SET verification = 'MISSING', notes = 'Not found at expected location — last seen at the Pune shoot', verified_by = $2, verified_at = now() - INTERVAL '1 day'
     WHERE cycle_id = $1 AND asset_id = (SELECT id FROM assets WHERE tag = 'AF-0007')`,
    [active.rows[0].id, priya],
  );
  const closed = await query<{ id: string }>(
    `INSERT INTO audit_cycles (name, scope_type, start_date, end_date, status, created_by, closed_at, created_at)
     VALUES ('Q1 2026 Electronics Audit', 'DEPARTMENT', CURRENT_DATE - 120, CURRENT_DATE - 90, 'CLOSED', $1, now() - INTERVAL '90 days', now() - INTERVAL '120 days')
     RETURNING id`,
    [admin],
  );
  await query(
    `INSERT INTO audit_cycle_departments (cycle_id, department_id)
     VALUES ($1, (SELECT id FROM departments WHERE name = 'Engineering'))`,
    [closed.rows[0].id],
  );
  await query(
    `INSERT INTO audit_items (cycle_id, asset_id, expected_location, verification, verified_by, verified_at)
     SELECT $1, id, location, 'VERIFIED', $2, now() - INTERVAL '95 days'
     FROM assets WHERE department_id = (SELECT id FROM departments WHERE name = 'Engineering')`,
    [closed.rows[0].id, rohan],
  );
  console.log('Audits: 1 active cycle (7 verified, 1 discrepancy, 1 missing) + 1 closed cycle.');

  // Notifications — mixed read/unread across users.
  const NOTIFS: Array<[email: string, type: string, title: string, message: string, read: boolean, daysAgo: number]> = [
    ['priya@assetflow.com', 'ALLOCATION', 'Asset allocated to you', 'AF-0001 — MacBook Pro M3 has been allocated to you.', true, 40],
    ['priya@assetflow.com', 'AUDIT', 'Audit assignment', 'You were assigned as an auditor on "Q3 2026 Full Audit".', false, 7],
    ['arjun@assetflow.com', 'RETURN', 'Return overdue', 'AF-0003 — iPad Pro 12.9 return is overdue by 3 days.', false, 1],
    ['rohit@assetflow.com', 'RETURN', 'Return overdue', 'AF-0005 — iPhone 15 Pro return is overdue by 12 days.', false, 2],
    ['rohan@assetflow.com', 'AUDIT', 'Audit assignment', 'You were assigned as an auditor on "Q3 2026 Full Audit".', true, 7],
    ['kavya@assetflow.com', 'MAINTENANCE', 'Job assigned to you', 'AF-0013: AC compressor noisy on long routes.', false, 5],
    ['sneha@assetflow.com', 'MAINTENANCE', 'Request approved', 'Maintenance for AF-0016 was approved.', false, 3],
    ['employee@assetflow.com', 'BOOKING', 'Upcoming booking', 'Sprint planning in Conference Room B2 at 10:00 today.', false, 0],
    ['neelsheth708@gmail.com', 'AUDIT', 'Discrepancies found', 'Q3 2026 Full Audit has 1 discrepancy and 1 missing asset.', false, 1],
  ];
  for (const [email, type, title, message, read, daysAgo] of NOTIFS) {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, read, created_at)
       VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6))`,
      [await uid(email), type, title, message, read, daysAgo],
    );
  }
  console.log(`Notifications: ${NOTIFS.length} seeded.`);

  // Activity trail — varied actors, types, and timestamps for the feed and log screen.
  const ACTIVITIES: Array<[email: string, action: string, entity: string, desc: string, daysAgo: number]> = [
    ['manager@assetflow.com', 'ALLOCATION', 'ALLOCATION', 'Allocated AF-0001 (MacBook Pro M3) to Priya Shah', 40],
    ['manager@assetflow.com', 'ALLOCATION', 'ALLOCATION', 'Allocated AF-0003 (iPad Pro 12.9) to Arjun Nair', 45],
    ['manager@assetflow.com', 'ALLOCATION', 'ALLOCATION', 'Allocated AF-0005 (iPhone 15 Pro) to Rohit Joshi', 90],
    ['aditi@assetflow.com', 'RETURN', 'ALLOCATION', 'Initiated return of AF-0015 (Honda City) — condition: FAIR', 1],
    ['priya@assetflow.com', 'TRANSFER', 'TRANSFER', 'Requested transfer of AF-0001 to Kavya Menon', 2],
    ['manager@assetflow.com', 'TRANSFER', 'TRANSFER', 'Rejected transfer of AF-0003 — asset still needed by current holder', 9],
    ['sneha@assetflow.com', 'MAINTENANCE', 'MAINTENANCE', 'Raised maintenance request for AF-0016: projector bulb flickering', 3],
    ['manager@assetflow.com', 'MAINTENANCE', 'MAINTENANCE', 'Assigned Kavya Menon to AF-0013 (Delivery Van)', 5],
    ['manager@assetflow.com', 'MAINTENANCE', 'MAINTENANCE', 'Escalated AF-0014 (Forklift) — SLA breached', 4],
    ['admin@assetflow.com', 'AUDIT', 'AUDIT_CYCLE', 'Created audit cycle "Q3 2026 Full Audit" (23 items)', 7],
    ['priya@assetflow.com', 'AUDIT', 'AUDIT_CYCLE', 'Marked AF-0007 (Canon EOS R6) as MISSING in Q3 audit', 1],
    ['sneha@assetflow.com', 'BOOKING', 'BOOKING', 'Booked Conference Room B2 for Marketing sync', 0],
    ['employee@assetflow.com', 'BOOKING', 'BOOKING', 'Created weekly recurring booking — Sprint planning (8 slots)', 0],
    ['admin@assetflow.com', 'USER_CHANGE', 'USER', "Changed Rohan Verma's role to Asset Manager", 30],
    ['admin@assetflow.com', 'USER_CHANGE', 'USER', 'Deactivated a user account', 14],
    ['manager@assetflow.com', 'ASSET', 'ASSET', 'Registered asset AF-0024 — Dell Latitude 5440', 20],
    ['manager@assetflow.com', 'ASSET', 'ASSET', 'Retired asset AF-0019 — Xerox WorkCentre', 25],
    ['admin@assetflow.com', 'AUDIT', 'AUDIT_CYCLE', 'Closed audit cycle "Q1 2026 Electronics Audit"', 90],
  ];
  for (const [email, action, entity, desc, daysAgo] of ACTIVITIES) {
    await query(
      `INSERT INTO activity_logs (actor_id, action_type, entity_type, description, created_at)
       VALUES ($1, $2, $3, $4, now() - make_interval(days => $5, hours => $6))`,
      [await uid(email), action, entity, desc, daysAgo, daysAgo % 5],
    );
  }
  console.log(`Activity logs: ${ACTIVITIES.length} seeded.`);

  console.log('Seed complete.');
} finally {
  await closeDb();
}
