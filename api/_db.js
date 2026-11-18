// Neon serverless Postgres client (server-side only).
// DATABASE_URL is set as a Vercel Environment Variable - never exposed to the browser.
import { neon } from '@neondatabase/serverless';

let _sql;
export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diset (environment variable server).');
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}
