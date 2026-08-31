import { getSql } from './_db.js';
import { verifyPassword, signToken, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const { nip, password } = await readJson(req);
    if (!nip || !password) return send(res, 400, { error: 'Masukkan NIP dan password' });

    const sql = getSql();
    const rows = await sql`select id, nip, name, role, password_hash from users where nip = ${String(nip).trim()}`;
    if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
      return send(res, 401, { error: 'NIP atau password salah' });
    }
    const u = rows[0];
    const token = signToken({ sub: u.id, nip: u.nip, name: u.name, role: u.role });
    return send(res, 200, { token, user: { nip: u.nip, name: u.name, role: u.role } });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
