// Build everything for daftar aset 2026 in one pass:
//   1. public/assets/aset/<slug(nama merk)>.webp — image per (Nama Barang, Merk):
//      fetched from the Google Drive link in the sheet, or an icon card when the
//      combo has no (working) link. Units sharing name+brand share ONE image.
//   2. db/migrate-v6-aset-2026.sql — RESETS old data (borrowings, asset_images,
//      assets) and inserts the 697 aset 2026. Run it against Neon:
//        node scripts/run-sql.mjs db/migrate-v6-aset-2026.sql
//   3. docs/asset-image-credits.json — key -> sumber gambar (drive link / icon).
//
//   npm install   (xlsx dan sharp sudah terdaftar sebagai devDependencies)
//   node scripts/build-2026-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import sharp from 'sharp';
import { slug, svgCard } from './asset-icons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_FILE = path.join(ROOT, 'arsip', 'daftar-aset-2026 dan link gambar (1) FIX.xlsx');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'aset');
const SQL_FILE = path.join(ROOT, 'db', 'migrate-v6-aset-2026.sql');
const CREDITS_FILE = path.join(ROOT, 'docs', 'asset-image-credits.json');
const UA = 'SESDIAN-asset-images/1.0 (asset management app; adi377503@gmail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";   // SQL string literal

function driveId(link) {
  let m = /\/file\/d\/([\w-]{10,})/.exec(link); if (m) return m[1];
  m = /[?&]id=([\w-]{10,})/.exec(link); if (m) return m[1];
  return null;
}
async function fetchDrive(id) {
  const urls = [
    'https://drive.google.com/uc?export=download&id=' + id,
    'https://drive.usercontent.google.com/download?id=' + id + '&export=download',
  ];
  for (const u of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) { await sleep(6000 * (attempt + 1)); continue; }
      if (!r.ok) break;
      const ct = r.headers.get('content-type') || '';
      if (ct.indexOf('image/') === 0) return Buffer.from(await r.arrayBuffer());
      break;   // HTML (permission page / scan interstitial) -> try next URL form
    }
  }
  return null;
}

/* ---------------- read the 2026 sheet ---------------- */
const wb = XLSX.readFile(XLSX_FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Master Aset BMN'], { header: 1 });
const assets = [];             // one entry per unit
const combos = new Map();      // key -> { nama, merk, link }
const cats = new Set();
for (let i = 2; i < rows.length; i++) {
  const r = rows[i] || [];
  const nama = String(r[6] || '').trim(); if (!nama) continue;
  const merk = String(r[8] || '').trim();
  const kategori = String(r[1] || '').trim();
  const kondisi = String(r[10] || '').trim() || 'Baik';
  const code = String(r[4] || '').trim() + String(r[5] || '').trim();
  const link = String(r[20] || '').trim();
  if (kategori) cats.add(kategori);
  assets.push({ code, nama, merk, kategori, kondisi });
  const key = slug(nama + ' ' + merk);
  if (!combos.has(key)) combos.set(key, { nama, merk, link: '' });
  if (!combos.get(key).link && link.includes('http')) combos.get(key).link = link;
}
console.log('unit:', assets.length, '| kombinasi (nama,merk):', combos.size, '| kategori:', cats.size);

/* ---------------- 1. images ---------------- */
fs.mkdirSync(OUT_DIR, { recursive: true });
// wipe the old (name-only keyed) set so stale files don't linger
for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.webp')) fs.unlinkSync(path.join(OUT_DIR, f));

const credits = {};
let nPhoto = 0, nIcon = 0;
for (const [key, c] of combos) {
  const out = path.join(OUT_DIR, key + '.webp');
  let done = false;
  const id = c.link ? driveId(c.link) : null;
  if (id) {
    try {
      const buf = await fetchDrive(id);
      if (buf) {
        await sharp(buf).rotate().resize(640, 420, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toFile(out);
        credits[key] = { name: c.nama, brand: c.merk, source: c.link };
        nPhoto++; done = true;
        console.log('  foto   ' + c.nama + (c.merk ? ' | ' + c.merk : ''));
      }
    } catch (e) { console.log('  gagal  ' + c.nama + ': ' + e.message); }
    await sleep(200);
  }
  if (!done) {
    const label = c.nama + (c.merk ? ' ' + c.merk : '');
    await sharp(Buffer.from(svgCard(label.length > 60 ? c.nama : label))).webp({ quality: 82 }).toFile(out);
    credits[key] = { name: c.nama, brand: c.merk, source: 'icon' };
    nIcon++;
    console.log('  (icon) ' + c.nama + (c.merk ? ' | ' + c.merk : ''));
  }
}
fs.mkdirSync(path.dirname(CREDITS_FILE), { recursive: true });
fs.writeFileSync(CREDITS_FILE, JSON.stringify(credits, null, 2));

/* ---------------- 2. SQL migration ---------------- */
const lines = [];
lines.push('-- migrate-v6: reset data lama dan muat daftar aset 2026 (' + assets.length + ' unit).');
lines.push('-- Jalankan: node scripts/run-sql.mjs db/migrate-v6-aset-2026.sql');
lines.push('-- PERINGATAN: menghapus SEMUA aset, riwayat peminjaman, dan gambar jenis lama.');
lines.push('begin;');
lines.push('truncate table borrowings, asset_images, assets restart identity cascade;');
lines.push('');
lines.push('-- kategori dari kolom "Jenis BMN" (dibuat bila belum ada)');
for (const c of cats) {
  lines.push('insert into categories (name, icon) select ' + q(c) + ", 'package' where not exists (select 1 from categories where lower(name) = lower(" + q(c) + '));');
}
lines.push('');
lines.push('insert into assets (code, name, category_id, brand, room_id, condition, type, asset_type, stock_total, stock_available, stock_borrowed) values');
const vals = assets.map((a) =>
  '(' + q(a.code) + ', ' + q(a.nama) + ', (select id from categories where lower(name) = lower(' + q(a.kategori || 'Lain-lain') + ') limit 1), ' +
  (a.merk ? q(a.merk) : 'null') + ', null, ' + q(a.kondisi) + ", 'BMN', " + q(a.kategori) + ', 1, 1, 0)');
lines.push(vals.join(',\n') + ';');
lines.push('');
lines.push("update assets set qr_code = 'QR' || lpad(id::text, 6, '0'), qr_generated_at = now() where qr_code is null;");
lines.push('commit;');
fs.writeFileSync(SQL_FILE, lines.join('\n') + '\n');

console.log('\nSelesai: ' + nPhoto + ' foto drive, ' + nIcon + ' kartu ikon -> public/assets/aset/');
console.log('SQL: db/migrate-v6-aset-2026.sql (' + assets.length + ' unit, reset total)');
