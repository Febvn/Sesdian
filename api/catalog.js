import { getSql } from './_db.js';
import { send } from './_auth.js';

// PUBLIC catalog for the guest landing page (no auth, no stock figures).
// Returns assets + the category/room lists used for filtering.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const sql = getSql();
  try {
    const assets = await sql`
      select a.id, a.code, a.name, coalesce(a.brand,'') as brand,
             coalesce(a.type,'BMN') as type, a.image, a.qr_code,
             coalesce(c.name,'') as category, coalesce(r.name,'') as room
      from assets a
      left join categories c on c.id = a.category_id
      left join rooms r on r.id = a.room_id
      order by a.name`;
    const categories = await sql`select id, name from categories order by name`;
    const rooms = await sql`select id, name from rooms order by name`;
    return send(res, 200, { assets, categories, rooms });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
