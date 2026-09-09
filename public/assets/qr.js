/* ============================================================
   SESDIAN - QR code printing (admin). Renders a printable grid of
   QR codes that link to each asset's public detail page
   (aset-detail.html?qr=QRxxxxxx). Runs only on data-page="qr-print".
   QR rendering uses qrcode-generator (loaded on demand from CDN).
   ============================================================ */
(function () {
  'use strict';
  if (document.body.getAttribute('data-page') !== 'qr-print') return;
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

  async function boot() {
    var grid = $('[data-qr-grid]'); if (!grid) return;
    var user = DB.auth ? DB.auth.currentUser() : null;
    if (!user) { location.replace('login.html'); return; }
    if (user.role !== 'admin') { location.replace('dashboard.html'); return; }

    var assets;
    try { assets = await DB.assets(); }
    catch (e) { if (e && e.status === 401) { location.replace('login.html'); return; } grid.innerHTML = '<div class="sesd-empty">Gagal memuat aset.</div>'; return; }

    // assets with a QR code first; cap is not needed but keep it sane for printing
    assets = assets.filter(function (a) { return a.qr_code || a.id; });
    if (!assets.length) { grid.innerHTML = '<div class="sesd-empty">Belum ada aset.</div>'; return; }

    try { await ensureQR(); }
    catch (e) { grid.innerHTML = '<div class="sesd-empty">' + e.message + '</div>'; return; }

    var origin = location.origin + location.pathname.replace(/[^/]*$/, '');
    grid.innerHTML = '';
    assets.forEach(function (a) {
      var code = a.qr_code || ('id' + a.id);
      var url = a.qr_code ? (origin + 'aset-detail.html?qr=' + encodeURIComponent(a.qr_code)) : (origin + 'aset-detail.html?id=' + a.id);
      var card = el('div', { class: 'qr-card', style: 'border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;break-inside:avoid;background:#fff;box-shadow:var(--shadow)' });
      card.appendChild(el('div', { style: 'background:#fff;border:1px solid var(--border);border-radius:10px;padding:8px;display:inline-block', html: '<img src="' + qrDataUrl(url) + '" alt="' + code + '" style="width:118px;height:118px;image-rendering:pixelated;display:block">' }));
      card.appendChild(el('div', { style: 'font-weight:700;font-size:0.8rem;margin-top:8px;word-break:break-word;color:var(--text)' }, a.name || ''));
      card.appendChild(el('div', { style: 'font-family:"JetBrains Mono",monospace;font-size:0.68rem;color:var(--text-muted);margin-top:2px' }, (a.code || '') + ' · ' + code));
      grid.appendChild(card);
    });

    var sub = $('[data-qr-sub]'); if (sub) sub.textContent = assets.length + ' QR siap dicetak';
    var pb = $('[data-print]'); if (pb) pb.addEventListener('click', function () { window.print(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
