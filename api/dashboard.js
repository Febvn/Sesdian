import { getSql } from './_db.js';
import { requireAuth, requireRoles, send } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  // Borrowing reports (admin + verifikator), merged here to stay under the
  // serverless function limit: /api/dashboard?view=reports&period=&start=&end=
  if (req.method === 'GET' && req.query && req.query.view === 'reports') {
    if (!requireRoles(req, res, ['admin', 'verifikator'])) return;
    try {
      const q = req.query || {};
      const today = new Date();
      const def = new Date(today.getTime() - 29 * 86400000);
      const iso = (d) => d.toISOString().slice(0, 10);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(q.start || '') ? q.start : iso(def);
      const end = /^\d{4}-\d{2}-\d{2}$/.test(q.end || '') ? q.end : iso(today);

      const byStatus = await sql`
        select status, count(*)::int as count from borrowings
        where created_at >= ${start}::date and created_at < (${end}::date + 1) group by status`;
      // full row detail incl. admin (approver) and verifikator names + return date
      const rows = await sql`
        select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at, b.returned_at,
               coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code,
               coalesce(ua.name,'') as admin_name, coalesce(uv.name,'') as verifikator_name
        from borrowings b
        left join assets a on a.id = b.asset_id
        left join users ua on ua.id = b.approved_by
        left join users uv on uv.id = b.verified_by
        where b.created_at >= ${start}::date and b.created_at < (${end}::date + 1)
        order by b.created_at desc limit 5000`;
      const status = {};
      let total = 0;
      byStatus.forEach((s) => { status[s.status] = s.count; total += s.count; });
      return send(res, 200, { period: q.period || 'daily', start, end, total, by_status: status, rows });
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
