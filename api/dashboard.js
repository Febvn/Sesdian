import { getSql } from './_db.js';
import { requireAuth, requireRoles, send } from './_auth.js';
import { ensureSchema } from './_schema.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();
  await ensureSchema(sql);

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
      // full row detail incl. admin (approver) and verifikator names + return date + borrower avatar
      const rows = await sql`
        select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at, b.returned_at, b.notes,
               coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code,
               coalesce(ua.name,'') as admin_name, coalesce(uv.name,'') as verifikator_name,
               coalesce(u.avatar,'') as borrower_avatar
        from borrowings b
        left join assets a on a.id = b.asset_id
        left join users ua on ua.id = b.approved_by
        left join users uv on uv.id = b.verified_by
        left join users u on u.id = b.user_id
        where b.created_at >= ${start}::date and b.created_at < (${end}::date + 1)
        order by b.created_at desc limit 5000`;
      const status = {};
      let total = 0;
      byStatus.forEach((s) => { status[s.status] = s.count; total += s.count; });
      return send(res, 200, { period: q.period || 'daily', start, end, total, by_status: status, rows });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  // Jejak audit (admin + verifikator), also merged here for the function limit:
  //   /api/dashboard?view=audit&start=&end=&entity=&action=&entity_id=&limit=&all=1
  // all=1 drops the date window (used for a room's latest stock-take).
  if (req.method === 'GET' && req.query && req.query.view === 'audit') {
    if (!requireRoles(req, res, ['admin', 'verifikator'])) return;
    try {
      const q = req.query || {};
      const today = new Date();
      const iso = (d) => d.toISOString().slice(0, 10);
      const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
      const all = q.all === '1';
      const start = all ? '1970-01-01' : (isDate(q.start) ? q.start : iso(new Date(today.getTime() - 29 * 86400000)));
      const end = all ? '9999-12-30' : (isDate(q.end) ? q.end : iso(today));
      const entity = /^[a-z_]{1,32}$/.test(q.entity || '') ? q.entity : null;
      const action = /^[a-z_]{1,32}$/.test(q.action || '') ? q.action : null;
      const entityId = parseInt(q.entity_id, 10) || null;
      const limit = Math.min(Math.max(parseInt(q.limit, 10) || 1000, 1), 5000);
      const rows = await sql`
        select l.id, l.created_at, l.action, l.entity, l.entity_id, l.detail,
               coalesce(nullif(u.name, ''), l.user_name, 'Sistem') as user_name,
               coalesce(u.role, l.user_role, '') as user_role
        from audit_log l
        left join users u on u.id = l.user_id
        where l.created_at >= ${start}::date and l.created_at < (${end}::date + 1)
          and (${entity}::text is null or l.entity = ${entity})
          and (${action}::text is null or l.action = ${action})
          and (${entityId}::bigint is null or l.entity_id = ${entityId})
        order by l.created_at desc, l.id desc
        limit ${limit}`;
      return send(res, 200, { start: all ? null : start, end: all ? null : end, total: rows.length, rows });
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
