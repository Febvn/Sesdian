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
    pending: ['Pending', '#dd5b00'], approved: ['Disetujui Admin', '#0075de'],
    verified: ['Terverifikasi', '#2a9d99'], borrowed: ['Dipinjam', '#7b54c0'],
    return_pending: ['Menunggu Verifikasi Kembali', '#c44a8a'],
    returned: ['Kembali', '#1aae39'], rejected: ['Ditolak', '#e03e3e'],
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
  var state = { period: 'monthly', day: '', month: '', start: '', end: '', status: 'all' };

  // Status filter (segmented control) for the detail table.
  var SEG = [
    ['all', 'Semua', ''],
    ['pending', 'Pending', '#dd5b00'],
    ['approved', 'Disetujui', '#0075de'],
    ['rejected', 'Ditolak', '#e03e3e'],
    ['returned', 'Sudah dikembalikan', '#1aae39'],
  ];
  function buildReportFilter() {
    var host = $('[data-report-filter]'); if (!host) return;
    host.innerHTML = '';
    var bar = el('div', { class: 'sesd-segfilter', role: 'tablist', 'aria-label': 'Filter status' });
    SEG.forEach(function (s) {
      var btn = el('button', { type: 'button', 'data-report-status': s[0] });
      if (s[0] === state.status) btn.setAttribute('data-filter-active', '');
      if (s[2]) btn.appendChild(el('span', { class: 'seg-dot', style: 'background:' + s[2] }));
      btn.appendChild(el('span', {}, s[1]));
      btn.appendChild(el('span', { class: 'seg-count', 'data-seg-count': s[0] }, '0'));
      btn.addEventListener('click', function () {
        state.status = s[0];
        $$('[data-report-status]', host).forEach(function (x) { x.removeAttribute('data-filter-active'); });
        btn.setAttribute('data-filter-active', '');
        applyReportFilter();
      });
      bar.appendChild(btn);
    });
    host.appendChild(bar);
  }
  function updateFilterCounts(d) {
    var bs = (d && d.by_status) || {};
    var counts = { all: (d && d.total) || 0, pending: bs.pending || 0, approved: bs.approved || 0, rejected: bs.rejected || 0, returned: bs.returned || 0 };
    Object.keys(counts).forEach(function (k) { var e = $('[data-seg-count="' + k + '"]'); if (e) e.textContent = counts[k]; });
  }
  function applyReportFilter() {
    var tbody = $('[data-report-rows]'); if (!tbody) return;
    var rows = $$('tr[data-status]', tbody);
    var n = 0;
    rows.forEach(function (tr) {
      var ok = state.status === 'all' || tr.getAttribute('data-status') === state.status;
      tr.style.display = ok ? '' : 'none';
      if (ok && tr.firstChild) { tr.firstChild.textContent = String(++n); }
    });
    var emptyRow = $('[data-report-empty]', tbody); if (emptyRow) emptyRow.remove();
    if (rows.length && n === 0) tbody.appendChild(el('tr', { 'data-report-empty': '', html: '<td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada peminjaman dengan status ini.</td>' }));
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function localIso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  function setPeriod(p) {
    state.period = p;
    $$('[data-period]').forEach(function (b) {
      var on = b.getAttribute('data-period') === p;
      b.style.background = on ? 'linear-gradient(135deg,rgb(99,102,241),rgb(139,92,246))' : 'transparent';
      b.style.color = on ? '#fff' : 'var(--text-muted)';
    });
  }

  function clearData() {
    // Wipe the previous period's data so it does not linger behind the loader.
    var tbody = $('[data-report-rows]'); if (tbody) tbody.innerHTML = '';
    var total = $('[data-total]'); if (total) total.textContent = '…';
    var sb = $('[data-status-breakdown]'); if (sb) sb.innerHTML = '';
  }

  function ensureDates() {
    if (!state.day) state.day = localIso(new Date());
    if (!state.month) { var n = new Date(); state.month = n.getFullYear() + '-' + pad2(n.getMonth() + 1); }
  }

  // Each preset drives its own date window (the API filters strictly by start/end):
  // Harian = the chosen day; Bulanan = tanggal 1 s/d akhir of the chosen month.
  function computeRange() {
    ensureDates();
    if (state.period === 'daily') return { start: state.day, end: state.day };
    var parts = state.month.split('-');
    var y = parseInt(parts[0], 10), m = (parseInt(parts[1], 10) || 1) - 1;
    return { start: localIso(new Date(y, m, 1)), end: localIso(new Date(y, m + 1, 0)) };
  }

  function renderPeriodControl() {
    var host = $('[data-period-select]'); if (!host) return;
    ensureDates();
    host.innerHTML = '';
    var now = new Date();
    var inpStyle = 'padding:0.6rem 0.7rem;border:1.5px solid var(--border);border-radius:10px;font-size:0.875rem;outline:none;background:#fff;cursor:pointer;min-width:200px';
    var lbl = el('label', { style: 'font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:5px' });
    if (state.period === 'daily') {
      lbl.innerHTML = '<span class="ic" style="vertical-align:-0.12em"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span> Tanggal';
      var di = el('input', { type: 'date', value: state.day, max: localIso(now), style: inpStyle });
      di.addEventListener('change', function () { if (di.value) { state.day = di.value; load(); } });
      host.appendChild(lbl); host.appendChild(di);
    } else {
      lbl.innerHTML = '<span class="ic" style="vertical-align:-0.12em"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span> Bulan';
      var mi = el('input', { type: 'month', value: state.month, max: now.getFullYear() + '-' + pad2(now.getMonth() + 1), style: inpStyle });
      mi.addEventListener('change', function () { if (mi.value) { state.month = mi.value; load(); } });
      host.appendChild(lbl); host.appendChild(mi);
    }
  }

  function applyPeriod(p) {
    setPeriod(p);
    renderPeriodControl();
    load();
  }

  async function load() {
    clearData();                                            // remove old data first
    if (window.SESDIAN_LOADER) window.SESDIAN_LOADER.show(); // dots inside the now-empty report table
    var r = computeRange();
    state.start = r.start; state.end = r.end;
    try {
      lastData = await DB.reports({ period: state.period, start: r.start, end: r.end });
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
    updateFilterCounts(d);
    if (!d.rows.length) { tbody.appendChild(el('tr', { html: '<td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada peminjaman pada periode ini.</td>' })); return; }
    var td = 'padding:0.6rem 0.8rem;font-size:0.83rem;border-top:1px solid var(--border)';
    d.rows.forEach(function (r, i) {
      var tr = el('tr', { 'data-status': r.status || '' });
      tr.appendChild(el('td', { style: td }, String(i + 1)));
      tr.appendChild(el('td', { style: td + ';font-weight:600' }, r.borrower_name || '-'));
      tr.appendChild(el('td', { style: td }, (r.asset_name || '-') + (r.asset_code ? ' (' + r.asset_code + ')' : '')));
      tr.appendChild(el('td', { style: td }, fmtDate(r.created_at)));
      tr.appendChild(el('td', { style: td }, r.due_date ? fmtDate(r.due_date) : '-'));
      tr.appendChild(el('td', { style: td }, r.returned_at ? fmtDate(r.returned_at) : '-'));
      tr.appendChild(el('td', { style: td }, r.admin_name || '-'));
      tr.appendChild(el('td', { style: td }, r.verifikator_name || '-'));
      tbody.appendChild(tr);
    });
    applyReportFilter();               // honour the active status segment
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

  /* ============ Grafik tren peminjaman (Harian / Bulanan / Tahunan) ============
     Single-series LINE chart (inline SVG, no library). Counts = borrowings CREATED
     in each bucket. One hue (var(--chart-1), theme-validated); no legend needed —
     the card title names the series. 2px line + area wash, dot markers with a
     surface ring, crosshair hover snapping to the nearest point, selective label
     on the max point only; recessive hairline grid. */
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function trendBuckets(mode, rows) {
    var now = new Date(), buckets = [], i;
    function count(match) { var n = 0; rows.forEach(function (r) { if (r.created_at && match(new Date(r.created_at))) n++; }); return n; }
    if (mode === 'daily') {
      for (i = 13; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        buckets.push({ label: d.getDate() + '/' + (d.getMonth() + 1), full: localIso(d), n: count(function (x) { return localIso(x) === localIso(d); }) });
      }
    } else if (mode === 'monthly') {
      for (i = 0; i < 12; i++) (function (m) {
        buckets.push({ label: MON3[m], full: MON3[m] + ' ' + now.getFullYear(), n: count(function (x) { return x.getFullYear() === now.getFullYear() && x.getMonth() === m; }) });
      })(i);
    } else {
      for (i = 4; i >= 0; i--) (function (y) {
        buckets.push({ label: String(y), full: 'Tahun ' + y, n: count(function (x) { return x.getFullYear() === y; }) });
      })(now.getFullYear() - i);
    }
    return buckets;
  }
  function drawTrendSvg(host, buckets, tipEl) {
    var W = 720, H = 250, padL = 34, padR = 14, padT = 20, padB = 24;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var maxN = Math.max(1, Math.max.apply(null, buckets.map(function (b) { return b.n; })));
    var step = Math.max(1, Math.ceil(maxN / 4));
    var top = step * 4;
    var band = plotW / buckets.length;
    var baseY = padT + plotH;
    var maxIdx = -1; buckets.forEach(function (b, i) { if (b.n > 0 && (maxIdx === -1 || b.n > buckets[maxIdx].n)) maxIdx = i; });
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Grafik garis jumlah peminjaman per periode');
    svg.style.cssText = 'width:100%;height:auto;display:block';
    function sEl(tag, attrs) { var e = document.createElementNS(svgNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
    // recessive grid + y labels
    for (var g = 0; g <= 4; g++) {
      var y = baseY - (plotH * g / 4);
      svg.appendChild(sEl('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: 'var(--border)', 'stroke-width': g === 0 ? 1.4 : 1 }));
      var yl = sEl('text', { x: padL - 7, y: y + 3.5, 'text-anchor': 'end', 'font-size': '10', fill: 'var(--text-muted)' });
      yl.textContent = String(step * g); svg.appendChild(yl);
    }
    // point coordinates: one per bucket, centered in its band (zeros included —
    // a line is a continuous series, gaps would misstate the data)
    var pts = buckets.map(function (b, i) {
      return { x: padL + band * i + band / 2, y: baseY - plotH * (b.n / top) };
    });
    // straight line path between points (runcing)
    function straightPath(p) {
      return p.map(function (q, i) { return (i ? 'L' : 'M') + q.x.toFixed(1) + ',' + q.y.toFixed(1); }).join(' ');
    }
    // area wash under the curve (series hue at ~10%), then the 2px curve itself
    var lineD = straightPath(pts);
    svg.appendChild(sEl('path', { d: lineD + ' L' + pts[pts.length - 1].x.toFixed(1) + ',' + baseY + ' L' + pts[0].x.toFixed(1) + ',' + baseY + ' Z', fill: 'var(--chart-1)', 'fill-opacity': '0.1', stroke: 'none' }));
    svg.appendChild(sEl('path', { d: lineD, fill: 'none', stroke: 'var(--chart-1)', 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    // crosshair (hidden until hover) — readers aim at a period, not at a 2px line
    var cross = sEl('line', { x1: 0, y1: padT, x2: 0, y2: baseY, stroke: 'var(--text-muted)', 'stroke-width': '1', opacity: '0' });
    svg.appendChild(cross);
    // dot markers with a 2px surface ring so they stay legible on the line
    var dots = pts.map(function (p, i) {
      var c = sEl('circle', { cx: p.x, cy: p.y, r: 4, fill: 'var(--chart-1)', stroke: 'var(--bg-card)', 'stroke-width': '2', 'data-dot': i });
      svg.appendChild(c); return c;
    });
    var labelEvery = buckets.length > 12 ? 2 : 1;
    buckets.forEach(function (b, i) {
      if (i === maxIdx) {   // selective direct label: max only (text token, not series color)
        var vl = sEl('text', { x: pts[i].x, y: pts[i].y - 10, 'text-anchor': 'middle', 'font-size': '10.5', 'font-weight': '700', fill: 'var(--text)' });
        vl.textContent = String(b.n); svg.appendChild(vl);
      }
      if (i % labelEvery === 0) {
        var xl = sEl('text', { x: pts[i].x, y: H - 8, 'text-anchor': 'middle', 'font-size': '10', fill: 'var(--text-muted)' });
        xl.textContent = b.label; svg.appendChild(xl);
      }
    });
    // one hover layer over the whole plot; the crosshair snaps to the nearest point
    var active = -1;
    function setActive(i) {
      if (i === active) return;
      if (active >= 0) dots[active].setAttribute('r', 4);
      active = i;
      if (i < 0) { cross.setAttribute('opacity', '0'); tipEl.style.display = 'none'; return; }
      dots[i].setAttribute('r', 5.5);
      cross.setAttribute('x1', pts[i].x); cross.setAttribute('x2', pts[i].x);
      cross.setAttribute('opacity', '0.4');
      tipEl.textContent = buckets[i].full + ' · ' + buckets[i].n + ' peminjaman';
      tipEl.style.display = 'block';
    }
    var hover = sEl('rect', { x: padL, y: padT, width: plotW, height: plotH, fill: 'transparent' });
    hover.style.cursor = 'default';
    hover.addEventListener('mousemove', function (e) {
      var svgR = svg.getBoundingClientRect();
      var xu = (e.clientX - svgR.left) * (W / svgR.width);          // px -> viewBox units
      var i = Math.max(0, Math.min(buckets.length - 1, Math.floor((xu - padL) / band)));
      setActive(i);
      var hostR = host.getBoundingClientRect();
      tipEl.style.left = Math.min(hostR.width - tipEl.offsetWidth - 6, Math.max(6, e.clientX - hostR.left + 12)) + 'px';
      tipEl.style.top = (e.clientY - hostR.top - 34) + 'px';
    });
    hover.addEventListener('mouseleave', function () { setActive(-1); });
    svg.appendChild(hover);
    host.innerHTML = ''; host.appendChild(svg);
  }
  function buildTrendCard() {
    var card = $('[data-trend-card]'); if (!card) return;
    var trendRows = null, mode = 'daily';
    card.appendChild(el('div', { style: 'font-size:0.95rem;font-weight:800' }, 'Grafik Peminjaman'));
    var sub = el('div', { style: 'font-size:0.75rem;color:var(--text-muted);margin:2px 0 12px' }, 'Jumlah pengajuan peminjaman per periode');
    card.appendChild(sub);
    var seg = el('div', { class: 'sesd-segfilter', role: 'tablist', 'aria-label': 'Periode grafik', style: 'margin-bottom:12px' });
    var chartHost = el('div');
    var tip = el('div', { style: 'display:none;position:absolute;z-index:5;background:var(--text);color:var(--bg-card);font-size:0.72rem;font-weight:700;padding:0.3rem 0.6rem;border-radius:8px;pointer-events:none;white-space:nowrap' });
    card.appendChild(seg); card.appendChild(chartHost); card.appendChild(tip);
    function draw() {
      var b = trendBuckets(mode, trendRows || []);
      var now = new Date();
      sub.textContent = mode === 'daily' ? 'Pengajuan per hari · 14 hari terakhir'
        : mode === 'monthly' ? 'Pengajuan per bulan · tahun ' + now.getFullYear()
        : 'Pengajuan per tahun · 5 tahun terakhir';
      if (!b.some(function (x) { return x.n > 0; })) { chartHost.innerHTML = '<div style="padding:2.2rem;text-align:center;color:var(--text-muted);font-size:0.85rem">Belum ada data pada periode ini.</div>'; return; }
      drawTrendSvg(chartHost, b, tip);
    }
    [['daily', 'Harian'], ['monthly', 'Bulanan'], ['yearly', 'Tahunan']].forEach(function (o) {
      var btn = el('button', { type: 'button' });
      btn.appendChild(el('span', {}, o[1]));
      if (o[0] === mode) btn.setAttribute('data-filter-active', '');
      btn.addEventListener('click', function () {
        mode = o[0];
        Array.prototype.forEach.call(seg.children, function (x) { x.removeAttribute('data-filter-active'); });
        btn.setAttribute('data-filter-active', '');
        draw();
      });
      seg.appendChild(btn);
    });
    chartHost.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem">Memuat grafik...</div>';
    DB.borrowings().then(function (rows) { trendRows = rows; draw(); })
      .catch(function () { chartHost.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem">Gagal memuat data grafik.</div>'; });
  }

  function boot() {
    $$('[data-period]').forEach(function (b) { b.addEventListener('click', function () { applyPeriod(b.getAttribute('data-period')); }); });
    $('[data-export]').addEventListener('click', exportCsv);
    $('[data-print]').addEventListener('click', printPdf);
    setPeriod(state.period);
    renderPeriodControl();               // dates are now auto per preset; no manual Dari/Sampai
    buildReportFilter();                 // status segmented filter for the table
    buildTrendCard();                    // grafik tren di bawah laporan
    // app.js showed the page loader for laporan; hide it once the first report renders
    load().then(function () { if (window.SESDIAN_LOADER) window.SESDIAN_LOADER.hide(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
