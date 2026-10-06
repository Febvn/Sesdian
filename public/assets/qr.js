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

  // Parse the combined code field back into Kode Barang and NUP.
  // Kode barang is typically 10 digits, NUP is the remainder.
  function parseKodeNUP(code) {
    if (!code) return { kodeBarang: '', nup: '' };
    var s = String(code).trim();
    // If the code is all digits and longer than 10, split at 10
    if (/^\d+$/.test(s) && s.length > 10) {
      return { kodeBarang: s.substring(0, 10), nup: s.substring(10) };
    }
    return { kodeBarang: s, nup: '' };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Build the Kementerian-style label HTML for print
  function buildLabelHtml(asset, dataUrl) {
    var code = asset.qr_code || ('id' + asset.id);
    var parsed = parseKodeNUP(asset.code);
    var logoLeft = window.LOGO_LEFT || '';
    var logoRight = window.LOGO_RIGHT || '';
    var categoryText = asset.category ? ' (' + esc(asset.category) + ')' : '';

    return '<html><head><title>Label ' + esc(asset.code || code) + '</title>' +
      '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: Arial, Helvetica, sans-serif; }' +
        '.label { width: 340px; border: 2px solid #222; background: #fff; }' +
        '.header { display: flex; align-items: center; border-bottom: 2px solid #222; padding: 6px 8px; gap: 6px; }' +
        '.header-logo { width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }' +
        '.header-text { flex: 1; text-align: center; }' +
        '.header-title { font-size: 11px; font-weight: 700; line-height: 1.3; }' +
        '.header-code { font-size: 8px; font-weight: 400; margin-top: 2px; }' +
        '.info { padding: 5px 8px; border-bottom: 1px solid #bbb; }' +
        '.info-row1 { display: flex; gap: 16px; font-size: 10px; font-weight: 700; }' +
        '.info-name { font-size: 10px; font-weight: 700; margin-top: 2px; }' +
        '.bottom { display: flex; align-items: flex-end; padding: 4px 8px 6px; }' +
        '.bottom-left { flex: 1; }' +
        '.bottom-code { font-size: 10px; font-weight: 700; }' +
        '.qr-img { width: 80px; height: 80px; image-rendering: pixelated; }' +
        '@media print { body { margin: 0; } }' +
      '</style></head>' +
      '<body onload="window.print()">' +
      '<div class="label">' +
        '<div class="header">' +
          (logoLeft ? '<img class="header-logo" src="' + logoLeft + '">' : '') +
          '<div class="header-text">' +
            '<div class="header-title">KEMENTERIAN KELAUTAN DAN<br>PERIKANAN</div>' +
          '</div>' +
          (logoRight ? '<img class="header-logo" src="' + logoRight + '">' : '') +
        '</div>' +
        '<div class="info">' +
          '<div class="info-row1">' +
            '<span>' + esc(parsed.kodeBarang) + '</span>' +
            (parsed.nup ? '<span>NUP: ' + esc(parsed.nup) + '</span>' : '') +
          '</div>' +
          '<div class="info-name">' + esc(asset.name || '') + categoryText + '</div>' +
        '</div>' +
        '<div class="bottom">' +
          '<div class="bottom-left">' +
            '<div class="bottom-code">' + esc(code) + '</div>' +
          '</div>' +
          '<img class="qr-img" src="' + dataUrl + '">' +
        '</div>' +
      '</div>' +
      '</body></html>';
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
      var w = window.open('', '_blank', 'width=500,height=400');
      if (!w) return;
      w.document.write(buildLabelHtml(asset, dataUrl));
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
