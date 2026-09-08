import { getSql } from './_db.js';
import { requireAuth, requireRoles, send } from './_auth.js';

const UNIT = { daily: 'day', weekly: 'week', monthly: 'month' };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  // Borrowing reports (admin + verifikator), merged here to stay under the
  // serverless function limit: /api/dashboard?view=reports&period=&start=&end=
  if (req.method === 'GET' && req.query && req.query.view === 'reports') {
    if (!requireRoles(req, res, ['admin', 'verifikator'])) return;
    try {
      const q = req.query || {};
      const unit = UNIT[q.period] || 'day';
      const today = new Date();
      const def = new Date(today.getTime() - 29 * 86400000);
      const iso = (d) => d.toISOString().slice(0, 10);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(q.start || '') ? q.start : iso(def);
      const end = /^\d{4}-\d{2}-\d{2}$/.test(q.end || '') ? q.end : iso(today);

      const series = await sql`
        select to_char(date_trunc(${unit}, created_at), 'YYYY-MM-DD') as bucket, count(*)::int as count
        from borrowings where created_at >= ${start}::date and created_at < (${end}::date + 1)
        group by 1 order by 1`;
      const byStatus = await sql`
        select status, count(*)::int as count from borrowings
        where created_at >= ${start}::date and created_at < (${end}::date + 1) group by status`;
      const topAssets = await sql`
        select coalesce(a.name,'-') as name, coalesce(a.code,'') as code,
               count(*)::int as count, coalesce(sum(b.qty),0)::int as qty
        from borrowings b left join assets a on a.id = b.asset_id
        where b.created_at >= ${start}::date and b.created_at < (${end}::date + 1)
        group by 1, 2 order by count desc, qty desc limit 10`;
      const topBorrowers = await sql`
        select coalesce(borrower_name,'-') as name, count(*)::int as count from borrowings
        where created_at >= ${start}::date and created_at < (${end}::date + 1)
        group by 1 order by count desc limit 10`;
      const rows = await sql`
        select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at,
               coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code
        from borrowings b left join assets a on a.id = b.asset_id
        where b.created_at >= ${start}::date and b.created_at < (${end}::date + 1)
        order by b.created_at desc limit 1000`;
      const total = series.reduce((t, s) => t + s.count, 0);
      const status = {};
      byStatus.forEach((s) => { status[s.status] = s.count; });
      return send(res, 200, { period: q.period || 'daily', start, end, total, series, by_status: status, top_assets: topAssets, top_borrowers: topBorrowers, rows });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

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
