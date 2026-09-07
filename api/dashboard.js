import { getSql } from './_db.js';
import { requireAuth, send } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  if (req.method === 'GET') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const [{ total_assets, total_stock, stock_available, stock_borrowed }] = await sql`
        select 
          count(*) as total_assets,
          coalesce(sum(stock_total), 0) as total_stock,
          coalesce(sum(stock_available), 0) as stock_available,
          coalesce(sum(stock_borrowed), 0) as stock_borrowed
        from assets
      `;
      
      const seesAll = auth.role === 'admin' || auth.role === 'verifikator';
      const [{ pending }] = seesAll
        ? await sql`select count(*) as pending from borrowings where status = 'pending'`
        : await sql`select count(*) as pending from borrowings where status = 'pending' and user_id = ${auth.sub}`;

      const monitor = await sql`
        select name, code, stock_available as available, stock_total as total
        from assets
        order by stock_available asc
        limit 10
      `;

      const recent = seesAll
        ? await sql`select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at, coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code from borrowings b left join assets a on a.id = b.asset_id order by b.created_at desc limit 5`
        : await sql`select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at, coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code from borrowings b left join assets a on a.id = b.asset_id where b.user_id = ${auth.sub} order by b.created_at desc limit 5`;

      return send(res, 200, {
        stats: {
          total_assets: parseInt(total_assets, 10),
          total_stock: parseInt(total_stock, 10),
          stock_available: parseInt(stock_available, 10),
          stock_borrowed: parseInt(stock_borrowed, 10),
          pending: parseInt(pending, 10)
        },
        monitor: monitor,
        recent: recent
      });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
