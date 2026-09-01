import { getSql } from './_db.js';
import { requireAuth, requireAdmin, send, readJson } from './_auth.js';

const SELECT = (sql) => sql`
  select a.id, a.code, a.name, coalesce(a.brand,'') as brand, a.year,
         coalesce(a.condition,'Baik') as condition, coalesce(a.type,'BMN') as type,
         coalesce(a.asset_type,'') as asset_type,
         a.stock_total, a.stock_available, a.stock_borrowed,
         a.category_id, a.room_id, a.image,
         coalesce(c.name,'') as category, coalesce(r.name,'') as room
  from assets a
  left join categories c on c.id = a.category_id
  left join rooms r on r.id = a.room_id
  order by a.id`;

export default async function handler(req, res) {
  const sql = getSql();

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    try { return send(res, 200, { assets: await SELECT(sql) }); }
    catch (e) { return send(res, 500, { error: e.message }); }
  }

  // ---- admin write operations ----
  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      if (!b.code || !b.name) return send(res, 400, { error: 'Kode dan nama aset wajib diisi' });
      const total = Math.max(0, parseInt(b.stock_total || 1, 10));
      const rows = await sql`
        insert into assets (code, name, category_id, brand, room_id, year, condition, type, asset_type, stock_total, stock_available, stock_borrowed, image)
        values (${b.code}, ${b.name}, ${b.category_id || null}, ${b.brand || null}, ${b.room_id || null},
                ${b.year ? parseInt(b.year, 10) : null}, ${b.condition || 'Baik'}, ${b.type || 'BMN'},
                ${b.asset_type || 'Fixed Asset'}, ${total}, ${total}, 0, ${b.image || null})
        returning id`;
      return send(res, 200, { id: rows[0].id });
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
