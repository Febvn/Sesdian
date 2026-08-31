import { getSql } from './_db.js';
import { requireAuth, requireAdmin, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    try {
      const rows = await sql`select id, name, coalesce(icon,'📦') as icon from categories order by id`;
      return send(res, 200, { categories: rows });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      if (!b.name) return send(res, 400, { error: 'Nama kategori wajib diisi' });
      const rows = await sql`insert into categories (name, icon) values (${b.name}, ${b.icon || '📦'}) returning id`;
      return send(res, 200, { id: rows[0].id });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id, 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      const rows = await sql`update categories set name = coalesce(${b.name}, name), icon = coalesce(${b.icon}, icon) where id = ${id} returning id`;
      if (!rows.length) return send(res, 404, { error: 'Kategori tidak ditemukan' });
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id || (req.query && req.query.id), 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      await sql`delete from categories where id = ${id}`;
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
