// WhatsApp notification (best-effort, server-side).
// Auto-send is enabled only when FONNTE_TOKEN is set (https://fonnte.com - a
// simple WhatsApp gateway with an Indonesian free tier). Without it, the
// frontend falls back to a wa.me click-to-send link.
import { getSql } from './_db.js';

export function waEnabled() { return !!process.env.FONNTE_TOKEN; }

// 08xxxx / +62xxxx / 62xxxx -> 62xxxx
export function normalizeWa(num) {
  var d = String(num || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.charAt(0) === '0') d = '62' + d.slice(1);
  return d;
}

export async function getWaNumber() {
  try {
    const sql = getSql();
    const rows = await sql`select value from settings where key = 'wa_number'`;
    return rows.length ? (rows[0].value || '') : '';
  } catch (e) { return ''; }
}

export async function notifyAdminBorrow({ assetName, borrower, qty, due }) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return;
  const target = normalizeWa(await getWaNumber());
  if (!target) return;
  const message =
    'Pengajuan Peminjaman Baru\n' +
    'Peminjam: ' + borrower + '\n' +
    'Aset: ' + assetName + ' (' + qty + ' unit)\n' +
    'Jatuh tempo: ' + (due || '-') + '\n' +
    'Mohon ditindaklanjuti di SESDIAN.';
  try {
    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ target: target, message: message }).toString(),
    });
  } catch (e) { /* best-effort: never block the borrowing */ }
}
