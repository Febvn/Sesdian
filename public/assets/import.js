/* ============================================================
   SESDIAN - Excel import (admin). Parses .xlsx/.xls in the browser
   with SheetJS (loaded on demand from CDN), previews the rows, then
   POSTs normalized JSON to /api/assets (body.rows). Exposes
   window.SESDIAN_IMPORT.open().
   ============================================================ */
(function () {
  'use strict';
  var DB = window.SESDIAN_DB || {};
  var XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap'); if (!wrap) { wrap = el('div', { class: 'sesd-toast-wrap' }); document.body.appendChild(wrap); }
    var t = el('div', { class: 'sesd-toast ' + (type || 'info') }, msg); wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 3200);
  }

  var _loading = null;
  function ensureXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (_loading) return _loading;
    _loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = XLSX_URL;
      s.onload = function () { resolve(window.XLSX); };
      s.onerror = function () { reject(new Error('Gagal memuat pustaka Excel (perlu internet)')); };
      document.head.appendChild(s);
    });
    return _loading;
  }

  // map a spreadsheet row (header->value) to our asset keys.
  // Mengikuti format "daftar aset 2026": Kode Barang + NUP menjadi kode unik,
  // Nama Barang, Merk, Jenis BMN (kategori), Kondisi.
  var FIELDS = {
    code: ['kode', 'code'],
    name: ['nama barang', 'nama', 'name', 'nama aset'],
    category: ['jenis bmn', 'kategori', 'category'],
    brand: ['merk', 'brand', 'merek'],
    room: ['ruangan', 'room', 'lokasi'],
    year: ['tahun', 'year'],
    condition: ['kondisi', 'condition'],
    asset_type: ['jenis aset', 'asset type', 'asset_type'],
    acquisition_date: ['tanggal perolehan', 'tgl perolehan', 'tanggal_perolehan', 'acquisition_date', 'acquisition date'],
    stock_total: ['stok total', 'stok', 'stock', 'jumlah', 'stok_total', 'stock_total'],
  };
  // Excel dates arrive as JS Date (cellDates:true) or a plain string; normalise
  // to 'YYYY-MM-DD' using the local calendar day so it never drifts a day.
  function toISODate(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v.getTime())) {
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    var d = new Date(s);
    if (!isNaN(d.getTime())) { var q = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate()); }
    return '';
  }
  function normalizeRow(raw) {
    var low = {};
    Object.keys(raw).forEach(function (k) { low[String(k).trim().toLowerCase()] = raw[k]; });
    var out = {};
    Object.keys(FIELDS).forEach(function (key) {
      for (var i = 0; i < FIELDS[key].length; i++) { var h = FIELDS[key][i]; if (low[h] != null && String(low[h]).trim() !== '') { out[key] = (key === 'acquisition_date') ? toISODate(low[h]) : String(low[h]).trim(); break; } }
    });
    // format 2026: kode unik = "Kode Barang" + "NUP" digabung
    if (!out.code && low['kode barang'] != null && String(low['kode barang']).trim() !== '') {
      out.code = String(low['kode barang']).trim() + String(low['nup'] != null ? low['nup'] : '').trim();
    }
    return out;
  }

  function open() {
    if (document.querySelector('.sesd-overlay')) return; // never stack duplicate modals
    var ov = el('div', { class: 'sesd-overlay' });
    var m = el('div', { class: 'sesd-modal', style: 'width:680px' });
    m.appendChild(el('h3', {}, 'Import Aset dari Excel'));
    m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:0.82rem;margin-bottom:0.75rem' }, 'Mengikuti format daftar aset. Kolom inti: Kode Barang + NUP (menjadi kode unik), Nama Barang, Jenis BMN, Merk, Kondisi, dan Tanggal Perolehan. Setiap baris = satu barang; baris dengan kode yang sudah ada otomatis dilewati.'));

    var tmpl = el('a', { href: '#', style: 'font-size:0.8rem;font-weight:700;display:inline-block;margin-bottom:0.75rem' }, 'Unduh template CSV (contoh)');
    tmpl.addEventListener('click', function (e) { e.preventDefault(); downloadTemplate(); });
    m.appendChild(tmpl);

    var fileWrap = el('div', { class: 'sesd-field' });
    fileWrap.appendChild(el('label', {}, 'File Excel (.xlsx / .xls / .csv)'));
    var input = el('input', { type: 'file', accept: '.xlsx,.xls,.csv' });
    fileWrap.appendChild(input);
    m.appendChild(fileWrap);

    var info = el('div', { style: 'font-size:0.82rem;color:var(--text-muted);margin:0.25rem 0 0.75rem' });
    m.appendChild(info);
    var previewWrap = el('div', { style: 'max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:10px;display:none;margin-bottom:0.75rem' });
    m.appendChild(previewWrap);

    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:0.5rem' });
    var importBtn = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'flex:1' }, 'Import');
    importBtn.disabled = true; importBtn.style.opacity = '0.6';
    var cancel = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Tutup');
    foot.appendChild(importBtn); foot.appendChild(cancel); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    cancel.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    var rows = [];
    input.addEventListener('change', async function () {
      if (!input.files || !input.files[0]) return;
      info.textContent = 'Membaca file…';
      try {
        var XLSX = await ensureXlsx();
        var buf = await input.files[0].arrayBuffer();
        var wb = XLSX.read(buf, { type: 'array', cellDates: true });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        // Reject files that don't follow the template (must have Kode + Nama columns)
        var headers = raw.length ? Object.keys(raw[0]).map(function (h) { return String(h).trim().toLowerCase(); }) : [];
        var hasCode = headers.some(function (h) { return FIELDS.code.indexOf(h) !== -1 || h === 'kode barang'; });
        var hasName = headers.some(function (h) { return FIELDS.name.indexOf(h) !== -1; });
        if (!hasCode || !hasName) {
          info.innerHTML = '<span style="color:var(--danger);font-weight:700">File tidak sesuai template.</span> Wajib ada kolom <b>Kode Barang</b> dan <b>Nama Barang</b> (format daftar aset 2026). Unduh template lalu gunakan kolom yang sama.';
          previewWrap.style.display = 'none'; importBtn.disabled = true; importBtn.style.opacity = '0.6'; rows = [];
          return;
        }
        rows = raw.map(normalizeRow).filter(function (r) { return r.code || r.name; });
        if (!rows.length) { info.textContent = 'Tidak ada baris valid ditemukan.'; previewWrap.style.display = 'none'; importBtn.disabled = true; importBtn.style.opacity = '0.6'; return; }
        info.textContent = rows.length + ' baris siap diimpor (menampilkan 10 pertama):';
        renderPreview(previewWrap, rows.slice(0, 10));
        previewWrap.style.display = 'block';
        importBtn.disabled = false; importBtn.style.opacity = '1';
      } catch (e) { info.textContent = (e && e.message) || 'Gagal membaca file'; }
    });

    importBtn.addEventListener('click', async function () {
      if (!rows.length) return;
      importBtn.disabled = true; importBtn.textContent = 'Mengimpor…';
      try {
        var res = await DB.importAssets(rows);
        toast('Import selesai: ' + res.success + ' berhasil, ' + res.skipped + ' dilewati, ' + res.failed + ' gagal', res.failed ? 'info' : 'success');
        close();
        setTimeout(function () { location.reload(); }, 900);
      } catch (e) {
        toast((e && e.message) || 'Gagal mengimpor', 'error');
        importBtn.disabled = false; importBtn.textContent = 'Import';
      }
    });
  }

  function renderPreview(host, rows) {
    var cols = ['code', 'name', 'category', 'brand', 'room', 'acquisition_date', 'condition', 'type', 'asset_type', 'stock_total'];
    var head = '<tr>' + cols.map(function (c) { return '<th style="padding:6px 8px;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;position:sticky;top:0;background:#f8faff">' + c + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td style="padding:6px 8px;font-size:0.78rem;border-top:1px solid var(--border)">' + (r[c] != null ? String(r[c]) : '') + '</td>'; }).join('') + '</tr>'; }).join('');
    host.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:640px">' + head + body + '</table>';
  }

  function downloadTemplate() {
    // mirrors the daftar aset 2026 format: kode unik = Kode Barang + NUP,
    // kategori = Jenis BMN, merek = Merk (contoh baris diambil dari file asli 2026)
    var head = 'No,Jenis BMN,Kode Barang,NUP,Nama Barang,Merk,Tipe,Kondisi,Tanggal Perolehan';
    var samples = [
      '1,ALAT ANGKUTAN BERMOTOR,3020101003,1,Station Wagon,TOYOTA KIJANG,INNOVA TYPE J,Baik,2010-12-16',
      '2,ALAT ANGKUTAN BERMOTOR,3020102003,2,Mini Bus ( Penumpang 14 Orang Kebawah ),ISUZU PANTHER,BR54FTURBO H TOURING,Baik,2011-08-01',
      '3,MESIN PERALATAN NON TIK,3080117016,2,Lemari Asam,ESCO,EFA-4UDRVW-8,Baik,2019-11-05',
      '4,MESIN PERALATAN KHUSUS TIK,3100102002,5,Lap Top,ACER,ASPIRE 5,Baik,2020-03-12',
    ];
    var blob = new Blob(['﻿' + head + '\r\n' + samples.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'template-import-aset-2026.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Export the ENTIRE asset database (admin) to a real .xlsx — mirrors the daftar
  // aset columns plus stock/status/QR so the file round-trips through Import.
  async function exportAll(btn) {
    var orig = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Menyiapkan…'; }
    try {
      var XLSX = await ensureXlsx();
      var assets = await DB.assets();
      assets = assets.slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')) || String(a.code || '').localeCompare(String(b.code || '')); });
      var rows = assets.map(function (a, i) {
        return {
          'No': i + 1,
          'Kode': a.code || '',
          'Nama Barang': a.name || '',
          'Jenis BMN': a.category || '',
          'Merek': a.brand || '',
          'Kondisi': a.condition || '',
          'Jenis': a.type || '',
          'Tanggal Perolehan': a.acquisition_date ? String(a.acquisition_date).slice(0, 10) : '',
          'Ruangan': a.room || '',
          'Stok Total': a.stock_total,
          'Stok Tersedia': a.stock_available,
          'Stok Dipinjam': a.stock_borrowed,
          'Status': a.status || '',
          'Kode QR': a.qr_code || ''
        };
      });
      var ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 34 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 9 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 11 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Aset');
      var today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, 'daftar-aset-sesdian-' + today + '.xlsx');
      toast('Daftar aset diekspor (' + rows.length + ' barang)', 'success');
    } catch (e) {
      toast((e && e.message) || 'Gagal mengekspor daftar aset', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
  }

  window.SESDIAN_IMPORT = { open: open, exportAll: exportAll };
})();
