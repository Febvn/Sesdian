/* ============================================================
   SESDIAN - reports (laporan). Runs only on data-page="laporan".
   Daily / weekly / monthly window, summary + detail table, CSV export,
   and a print/PDF layout (DAFTAR PEMINJAMAN BARANG INVENTARIS form).
   ============================================================ */
(function () {
  'use strict';
  if (document.body.getAttribute('data-page') !== 'laporan') return;
  var DB = window.SESDIAN_DB || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  var STATUS = {
    pending: ['Pending', '#f59e0b'], approved: ['Disetujui Admin', '#3b82f6'],
    verified: ['Terverifikasi', '#06b6d4'], borrowed: ['Dipinjam', '#8b5cf6'],
    return_pending: ['Menunggu Verifikasi Kembali', '#f97316'],
    returned: ['Kembali', '#10b981'], rejected: ['Ditolak', '#ef4444'],
  };
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap'); if (!wrap) { wrap = el('div', { class: 'sesd-toast-wrap' }); document.body.appendChild(wrap); }
    var t = el('div', { class: 'sesd-toast ' + (type || 'info') }, msg); wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function fmtDate(s) { if (!s) return ''; var d = new Date(s); if (isNaN(d)) return String(s).slice(0, 10); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); }
  function statusLabel(s) { return (STATUS[s] && STATUS[s][0]) || s; }
  var lastData = null;
  var state = { period: 'daily' };

  function setPeriod(p) {
    state.period = p;
    $$('[data-period]').forEach(function (b) {
      var on = b.getAttribute('data-period') === p;
      b.style.background = on ? 'linear-gradient(135deg,rgb(99,102,241),rgb(139,92,246))' : 'transparent';
      b.style.color = on ? '#fff' : 'var(--text-muted)';
    });
  }

  async function load() {
    if (window.SESDIAN_LOADER) window.SESDIAN_LOADER.show(); // dots inside the report table only
    var start = $('[data-start]').value, end = $('[data-end]').value;
    try {
      lastData = await DB.reports({ period: state.period, start: start, end: end });
      render(lastData);
    } catch (e) {
      if (window.SESDIAN_LOADER) window.SESDIAN_LOADER.hide();
      if (e && e.status === 401) { location.replace('login.html'); return; }
      toast((e && e.message) || 'Gagal memuat laporan', 'error');
    }
  }

  function render(d) {
    $('[data-total]').textContent = d.total;
    var sb = $('[data-status-breakdown]'); sb.innerHTML = '';
    Object.keys(STATUS).forEach(function (k) {
      var n = d.by_status[k] || 0;
      if (!n) return;
      var chip = el('div', { style: 'display:flex;align-items:center;gap:6px;padding:0.4rem 0.7rem;border-radius:10px;background:var(--bg);font-size:0.8rem;font-weight:600' });
      chip.appendChild(el('span', { style: 'width:9px;height:9px;border-radius:50%;background:' + STATUS[k][1] }));
      chip.appendChild(el('span', {}, STATUS[k][0] + ': ' + n));
      sb.appendChild(chip);
    });
    if (!sb.children.length) sb.appendChild(el('span', { style: 'color:var(--text-muted);font-size:0.85rem' }, 'Tidak ada data.'));

    var tbody = $('[data-report-rows]'); tbody.innerHTML = '';
    if (!d.rows.length) { tbody.appendChild(el('tr', { html: '<td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada peminjaman pada periode ini.</td>' })); return; }
    var td = 'padding:0.6rem 0.8rem;font-size:0.83rem;border-top:1px solid var(--border)';
    d.rows.forEach(function (r, i) {
      var tr = el('tr');
      tr.appendChild(el('td', { style: td }, String(i + 1)));
      tr.appendChild(el('td', { style: td + ';font-weight:600' }, r.borrower_name || '-'));
      tr.appendChild(el('td', { style: td }, (r.asset_name || '-') + (r.asset_code ? ' (' + r.asset_code + ')' : '')));
      tr.appendChild(el('td', { style: td }, fmtDate(r.created_at)));
      tr.appendChild(el('td', { style: td }, r.due_date ? fmtDate(r.due_date) : '-'));
      tr.appendChild(el('td', { style: td }, r.returned_at ? fmtDate(r.returned_at) : '—'));
      tr.appendChild(el('td', { style: td }, r.admin_name || '-'));
      tr.appendChild(el('td', { style: td }, r.verifikator_name || '-'));
      tbody.appendChild(tr);
    });
  }

  function exportCsv() {
    if (!lastData || !lastData.rows.length) { toast('Tidak ada data untuk diexport', 'error'); return; }
    var head = ['No', 'Nama Peminjam', 'Nama Barang', 'Tgl Pinjam', 'Tgl Kembali', 'Tgl Pengembalian', 'Admin', 'Verifikator'];
    var lines = [head.join(',')];
    lastData.rows.forEach(function (r, i) {
      var row = [i + 1, r.borrower_name || '', r.asset_name || '', fmtDate(r.created_at), r.due_date ? fmtDate(r.due_date) : '',
        r.returned_at ? fmtDate(r.returned_at) : '', r.admin_name || '', r.verifikator_name || ''];
      lines.push(row.map(function (c) { var s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'laporan-peminjaman-' + lastData.start + '_' + lastData.end + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Print to a clean DAFTAR PEMINJAMAN BARANG INVENTARIS form in a new window.
  function printPdf() {
    if (!lastData || !lastData.rows.length) { toast('Tidak ada data untuk dicetak', 'error'); return; }
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
    var rows = lastData.rows.map(function (r, i) {
      return '<tr>' +
        '<td class="c">' + (i + 1) + '</td>' +
        '<td>' + esc(r.borrower_name) + '</td>' +
        '<td>' + esc(r.asset_name) + (r.asset_code ? ' (' + esc(r.asset_code) + ')' : '') + '</td>' +
        '<td class="c">' + esc(fmtDate(r.created_at)) + '</td>' +
        '<td class="c">' + esc(r.due_date ? fmtDate(r.due_date) : '') + '</td>' +
        '<td class="c">' + esc(r.returned_at ? fmtDate(r.returned_at) : '') + '</td>' +
        '<td>' + esc(r.admin_name) + '</td>' +
        '<td>' + esc(r.verifikator_name) + '</td>' +
        '</tr>';
    }).join('');
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Laporan Peminjaman</title><style>' +
      'body{font-family:"Times New Roman",serif;color:#000;padding:28px}' +
      'h2{text-align:center;margin:0;font-size:16px;letter-spacing:.5px}' +
      'h3{text-align:center;margin:2px 0 18px;font-size:14px}' +
      'table{width:100%;border-collapse:collapse;font-size:11px}' +
      'th,td{border:1px solid #000;padding:5px 7px;vertical-align:top}' +
      'th{text-align:center;font-weight:bold}td.c{text-align:center}' +
      '@media print{body{padding:0}}' +
      '</style></head><body onload="window.print()">' +
      '<h2>DAFTAR PEMINJAMAN BARANG INVENTARIS</h2>' +
      '<h3>Periode ' + esc(fmtDate(lastData.start)) + ' s/d ' + esc(fmtDate(lastData.end)) + '</h3>' +
      '<table><thead><tr>' +
      '<th>No</th><th>Nama Peminjam</th><th>Nama Barang</th><th>Tgl Pinjam</th><th>Tgl Kembali</th><th>Tgl Pengembalian</th><th>Nama Admin</th><th>Nama Verifikator</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></body></html>';
    var w = window.open('', '_blank');
    if (!w) { toast('Izinkan popup untuk mencetak', 'error'); return; }
    w.document.write(html); w.document.close();
  }

  function boot() {
    var today = new Date(); var def = new Date(today.getTime() - 29 * 86400000);
    $('[data-end]').value = iso(today); $('[data-start]').value = iso(def);
    $$('[data-period]').forEach(function (b) { b.addEventListener('click', function () { setPeriod(b.getAttribute('data-period')); load(); }); });
    $('[data-apply]').addEventListener('click', load);
    $('[data-export]').addEventListener('click', exportCsv);
    $('[data-print]').addEventListener('click', printPdf);
    setPeriod('daily');
    // app.js showed the page loader for laporan; hide it once the first report renders
    load().then(function () { if (window.SESDIAN_LOADER) window.SESDIAN_LOADER.hide(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
