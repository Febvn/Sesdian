// WhatsApp notification helpers (best-effort, server-side).
// Auto-send works only when FONNTE_TOKEN is set (https://fonnte.com gateway).
// Otherwise the frontend falls back to a wa.me click-to-send link.
import { getSql } from './_db.js';

export function waEnabled() { return !!process.env.FONNTE_TOKEN; }

// 08xxxx / +62xxxx / 62xxxx -> 62xxxx
export function normalizeWa(num) {
  var d = String(num || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.charAt(0) === '0') d = '62' + d.slice(1);
  return d;
}

// create the settings table on demand so the app self-heals without a manual migration
let _ensured = false;
export async function ensureSettings(sql) {
  if (_ensured) return;
  try {
    await sql`create table if not exists settings (key text primary key, value text)`;
    await sql`insert into settings (key, value) values ('wa_number', '') on conflict (key) do nothing`;
    _ensured = true;
  } catch (e) { /* ignore; reads below tolerate a missing table */ }
}

export async function getWaNumber() {
  try {
    const sql = getSql();
    await ensureSettings(sql);
    const rows = await sql`select value from settings where key = 'wa_number'`;
    return rows.length ? (rows[0].value || '') : '';
  } catch (e) { return ''; }
}

// send a WhatsApp message to a target number via Fonnte (no-op if not configured / no number)
export async function sendWa(target, message) {
  const token = process.env.FONNTE_TOKEN;
  const to = normalizeWa(target);
  if (!token || !to) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);   // never let a hung gateway stall the request
  try {
    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ target: to, message: message }).toString(),
      signal: ctrl.signal,
    });
    return true;
  } catch (e) { return false; }
  finally { clearTimeout(timer); }
}

export async function notifyAdminBorrow({ assetName, borrower, qty, due }) {
  if (!process.env.FONNTE_TOKEN) return;
  const num = await getWaNumber();
  if (!num) return;
  await sendWa(num,
    'Pengajuan Peminjaman Baru\n' +
    'Peminjam: ' + borrower + '\n' +
    'Aset: ' + assetName + ' (' + qty + ' unit)\n' +
    'Jatuh tempo: ' + (due || '-') + '\n' +
    'Mohon ditindaklanjuti di SESDIAN.');
}
