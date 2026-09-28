import { getSql } from './_db.js';
import { requireAdmin, hashPassword, send, readJson } from './_auth.js';
import { ensureSchema } from './_schema.js';

const ROLES = ['user', 'admin', 'verifikator'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const sql = getSql();
  await ensureSchema(sql);

  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query?.page || 1, 10);
      const limit = Math.min(parseInt(req.query?.limit || 1000, 10), 1000);
      const offset = (page - 1) * limit;
      const rows = await sql`select id, nip, name, coalesce(phone,'') as phone, role, created_at from users order by role desc, id limit ${limit} offset ${offset}`;
      const [{ count }] = await sql`select count(*) from users`;
      return send(res, 200, { users: rows, total: parseInt(count, 10), page, limit });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  // ---- admin creates a new account (replaces self-registration) ----
  if (req.method === 'POST') {
    try {
      const b = await readJson(req);
      const nip = String(b.nip || '').trim();
      const name = String(b.name || '').trim();
      const password = String(b.password || '');
      const role = ROLES.indexOf(b.role) !== -1 ? b.role : 'user';
      const phone = String(b.phone || '').replace(/\D/g, '').replace(/^0/, '62');
      if (!nip || !name || !password) return send(res, 400, { error: 'Lengkapi nama, NIP, dan password' });
      if (!/^\d{18}$/.test(nip)) return send(res, 400, { error: 'NIP harus 18 digit angka, tidak boleh lebih atau kurang' });
      if (password.length < 8) return send(res, 400, { error: 'Password minimal 8 karakter' });

      const exists = await sql`select id from users where nip = ${nip}`;
      if (exists.length) return send(res, 409, { error: 'NIP sudah terdaftar' });

      const rows = await sql`
        insert into users (nip, name, phone, role, password_hash)
        values (${nip}, ${name}, ${phone || null}, ${role}, ${hashPassword(password)})
        returning id, nip, name, role`;
      return send(res, 200, { user: rows[0] });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, role } = await readJson(req);
      const uid = parseInt(id, 10);
      if (!uid || ROLES.indexOf(role) === -1) return send(res, 400, { error: 'Data tidak valid' });
      if (String(uid) === String(admin.sub) && role !== 'admin') return send(res, 400, { error: 'Tidak dapat menurunkan akun sendiri' });
      const rows = await sql`update users set role = ${role} where id = ${uid} returning id, nip, name, role`;
      if (!rows.length) return send(res, 404, { error: 'User tidak ditemukan' });
      return send(res, 200, { user: rows[0] });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'DELETE') {
    try {
      const b = await readJson(req);
      const uid = parseInt(b.id || (req.query && req.query.id), 10);
      if (!uid) return send(res, 400, { error: 'ID tidak valid' });
      if (String(uid) === String(admin.sub)) return send(res, 400, { error: 'Tidak dapat menghapus akun sendiri' });
      // a deleted user's active loans would be orphaned (user_id set null), so the
      // borrower could never confirm the return; settle the loans first.
      const active = await sql`select count(*)::int as n from borrowings where user_id = ${uid} and status in ('pending','approved','verified','borrowed','return_pending')`;
      if (active[0].n > 0) return send(res, 409, { error: 'User masih memiliki peminjaman aktif, selesaikan dulu sebelum menghapus' });
      await sql`delete from users where id = ${uid}`;
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
