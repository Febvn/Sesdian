import { getSql } from './_db.js';
import { verifyPassword, hashPassword, signToken, send, readJson } from './_auth.js';
import { ensureSchema } from './_schema.js';

// Rate limit login per NIP: setelah MAX_FAILS kegagalan dalam WINDOW menit,
// percobaan berikutnya untuk NIP itu ditolak sampai jendelanya lewat.
const MAX_FAILS = 10;
const WINDOW_MIN = 15;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readJson(req);
    const nip = String(body.nip || '').trim();
    const password = String(body.password || '');
    if (!nip) return send(res, 400, { error: 'Masukkan NIP' });

    const sql = getSql();
    await ensureSchema(sql);

    // Step 1: check whether NIP exists and has a password (no auth required)
    if (body.action === 'check') {
      const rows = await sql`select id, password_hash from users where nip = ${nip}`;
      if (!rows.length) {
        await new Promise(r => setTimeout(r, 500));
        return send(res, 200, { exists: false });
      }
      return send(res, 200, { exists: true, has_password: !!rows[0].password_hash });
    }

    const recent = await sql`select count(*)::int as n from login_attempts
      where nip = ${nip} and created_at > now() - ${WINDOW_MIN + ' minutes'}::interval`;
    if (recent[0].n >= MAX_FAILS)
      return send(res, 429, { error: 'Terlalu banyak percobaan masuk untuk NIP ini. Tunggu ' + WINDOW_MIN + ' menit lalu coba lagi.' });
    const recordFail = async () => {
      await sql`insert into login_attempts (nip) values (${nip})`;
      await sql`delete from login_attempts where created_at < now() - interval '1 day'`;
    };

    const rows = await sql`select id, nip, name, role, password_hash from users where nip = ${nip}`;

    if (!rows.length) {
      await recordFail();
      await new Promise(r => setTimeout(r, 1000));
      return send(res, 401, { error: 'NIP atau password salah' });
    }
    const u = rows[0];

    // Akun berisi NIP saja (dibuat admin): pemiliknya mengatur nama dan
    // password sendiri lewat alur claim, lalu langsung masuk.
    const unclaimed = !u.password_hash;
    if (unclaimed) {
      if (!body.claim) return send(res, 200, { claim_required: true });
      const newName = String(body.name || '').trim();
      if (!newName) return send(res, 400, { error: 'Masukkan nama lengkap' });
      if (password.length < 8) return send(res, 400, { error: 'Password minimal 8 karakter' });
      // klausa where menjaga dari balapan: kalau akun keburu diklaim orang
      // lain, update ini tidak mengenai baris apa pun.
      const updated = await sql`
        update users set name = ${newName}, password_hash = ${hashPassword(password)}
        where id = ${u.id} and (password_hash is null or password_hash = '')
        returning id, nip, name, role`;
      if (!updated.length) return send(res, 409, { error: 'Akun sudah diaktifkan, silakan masuk dengan password Anda' });
      u.name = updated[0].name;
    } else {
      if (!password) return send(res, 400, { error: 'Masukkan NIP dan password' });
      if (!verifyPassword(password, u.password_hash)) {
        await recordFail();
        await new Promise(r => setTimeout(r, 1500));
        return send(res, 401, { error: 'NIP atau password salah' });
      }
    }

    let role = u.role;
    // bootstrap: if the system has no admin yet, the first account to log in is promoted
    if (role !== 'admin') {
      const adminExists = await sql`select 1 from users where role = 'admin' limit 1`;
      if (!adminExists.length) { await sql`update users set role = 'admin' where id = ${u.id}`; role = 'admin'; }
    }
    await sql`delete from login_attempts where nip = ${nip}`; // sukses: bersihkan hitungan
    const token = signToken({ sub: u.id, nip: u.nip, name: u.name, role: role });
    return send(res, 200, { token, user: { nip: u.nip, name: u.name, role: role } });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
