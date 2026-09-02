import { getSql } from './_db.js';
import { requireAuth, requireAdmin, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    try {
      const rows = await sql`select id, name, coalesce(code,'') as code, coalesce(pic,'') as pic from rooms order by id`;
      return send(res, 200, { rooms: rows });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      if (!b.name) return send(res, 400, { error: 'Nama ruangan wajib diisi' });
      const rows = await sql`insert into rooms (name, code, pic) values (${b.name}, ${b.code || null}, ${b.pic || null}) returning id`;
      return send(res, 200, { id: rows[0].id });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id, 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      const rows = await sql`update rooms set name = coalesce(${b.name}, name), code = ${b.code || null}, pic = ${b.pic || null} where id = ${id} returning id`;
      if (!rows.length) return send(res, 404, { error: 'Ruangan tidak ditemukan' });
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id || (req.query && req.query.id), 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      await sql`delete from rooms where id = ${id}`;
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
