/* ============================================================
   SESDIAN - reports (laporan) module. Runs only on data-page="laporan".
   Daily / weekly / monthly aggregation, on-screen chart + tables,
   CSV download and browser print (Save as PDF). No external libraries.
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
    returned: ['Kembali', '#10b981'], rejected: ['Ditolak', '#ef4444'],
  };
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap'); if (!wrap) { wrap = el('div', { class: 'sesd-toast-wrap' }); document.body.appendChild(wrap); }
    var t = el('div', { class: 'sesd-toast ' + (type || 'info') }, msg); wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
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
    var start = $('[data-start]').value, end = $('[data-end]').value;
    try {
      var data = await DB.reports({ period: state.period, start: start, end: end });
      lastData = data;
      render(data);
    } catch (e) {
      if (e && e.status === 401) { location.replace('login.html'); return; }
      toast((e && e.message) || 'Gagal memuat laporan', 'error');
    }
  }

  function render(d) {
    $('[data-total]').textContent = d.total;
    // status breakdown
    var sb = $('[data-status-breakdown]'); sb.innerHTML = '';
    Object.keys(STATUS).forEach(function (k) {
      var n = d.by_status[k] || 0;
      var chip = el('div', { style: 'display:flex;align-items:center;gap:6px;padding:0.4rem 0.7rem;border-radius:10px;background:var(--bg);font-size:0.8rem;font-weight:600' });
      chip.appendChild(el('span', { style: 'width:9px;height:9px;border-radius:50%;background:' + STATUS[k][1] }));
      chip.appendChild(el('span', {}, STATUS[k][0] + ': ' + n));
      sb.appendChild(chip);
    });
    // bar chart (inline SVG)
    drawChart(d.series);
    // top assets
    var ta = $('[data-top-assets]'); ta.innerHTML = '';
    if (!d.top_assets.length) ta.appendChild(el('div', { class: 'sesd-empty' }, 'Belum ada data.'));
    d.top_assets.forEach(function (a, i) {
      ta.appendChild(rowLine((i + 1) + '. ' + a.name + (a.code ? ' (' + a.code + ')' : ''), a.count + 'x · ' + a.qty + ' unit'));
    });
    // top borrowers
    var tb = $('[data-top-borrowers]'); tb.innerHTML = '';
    if (!d.top_borrowers.length) tb.appendChild(el('div', { class: 'sesd-empty' }, 'Belum ada data.'));
    d.top_borrowers.forEach(function (b, i) { tb.appendChild(rowLine((i + 1) + '. ' + b.name, b.count + 'x')); });
    // detail rows
    var tbody = $('[data-report-rows]'); tbody.innerHTML = '';
    if (!d.rows.length) { tbody.appendChild(el('tr', { html: '<td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada peminjaman pada periode ini.</td>' })); }
    d.rows.forEach(function (r) {
      var tr = el('tr', { style: 'border-top:1px solid var(--border)' });
      var td = 'padding:0.7rem 1rem;font-size:0.83rem';
      tr.appendChild(el('td', { style: td }, fmtDate(r.created_at)));
      tr.appendChild(el('td', { style: td + ';font-weight:600' }, (r.asset_name || '-') + (r.asset_code ? ' (' + r.asset_code + ')' : '')));
      tr.appendChild(el('td', { style: td }, r.borrower_name || '-'));
      tr.appendChild(el('td', { style: td }, String(r.qty)));
      tr.appendChild(el('td', { style: td }, (STATUS[r.status] && STATUS[r.status][0]) || r.status));
      tr.appendChild(el('td', { style: td + ';font-family:"JetBrains Mono"' }, r.due_date ? String(r.due_date).slice(0, 10) : '-'));
      tbody.appendChild(tr);
    });
  }

  function rowLine(left, right) {
    var d = el('div', { style: 'display:flex;justify-content:space-between;gap:10px;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.85rem' });
    d.appendChild(el('span', { style: 'font-weight:600' }, left));
    d.appendChild(el('span', { style: 'color:var(--text-muted);white-space:nowrap' }, right));
    return d;
  }
  function fmtDate(s) { if (!s) return '-'; var d = new Date(s); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); }

  function drawChart(series) {
    var host = $('[data-chart]'); host.innerHTML = '';
    if (!series.length) { host.appendChild(el('div', { class: 'sesd-empty' }, 'Tidak ada data untuk grafik.')); return; }
    var max = series.reduce(function (m, s) { return Math.max(m, s.count); }, 1);
    var bar = el('div', { style: 'display:flex;align-items:flex-end;gap:6px;height:180px;overflow-x:auto;padding-top:10px' });
    series.forEach(function (s) {
      var col = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px;min-width:34px;flex:1' });
      var h = Math.round((s.count / max) * 140) + 2;
      col.appendChild(el('div', { style: 'font-size:0.7rem;font-weight:700;color:var(--text)' }, String(s.count)));
      col.appendChild(el('div', { style: 'width:60%;min-width:14px;height:' + h + 'px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,rgb(99,102,241),rgb(139,92,246))' }));
      col.appendChild(el('div', { style: 'font-size:0.6rem;color:var(--text-muted);white-space:nowrap;transform:rotate(-35deg);transform-origin:center;margin-top:6px' }, s.bucket.slice(5)));
      bar.appendChild(col);
    });
    host.appendChild(bar);
  }

  function exportCsv() {
    if (!lastData || !lastData.rows.length) { toast('Tidak ada data untuk diexport', 'error'); return; }
    var head = ['Tanggal Pengajuan', 'Aset', 'Kode', 'Peminjam', 'Jumlah', 'Status', 'Jatuh Tempo'];
    var lines = [head.join(',')];
    lastData.rows.forEach(function (r) {
      var row = [fmtDate(r.created_at), r.asset_name || '-', r.asset_code || '', r.borrower_name || '-', r.qty,
        (STATUS[r.status] && STATUS[r.status][0]) || r.status, r.due_date ? String(r.due_date).slice(0, 10) : ''];
      lines.push(row.map(function (c) { var s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'laporan-peminjaman-' + state.period + '-' + lastData.start + '_' + lastData.end + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  function boot() {
    var today = new Date(); var def = new Date(today.getTime() - 29 * 86400000);
    $('[data-end]').value = iso(today); $('[data-start]').value = iso(def);
    $$('[data-period]').forEach(function (b) { b.addEventListener('click', function () { setPeriod(b.getAttribute('data-period')); load(); }); });
    $('[data-apply]').addEventListener('click', load);
    $('[data-export]').addEventListener('click', exportCsv);
    $('[data-print]').addEventListener('click', function () { window.print(); });
    setPeriod('daily');
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
