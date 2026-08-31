import { getSql } from './_db.js';
import { requireAuth, send, readJson } from './_auth.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const sql = getSql();

  // ---------- list ----------
  if (req.method === 'GET') {
    try {
      const rows = await sql`
        select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at,
               coalesce(a.name,'—') as asset_name, coalesce(a.code,'') as asset_code
        from borrowings b
        left join assets a on a.id = b.asset_id
        order by b.created_at desc`;
      return send(res, 200, { borrowings: rows });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // ---------- create (atomic reserve + insert) ----------
  if (req.method === 'POST') {
    try {
      const body = await readJson(req);
      const assetId = parseInt(body.assetId, 10);
      const qty = Math.max(1, parseInt(body.qty || 1, 10));
      const dueDate = body.dueDate || null;
      const notes = body.notes || null;
      if (!assetId) return send(res, 400, { error: 'Aset tidak valid' });

      const urows = await sql`select name from users where id = ${auth.sub}`;
      const borrower = urows.length ? urows[0].name : 'Pengguna';

      // single statement: a data-modifying CTE decrements stock only if available,
      // and the INSERT runs only when the CTE produced a row -> fully atomic.
      const rows = await sql`
        with upd as (
          update assets
             set stock_available = stock_available - ${qty},
                 stock_borrowed  = stock_borrowed  + ${qty}
           where id = ${assetId} and stock_available >= ${qty}
          returning id
        )
        insert into borrowings (asset_id, user_id, borrower_name, qty, status, due_date, notes)
        select ${assetId}, ${auth.sub}, ${borrower}, ${qty}, 'pending', ${dueDate}, ${notes}
        from upd
        returning *`;

      if (!rows.length) return send(res, 400, { error: 'Stok tidak mencukupi' });
      return send(res, 200, { borrowing: rows[0] });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
