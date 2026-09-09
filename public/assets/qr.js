/* ============================================================
   SESDIAN - QR codes. Exposes window.SESDIAN_QR.showFor(asset) so a
   single asset's QR can be viewed/printed straight from its detail
   (per item). Still powers the optional bulk page (data-page="qr-print").
   QR rendering uses qrcode-generator (loaded on demand from CDN).
   ============================================================ */
(function () {
  'use strict';
  var DB = window.SESDIAN_DB || {};
  var QR_URL = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  var _loading = null;
  function ensureQR() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (_loading) return _loading;
    _loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = QR_URL;
      s.onload = function () { resolve(window.qrcode); };
      s.onerror = function () { reject(new Error('Gagal memuat pustaka QR (perlu internet)')); };
      document.head.appendChild(s);
    });
    return _loading;
  }
  function qrDataUrl(text) {
    var qr = window.qrcode(0, 'M');
    qr.addData(text); qr.make();
    return qr.createDataURL(5, 8);
  }
  function detailUrl(asset) {
    var origin = location.origin + location.pathname.replace(/[^/]*$/, '');
    return asset.qr_code ? (origin + 'aset-detail.html?qr=' + encodeURIComponent(asset.qr_code)) : (origin + 'aset-detail.html?id=' + asset.id);
  }

  // Show one asset's QR in a modal, with a print button (prints just this QR).
  async function showFor(asset) {
    if ($('.sesd-overlay')) return; // never stack modals
    var ov = el('div', { class: 'sesd-overlay' });
    var m = el('div', { class: 'sesd-modal', style: 'width:340px;text-align:center' });
    m.appendChild(el('h3', {}, 'QR Aset'));
    var holder = el('div', { style: 'display:flex;align-items:center;justify-content:center;min-height:160px' });
    holder.innerHTML = '<div class="sesd-page-loader" style="min-height:0"><span></span><span></span><span></span></div>';
    m.appendChild(holder);
    m.appendChild(el('div', { style: 'font-weight:700;margin-top:8px' }, asset.name || ''));
    var code = asset.qr_code || ('id' + asset.id);
    m.appendChild(el('div', { style: 'font-family:"JetBrains Mono",monospace;font-size:.72rem;color:var(--text-muted);margin-top:2px' }, (asset.code || '') + ' · ' + code));
    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    var printBtn = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'flex:1' }, 'Cetak QR');
    var closeBtn = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Tutup');
    foot.appendChild(printBtn); foot.appendChild(closeBtn); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    closeBtn.addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });

    var dataUrl = '';
    try { await ensureQR(); dataUrl = qrDataUrl(detailUrl(asset)); holder.innerHTML = '<img src="' + dataUrl + '" alt="' + code + '" style="width:200px;height:200px;image-rendering:pixelated">'; }
    catch (e) { holder.textContent = 'Gagal memuat QR (perlu internet).'; }

    printBtn.addEventListener('click', function () {
      if (!dataUrl) return;
      var w = window.open('', '_blank', 'width=420,height=520');
      if (!w) return;
      w.document.write('<html><head><title>QR ' + (asset.code || code) + '</title></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:24px" onload="window.print()">' +
        '<img src="' + dataUrl + '" style="width:240px;height:240px;image-rendering:pixelated">' +
        '<div style="font-weight:700;margin-top:10px;font-size:15px">' + (asset.name || '') + '</div>' +
        '<div style="font-family:monospace;font-size:12px;color:#555;margin-top:2px">' + (asset.code || '') + ' &middot; ' + code + '</div>' +
        '</body></html>');
      w.document.close();
    });
  }

  window.SESDIAN_QR = { ensure: ensureQR, dataUrl: qrDataUrl, showFor: showFor };

  /* -------- optional bulk print page (data-page="qr-print") -------- */
  async function bootBulk() {
    var grid = $('[data-qr-grid]'); if (!grid) return;
    var user = DB.auth ? DB.auth.currentUser() : null;
    if (!user) { location.replace('login.html'); return; }
    if (user.role !== 'admin') { location.replace('dashboard.html'); return; }
    var assets;
    try { assets = await DB.assets(); }
    catch (e) { if (e && e.status === 401) { location.replace('login.html'); return; } grid.innerHTML = '<div class="sesd-empty">Gagal memuat aset.</div>'; return; }
    if (!assets.length) { grid.innerHTML = '<div class="sesd-empty">Belum ada aset.</div>'; return; }
    try { await ensureQR(); } catch (e) { grid.innerHTML = '<div class="sesd-empty">' + e.message + '</div>'; return; }
    grid.innerHTML = '';
    assets.forEach(function (a) {
      var code = a.qr_code || ('id' + a.id);
      var card = el('div', { class: 'qr-card', style: 'border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;break-inside:avoid;background:#fff;box-shadow:var(--shadow)' });
      card.appendChild(el('div', { style: 'background:#fff;border:1px solid var(--border);border-radius:10px;padding:8px;display:inline-block', html: '<img src="' + qrDataUrl(detailUrl(a)) + '" alt="' + code + '" style="width:118px;height:118px;image-rendering:pixelated;display:block">' }));
      card.appendChild(el('div', { style: 'font-weight:700;font-size:0.8rem;margin-top:8px;word-break:break-word;color:var(--text)' }, a.name || ''));
      card.appendChild(el('div', { style: 'font-family:"JetBrains Mono",monospace;font-size:0.68rem;color:var(--text-muted);margin-top:2px' }, (a.code || '') + ' · ' + code));
      grid.appendChild(card);
    });
    var sub = $('[data-qr-sub]'); if (sub) sub.textContent = assets.length + ' QR siap dicetak';
    var pb = $('[data-print]'); if (pb) pb.addEventListener('click', function () { window.print(); });
  }
  if (document.body.getAttribute('data-page') === 'qr-print') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootBulk);
    else bootBulk();
  }
})();
