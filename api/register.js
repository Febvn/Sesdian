import { getSql } from './_db.js';
import { hashPassword, signToken, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const { nip, name, password } = await readJson(req);
    if (!nip || !name || !password) return send(res, 400, { error: 'Lengkapi nama, NIP, dan password' });
    if (String(password).length < 8) return send(res, 400, { error: 'Password minimal 8 karakter' });

    const sql = getSql();
    const exists = await sql`select id from users where nip = ${String(nip).trim()}`;
    if (exists.length) return send(res, 409, { error: 'NIP sudah terdaftar' });

    // bootstrap: the very first account created becomes the admin - derived
    // atomically in one statement so concurrent registrations can't both win.
    const rows = await sql`
      insert into users (nip, name, role, password_hash)
      values (${String(nip).trim()}, ${String(name)},
              case when not exists (select 1 from users) then 'admin' else 'user' end,
              ${hashPassword(password)})
      returning id, nip, name, role`;
    const u = rows[0];
    const token = signToken({ sub: u.id, nip: u.nip, name: u.name, role: u.role });
    return send(res, 200, { token, user: { nip: u.nip, name: u.name, role: u.role } });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
