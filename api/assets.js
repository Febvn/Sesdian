import { getSql } from './_db.js';
import { requireAuth, requireAdmin, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    try {
      const page = parseInt(req.query?.page || 1, 10);
      const limit = Math.min(parseInt(req.query?.limit || 5000, 10), 10000); // load all assets by default
      const offset = (page - 1) * limit;
      // single round-trip: total via window count instead of a second COUNT query
      const rows = await sql`
        select a.id, a.code, a.name, coalesce(a.brand,'') as brand, a.year,
               coalesce(a.condition,'Baik') as condition, coalesce(a.type,'BMN') as type,
               coalesce(a.asset_type,'') as asset_type,
               a.stock_total, a.stock_available, a.stock_borrowed,
               a.category_id, a.room_id, a.image, a.qr_code,
               coalesce(c.name,'') as category, coalesce(r.name,'') as room,
               count(*) over() as total_count
        from assets a
        left join categories c on c.id = a.category_id
        left join rooms r on r.id = a.room_id
        order by a.id limit ${limit} offset ${offset}`;
      const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
      return send(res, 200, { assets: rows, total, page, limit });
    }
    catch (e) { return send(res, 500, { error: e.message }); }
  }

  // ---- admin write operations ----
  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      // bulk import from Excel (parsed client-side): body.rows present -> import path
      if (Array.isArray(b.rows)) return importAssets(sql, b.rows, res);
      if (!b.code || !b.name) return send(res, 400, { error: 'Kode dan nama aset wajib diisi' });
      const total = Math.max(0, parseInt(b.stock_total || 1, 10));
      const rows = await sql`
        insert into assets (code, name, category_id, brand, room_id, year, condition, type, asset_type, stock_total, stock_available, stock_borrowed, image)
        values (${b.code}, ${b.name}, ${b.category_id || null}, ${b.brand || null}, ${b.room_id || null},
                ${b.year ? parseInt(b.year, 10) : null}, ${b.condition || 'Baik'}, ${b.type || 'BMN'},
                ${b.asset_type || 'Fixed Asset'}, ${total}, ${total}, 0, ${b.image || null})
        returning id`;
      const newId = rows[0].id;
      // auto-assign a unique QR code so every asset has a scannable detail page
      await sql`update assets set qr_code = ${'QR' + String(newId).padStart(6, '0')}, qr_generated_at = now()
                where id = ${newId} and qr_code is null`;
      return send(res, 200, { id: newId });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id, 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      const cur = await sql`select stock_total, stock_borrowed from assets where id = ${id}`;
      if (!cur.length) return send(res, 404, { error: 'Aset tidak ditemukan' });
      // keep stock_available consistent when total changes: available = total - borrowed
      const total = b.stock_total != null ? Math.max(0, parseInt(b.stock_total, 10)) : cur[0].stock_total;
      const avail = Math.max(0, total - cur[0].stock_borrowed);
      await sql`
        update assets set
          code = coalesce(${b.code}, code),
          name = coalesce(${b.name}, name),
          category_id = ${b.category_id || null},
          brand = ${b.brand || null},
          room_id = ${b.room_id || null},
          year = ${b.year ? parseInt(b.year, 10) : null},
          condition = coalesce(${b.condition}, condition),
          type = coalesce(${b.type}, type),
          asset_type = coalesce(${b.asset_type}, asset_type),
          stock_total = ${total},
          stock_available = ${avail},
          image = coalesce(${b.image}, image)
        where id = ${id}`;
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id || (req.query && req.query.id), 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      await sql`delete from assets where id = ${id}`;
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}

// Bulk import (called from POST when body.rows is present). Category/room are
// matched by name (created on the fly if missing); rows with an existing code
// are skipped. Returns a per-row summary.
async function importAssets(sql, rows, res) {
  try {
    if (!rows.length) return send(res, 400, { error: 'Tidak ada baris untuk diimpor' });
    if (rows.length > 2000) return send(res, 400, { error: 'Maksimal 2000 baris per impor' });

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
      const ln = i + 2;
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

    if (success) await sql`update assets set qr_code = 'QR' || lpad(id::text, 6, '0'), qr_generated_at = now() where qr_code is null`;
    return send(res, 200, { success, skipped, failed: errors.length, errors });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
