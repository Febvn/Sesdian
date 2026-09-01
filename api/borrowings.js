import { getSql } from './_db.js';
import { requireAuth, requireAdmin, send, readJson } from './_auth.js';

const RESERVED = ['pending', 'approved', 'borrowed']; // stock counted as out while in these states
const STATUSES = ['pending', 'approved', 'borrowed', 'returned', 'rejected'];

export default async function handler(req, res) {
  const sql = getSql();

  // ---------- list (admins see all; users see only their own) ----------
  if (req.method === 'GET') {
    const auth = requireAuth(req, res); if (!auth) return;
    try {
      const rows = auth.role === 'admin'
        ? await sql`select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at,
               coalesce(a.name,'—') as asset_name, coalesce(a.code,'') as asset_code
            from borrowings b left join assets a on a.id = b.asset_id
            order by b.created_at desc`
        : await sql`select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at,
               coalesce(a.name,'—') as asset_name, coalesce(a.code,'') as asset_code
            from borrowings b left join assets a on a.id = b.asset_id
            where b.user_id = ${auth.sub}
            order by b.created_at desc`;
      return send(res, 200, { borrowings: rows });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  // ---------- create (any authenticated user) ----------
  if (req.method === 'POST') {
    const auth = requireAuth(req, res); if (!auth) return;
    try {
      const body = await readJson(req);
      const assetId = parseInt(body.assetId, 10);
      const qty = Math.max(1, parseInt(body.qty || 1, 10));
      const dueDate = body.dueDate || null;
      const notes = body.notes || null;
      if (!assetId) return send(res, 400, { error: 'Aset tidak valid' });

      const urows = await sql`select name from users where id = ${auth.sub}`;
      const borrower = urows.length ? urows[0].name : 'Pengguna';

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
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  // ---------- admin: change status (approve / reject / borrow / return) ----------
  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJson(req);
      const id = parseInt(body.id, 10);
      const status = String(body.status || '');
      if (!id || STATUSES.indexOf(status) === -1) return send(res, 400, { error: 'Data tidak valid' });

      const cur = await sql`select status, qty, asset_id from borrowings where id = ${id}`;
      if (!cur.length) return send(res, 404, { error: 'Peminjaman tidak ditemukan' });
      const prev = cur[0];

      const wasOut = RESERVED.indexOf(prev.status) !== -1;
      const nowOut = RESERVED.indexOf(status) !== -1;
      const releasing = wasOut && !nowOut;     // returned/rejected -> give stock back
      const reserving = !wasOut && nowOut;     // re-activate -> take stock again

      // re-reserve guard: never over-commit beyond available stock
      if (reserving && prev.asset_id) {
        const a = await sql`select stock_available from assets where id = ${prev.asset_id}`;
        if (a.length && a[0].stock_available < prev.qty) return send(res, 400, { error: 'Stok tidak mencukupi untuk mengaktifkan kembali' });
      }

      const dAvail = releasing ? prev.qty : (reserving ? -prev.qty : 0);
      const dBorrow = releasing ? -prev.qty : (reserving ? prev.qty : 0);
      // status update + stock adjustment in ONE statement -> can't desync
      await sql`
        with b as (update borrowings set status = ${status} where id = ${id} returning asset_id)
        update assets a set stock_available = a.stock_available + ${dAvail},
                            stock_borrowed  = a.stock_borrowed  + ${dBorrow}
        from b where a.id = b.asset_id`;
      return send(res, 200, { ok: true, status: status });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
