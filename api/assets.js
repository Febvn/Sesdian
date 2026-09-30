import { getSql } from './_db.js';
import { requireAuth, requireAdmin, send, readJson } from './_auth.js';
import { ensureSchema } from './_schema.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();
  await ensureSchema(sql);

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    try {
      const page = parseInt(req.query?.page || 1, 10);
      const limit = Math.min(parseInt(req.query?.limit || 5000, 10), 10000); // load all assets by default
      const offset = (page - 1) * limit;
      // single round-trip: total via window count instead of a second COUNT query.
      // jenis image is joined as key+version only (the binary is served separately
      // via /api/public?resource=img so the payload stays light).
      const rows = await sql`
        select a.id, a.code, a.name, coalesce(a.brand,'') as brand, a.year,
               coalesce(a.condition,'Baik') as condition, coalesce(a.type,'BMN') as type,
               coalesce(a.asset_type,'') as asset_type,
               a.stock_total, a.stock_available, a.stock_borrowed,
               a.category_id, a.room_id, a.image, a.qr_code,
               coalesce(c.name,'') as category, coalesce(r.name,'') as room,
               ai.name_key as jenis_key, extract(epoch from ai.updated_at)::bigint as jenis_ver,
               count(*) over() as total_count
        from assets a
        left join categories c on c.id = a.category_id
        left join rooms r on r.id = a.room_id
        left join asset_images ai on ai.name_key = btrim(regexp_replace(lower(a.name), '[^a-z0-9]+', '-', 'g'), '-')
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
      // one image per jenis: single upsert covers every unit sharing the name
      if (b.jenis_image && b.jenis_image.name) {
        const key = String(b.jenis_image.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const img = String(b.jenis_image.image || '');
        if (!key) return send(res, 400, { error: 'Nama jenis tidak valid' });
        if (img.indexOf('data:image/') !== 0) return send(res, 400, { error: 'Gambar tidak valid' });
        if (img.length > 800000) return send(res, 400, { error: 'Gambar terlalu besar (maks ±600KB)' });
        await sql`insert into asset_images (name_key, image, updated_at) values (${key}, ${img}, now())
                  on conflict (name_key) do update set image = ${img}, updated_at = now()`;
        return send(res, 200, { ok: true, key });
      }
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
      const cur = await sql`select code, name, category_id, brand, room_id, year, condition, type, asset_type, stock_total, stock_borrowed, image from assets where id = ${id}`;
      if (!cur.length) return send(res, 404, { error: 'Aset tidak ditemukan' });
      const c = cur[0];
      const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
      const intOrNull = (v) => (v != null && v !== '' ? parseInt(v, 10) : null);
      // Only touch a field the request actually included, so a partial PATCH can no
      // longer silently NULL category_id/brand/room_id/year. Sending an explicit
      // null/'' for category_id/room_id still clears them.
      const code       = has('code') && b.code ? String(b.code) : c.code;
      const name       = has('name') && b.name ? String(b.name) : c.name;
      const categoryId = has('category_id') ? intOrNull(b.category_id) : c.category_id;
      const brand      = has('brand') ? (b.brand || null) : c.brand;
      const roomId     = has('room_id') ? intOrNull(b.room_id) : c.room_id;
      const year       = has('year') ? (b.year ? parseInt(b.year, 10) : null) : c.year;
      const condition  = has('condition') && b.condition ? b.condition : c.condition;
      const type       = has('type') && b.type ? b.type : c.type;
      const assetType  = has('asset_type') && b.asset_type ? b.asset_type : c.asset_type;
      // keep stock_available consistent when total changes: available = total - borrowed
      const total      = has('stock_total') ? Math.max(0, parseInt(b.stock_total, 10) || 0) : c.stock_total;
      const avail      = Math.max(0, total - c.stock_borrowed);
      const image      = has('image') && b.image ? String(b.image) : c.image;
      await sql`
        update assets set
          code = ${code}, name = ${name}, category_id = ${categoryId}, brand = ${brand},
          room_id = ${roomId}, year = ${year}, condition = ${condition}, type = ${type},
          asset_type = ${assetType}, stock_total = ${total}, stock_available = ${avail}, image = ${image}
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
      // don't drop an asset that's still out / in the pipeline: the FK cascades and
      // would silently delete live borrowing records (history + stock desync).
      const active = await sql`select count(*)::int as n from borrowings where asset_id = ${id} and status in ('pending','approved','verified','borrowed','return_pending')`;
      if (active[0].n > 0) return send(res, 409, { error: 'Aset sedang dipinjam atau dalam proses, tidak dapat dihapus' });
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
