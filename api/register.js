import { getSql } from './_db.js';
import { hashPassword, signToken, send, readJson } from './_auth.js';
import { ensureSchema } from './_schema.js';

// Self-registration is DISABLED. New accounts are created by an admin from the
// "Kelola User" panel (POST /api/users). The only exception is a one-time
// bootstrap: if the database has no users at all, the first POST here creates
// the initial admin so the system can be set up on a fresh deployment.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const [{ count }] = await sql`select count(*) from users`;
    if (parseInt(count, 10) > 0) {
      return send(res, 403, { error: 'Pendaftaran mandiri dinonaktifkan. Hubungi admin untuk membuat akun.' });
    }

    // --- bootstrap path: no users yet -> create the first admin ---
    const { nip, name, password, phone } = await readJson(req);
    if (!nip || !name || !password) return send(res, 400, { error: 'Lengkapi nama, NIP, dan password' });
    if (String(password).length < 8) return send(res, 400, { error: 'Password minimal 8 karakter' });
    const wa = String(phone || '').replace(/\D/g, '').replace(/^0/, '62');

    const rows = await sql`
      insert into users (nip, name, phone, role, password_hash)
      values (${String(nip).trim()}, ${String(name)}, ${wa || null}, 'admin', ${hashPassword(password)})
      returning id, nip, name, role`;
    const u = rows[0];
    const token = signToken({ sub: u.id, nip: u.nip, name: u.name, role: u.role });
    return send(res, 200, { token, user: { nip: u.nip, name: u.name, role: u.role } });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
