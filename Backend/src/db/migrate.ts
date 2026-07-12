import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { query, closeDb } from './neon.js';

const schemaPath = fileURLToPath(new URL('../../sql/schema.sql', import.meta.url));

try {
  await query(await readFile(schemaPath, 'utf8'));
  console.log('Database schema applied successfully.');
} finally {
  await closeDb();
}
