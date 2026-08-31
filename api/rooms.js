import { getSql } from './_db.js';
import { requireAuth, send } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    const sql = getSql();
    const rows = await sql`select id, name, coalesce(code,'') as code, coalesce(pic,'') as pic from rooms order by id`;
    return send(res, 200, { rooms: rows });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
