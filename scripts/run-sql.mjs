// Run a .sql file against your Neon database (DATABASE_URL from .env.local).
//   node scripts/run-sql.mjs migrate-v3.sql
//   node scripts/run-sql.mjs seed-aset-2025.sql
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

const arg = process.argv[2];
if (!arg) { console.error('Pakai: node scripts/run-sql.mjs <file.sql>'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL belum diset — isi .env.local (lihat .env.example).'); process.exit(1); }

const file = path.isAbsolute(arg) ? arg : path.join(ROOT, arg);
if (!fs.existsSync(file)) { console.error('File tidak ditemukan: ' + file); process.exit(1); }

// strip full-line comments, then split into statements on ';'
const raw = fs.readFileSync(file, 'utf8');
const cleaned = raw.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
const statements = cleaned.split(';').map((s) => s.trim()).filter(Boolean);

const sql = neon(process.env.DATABASE_URL);
const run = (s) => (typeof sql.query === 'function' ? sql.query(s) : sql([s]));

console.log('Menjalankan ' + statements.length + ' statement dari ' + path.basename(file) + ' ...');
let ok = 0;
for (let i = 0; i < statements.length; i++) {
  try { await run(statements[i]); ok++; }
  catch (e) {
    console.error('\n✗ Statement #' + (i + 1) + ' gagal: ' + e.message);
    console.error('  ' + statements[i].slice(0, 140).replace(/\s+/g, ' ') + ' ...');
    process.exit(1);
  }
}
console.log('✓ Selesai: ' + ok + '/' + statements.length + ' statement berhasil.');
