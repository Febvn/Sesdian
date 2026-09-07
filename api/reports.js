import { getSql } from './_db.js';
import { requireRoles, send } from './_auth.js';

// Borrowing reports (admin + verifikator). Aggregates by day / week / month
// over a date range, plus status breakdown and top assets/borrowers.
//   GET /api/reports?period=daily|weekly|monthly&start=YYYY-MM-DD&end=YYYY-MM-DD
const UNIT = { daily: 'day', weekly: 'week', monthly: 'month' };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  if (!requireRoles(req, res, ['admin', 'verifikator'])) return;
  const sql = getSql();
  try {
    const q = req.query || {};
    const unit = UNIT[q.period] || 'day';
    // default window: last 30 days
    const today = new Date();
    const def = new Date(today.getTime() - 29 * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(q.start || '') ? q.start : iso(def);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(q.end || '') ? q.end : iso(today);

    const series = await sql`
      select to_char(date_trunc(${unit}, created_at), 'YYYY-MM-DD') as bucket, count(*)::int as count
      from borrowings
      where created_at >= ${start}::date and created_at < (${end}::date + 1)
      group by 1 order by 1`;

    const byStatus = await sql`
      select status, count(*)::int as count
      from borrowings
      where created_at >= ${start}::date and created_at < (${end}::date + 1)
      group by status`;

    const topAssets = await sql`
      select coalesce(a.name,'-') as name, coalesce(a.code,'') as code,
             count(*)::int as count, coalesce(sum(b.qty),0)::int as qty
      from borrowings b left join assets a on a.id = b.asset_id
      where b.created_at >= ${start}::date and b.created_at < (${end}::date + 1)
      group by 1, 2 order by count desc, qty desc limit 10`;

    const topBorrowers = await sql`
      select coalesce(borrower_name,'-') as name, count(*)::int as count
      from borrowings
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

    return send(res, 200, {
      period: q.period || 'daily', start, end, total,
      series, by_status: status, top_assets: topAssets, top_borrowers: topBorrowers, rows,
    });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
