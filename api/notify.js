import { getSql } from './_db.js';
import { getAuth, send, readJson } from './_auth.js';
import { sendWa, getWaNumber, normalizeWa } from './_wa.js';

// Build + (best-effort) send a WhatsApp message tied to a borrowing.
//   kind 'remind'        admin -> borrower: overdue reminder
//   kind 'returned'      admin -> borrower: return confirmed
//   kind 'return-request' borrower -> admin: "I have returned it, please verify"
// Always returns { auto, wa, text } so the client can fall back to a wa.me link.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const auth = getAuth(req);
  if (!auth) return send(res, 401, { error: 'Unauthorized' });
  const sql = getSql();
  try {
    const { borrowingId, kind } = await readJson(req);
    const id = parseInt(borrowingId, 10);
    if (!id || ['remind', 'returned', 'return-request'].indexOf(kind) === -1) return send(res, 400, { error: 'Data tidak valid' });

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
      // both staff roles act on returns/reminders in the UI (admin + verifikator)
      if (auth.role !== 'admin' && auth.role !== 'verifikator') return send(res, 403, { error: 'Akses staf diperlukan' });
      target = b.borrower_phone || '';
      text = kind === 'remind'
        ? 'Pengingat SESDIAN\nAset "' + b.asset_name + '" jatuh tempo ' + due + '.\nMohon segera dikembalikan.'
        : 'Konfirmasi SESDIAN\nPengembalian aset "' + b.asset_name + '" telah dicatat. Terima kasih.';
    } else { // return-request
      if (auth.role !== 'admin' && String(b.user_id) !== String(auth.sub)) return send(res, 403, { error: 'Bukan peminjaman Anda' });
      target = await getWaNumber(); // admin number
      text = 'Konfirmasi Pengembalian\n' + (b.borrower_name || 'Pengguna') +
        ' menyatakan telah mengembalikan aset "' + b.asset_name + '".\nMohon verifikasi di SESDIAN.';
    }

    const auto = await sendWa(target, text);
    return send(res, 200, { auto: auto, wa: normalizeWa(target), text: text });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
