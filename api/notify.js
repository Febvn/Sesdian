import { getSql } from './_db.js';
import { getAuth, send, readJson } from './_auth.js';
import { sendWa, getWaNumber, normalizeWa } from './_wa.js';

// Build + (best-effort) send a WhatsApp message tied to a borrowing.
//   kind 'remind'        admin/verifikator -> borrower: overdue reminder
//   kind 'returned'      admin/verifikator -> borrower: return confirmed
//   kind 'return-request' borrower -> admin: "I have returned it, please verify"
// Scheduled task / Cron:
//   GET /api/notify?cron=overdue or POST with { action: 'cron' }
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();

  // Scheduled / Cron task endpoint: checks all overdue borrowings
  if (req.method === 'GET' && req.query && (req.query.cron === 'overdue' || req.query.action === 'cron')) {
    try {
      const overdueRows = await sql`
        select b.id, b.borrower_name, b.due_date, b.status, coalesce(a.name, '-') as asset_name, u.phone as borrower_phone
        from borrowings b
        left join assets a on a.id = b.asset_id
        left join users u on u.id = b.user_id
        where b.due_date is not null and b.due_date < current_date
          and b.status in ('borrowed', 'verified', 'return_pending', 'approved')
        order by b.due_date asc`;
      return send(res, 200, { ok: true, count: overdueRows.length, overdue: overdueRows });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const auth = getAuth(req);
  if (!auth) return send(res, 401, { error: 'Unauthorized' });

  try {
    const body = await readJson(req);

    if (body.action === 'cron') {
      const overdueRows = await sql`
        select b.id, b.borrower_name, b.due_date, b.status, coalesce(a.name, '-') as asset_name, u.phone as borrower_phone
        from borrowings b
        left join assets a on a.id = b.asset_id
        left join users u on u.id = b.user_id
        where b.due_date is not null and b.due_date < current_date
          and b.status in ('borrowed', 'verified', 'return_pending', 'approved')
        order by b.due_date asc`;
      return send(res, 200, { ok: true, count: overdueRows.length, overdue: overdueRows });
    }

    const id = parseInt(body.borrowingId, 10);
    const kind = String(body.kind || '');
    if (!id || ['remind', 'returned', 'return-request'].indexOf(kind) === -1) {
      return send(res, 400, { error: 'Data tidak valid' });
    }

    const rows = await sql`
      select b.id, b.user_id, b.status, b.due_date, b.borrower_name,
             coalesce(a.name,'-') as asset_name, u.phone as borrower_phone
      from borrowings b
      left join assets a on a.id = b.asset_id
      left join users u on u.id = b.user_id
      where b.id = ${id}`;
    if (!rows.length) return send(res, 404, { error: 'Peminjaman tidak ditemukan' });
    const b = rows[0];
    const due = b.due_date ? String(b.due_date).slice(0, 10) : '-';

    let target = '', text = '';
    if (kind === 'remind' || kind === 'returned') {
      if (auth.role !== 'admin' && auth.role !== 'verifikator') return send(res, 403, { error: 'Akses staf diperlukan' });
      target = b.borrower_phone || '';
      text = kind === 'remind'
        ? 'Pengingat SESDIAN\nAset "' + b.asset_name + '" jatuh tempo ' + due + '.\nMohon segera dikembalikan.'
        : 'Konfirmasi SESDIAN\nPengembalian aset "' + b.asset_name + '" telah dicatat. Terima kasih.';
    } else { // return-request
      if (auth.role !== 'admin' && String(b.user_id) !== String(auth.sub)) return send(res, 403, { error: 'Bukan peminjaman Anda' });
      target = await getWaNumber();
      text = 'Konfirmasi Pengembalian\n' + (b.borrower_name || 'Pengguna') +
        ' menyatakan telah mengembalikan aset "' + b.asset_name + '".\nMohon verifikasi di SESDIAN.';
    }

    const auto = await sendWa(target, text);
    return send(res, 200, { auto: auto, wa: normalizeWa(target), text: text });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
