import { getSql } from './_db.js';
import { verifyPassword, signToken, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const { nip, password } = await readJson(req);
    if (!nip || !password) return send(res, 400, { error: 'Masukkan NIP dan password' });

    const sql = getSql();
    const rows = await sql`select id, nip, name, role, password_hash from users where nip = ${String(nip).trim()}`;
    
    if (!rows.length) {
      await new Promise(r => setTimeout(r, 1000));
      return send(res, 401, { error: 'NIP atau password salah' });
    }

    if (!verifyPassword(password, rows[0].password_hash)) {
      await new Promise(r => setTimeout(r, 1500));
      return send(res, 401, { error: 'NIP atau password salah' });
    }

    const u = rows[0];
    let role = u.role;
    // bootstrap: if the system has no admin yet, the first account to log in is promoted
    if (role !== 'admin') {
      const adminExists = await sql`select 1 from users where role = 'admin' limit 1`;
      if (!adminExists.length) { await sql`update users set role = 'admin' where id = ${u.id}`; role = 'admin'; }
    }
    const token = signToken({ sub: u.id, nip: u.nip, name: u.name, role: role });
    return send(res, 200, { token, user: { nip: u.nip, name: u.name, role: role } });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
