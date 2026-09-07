import { getSql } from './_db.js';
import { requireAdmin, send, readJson } from './_auth.js';

// Bulk import assets (admin). The browser parses the .xlsx with SheetJS and
// POSTs normalized rows as JSON, so the server never touches multipart/files.
//   body: { rows: [{ code, name, category, brand, room, year, condition, type, asset_type, stock_total }] }
// Category/room are matched by name (created on the fly if missing). Rows whose
// code already exists are skipped. Returns a per-row summary.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const body = await readJson(req);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return send(res, 400, { error: 'Tidak ada baris untuk diimpor' });
    if (rows.length > 2000) return send(res, 400, { error: 'Maksimal 2000 baris per impor' });

    // name(lower) -> id lookup maps, augmented as we create new ones
    const cats = await sql`select id, name from categories`;
    const rms = await sql`select id, name from rooms`;
    const catMap = new Map(cats.map((c) => [String(c.name).trim().toLowerCase(), c.id]));
    const roomMap = new Map(rms.map((r) => [String(r.name).trim().toLowerCase(), r.id]));
    const existing = await sql`select code from assets`;
    const codes = new Set(existing.map((a) => String(a.code).trim().toLowerCase()));

    async function resolveCat(name) {
      const k = String(name || '').trim().toLowerCase();
      if (!k) return null;
      if (catMap.has(k)) return catMap.get(k);
      const ins = await sql`insert into categories (name, icon) values (${String(name).trim()}, 'package') returning id`;
      catMap.set(k, ins[0].id); return ins[0].id;
    }
    async function resolveRoom(name) {
      const k = String(name || '').trim().toLowerCase();
      if (!k) return null;
      if (roomMap.has(k)) return roomMap.get(k);
      const ins = await sql`insert into rooms (name) values (${String(name).trim()}) returning id`;
      roomMap.set(k, ins[0].id); return ins[0].id;
    }

    let success = 0, skipped = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const code = String(r.code || '').trim();
      const name = String(r.name || '').trim();
      const ln = i + 2; // human row number (header = row 1)
      try {
        if (!code || !name) { errors.push({ row: ln, error: 'Kode/Nama kosong' }); continue; }
        if (codes.has(code.toLowerCase())) { skipped++; continue; }
        const total = Math.max(0, parseInt(r.stock_total, 10) || 1);
        const catId = await resolveCat(r.category);
        const roomId = await resolveRoom(r.room);
        const type = String(r.type || '').toLowerCase().includes('non') ? 'Non-BMN' : 'BMN';
        await sql`
          insert into assets (code, name, category_id, brand, room_id, year, condition, type, asset_type,
                              stock_total, stock_available, stock_borrowed)
          values (${code}, ${name}, ${catId}, ${r.brand || null}, ${roomId},
                  ${r.year ? parseInt(r.year, 10) : null}, ${r.condition || 'Baik'}, ${type},
                  ${r.asset_type || 'Fixed Asset'}, ${total}, ${total}, 0)`;
        codes.add(code.toLowerCase());
        success++;
      } catch (e) { errors.push({ row: ln, error: e.message }); }
    }

    // give every freshly-imported asset a scannable QR code
    if (success) await sql`update assets set qr_code = 'QR' || lpad(id::text, 6, '0'), qr_generated_at = now() where qr_code is null`;

    return send(res, 200, { success, skipped, failed: errors.length, errors });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
