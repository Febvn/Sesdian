import { getSql } from './_db.js';
import { requireAuth, hashPassword, verifyPassword, send, readJson } from './_auth.js';
import { ensureSchema } from './_schema.js';

// Self-service profile endpoint (any authenticated user).
//   GET   -> own profile (id, nip, name, phone, role)
//   PATCH -> { name?, phone? }  update own identity
//          | { currentPassword, newPassword }  change own password
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const u = requireAuth(req, res);
  if (!u) return;
  const sql = getSql();
  await ensureSchema(sql);
  const uid = parseInt(u.sub, 10);

  if (req.method === 'GET') {
    try {
      const rows = await sql`select id, nip, name, coalesce(phone,'') as phone, role, created_at from users where id = ${uid}`;
      if (!rows.length) return send(res, 404, { error: 'User tidak ditemukan' });
      return send(res, 200, { user: rows[0] });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'PATCH') {
    try {
      const b = await readJson(req);

      // ── change password ──
      if (b.newPassword != null || b.currentPassword != null) {
        const cur = String(b.currentPassword || '');
        const np = String(b.newPassword || '');
        if (np.length < 8) return send(res, 400, { error: 'Password baru minimal 8 karakter' });
        const rows = await sql`select password_hash from users where id = ${uid}`;
        if (!rows.length) return send(res, 404, { error: 'User tidak ditemukan' });
        if (!verifyPassword(cur, rows[0].password_hash)) return send(res, 401, { error: 'Password saat ini salah' });
        await sql`update users set password_hash = ${hashPassword(np)} where id = ${uid}`;
        return send(res, 200, { ok: true });
      }

      // ── update identity (name / phone) ──
      const name = b.name != null ? String(b.name).trim() : null;
      const phone = b.phone != null ? String(b.phone).replace(/\D/g, '').replace(/^0/, '62') : null;
      if (name) await sql`update users set name = ${name} where id = ${uid}`;
      if (phone != null) await sql`update users set phone = ${phone || null} where id = ${uid}`;
      const rows = await sql`select id, nip, name, coalesce(phone,'') as phone, role from users where id = ${uid}`;
      return send(res, 200, { user: rows[0] });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
