import { getSql } from './_db.js';
import { getAuth, send } from './_auth.js';

// PUBLIC asset detail, reachable by QR scan: /api/asset-detail?qr=QR000001
// or /api/asset-detail?id=12. Stock figures + availability are only included
// for signed-in users (guests see the spec sheet but not stock).
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const sql = getSql();
  try {
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
  } catch (e) { return send(res, 500, { error: e.message }); }
}
