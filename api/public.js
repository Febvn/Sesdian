import { getSql } from './_db.js';
import { getAuth, send } from './_auth.js';
import { ensureSchema } from './_schema.js';

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
  await ensureSchema(sql);
  const resource = (req.query && req.query.resource) || 'catalog';
  try {
    // jenis image binary: /api/public?resource=img&key=<name_key>&t=<ver>
    // (t only busts caches; content is immutable per version)
    if (resource === 'img') {
      const key = String((req.query && req.query.key) || '').trim();
      if (!key) return send(res, 400, { error: 'key wajib diisi' });
      const rows = await sql`select image from asset_images where name_key = ${key}`;
      const m = rows.length ? /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/.exec(rows[0].image || '') : null;
      if (!m) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain'); return res.end('not found'); }
      res.statusCode = 200;
      res.setHeader('Content-Type', m[1]);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(Buffer.from(m[2], 'base64'));
    }

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
                   coalesce(c.name,'') as category, coalesce(r.name,'') as room,
                   ai.name_key as jenis_key, extract(epoch from ai.updated_at)::bigint as jenis_ver
            from assets a
            left join categories c on c.id = a.category_id
            left join rooms r on r.id = a.room_id
            left join asset_images ai on ai.name_key = btrim(regexp_replace(lower(a.name || ' ' || coalesce(a.brand,'')), '[^a-z0-9]+', '-', 'g'), '-')
            where a.id = ${id}`
        : await sql`
            select a.id, a.code, a.name, coalesce(a.brand,'') as brand, a.year,
                   coalesce(a.condition,'Baik') as condition, coalesce(a.type,'BMN') as type,
                   coalesce(a.asset_type,'') as asset_type, a.image, a.qr_code,
                   a.stock_total, a.stock_available, a.stock_borrowed,
                   coalesce(c.name,'') as category, coalesce(r.name,'') as room,
                   ai.name_key as jenis_key, extract(epoch from ai.updated_at)::bigint as jenis_ver
            from assets a
            left join categories c on c.id = a.category_id
            left join rooms r on r.id = a.room_id
            left join asset_images ai on ai.name_key = btrim(regexp_replace(lower(a.name || ' ' || coalesce(a.brand,'')), '[^a-z0-9]+', '-', 'g'), '-')
            where a.qr_code = ${qr}`;

      if (!rows.length) return send(res, 404, { error: 'Aset tidak ditemukan' });
      const a = rows[0];
      const authed = !!getAuth(req);
      const detail = {
        id: a.id, code: a.code, name: a.name, brand: a.brand, year: a.year,
        condition: a.condition, type: a.type, asset_type: a.asset_type,
        image: a.image, qr_code: a.qr_code, category: a.category, room: a.room,
        jenis_key: a.jenis_key, jenis_ver: a.jenis_ver,
      };
      if (authed) {
        detail.stock_total = a.stock_total;
        detail.stock_available = a.stock_available;
        detail.stock_borrowed = a.stock_borrowed;
        detail.available = a.stock_available > 0;
      }
      return send(res, 200, { asset: detail, authed });
    }

    // default: catalog (no stock figures per item, but aggregate stats for the overview)
    const assets = await sql`
      select a.id, a.code, a.name, coalesce(a.brand,'') as brand,
             coalesce(a.type,'BMN') as type, a.image, a.qr_code,
             coalesce(c.name,'') as category, coalesce(r.name,'') as room,
             ai.name_key as jenis_key, extract(epoch from ai.updated_at)::bigint as jenis_ver
      from assets a
      left join categories c on c.id = a.category_id
      left join rooms r on r.id = a.room_id
      left join asset_images ai on ai.name_key = btrim(regexp_replace(lower(a.name || ' ' || coalesce(a.brand,'')), '[^a-z0-9]+', '-', 'g'), '-')
      order by a.name`;
    const categories = await sql`select id, name from categories order by name`;
    const rooms = await sql`select id, name from rooms order by name`;
    const aggRows = await sql`
      select count(*)::int as total_assets,
             coalesce(sum(stock_total),0)::int as total_stock,
             coalesce(sum(stock_available),0)::int as stock_available,
             coalesce(sum(stock_borrowed),0)::int as stock_borrowed
      from assets`;
    const pendingRows = await sql`select count(*)::int as cnt from borrowings where status = 'pending'`;
    const stats = {
      total_assets: aggRows[0].total_assets,
      total_stock: aggRows[0].total_stock,
      stock_available: aggRows[0].stock_available,
      stock_borrowed: aggRows[0].stock_borrowed,
      pending: pendingRows[0].cnt,
    };
    return send(res, 200, { assets, categories, rooms, stats });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
