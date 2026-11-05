/* ============================================================
   SESDIAN - jejak audit (SES-4.3.3). Runs only on data-page="audit".
   Reads /api/dashboard?view=audit for a date window, then filters by
   activity type and free text in the browser. Inventory sessions expand
   to the per-unit result (ada / tidak ditemukan / pindahan). CSV export.
   ============================================================ */
(function () {
  'use strict';
  if (document.body.getAttribute('data-page') !== 'audit') return;
  var DB = window.SESDIAN_DB || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap'); if (!wrap) { wrap = el('div', { class: 'sesd-toast-wrap' }); document.body.appendChild(wrap); }
    var t = el('div', { class: 'sesd-toast ' + (type || 'info') }, msg); wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function localIso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function fmtTime(s) {
    var d = new Date(s); if (isNaN(d)) return String(s || '');
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + '.' + pad2(d.getMinutes());
  }

  var ACTION = {
    create: ['Tambah', '#1aae39'], update: ['Ubah', '#0075de'], delete: ['Hapus', '#e03e3e'],
    status: ['Ubah Status', '#7b54c0'], inventory: ['Inventarisasi', '#2a9d99'], notify: ['Notifikasi', '#dd5b00'],
    cron: ['Tugas Terjadwal', '#dd5b00'], import: ['Impor', '#0075de'], role: ['Ubah Peran', '#7b54c0'],
    deactivate: ['Nonaktifkan', '#e03e3e'],
  };
  var ENTITY = { borrowing: 'Peminjaman', asset: 'Aset', room: 'Ruangan', category: 'Kategori', user: 'Pengguna', setting: 'Pengaturan', notification: 'Notifikasi' };
  var BSTATUS = {
    pending: 'Pending', approved: 'Disetujui Admin', verified: 'Terverifikasi', borrowed: 'Dipinjam',
    return_pending: 'Menunggu Verifikasi Kembali', returned: 'Kembali', rejected: 'Ditolak', cancelled: 'Dibatalkan', expired: 'Kedaluwarsa',
  };
  var ROLE = { admin: 'Admin', verifikator: 'Verifikator', user: 'User', system: 'Sistem' };
  var FIELD = { code: 'Kode', name: 'Nama', category_id: 'Kategori', brand: 'Merek', room_id: 'Ruangan', year: 'Tahun', condition: 'Kondisi', type: 'Jenis', asset_type: 'Tipe', stock_total: 'Stok', status: 'Status', image: 'Gambar' };
  var NOTIFY = { remind: 'pengingat jatuh tempo', returned: 'konfirmasi pengembalian', 'return-request': 'permintaan verifikasi pengembalian' };
  // activity-type filter (select) -> row predicate
  var KIND = {
    all: function () { return true; },
    borrowing: function (r) { return r.entity === 'borrowing' && r.action !== 'notify'; },
    inventory: function (r) { return r.action === 'inventory'; },
    notification: function (r) { return r.action === 'notify' || r.entity === 'notification'; },
    asset: function (r) { return r.entity === 'asset'; },
    room: function (r) { return r.entity === 'room' && r.action !== 'inventory'; },
    user: function (r) { return r.entity === 'user'; },
    other: function (r) { return r.entity === 'category' || r.entity === 'setting'; },
  };

  // one readable sentence per log row
  function describe(r) {
    var d = r.detail || {};
    var q = function (s) { return '"' + (s || '-') + '"'; };
    if (r.entity === 'borrowing') {
      if (r.action === 'create') return 'Pengajuan peminjaman ' + q(d.asset) + ' (' + (d.qty || 1) + ' unit) oleh ' + (d.borrower || '-') + ', jatuh tempo ' + (d.due || '-');
      if (r.action === 'status') return 'Peminjaman ' + q(d.asset) + ' milik ' + (d.borrower || '-') + ': ' + (BSTATUS[d.from] || d.from || '-') + ' → ' + (BSTATUS[d.to] || d.to || '-') + (d.scanned ? ' (via pemindaian QR)' : '');
      if (r.action === 'notify') return 'WhatsApp ' + (NOTIFY[d.kind] || d.kind || '') + ' untuk ' + q(d.asset) + (d.borrower ? ' (' + d.borrower + ')' : '') + ' · ' + (d.channel === 'whatsapp-otomatis' ? 'terkirim otomatis' : d.channel === 'wa.me' ? 'dibuka via wa.me' : 'nomor tujuan belum ada');
    }
    if (r.action === 'inventory') {
      return 'Inventarisasi ' + (d.room || 'ruangan') + (d.room_code ? ' (' + d.room_code + ')' : '') + ': ' + (d.found || 0) + ' dari ' + (d.total || 0) + ' unit ada, ' +
        (d.missing || 0) + ' tidak ditemukan' + (d.moved ? ', ' + d.moved + ' dipindahkan ke ruangan ini' : '') + (d.condition_changed ? ', ' + d.condition_changed + ' kondisi diperbarui' : '');
    }
    if (r.entity === 'notification' && r.action === 'cron') {
      return 'Pemeriksaan jatuh tempo ' + (d.trigger === 'cron' ? 'otomatis (terjadwal)' : 'manual') + ': ' + (d.count || 0) + ' peminjaman terlambat, ' +
        (d.sent || 0) + ' pengingat WA terkirim' + (d.auto ? '' : ' · WA otomatis nonaktif');
    }
    if (r.entity === 'asset') {
      if (r.action === 'import') return 'Impor Excel: ' + (d.success || 0) + ' aset ditambahkan, ' + (d.skipped || 0) + ' dilewati, ' + (d.failed || 0) + ' gagal';
      if (d.jenis) return 'Ganti gambar jenis ' + q(d.jenis);
      var label = (d.code ? d.code + ' – ' : '') + (d.name || '-');
      if (r.action === 'update') {
        var parts = Object.keys(d.changes || {}).map(function (k) {
          var v = d.changes[k];
          if (k === 'image' || k === 'category_id' || k === 'room_id' || !Array.isArray(v)) return FIELD[k] || k;
          return (FIELD[k] || k) + ' ' + (v[0] == null ? '-' : v[0]) + ' → ' + (v[1] == null ? '-' : v[1]);
        });
        return 'Ubah aset ' + label + (parts.length ? ': ' + parts.join(', ') : ' (tanpa perubahan)');
      }
      return (r.action === 'create' ? 'Tambah aset ' : 'Hapus aset ') + label;
    }
    if (r.entity === 'room') return (ACTION[r.action] ? ACTION[r.action][0] : r.action) + ' ruangan ' + (d.name || '-') + (d.code ? ' (' + d.code + ')' : '');
    if (r.entity === 'category') return (ACTION[r.action] ? ACTION[r.action][0] : r.action) + ' kategori ' + q(d.name);
    if (r.entity === 'user') {
      var who = (d.name ? d.name + ' · ' : '') + 'NIP ' + (d.nip || '-');
      if (r.action === 'role') return 'Ubah peran ' + who + ': ' + (ROLE[d.from] || d.from || '-') + ' → ' + (ROLE[d.to] || d.to || '-');
      if (r.action === 'create') return 'Daftarkan akun NIP ' + (d.nip || '-') + ' sebagai ' + (ROLE[d.role] || d.role || '-');
      if (r.action === 'deactivate') return 'Nonaktifkan akun ' + who;
      return 'Hapus akun ' + who;
    }
    if (r.entity === 'setting') return 'Ubah nomor WhatsApp notifikasi admin';
    return (ACTION[r.action] ? ACTION[r.action][0] : r.action) + ' ' + (ENTITY[r.entity] || r.entity);
  }

  var all = [];
  var state = { start: '', end: '', kind: 'all', q: '' };

  function visibleRows() {
    var pred = KIND[state.kind] || KIND.all;
    var q = state.q.trim().toLowerCase();
    return all.filter(function (r) {
      if (!pred(r)) return false;
      if (!q) return true;
      return (String(r.user_name || '') + ' ' + describe(r)).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderSummary(rows) {
    var host = $('[data-audit-summary]'); host.innerHTML = '';
    var chip = function (text, color) {
      var c = el('div', { style: 'display:flex;align-items:center;gap:6px;padding:0.4rem 0.7rem;border-radius:10px;background:var(--bg-card, #fff);box-shadow:var(--shadow);font-size:0.8rem;font-weight:600' });
      if (color) c.appendChild(el('span', { style: 'width:9px;height:9px;border-radius:50%;background:' + color }));
      c.appendChild(el('span', {}, text));
      host.appendChild(c);
    };
    chip(rows.length + ' aktivitas', '');
    var by = {};
    rows.forEach(function (r) { by[r.action] = (by[r.action] || 0) + 1; });
    Object.keys(ACTION).forEach(function (k) { if (by[k]) chip(ACTION[k][0] + ': ' + by[k], ACTION[k][1]); });
  }

  function inventoryDetail(d) {
    var box = el('div', { style: 'padding:0.6rem 0.8rem 0.9rem 0.8rem' });
    var items = (d && d.items) || [];
    if (!items.length) { box.textContent = 'Tidak ada unit tercatat.'; return box; }
    var tbl = el('table', { style: 'width:100%;border-collapse:collapse;font-size:0.78rem' });
    tbl.innerHTML = '<thead><tr><th style="text-align:left;padding:4px 8px;color:var(--text-muted)">Kode</th><th style="text-align:left;padding:4px 8px;color:var(--text-muted)">Nama</th><th style="text-align:left;padding:4px 8px;color:var(--text-muted)">Hasil</th><th style="text-align:left;padding:4px 8px;color:var(--text-muted)">Kondisi</th><th style="text-align:left;padding:4px 8px;color:var(--text-muted)">Keterangan</th></tr></thead>';
    var tb = el('tbody');
    items.forEach(function (it) {
      var tr = el('tr', { style: 'border-top:1px solid var(--border)' });
      tr.appendChild(el('td', { style: 'padding:4px 8px;font-family:"JetBrains Mono",monospace' }, it.code || '-'));
      tr.appendChild(el('td', { style: 'padding:4px 8px' }, it.name || '-'));
      tr.appendChild(el('td', { style: 'padding:4px 8px;font-weight:700;color:' + (it.found ? '#1aae39' : '#e03e3e') }, it.found ? 'Ada' : 'Tidak ditemukan'));
      var cond = it.condition || '-';
      if (it.condition_before && it.condition_before !== it.condition) cond = it.condition_before + ' → ' + it.condition;
      tr.appendChild(el('td', { style: 'padding:4px 8px' }, cond));
      tr.appendChild(el('td', { style: 'padding:4px 8px;color:var(--text-muted)' }, it.moved_from ? 'Pindahan dari ' + it.moved_from : ''));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); box.appendChild(tbl);
    return box;
  }

  function render() {
    var rows = visibleRows();
    renderSummary(rows);
    var tbody = $('[data-audit-rows]'); tbody.innerHTML = '';
    if (!rows.length) {
      tbody.appendChild(el('tr', { html: '<td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada aktivitas pada periode / filter ini.</td>' }));
      return;
    }
    var td = 'padding:0.6rem 0.8rem;font-size:0.83rem;border-top:1px solid var(--border);vertical-align:top';
    rows.forEach(function (r) {
      var tr = el('tr', { 'data-audit-row': r.id });
      tr.appendChild(el('td', { style: td + ';white-space:nowrap;font-family:"JetBrains Mono",monospace;font-size:0.76rem', 'data-label': 'Waktu' }, fmtTime(r.created_at)));
      var who = el('td', { style: td, 'data-label': 'Pengguna' });
      who.appendChild(el('div', { style: 'font-weight:600;color:var(--text)' }, r.user_name || 'Sistem'));
      who.appendChild(el('div', { style: 'font-size:0.7rem;color:var(--text-muted)' }, ROLE[r.user_role] || r.user_role || ''));
      tr.appendChild(who);
      var a = ACTION[r.action] || [r.action, '#64748b'];
      var act = el('td', { style: td, 'data-label': 'Aksi' });
      act.appendChild(el('span', { style: 'display:inline-block;white-space:nowrap;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;color:#fff;background:' + a[1] }, a[0]));
      tr.appendChild(act);
      tr.appendChild(el('td', { style: td, 'data-label': 'Objek' }, (ENTITY[r.entity] || r.entity) + (r.entity_id ? ' #' + r.entity_id : '')));
      var desc = el('td', { style: td, 'data-label': 'Keterangan' });
      desc.appendChild(el('span', {}, describe(r)));
      tr.appendChild(desc);
      tbody.appendChild(tr);
      if (r.action === 'inventory') {
        var more = el('button', { type: 'button', class: 'sesd-btn sesd-btn-ghost sesd-btn-sm', style: 'margin-left:8px;padding:2px 8px;font-size:0.72rem' }, 'Lihat rincian');
        var detailRow = null;
        more.addEventListener('click', function () {
          if (detailRow) { detailRow.remove(); detailRow = null; more.textContent = 'Lihat rincian'; return; }
          detailRow = el('tr', { 'data-audit-detail': r.id });
          var cell = el('td', { colspan: '5', style: 'background:var(--bg);border-top:1px solid var(--border)' });
          cell.appendChild(inventoryDetail(r.detail));
          detailRow.appendChild(cell);
          tr.parentNode.insertBefore(detailRow, tr.nextSibling);
          more.textContent = 'Tutup rincian';
        });
        desc.appendChild(more);
      }
    });
  }

  async function load() {
    var tbody = $('[data-audit-rows]');
    tbody.innerHTML = '<tr><td colspan="5" style="padding:0"><div class="sesd-page-loader" style="min-height:160px"><span></span><span></span><span></span></div></td></tr>';
    try {
      var d = await DB.auditTrail({ start: state.start, end: state.end, limit: 5000 });
      all = (d && d.rows) || [];
      render();
    } catch (e) {
      if (e && e.status === 401) { location.replace('login.html'); return; }
      tbody.innerHTML = '';
      tbody.appendChild(el('tr', {}, '')).appendChild(el('td', { colspan: '5', style: 'text-align:center;padding:2rem;color:#e03e3e' }, (e && e.message) || 'Gagal memuat jejak audit'));
    }
  }

  function exportCsv() {
    var rows = visibleRows();
    if (!rows.length) { toast('Tidak ada data untuk diexport', 'error'); return; }
    var lines = [['Waktu', 'Pengguna', 'Peran', 'Aksi', 'Objek', 'Keterangan'].join(',')];
    rows.forEach(function (r) {
      var cols = [fmtTime(r.created_at), r.user_name || 'Sistem', ROLE[r.user_role] || r.user_role || '', (ACTION[r.action] || [r.action])[0],
        (ENTITY[r.entity] || r.entity) + (r.entity_id ? ' #' + r.entity_id : ''), describe(r)];
      lines.push(cols.map(function (c) { var s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'jejak-audit-' + state.start + '_' + state.end + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  function boot() {
    var now = new Date();
    state.end = localIso(now);
    state.start = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    var si = $('[data-audit-start]'), ei = $('[data-audit-end]'), ki = $('[data-audit-kind]'), qi = $('[data-audit-q]');
    si.value = state.start; ei.value = state.end; si.max = ei.max = state.end;
    si.addEventListener('change', function () { if (si.value) { state.start = si.value; if (state.end < state.start) { state.end = state.start; ei.value = state.end; } load(); } });
    ei.addEventListener('change', function () { if (ei.value) { state.end = ei.value; if (state.start > state.end) { state.start = state.end; si.value = state.start; } load(); } });
    ki.addEventListener('change', function () { state.kind = ki.value; render(); });
    qi.addEventListener('input', function () { state.q = qi.value; render(); });
    $('[data-audit-export]').addEventListener('click', exportCsv);
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
