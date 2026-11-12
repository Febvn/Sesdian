/* ============================================================
   SESDIAN - reports (laporan). Runs only on data-page="laporan".
   Daily / weekly / monthly window, summary + detail table, and Excel (.xlsx)
   + PDF exports sharing one layout (DAFTAR PEMINJAMAN BARANG INVENTARIS form).
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
  function borrowerAvatar(name, photo, size) {
    size = size || 30;
    var box = el('span', { style: 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex-shrink:0;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.38) + 'px;font-weight:700;color:#fff;background:var(--primary)' });
    if (photo) { box.style.background = 'var(--bg-mid)'; box.appendChild(el('img', { src: photo, alt: '', style: 'width:100%;height:100%;object-fit:cover' })); }
    else {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      box.textContent = parts.length ? ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase() : '?';
    }
    return box;
  }
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
    if (rows.length && n === 0) tbody.appendChild(el('tr', { 'data-report-empty': '', html: '<td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada peminjaman dengan status ini.</td>' }));
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
    if (!d.rows.length) { tbody.appendChild(el('tr', { html: '<td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada peminjaman pada periode ini.</td>' })); return; }
    var td = 'padding:0.6rem 0.8rem;font-size:0.83rem;border-top:1px solid var(--border)';
    d.rows.forEach(function (r, i) {
      var tr = el('tr', { 'data-status': r.status || '' });
      tr.appendChild(el('td', { style: td, 'data-label': 'No' }, String(i + 1)));
      
      var nameCell = el('td', { style: td, 'data-label': 'Nama Peminjam' });
      var wrap = el('div', { style: 'display:flex;align-items:center;gap:9px' });
      wrap.appendChild(borrowerAvatar(r.borrower_name, r.borrower_avatar, 30));
      wrap.appendChild(el('span', { style: 'font-weight:600;color:var(--text)' }, r.borrower_name || '-'));
      nameCell.appendChild(wrap);
      tr.appendChild(nameCell);

      tr.appendChild(el('td', { style: td, 'data-label': 'Nama Barang' }, (r.asset_name || '-') + (r.asset_code ? ' (' + r.asset_code + ')' : '')));
      tr.appendChild(el('td', { style: td, 'data-label': 'Tgl Pinjam' }, fmtDate(r.created_at)));
      tr.appendChild(el('td', { style: td, 'data-label': 'Tgl Kembali' }, r.due_date ? fmtDate(r.due_date) : '-'));
      tr.appendChild(el('td', { style: td, 'data-label': 'Tgl Pengembalian' }, r.returned_at ? fmtDate(r.returned_at) : '-'));
      tr.appendChild(el('td', { style: td + ';max-width:220px;color:var(--text-muted)', 'data-label': 'Alasan' }, r.notes || '-'));
      tr.appendChild(el('td', { style: td, 'data-label': 'Admin' }, r.admin_name || '-'));
      tr.appendChild(el('td', { style: td, 'data-label': 'Verifikator' }, r.verifikator_name || '-'));
      tbody.appendChild(tr);
    });
    applyReportFilter();               // honour the active status segment
  }

  /* ============ Export Excel (.xlsx) ============
     Same layout as the PDF: centred title + period, dark header row with white
     bold text, thin black grid on every cell, zebra rows, fixed column widths.
     Uses ExcelJS (SheetJS community cannot write cell styles), loaded on demand
     so the page does not pay for it until the button is pressed. */
  var REPORT_TITLE = 'DAFTAR PEMINJAMAN BARANG INVENTARIS';
  var REPORT_HEAD = ['No', 'Nama Peminjam', 'Nama Barang', 'Tgl Pinjam', 'Tgl Kembali', 'Tgl Pengembalian', 'Alasan', 'Nama Admin', 'Nama Verifikator'];
  var EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  var excelJsLoading = null;
  function ensureExcelJs() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!excelJsLoading) excelJsLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = EXCELJS_URL; s.async = true;
      s.onload = function () { if (window.ExcelJS) resolve(window.ExcelJS); else { excelJsLoading = null; reject(new Error('Library Excel gagal dimuat')); } };
      s.onerror = function () { excelJsLoading = null; s.remove(); reject(new Error('Library Excel gagal dimuat, periksa koneksi lalu coba lagi')); };
      document.head.appendChild(s);
    });
    return excelJsLoading;
  }
  function filteredReportRows() {
    return lastData.rows.filter(function (r) { return state.status === 'all' || r.status === state.status; });
  }
  function assetLabel(r) { return (r.asset_name || '-') + (r.asset_code ? ' (' + r.asset_code + ')' : ''); }
  function periodLabel(d) { return 'Periode ' + fmtDate(d.start) + ' s/d ' + fmtDate(d.end); }
  // Real Excel date (sortable/filterable) on the same calendar day fmtDate shows.
  function xlDate(s) {
    if (!s) return '-';
    var d = new Date(s); if (isNaN(d)) return String(s).slice(0, 10);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  function buildReportWorkbook(ExcelJS, d, rows) {
    var COLS = [   // width in Excel character units; wrap = long text that may span lines
      { w: 6, align: 'center' }, { w: 28, wrap: true }, { w: 42, wrap: true },
      { w: 13, align: 'center', date: true }, { w: 13, align: 'center', date: true }, { w: 18, align: 'center', date: true },
      { w: 32, wrap: true }, { w: 20, wrap: true }, { w: 20, wrap: true },
    ];
    var FONT = 'Arial';
    var LINE = { style: 'thin', color: { argb: 'FF000000' } };
    var BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };
    var HEAD_ROW = 4, last = HEAD_ROW + rows.length, lastCol = 'I';

    var wb = new ExcelJS.Workbook();
    wb.creator = 'SESDIAN'; wb.created = new Date();
    var ws = wb.addWorksheet('Laporan Peminjaman', {
      views: [{ state: 'frozen', ySplit: HEAD_ROW, showGridLines: false }],
      pageSetup: {
        paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true, printArea: 'A1:' + lastCol + last, printTitlesRow: HEAD_ROW + ':' + HEAD_ROW,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
      },
      headerFooter: { oddFooter: '&C&"Arial,Regular"&8Halaman &P dari &N' },
    });
    ws.columns = COLS.map(function (c) { return { width: c.w }; });

    ws.mergeCells('A1:' + lastCol + '1');
    var title = ws.getCell('A1');
    title.value = REPORT_TITLE;
    title.font = { name: FONT, size: 14, bold: true };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;

    ws.mergeCells('A2:' + lastCol + '2');
    var sub = ws.getCell('A2');
    sub.value = periodLabel(d);
    sub.font = { name: FONT, size: 11 };
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 10;

    var head = ws.getRow(HEAD_ROW);
    head.values = REPORT_HEAD;
    head.height = 30;
    head.eachCell(function (c) {
      c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF293241' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = BORDER;
    });

    rows.forEach(function (r, i) {
      var values = [i + 1, r.borrower_name || '-', assetLabel(r), xlDate(r.created_at), xlDate(r.due_date),
        xlDate(r.returned_at), r.notes || '-', r.admin_name || '-', r.verifikator_name || '-'];
      var row = ws.getRow(HEAD_ROW + 1 + i);
      row.values = values;
      // Excel does not grow wrapped rows on its own for generated files, so size
      // each row from its longest wrapped cell (≈1 char per width unit at 10pt).
      var lines = 1;
      COLS.forEach(function (c, ci) {
        var cell = row.getCell(ci + 1);
        cell.font = { name: FONT, size: 10 };
        cell.border = BORDER;
        cell.alignment = { horizontal: c.align || 'left', vertical: 'middle', wrapText: !!c.wrap, indent: c.align ? 0 : 1 };
        if (c.date && values[ci] instanceof Date) cell.numFmt = 'd/m/yyyy';
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
        if (c.wrap) lines = Math.max(lines, String(values[ci]).split('\n').reduce(function (n, part) { return n + Math.max(1, Math.ceil(part.length / (c.w - 1))); }, 0));
      });
      row.height = Math.max(22, lines * 13 + 9);
    });
    return wb;
  }

  async function exportExcel() {
    if (!lastData || !lastData.rows.length) { toast('Tidak ada data untuk diexport', 'error'); return; }
    var rows = filteredReportRows();    // same status filter as the table and the PDF
    if (!rows.length) { toast('Tidak ada data yang sesuai filter untuk diexport', 'error'); return; }
    var btn = $('[data-export]'); if (btn) btn.disabled = true;
    try {
      var ExcelJS = await ensureExcelJs();
      var buf = await buildReportWorkbook(ExcelJS, lastData, rows).xlsx.writeBuffer();
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob);
      var a = el('a', { href: url, download: 'laporan-peminjaman-' + lastData.start + '_' + lastData.end + '.xlsx' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      toast('Excel berhasil diunduh', 'success');
    } catch (e) {
      toast((e && e.message) || 'Gagal membuat file Excel', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Export PDF – directly downloads a PDF file (no print dialog, no popup).
  function printPdf() {
    if (!lastData || !lastData.rows.length) { toast('Tidak ada data untuk diexport', 'error'); return; }
    if (typeof window.jspdf === 'undefined') { toast('Library PDF belum dimuat, coba refresh halaman', 'error'); return; }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(REPORT_TITLE, doc.internal.pageSize.getWidth() / 2, 18, { align: 'center' });

    // Subtitle (period)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(periodLabel(lastData), doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });

    // Table headers
    var head = [REPORT_HEAD];

    // Table body – respect the active status filter
    var body = filteredReportRows().map(function (r, i) {
      return [
        i + 1,
        r.borrower_name || '-',
        assetLabel(r),
        fmtDate(r.created_at),
        r.due_date ? fmtDate(r.due_date) : '-',
        r.returned_at ? fmtDate(r.returned_at) : '-',
        r.notes || '-',
        r.admin_name || '-',
        r.verifikator_name || '-'
      ];
    });

    if (!body.length) { toast('Tidak ada data yang sesuai filter untuk diexport', 'error'); return; }

    doc.autoTable({
      head: head,
      body: body,
      startY: 30,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
        textColor: [0, 0, 0],
        valign: 'middle'
      },
      headStyles: {
        fillColor: [41, 50, 65],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { left: 10, right: 10 },
      didDrawPage: function (data) {
        // Footer with page number
        var pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Halaman ' + data.pageNumber + ' dari ' + pageCount, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      }
    });

    // Direct download
    doc.save('laporan-peminjaman-' + lastData.start + '_' + lastData.end + '.pdf');
    toast('PDF berhasil diunduh', 'success');
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
  function buildTrendCard() {
    var card = $('[data-trend-card]'); if (!card) return;
    var trendRows = null, mode = 'daily';
    var trendChartInstance = null;

    // Listen to theme changes to dynamically update the chart styling
    var themeObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === 'data-theme' && trendChartInstance) {
          var style = getComputedStyle(document.documentElement);
          var primaryColor = style.getPropertyValue('--chart-1').trim() || '#0075de';
          var gridColor = style.getPropertyValue('--border').trim() || '#e6e6e6';
          var textColor = style.getPropertyValue('--text-muted').trim() || '#64748b';
          var cardBg = style.getPropertyValue('--bg-card').trim() || '#ffffff';
          
          trendChartInstance.data.datasets[0].borderColor = primaryColor;
          trendChartInstance.data.datasets[0].pointBorderColor = primaryColor;
          trendChartInstance.data.datasets[0].pointBackgroundColor = cardBg;
          
          if (trendChartInstance.options.scales.x) {
            trendChartInstance.options.scales.x.ticks.color = textColor;
          }
          if (trendChartInstance.options.scales.y) {
            trendChartInstance.options.scales.y.grid.color = gridColor;
            trendChartInstance.options.scales.y.ticks.color = textColor;
          }
          
          trendChartInstance.update();
        }
      });
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    card.appendChild(el('div', { style: 'font-size:0.95rem;font-weight:800' }, 'Grafik Peminjaman'));
    var sub = el('div', { style: 'font-size:0.75rem;color:var(--text-muted);margin:2px 0 12px' }, 'Jumlah pengajuan peminjaman per periode');
    card.appendChild(sub);
    var seg = el('div', { class: 'sesd-segfilter', role: 'tablist', 'aria-label': 'Periode grafik', style: 'margin-bottom:12px' });
    var chartHost = el('div', { style: 'position:relative; height:260px; width:100%; min-width:0' });
    var canvas = el('canvas');
    card.appendChild(seg); card.appendChild(chartHost);

    function draw() {
      var b = trendBuckets(mode, trendRows || []);
      var now = new Date();
      sub.textContent = mode === 'daily' ? 'Pengajuan per hari · 14 hari terakhir'
        : mode === 'monthly' ? 'Pengajuan per bulan · tahun ' + now.getFullYear()
        : 'Pengajuan per tahun · 5 tahun terakhir';
      
      if (!b.some(function (x) { return x.n > 0; })) { 
        chartHost.innerHTML = '<div style="padding:2.2rem;text-align:center;color:var(--text-muted);font-size:0.85rem">Belum ada data pada periode ini.</div>'; 
        if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
        return; 
      }
      
      if (!chartHost.contains(canvas)) { chartHost.innerHTML = ''; chartHost.appendChild(canvas); }
      
      var labels = b.map(function(x) { return x.label; });
      var data = b.map(function(x) { return x.n; });
      var fullLabels = b.map(function(x) { return x.full; });
      var maxN = Math.max(1, Math.max.apply(null, data));
      
      if (trendChartInstance) trendChartInstance.destroy();
      
      if (window.Chart) {
        var ctx = canvas.getContext('2d');
        
        Chart.defaults.font.family = "'Inter', sans-serif";
        
        var style = getComputedStyle(document.documentElement);
        var primaryColor = style.getPropertyValue('--chart-1').trim() || '#0075de';
        var gridColor = style.getPropertyValue('--border').trim() || '#e6e6e6';
        var textColor = style.getPropertyValue('--text-muted').trim() || '#64748b';
        var cardBg = style.getPropertyValue('--bg-card').trim() || '#ffffff';
        
        Chart.defaults.color = textColor;
        
        trendChartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Peminjaman',
              data: data,
              borderColor: primaryColor,
              borderWidth: 2.5,
              pointBackgroundColor: cardBg,
              pointBorderColor: primaryColor,
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: false,
              tension: 0 // straight segments between points, no curve smoothing
            }]
          },
          options: {
            animation: {
              x: {
                type: 'number',
                easing: 'linear',
                duration: Math.max(20, 1000 / Math.max(1, data.length)),
                from: NaN,
                delay: function(ctx) {
                  if (ctx.type !== 'data' || ctx.xStarted) return 0;
                  ctx.xStarted = true;
                  return ctx.index * Math.max(20, 1000 / Math.max(1, data.length));
                }
              },
              y: {
                type: 'number',
                easing: 'linear',
                duration: Math.max(20, 1000 / Math.max(1, data.length)),
                from: function(ctx) {
                  return ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(0) : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(['y'], true).y;
                },
                delay: function(ctx) {
                  if (ctx.type !== 'data' || ctx.yStarted) return 0;
                  ctx.yStarted = true;
                  return ctx.index * Math.max(20, 1000 / Math.max(1, data.length));
                }
              }
            },
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0f172a',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 10,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                  title: function(context) { return fullLabels[context[0].dataIndex]; },
                  label: function(context) { return context.parsed.y + ' pengajuan peminjaman'; }
                }
              }
            },
            scales: {
              x: { 
                grid: { display: false, drawBorder: false },
                ticks: { color: textColor }
              },
              y: {
                beginAtZero: true,
                border: { display: false },
                grid: { color: gridColor, drawTicks: false },
                ticks: { padding: 10, stepSize: Math.max(1, Math.ceil(maxN/4)), color: textColor }
              }
            }
          }
        });
      } else {
        chartHost.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem">Gagal memuat library grafik.</div>';
      }
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
    $('[data-export]').addEventListener('click', exportExcel);
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
