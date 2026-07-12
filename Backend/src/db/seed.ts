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
  console.log('Seed complete.');
} finally {
  await closeDb();
}
