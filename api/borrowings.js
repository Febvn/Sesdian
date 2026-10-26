import { getSql } from './_db.js';
import { requireAuth, send, readJson } from './_auth.js';
import { notifyAdminBorrow } from './_wa.js';
import { ensureSchema } from './_schema.js';

// Stock is counted as "out" while a borrowing is in any of these states.
const RESERVED = ['pending', 'approved', 'verified', 'borrowed', 'return_pending'];
const STATUSES = ['pending', 'approved', 'verified', 'borrowed', 'return_pending', 'returned', 'rejected', 'cancelled', 'expired'];
const STAFF = ['admin', 'verifikator'];

// Workflow (two-tier verification, then item is physically handed over):
//   pending --(admin approve = verif 1)--> approved
//        --(verifikator verify = verif 2, serah terima)--> borrowed (= sedang dipinjam)
//        --(peminjam: konfirmasi kembali)--> return_pending
//        --(admin/verifikator verifikasi pengembalian)--> returned
//   pending / approved --(peminjam/admin batalkan sebelum serah terima)--> cancelled (stok kembali)
function transitionError(prevStatus, target, role, isOwner) {
  const staff = STAFF.indexOf(role) !== -1;

  // Larangan memproses pengajuan sendiri (SKPL):
  // Admin dan Verifikator dilarang menyetujui, memverifikasi serah terima,
  // menyelesaikan pengembalian, atau menolak peminjaman atas nama dirinya sendiri.
  if (isOwner && staff) {
    if (target === 'approved') return 'Tidak dapat menyetujui pengajuan milik sendiri.';
    if (target === 'borrowed') return 'Tidak dapat memverifikasi serah terima pengajuan milik sendiri.';
    if (target === 'returned') return 'Tidak dapat memverifikasi pengembalian pengajuan milik sendiri.';
    if (target === 'rejected') return 'Tidak dapat menolak pengajuan sendiri, gunakan opsi batalkan.';
  }

  let rule;
  if (target === 'approved') {
    rule = { from: ['pending'], ok: role === 'admin', msg: 'Persetujuan awal hanya oleh admin.' };
  } else if (target === 'borrowed') {
    if (prevStatus === 'approved') {
      rule = { from: ['approved'], ok: role === 'verifikator', msg: 'Verifikasi kedua (serah terima) hanya oleh verifikator.' };
    } else {
      rule = { from: ['verified', 'return_pending'], ok: staff, msg: 'Hanya admin/verifikator.' };
    }
  } else if (target === 'return_pending') {
    rule = { from: ['borrowed', 'verified'], ok: staff || isOwner, msg: 'Hanya peminjam atau admin yang dapat mengonfirmasi pengembalian.' };
  } else if (target === 'returned') {
    rule = { from: ['borrowed', 'verified', 'return_pending'], ok: staff, msg: 'Verifikasi pengembalian hanya oleh admin/verifikator.' };
  } else if (target === 'rejected') {
    rule = { from: ['pending', 'approved', 'verified'], ok: staff, msg: 'Peminjaman ini tidak bisa ditolak.' };
  } else if (target === 'cancelled') {
    // Peminjam atau admin berhak membatalkan pengajuan sebelum barang diserahterimakan (baik selagi pending maupun setelah approved)
    rule = { from: ['pending', 'approved'], ok: isOwner || staff, msg: 'Hanya peminjam atau admin yang dapat membatalkan pengajuan sebelum serah terima.' };
  } else if (target === 'expired') {
    rule = { from: ['pending', 'approved', 'borrowed', 'verified', 'return_pending'], ok: staff, msg: 'Penetapan status kedaluwarsa hanya oleh staf.' };
  } else {
    return 'Status tidak valid';
  }

  if (!rule.ok) return rule.msg;
  if (rule.from.indexOf(prevStatus) === -1) return rule.msg;
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();
  await ensureSchema(sql);

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
               coalesce(a.qr_code,'') as asset_qr_code,
               coalesce(u.avatar,'') as borrower_avatar,
               case when b.due_date is not null and b.due_date < current_date and b.status in ('borrowed', 'verified', 'return_pending', 'approved') then true else false end as is_overdue,
               count(*) over() as total_count
            from borrowings b left join assets a on a.id = b.asset_id
            left join users u on u.id = b.user_id
            order by b.created_at desc limit ${limit} offset ${offset}`
        : await sql`select b.id, b.borrower_name, b.qty, b.status, b.due_date, b.created_at,
               b.approved_at, b.verified_at, b.returned_at,
               coalesce(a.name,'-') as asset_name, coalesce(a.code,'') as asset_code,
               coalesce(a.qr_code,'') as asset_qr_code,
               case when b.due_date is not null and b.due_date < current_date and b.status in ('borrowed', 'verified', 'return_pending', 'approved') then true else false end as is_overdue,
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
      if (!dueDate) return send(res, 400, { error: 'Tanggal jatuh tempo kembali wajib diisi' });

      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate)) || isNaN(new Date(dueDate + 'T00:00:00Z').getTime()))
        return send(res, 400, { error: 'Format tanggal jatuh tempo tidak valid' });
      if (String(dueDate) < new Date().toISOString().slice(0, 10))
        return send(res, 400, { error: 'Tanggal jatuh tempo tidak boleh di masa lalu' });

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
      await notifyAdminBorrow({ assetName: assetName, borrower: borrower, qty: qty, due: dueDate });
      return send(res, 200, { borrowing: rows[0], asset_name: assetName });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  // ---------- change status (role-gated per transition; owner may cancel or confirm return) ----------
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

      // Verifikasi pencocokan unit fisik hasil pemindaian (F-18 & F-20)
      if ((status === 'borrowed' || status === 'returned') && (body.scanned_code || body.asset_code || body.qr_code)) {
        const rawScanned = String(body.scanned_code || body.asset_code || body.qr_code).trim();
        if (rawScanned && prev.asset_id) {
          let code = rawScanned;
          if (code.indexOf('qr=') !== -1) {
            const m = code.match(/[?&]qr=([^&#]+)/);
            if (m && m[1]) code = decodeURIComponent(m[1]).trim();
          }
          const arows = await sql`select code, qr_code, name from assets where id = ${prev.asset_id}`;
          if (arows.length) {
            const ast = arows[0];
            const c1 = String(ast.code || '').trim().toLowerCase();
            const q1 = String(ast.qr_code || '').trim().toLowerCase();
            const s1 = code.toLowerCase();
            if (s1 !== c1 && s1 !== q1 && rawScanned.toLowerCase() !== c1 && rawScanned.toLowerCase() !== q1) {
              return send(res, 400, {
                error: `Unit yang dipindai (${rawScanned}) tidak cocok dengan unit aset yang disetujui (${ast.name} - ${ast.code || ast.qr_code}).`
              });
            }
          }
        }
      }

      const wasOut = RESERVED.indexOf(prev.status) !== -1;
      const nowOut = RESERVED.indexOf(status) !== -1;
      const releasing = wasOut && !nowOut;     // returned/rejected/cancelled/expired -> give stock back
      const reserving = !wasOut && nowOut;     // (re)activate -> take stock again

      if (reserving && prev.asset_id) {
        const a = await sql`select stock_available from assets where id = ${prev.asset_id}`;
        if (a.length && a[0].stock_available < prev.qty) return send(res, 400, { error: 'Stok tidak mencukupi untuk mengaktifkan kembali' });
      }

      const dAvail = releasing ? prev.qty : (reserving ? -prev.qty : 0);
      const dBorrow = releasing ? -prev.qty : (reserving ? prev.qty : 0);
      // Status update + audit stamps + stock adjustment in ONE statement
      await sql`
        with b as (
          update borrowings set
            status = ${status},
            approved_by = case when ${status} = 'approved' then ${auth.sub} else approved_by end,
            approved_at = case when ${status} = 'approved' then now()      else approved_at end,
            verified_by = case when (${status} = 'borrowed' and ${prev.status} = 'approved') or ${status} = 'verified' then ${auth.sub} else verified_by end,
            verified_at = case when (${status} = 'borrowed' and ${prev.status} = 'approved') or ${status} = 'verified' then now() else verified_at end,
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
