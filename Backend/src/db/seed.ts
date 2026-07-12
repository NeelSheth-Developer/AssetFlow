/**
 * Seeds the Admin (spec §3.6) and the demo accounts (spec §11), plus two
 * departments so the Department Head has one. Idempotent — safe to re-run;
 * it resets the demo accounts' passwords/roles to the documented values.
 */
import bcrypt from 'bcryptjs';
import { query, closeDb } from './neon.js';

const DEMO_USERS = [
  { name: 'System Admin', email: 'admin@assetflow.com', password: 'Admin@123', role: 'ADMIN' },
  { name: 'Asset Manager', email: 'manager@assetflow.com', password: 'Manager@123', role: 'ASSET_MANAGER' },
  { name: 'Department Head', email: 'head@assetflow.com', password: 'Head@123', role: 'DEPT_HEAD' },
  { name: 'Employee', email: 'employee@assetflow.com', password: 'Employee@123', role: 'EMPLOYEE' },
] as const;

const DEPARTMENTS = ['Engineering', 'Sales'] as const;

try {
  for (const name of DEPARTMENTS) {
    await query('INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  for (const user of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4::user_role, 'ACTIVE')
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             status = 'ACTIVE',
             updated_at = now()`,
      [user.name, user.email, passwordHash, user.role],
    );
    console.log(`Seeded ${user.role.padEnd(13)} ${user.email}`);
  }

  // Department Head and Employee belong to Engineering; the head leads it.
  await query(
    `UPDATE users SET department_id = (SELECT id FROM departments WHERE name = 'Engineering')
     WHERE email IN ('head@assetflow.com', 'employee@assetflow.com')`,
  );
  await query(
    `UPDATE departments SET head_id = (SELECT id FROM users WHERE email = 'head@assetflow.com')
     WHERE name = 'Engineering'`,
  );

  console.log('Seed complete.');
} finally {
  await closeDb();
}
