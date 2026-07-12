/**
 * Neon (PostgreSQL) connection — the ONLY file in the project that knows
 * which database we talk to.
 *
 * Every other module imports { query, getClient, closeDb } from here.
 * To switch to another provider later (Supabase, RDS, local Postgres, ...):
 *   1. Change DATABASE_URL in .env, or
 *   2. Replace the Pool construction below with the new driver/client
 *      while keeping the same three exported functions.
 * Nothing else in the codebase needs to change.
 */
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
});

/** Run a single parameterized query. */
export const query = <R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<R>> => pool.query<R>(text, params as any[]);

/** Check out a dedicated client for transactions (BEGIN/COMMIT). Always release() it. */
export const getClient = (): Promise<pg.PoolClient> => pool.connect();

/** Verify connectivity at startup. */
export const pingDb = async (): Promise<void> => {
  await pool.query('SELECT 1');
};

/** Close all connections (used by scripts like migrate). */
export const closeDb = (): Promise<void> => pool.end();
