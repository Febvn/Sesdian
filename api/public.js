import { getSql } from './_db.js';
import { getAuth, send } from './_auth.js';

// PUBLIC (no-auth) endpoints, combined to stay under the serverless function
// limit. Routed by ?resource=:
//   /api/public?resource=catalog                 -> guest catalog (no stock)
//   /api/public?resource=detail&qr=QR000001      -> asset detail by QR
//   /api/public?resource=detail&id=12            -> asset detail by id
// Detail includes stock figures only for signed-in users (guests see specs only).
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const sql = getSql();
  const resource = (req.query && req.query.resource) || 'catalog';
  try {
    if (resource === 'detail') {
      const q = req.query || {};
      const id = parseInt(q.id, 10);
      const qr = String(q.qr || '').trim();
      if (!id && !qr) return send(res, 400, { error: 'Sertakan id atau qr' });

      const rows = id
        ? await sql`
            select a.id, a.code, a.name, coalesce(a.brand,'') as brand, a.year,
                   coalesce(a.condition,'Baik') as condition, coalesce(a.type,'BMN') as type,
                   coalesce(a.asset_type,'') as asset_type, a.image, a.qr_code,
                   a.stock_total, a.stock_available, a.stock_borrowed,
                   coalesce(c.name,'') as category, coalesce(r.name,'') as room
            from assets a
            left join categories c on c.id = a.category_id
            left join rooms r on r.id = a.room_id
            where a.id = ${id}`
        : await sql`
            select a.id, a.code, a.name, coalesce(a.brand,'') as brand, a.year,
                   coalesce(a.condition,'Baik') as condition, coalesce(a.type,'BMN') as type,
                   coalesce(a.asset_type,'') as asset_type, a.image, a.qr_code,
                   a.stock_total, a.stock_available, a.stock_borrowed,
                   coalesce(c.name,'') as category, coalesce(r.name,'') as room
            from assets a
            left join categories c on c.id = a.category_id
            left join rooms r on r.id = a.room_id
            where a.qr_code = ${qr}`;

      if (!rows.length) return send(res, 404, { error: 'Aset tidak ditemukan' });
      const a = rows[0];
      const authed = !!getAuth(req);
      const detail = {
        id: a.id, code: a.code, name: a.name, brand: a.brand, year: a.year,
        condition: a.condition, type: a.type, asset_type: a.asset_type,
        image: a.image, qr_code: a.qr_code, category: a.category, room: a.room,
      };
      if (authed) {
        detail.stock_total = a.stock_total;
        detail.stock_available = a.stock_available;
        detail.stock_borrowed = a.stock_borrowed;
        detail.available = a.stock_available > 0;
      }
      return send(res, 200, { asset: detail, authed });
    }

    // default: catalog (no stock figures)
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
