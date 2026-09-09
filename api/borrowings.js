import { getSql } from './_db.js';
import { requireAuth, send, readJson } from './_auth.js';
import { notifyAdminBorrow } from './_wa.js';

// Stock is counted as "out" while a borrowing is in any of these states.
const RESERVED = ['pending', 'approved', 'verified', 'borrowed', 'return_pending'];
const STATUSES = ['pending', 'approved', 'verified', 'borrowed', 'return_pending', 'returned', 'rejected'];
const STAFF = ['admin', 'verifikator'];

// Workflow:
//   pending --(admin approve)--> approved --(verifikator verify)--> verified
//        --(staff lend)--> borrowed --(peminjam: konfirmasi kembali)--> return_pending
//        --(admin/verifikator verifikasi pengembalian)--> returned
//   Staff may also return a borrowed item directly. rejected/return-reject branches exist.
// Each transition declares the required previous status and who may perform it.
function transitionError(prevStatus, target, role, isOwner) {
  const staff = STAFF.indexOf(role) !== -1;
  const rule = {
    approved: { from: ['pending'], ok: role === 'admin', msg: 'Persetujuan awal hanya oleh admin.' },
    verified: { from: ['approved'], ok: role === 'verifikator', msg: 'Verifikasi kedua hanya oleh verifikator.' },
    borrowed: { from: ['verified', 'return_pending'], ok: staff, msg: 'Hanya admin/verifikator.' },
    return_pending: { from: ['borrowed'], ok: staff || isOwner, msg: 'Hanya peminjam atau admin yang dapat mengonfirmasi pengembalian.' },
    returned: { from: ['borrowed', 'return_pending'], ok: staff, msg: 'Verifikasi pengembalian hanya oleh admin/verifikator.' },
    rejected: { from: ['pending', 'approved', 'verified'], ok: staff, msg: 'Peminjaman ini tidak bisa ditolak.' },
  }[target];
  if (!rule) return 'Status tidak valid';
  if (!rule.ok) return rule.msg;
  if (rule.from.indexOf(prevStatus) === -1) return rule.msg;
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  // ---------- list (staff see all; users see only their own) ----------
  if (req.method === 'GET') {
    const auth = requireAuth(req, res); if (!auth) return;
    try {
      const page = parseInt(req.query?.page || 1, 10);
      const limit = Math.min(parseInt(req.query?.limit || 5000, 10), 10000);
      const offset = (page - 1) * limit;
      const seesAll = STAFF.indexOf(auth.role) !== -1;

      const rows = seesAll
        ? await sql`select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at,
               b.approved_at, b.verified_at, b.returned_at,
               coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code,
               count(*) over() as total_count
            from borrowings b left join assets a on a.id = b.asset_id
            order by b.created_at desc limit ${limit} offset ${offset}`
        : await sql`select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at,
               b.approved_at, b.verified_at, b.returned_at,
               coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code,
               count(*) over() as total_count
            from borrowings b left join assets a on a.id = b.asset_id
            where b.user_id = ${auth.sub}
            order by b.created_at desc limit ${limit} offset ${offset}`;

      const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
      return send(res, 200, { borrowings: rows, total, page, limit });
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
      const arows = await sql`select name from assets where id = ${assetId}`;
      const assetName = arows.length ? arows[0].name : 'Aset';
      await notifyAdminBorrow({ assetName: assetName, borrower: borrower, qty: qty, due: dueDate }); // best-effort WA
      return send(res, 200, { borrowing: rows[0], asset_name: assetName });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  // ---------- change status (role-gated per transition; owner may confirm return) ----------
  if (req.method === 'PATCH') {
    const auth = requireAuth(req, res); if (!auth) return;
    try {
      const body = await readJson(req);
      const id = parseInt(body.id, 10);
      const status = String(body.status || '');
      if (!id || STATUSES.indexOf(status) === -1) return send(res, 400, { error: 'Data tidak valid' });

      const cur = await sql`select status, qty, asset_id, user_id from borrowings where id = ${id}`;
      if (!cur.length) return send(res, 404, { error: 'Peminjaman tidak ditemukan' });
      const prev = cur[0];
      const isOwner = String(prev.user_id) === String(auth.sub);

      const err = transitionError(prev.status, status, auth.role, isOwner);
      if (err) return send(res, 403, { error: err });

      const wasOut = RESERVED.indexOf(prev.status) !== -1;
      const nowOut = RESERVED.indexOf(status) !== -1;
      const releasing = wasOut && !nowOut;     // returned/rejected -> give stock back
      const reserving = !wasOut && nowOut;     // (re)activate -> take stock again

      if (reserving && prev.asset_id) {
        const a = await sql`select stock_available from assets where id = ${prev.asset_id}`;
        if (a.length && a[0].stock_available < prev.qty) return send(res, 400, { error: 'Stok tidak mencukupi untuk mengaktifkan kembali' });
      }

      const dAvail = releasing ? prev.qty : (reserving ? -prev.qty : 0);
      const dBorrow = releasing ? -prev.qty : (reserving ? prev.qty : 0);
      // status + audit stamps + stock adjustment in ONE statement -> can't desync
      await sql`
        with b as (
          update borrowings set
            status = ${status},
            approved_by = case when ${status} = 'approved' then ${auth.sub} else approved_by end,
            approved_at = case when ${status} = 'approved' then now()      else approved_at end,
            verified_by = case when ${status} = 'verified' then ${auth.sub} else verified_by end,
            verified_at = case when ${status} = 'verified' then now()      else verified_at end,
            returned_at = case when ${status} = 'returned' then now()      else returned_at end
          where id = ${id} returning asset_id
        )
        update assets a set stock_available = a.stock_available + ${dAvail},
                            stock_borrowed  = a.stock_borrowed  + ${dBorrow}
        from b where a.id = b.asset_id`;
      return send(res, 200, { ok: true, status: status });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}
