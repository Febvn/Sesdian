// Quick connectivity test: prints row counts from your Neon database.
//   node scripts/db-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  }
}
loadEnv();

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL belum diset — isi .env.local (lihat .env.example).'); process.exit(1); }

const sql = neon(process.env.DATABASE_URL);
try {
  const [{ now }] = await sql`select now()`;
  console.log('✓ Terhubung ke Neon. Waktu server: ' + now);
  // counts (separate queries; a table may not exist yet)
  async function count(table, q) { try { const r = await q(); return r[0].n; } catch (e) { return 'n/a (' + e.message.split('\n')[0] + ')'; } }
  const users = await count('users', () => sql`select count(*)::int as n from users`);
  const assets = await count('assets', () => sql`select count(*)::int as n from assets`);
  const categories = await count('categories', () => sql`select count(*)::int as n from categories`);
  const rooms = await count('rooms', () => sql`select count(*)::int as n from rooms`);
  const borrowings = await count('borrowings', () => sql`select count(*)::int as n from borrowings`);
  const withQr = await count('assets.qr', () => sql`select count(*)::int as n from assets where qr_code is not null`);
  console.log('  users       : ' + users);
  console.log('  assets      : ' + assets + '  (ber-QR: ' + withQr + ')');
  console.log('  categories  : ' + categories);
  console.log('  rooms       : ' + rooms);
  console.log('  borrowings  : ' + borrowings);
} catch (e) {
  console.error('✗ Gagal terhubung: ' + e.message);
  process.exit(1);
}
