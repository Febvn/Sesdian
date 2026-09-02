import { getSql } from './_db.js';
import { requireAuth, requireAdmin, send, readJson } from './_auth.js';
import { waEnabled, normalizeWa, ensureSettings } from './_wa.js';

export default async function handler(req, res) {
  const sql = getSql();
  await ensureSettings(sql);   // create the settings table on first use (self-heal)

  // any signed-in user may read settings the client needs (e.g. wa fallback)
  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    try {
      const rows = await sql`select value from settings where key = 'wa_number'`;
      return send(res, 200, { wa_number: rows.length ? (rows[0].value || '') : '', wa_auto: waEnabled() });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  // only admins may change settings
  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const b = await readJson(req);
      const num = normalizeWa(b.wa_number);
      await sql`insert into settings (key, value) values ('wa_number', ${num})
                on conflict (key) do update set value = ${num}`;
      return send(res, 200, { wa_number: num, wa_auto: waEnabled() });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
