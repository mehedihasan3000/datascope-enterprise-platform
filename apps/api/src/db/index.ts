import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const { Pool } = pg;

const isCloudSsl =
  env.DATABASE_URL.includes('sslmode=require') ||
  env.DATABASE_URL.includes('neon.tech') ||
  env.DATABASE_URL.includes('supabase.co') ||
  env.DATABASE_URL.includes('aivencloud.com');

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  ssl: isCloudSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  version?: string;
  latencyMs: number;
}> {
  const start = performance.now();
  const client = await pool.connect();
  try {
    const res = await client.query<{ version: string }>('SELECT version()');
    return {
      connected: true,
      version: res.rows[0]?.version,
      latencyMs: Math.round(performance.now() - start),
    };
  } finally {
    client.release();
  }
}
