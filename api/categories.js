import { getSql } from './_db.js';
import { requireAuth, send } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    const sql = getSql();
    const rows = await sql`select id, name, coalesce(icon,'📦') as icon from categories order by id`;
    return send(res, 200, { categories: rows });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
