import { getSql } from './_db.js';
import { requireAdmin, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const sql = getSql();

  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query?.page || 1, 10);
      const limit = Math.min(parseInt(req.query?.limit || 1000, 10), 1000);
      const offset = (page - 1) * limit;
      const rows = await sql`select id, nip, name, role, created_at from users order by role desc, id limit ${limit} offset ${offset}`;
      const [{ count }] = await sql`select count(*) from users`;
      return send(res, 200, { users: rows, total: parseInt(count, 10), page, limit });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, role } = await readJson(req);
      const uid = parseInt(id, 10);
      if (!uid || (role !== 'admin' && role !== 'user')) return send(res, 400, { error: 'Data tidak valid' });
      if (uid === admin.sub && role !== 'admin') return send(res, 400, { error: 'Tidak dapat menurunkan akun sendiri' });
      const rows = await sql`update users set role = ${role} where id = ${uid} returning id, nip, name, role`;
      if (!rows.length) return send(res, 404, { error: 'User tidak ditemukan' });
      return send(res, 200, { user: rows[0] });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
