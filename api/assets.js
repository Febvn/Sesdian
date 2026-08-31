import { getSql } from './_db.js';
import { requireAuth, send } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    const sql = getSql();
    const rows = await sql`
      select a.id, a.code, a.name, coalesce(a.brand,'') as brand, a.year,
             coalesce(a.condition,'Baik') as condition, coalesce(a.type,'BMN') as type,
             coalesce(a.asset_type,'') as asset_type,
             a.stock_total, a.stock_available, a.stock_borrowed,
             coalesce(c.name,'') as category, coalesce(r.name,'') as room
      from assets a
      left join categories c on c.id = a.category_id
      left join rooms r on r.id = a.room_id
      order by a.id`;
    return send(res, 200, { assets: rows });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
