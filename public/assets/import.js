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

  // map a spreadsheet row (header->value) to our asset keys
  var FIELDS = {
    code: ['kode', 'code'],
    name: ['nama', 'name', 'nama aset'],
    category: ['kategori', 'category'],
    brand: ['brand', 'merek', 'merk'],
    room: ['ruangan', 'room', 'lokasi'],
    year: ['tahun', 'year'],
    condition: ['kondisi', 'condition'],
    type: ['tipe', 'type'],
    asset_type: ['jenis aset', 'jenis', 'asset type', 'asset_type'],
    stock_total: ['stok total', 'stok', 'stock', 'jumlah', 'stok_total', 'stock_total'],
  };
  function normalizeRow(raw) {
    var low = {};
    Object.keys(raw).forEach(function (k) { low[String(k).trim().toLowerCase()] = raw[k]; });
    var out = {};
    Object.keys(FIELDS).forEach(function (key) {
      for (var i = 0; i < FIELDS[key].length; i++) { var h = FIELDS[key][i]; if (low[h] != null && String(low[h]).trim() !== '') { out[key] = String(low[h]).trim(); break; } }
    });
    return out;
  }

  function open() {
    if (document.querySelector('.sesd-overlay')) return; // never stack duplicate modals
    var ov = el('div', { class: 'sesd-overlay' });
    var m = el('div', { class: 'sesd-modal', style: 'width:680px' });
    m.appendChild(el('h3', {}, 'Import Aset dari Excel'));
    m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:0.82rem;margin-bottom:0.75rem' }, 'Wajib memakai template ini. Kolom: Kode, Nama, Kategori, Brand, Ruangan (opsional), Kondisi, Tipe (BMN/Non-BMN). Setiap baris = satu barang dengan kode unik. Baris dengan kode yang sudah ada otomatis dilewati.'));

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
        var wb = XLSX.read(buf, { type: 'array' });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        // #5 — reject files that don't follow the template (must have Kode + Nama columns)
        var headers = raw.length ? Object.keys(raw[0]).map(function (h) { return String(h).trim().toLowerCase(); }) : [];
        var hasCode = headers.some(function (h) { return FIELDS.code.indexOf(h) !== -1; });
        var hasName = headers.some(function (h) { return FIELDS.name.indexOf(h) !== -1; });
        if (!hasCode || !hasName) {
          info.innerHTML = '<span style="color:var(--danger);font-weight:700">File tidak sesuai template.</span> Wajib ada kolom <b>Kode</b> dan <b>Nama</b>. Unduh template lalu gunakan kolom yang sama.';
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
    var cols = ['code', 'name', 'category', 'brand', 'room', 'year', 'condition', 'type', 'asset_type', 'stock_total'];
    var head = '<tr>' + cols.map(function (c) { return '<th style="padding:6px 8px;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;position:sticky;top:0;background:#f8faff">' + c + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td style="padding:6px 8px;font-size:0.78rem;border-top:1px solid var(--border)">' + (r[c] != null ? String(r[c]) : '') + '</td>'; }).join('') + '</tr>'; }).join('');
    host.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:640px">' + head + body + '</table>';
  }

  function downloadTemplate() {
    // mirrors the daftar aset 2025 format (real kode/kategori) plus a Ruangan column
    var head = 'Kode,Nama,Kategori,Brand,Ruangan,Kondisi,Tipe';
    var samples = [
      '30801170162,Lemari Asam,MESIN PERALATAN NON TIK,ESCO,Laboratorium,Baik,BMN',
      '30801170163,LCD Projector/Infocus,MESIN PERALATAN NON TIK,EPSON,Ruang Rapat,Baik,BMN',
      '30801170164,Lemari Besi/Metal,MESIN PERALATAN NON TIK,Brother,Ruang Tata Usaha,Baik,BMN',
      '325872859,Laptop,Elektronik,Acer,Ruang Kepala,Baik,BMN',
    ];
    var blob = new Blob(['﻿' + head + '\r\n' + samples.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'template-import-aset.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  window.SESDIAN_IMPORT = { open: open };
})();
