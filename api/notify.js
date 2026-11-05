import crypto from 'node:crypto';
import { getSql } from './_db.js';
import { getAuth, send, readJson } from './_auth.js';
import { sendWa, getWaNumber, normalizeWa, waEnabled, ensureSettings } from './_wa.js';
import { ensureSchema } from './_schema.js';
import { logAudit } from './_audit.js';

const STAFF = ['admin', 'verifikator'];

// Build + (best-effort) send a WhatsApp message tied to a borrowing.
//   kind 'remind'        admin/verifikator -> borrower: overdue reminder
//   kind 'returned'      admin/verifikator -> borrower: return confirmed
//   kind 'return-request' borrower -> admin: "I have returned it, please verify"
// Scheduled task (SES-4.3.2) - overdue reminders:
//   Vercel Cron  GET /api/notify?cron=overdue  with "Authorization: Bearer $CRON_SECRET"
//   Staff (manual "Tugas Terjadwal")  POST { action: 'cron' }  with a staff JWT
// The overdue list holds borrower names + phone numbers, so it is never public.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();
  await ensureSchema(sql);

  if (req.method === 'GET') {
    if (isCronRequest(req)) {
      try { return send(res, 200, await runOverdueJob(sql, null, 'cron')); }
      catch (e) { return send(res, 500, { error: e.message }); }
    }
    const auth = getAuth(req);
    if (!auth) return send(res, 401, { error: 'Unauthorized' });
    if (STAFF.indexOf(auth.role) === -1) return send(res, 403, { error: 'Akses staf diperlukan' });
    try { return send(res, 200, await runOverdueJob(sql, auth, 'manual')); }
    catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const auth = getAuth(req);
  if (!auth) return send(res, 401, { error: 'Unauthorized' });

  try {
    const body = await readJson(req);

    if (body.action === 'cron') {
      if (STAFF.indexOf(auth.role) === -1) return send(res, 403, { error: 'Akses staf diperlukan' });
      return send(res, 200, await runOverdueJob(sql, auth, 'manual'));
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
    if (kind === 'remind' && auto) await sql`update borrowings set reminded_at = now() where id = ${id}`;
    await logAudit(sql, auth, 'notify', 'borrowing', id, {
      kind: kind, asset: b.asset_name, borrower: b.borrower_name || '',
      channel: auto ? 'whatsapp-otomatis' : (target ? 'wa.me' : 'tanpa-nomor'),
    });
    return send(res, 200, { auto: auto, wa: normalizeWa(target), text: text });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when that env var is set.
function isCronRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(String(req.headers['authorization'] || ''));
  const want = Buffer.from('Bearer ' + secret);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Overdue job: remind every overdue borrower by WhatsApp (at most once per day per
// borrowing, tracked in borrowings.reminded_at), send the admin one daily summary,
// and record the run in the audit trail. Returns counts only (no personal data).
async function runOverdueJob(sql, actor, trigger) {
  const rows = await sql`
    select b.id, b.borrower_name, b.due_date, b.reminded_at,
           coalesce(a.name, '-') as asset_name, u.phone as borrower_phone
    from borrowings b
    left join assets a on a.id = b.asset_id
    left join users u on u.id = b.user_id
    where b.due_date is not null and b.due_date < current_date
      and b.status in ('borrowed', 'verified', 'return_pending', 'approved')
    order by b.due_date asc`;

  const auto = waEnabled();
  const today = new Date().toISOString().slice(0, 10);
  const remindedToday = (r) => r.reminded_at && new Date(r.reminded_at).toISOString().slice(0, 10) === today;
  const due = rows.filter((r) => r.borrower_phone && !remindedToday(r));
  let sent = 0;
  if (auto) {
    // small parallel batches so a long list cannot run past the function timeout
    for (let i = 0; i < due.length; i += 5) {
      const batch = due.slice(i, i + 5);
      const ok = await Promise.all(batch.map((r) => sendWa(r.borrower_phone,
        'Pengingat SESDIAN\nAset "' + r.asset_name + '" jatuh tempo ' + String(r.due_date).slice(0, 10) +
        '.\nMohon segera dikembalikan.')));
      const done = batch.filter((r, k) => ok[k]).map((r) => r.id);
      if (done.length) await sql`update borrowings set reminded_at = now() where id = any(${done})`;
      sent += done.length;
    }
    // one summary per day to the admin WhatsApp number (settings.wa_number)
    if (rows.length) {
      await ensureSettings(sql);
      const last = await sql`select value from settings where key = 'overdue_summary_date'`;
      if (!last.length || last[0].value !== today) {
        const adminWa = await getWaNumber();
        if (adminWa && await sendWa(adminWa, 'Ringkasan Jatuh Tempo SESDIAN\n' + rows.length +
            ' peminjaman melewati jatuh tempo.\nMohon tindak lanjuti di halaman Daftar Pinjam.')) {
          await sql`insert into settings (key, value) values ('overdue_summary_date', ${today})
                    on conflict (key) do update set value = ${today}`;
        }
      }
    }
  }

  const result = {
    ok: true, trigger: trigger, auto: auto, count: rows.length, sent: sent,
    no_phone: rows.filter((r) => !r.borrower_phone).length,
    already_reminded: rows.filter(remindedToday).length,
  };
  await logAudit(sql, actor, 'cron', 'notification', null, result);
  return result;
}
