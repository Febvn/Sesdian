/* ============================================================
   SESDIAN - guest runtime (public catalog + asset detail)
   No auth required. Borrowing actions redirect to login.
   Pages: data-page="katalog" and data-page="aset-detail".
   ============================================================ */
(function () {
  'use strict';
  var DB = window.SESDIAN_DB || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  var ic = function (n) { return window.sesdIcon ? window.sesdIcon(n) : ''; };
  var page = function () { return document.body.getAttribute('data-page'); };
  var PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='130'%3E%3Crect width='200' height='130' fill='%23e0e7ff'/%3E%3Cg fill='none' stroke='%236366f1' stroke-width='4'%3E%3Cpath d='M100 42 72 56v34l28 14 28-14V56z'/%3E%3Cpath d='M72 56l28 14 28-14M100 70v34'/%3E%3C/g%3E%3C/svg%3E";

  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap');
    if (!wrap) { wrap = el('div', { class: 'sesd-toast-wrap' }); document.body.appendChild(wrap); }
    var t = el('div', { class: 'sesd-toast ' + (type || 'info') }, msg);
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }
  function loggedIn() { try { return DB.auth && DB.auth.currentUser(); } catch (e) { return null; } }
  function qs(name) { var m = new RegExp('[?&]' + name + '=([^&]+)').exec(location.search); return m ? decodeURIComponent(m[1]) : ''; }
  // same single three-dots loader used on the authed pages (see app.css)
  function showDots(container) { container.innerHTML = '<div class="sesd-page-loader"><span></span><span></span><span></span></div>'; }

  // group identical items (same name+category) into one tidy card; each unit
  // still exists individually in the DB (and keeps its own QR/detail page).
  function groupCatalog(list) {
    var map = {}, order = [];
    list.forEach(function (a) {
      // same grouping as the authed app: (nama, merk) = one jenis, one image
      var key = (a.name || '').trim().toLowerCase() + '|' + (a.brand || '').trim().toLowerCase();
      var g = map[key];
      if (!g) { g = map[key] = { name: a.name, category: a.category, room: a.room, brand: a.brand, type: a.type, image: a.image, count: 0, repId: a.id, qr_code: a.qr_code }; order.push(key); }
      g.count++;
      if (!g.image && a.image) g.image = a.image;
      if (g.room && a.room && g.room !== a.room) g.room = 'Beberapa ruangan';
    });
    return order.map(function (k) { return map[k]; }).sort(function (x, y) { return (x.name || '').localeCompare(y.name || ''); });
  }

  /* header auth button (Masuk / Buka Dashboard) — Notion blue pill */
  function wireGuestAuth() {
    var slot = $('[data-guest-auth]'); if (!slot) return;
    var u = loggedIn();
    slot.innerHTML = '';
    slot.appendChild(el('a', { href: u ? 'dashboard.html' : 'login.html', class: 'sesd-btn sesd-btn-primary' }, u ? 'Buka Dashboard' : 'Masuk'));
  }

  /* ---------------- catalog ----------------
     Re-uses the same Notion card primitives (.sesd-aset-*) as the authed Data
     Aset grid, so the public catalog and the internal app speak one card system. */
  function assetCard(g) {
    var isNon = (g.type || '').toLowerCase() === 'non-bmn';
    var card = el('div', { class: 'sesd-aset-card' });
    card.addEventListener('click', function () { location.href = 'aset-detail.html?' + (g.qr_code ? ('qr=' + encodeURIComponent(g.qr_code)) : ('id=' + g.repId)); });
    var band = el('div', { class: 'sesd-aset-img' });
    var img = el('img', { src: g.image || PLACEHOLDER, alt: '', loading: 'lazy', decoding: 'async' });
    img.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    band.appendChild(img);
    card.appendChild(band);
    var body = el('div', { class: 'sesd-aset-body' });
    var top = el('div', { class: 'sesd-aset-top' });
    top.appendChild(el('span', { class: 'sesd-aset-type ' + (isNon ? 'is-non' : 'is-bmn') }, isNon ? 'Non-BMN' : 'BMN'));
    if (g.count > 1) top.appendChild(el('span', { class: 'sesd-cat-count' }, g.count + ' unit'));
    body.appendChild(top);
    body.appendChild(el('div', { class: 'sesd-aset-name' }, g.name || ''));
    // merk = badge tersendiri di bawah nama (bukan bagian teks nama)
    if (g.brand) body.appendChild(el('span', { class: 'sesd-aset-merk' }, g.brand));
    var chips = el('div', { class: 'sesd-aset-chips' });
    [['tag', g.category], ['pin', g.room]].forEach(function (c) {
      if (!c[1]) return;
      var chip = el('span', { class: 'sesd-aset-chip' });
      chip.innerHTML = ic(c[0]);
      chip.appendChild(el('span', {}, c[1]));
      chips.appendChild(chip);
    });
    if (chips.children.length) body.appendChild(chips);
    var more = el('div', { class: 'sesd-cat-more' }, 'Lihat detail');
    body.appendChild(more);
    card.appendChild(body);
    return card;
  }

  async function renderKatalog() {
    var grid = $('[data-catalog-grid]'); if (!grid) return;
    showDots(grid);
    var data;
    try { data = await DB.catalog(); } catch (e) { grid.innerHTML = '<div class="sesd-empty">Gagal memuat katalog.</div>'; return; }
    var assets = data.assets || [], cats = data.categories || [];
    // populate stat cards from the API stats object
    var stats = data.stats || {};
    ['total_assets', 'total_stock', 'stock_available', 'stock_borrowed', 'pending'].forEach(function (k, i) {
      var numEl = $('[data-cat-stat-num="' + k + '"]');
      if (numEl) {
        var loadingSpan = numEl.querySelector('.sesd-loading-inline');
        if (loadingSpan) loadingSpan.remove();
        numEl.textContent = (stats[k] != null) ? String(stats[k]) : '0';
        numEl.style.opacity = '0';
        numEl.style.transition = 'opacity 0.3s ease';
        setTimeout(function() { numEl.style.opacity = '1'; }, i * 100);
      }
    });
    // #10 — room catalog: ?room=<name> shows only that room's items (QR target).
    var roomFilter = qs('room');
    if (roomFilter) {
      assets = assets.filter(function (a) { return (a.room || '').toLowerCase() === roomFilter.toLowerCase(); });
      document.title = 'SESDIAN - Ruangan ' + roomFilter;
    }
    var groups = groupCatalog(assets);
    var state = { q: '', cat: 'all' };

    // category chips
    var chipWrap = $('[data-cat-filters]');
    if (chipWrap) {
      chipWrap.innerHTML = '';
      var mk = function (label, val) {
        var b = el('button', { 'data-cat': val, style: chipStyle(val === 'all'), class: 'gcat' }, label);
        b.addEventListener('click', function () { state.cat = val; $$('.gcat', chipWrap).forEach(function (x) { x.style.cssText = chipStyle(x.getAttribute('data-cat') === val); }); draw(); });
        return b;
      };
      chipWrap.appendChild(mk('Semua', 'all'));
      cats.forEach(function (c) { chipWrap.appendChild(mk(c.name, c.name)); });
    }
    function chipStyle(active) { return 'padding:0.45rem 0.95rem;border-radius:999px;border:1px solid ' + (active ? 'var(--primary)' : 'var(--border)') + ';background:' + (active ? 'var(--primary-light)' : 'var(--bg-card)') + ';color:' + (active ? 'var(--primary)' : 'var(--text-muted)') + ';cursor:pointer;font-size:0.8rem;font-weight:700;white-space:nowrap;transition:border-color .15s,background .15s,color .15s'; }

    var search = $('[data-search]');
    if (search) search.addEventListener('input', function () { state.q = search.value.trim().toLowerCase(); draw(); });

    function draw() {
      var list = groups.filter(function (g) {
        if (state.cat !== 'all' && g.category !== state.cat) return false;
        if (state.q && (g.name + ' ' + (g.brand || '')).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
      grid.innerHTML = '';
      if (!list.length) { grid.appendChild(el('div', { class: 'sesd-empty' }, 'Tidak ada aset yang cocok.')); return; }
      list.forEach(function (g) { grid.appendChild(assetCard(g)); });
    }
    draw();
  }

  /* ---------------- detail (by id or qr) ---------------- */
  async function renderDetail() {
    var root = $('[data-detail-root]'); if (!root) return;
    var id = qs('id'), qr = qs('qr');
    if (!id && !qr) { root.innerHTML = '<div class="sesd-empty">Aset tidak ditemukan.</div>'; return; }
    showDots(root);
    var res;
    try { res = await DB.assetDetail(id ? { id: id } : { qr: qr }); }
    catch (e) { root.innerHTML = '<div class="sesd-empty">Aset tidak ditemukan.</div>'; return; }
    var a = res.asset, authed = res.authed;
    root.innerHTML = '';
    var dImg = el('img', { src: a.image || PLACEHOLDER, style: 'width:100%;height:240px;object-fit:cover;border-radius:16px;background:linear-gradient(135deg,#eef2ff,#e0e7ff)' });
    dImg.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    root.appendChild(dImg);
    root.appendChild(el('div', { style: 'font-family:"JetBrains Mono",monospace;font-size:0.75rem;color:var(--text-muted);margin-top:1rem' }, a.code || ''));
    root.appendChild(el('h1', { style: 'font-size:1.6rem;font-weight:800;margin:2px 0' }, a.name || ''));
    root.appendChild(el('p', { style: 'color:var(--text-muted)' }, a.brand || ''));

    var grid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin:1rem 0' });
    [['Kategori', a.category], ['Ruangan', a.room], ['Tahun', a.year], ['Kondisi', a.condition], ['Jenis', a.type], ['Tipe', a.asset_type]].forEach(function (kv) {
      var box = el('div', { style: 'background:var(--bg);border-radius:10px;padding:0.6rem 0.75rem' });
      box.appendChild(el('div', { style: 'font-size:0.66rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:.5px' }, kv[0]));
      box.appendChild(el('div', { style: 'font-size:0.9rem;font-weight:600;margin-top:2px' }, (kv[1] != null && kv[1] !== '') ? String(kv[1]) : '-'));
      grid.appendChild(box);
    });
    root.appendChild(grid);

    if (authed && a.stock_total != null) {
      var stock = el('div', { style: 'display:flex;gap:0.6rem;margin-bottom:1rem' });
      [['Total', a.stock_total, 'var(--text)'], ['Tersedia', a.stock_available, 'var(--success)'], ['Dipinjam', a.stock_borrowed, 'var(--warning)']].forEach(function (s) {
        var b = el('div', { style: 'flex:1;text-align:center;background:var(--bg);border-radius:10px;padding:0.6rem' });
        b.appendChild(el('div', { style: 'font-size:1.2rem;font-weight:800;color:' + s[2] }, String(s[1] != null ? s[1] : 0)));
        b.appendChild(el('div', { style: 'font-size:0.7rem;color:var(--text-muted)' }, s[0]));
        stock.appendChild(b);
      });
      root.appendChild(stock);
    } else {
      root.appendChild(el('div', { style: 'background:rgba(221,91,0,0.10);border:1px solid rgba(221,91,0,0.28);color:var(--warning);border-radius:10px;padding:0.75rem;font-size:0.82rem;margin-bottom:1rem;font-weight:500' }, 'Masuk untuk melihat ketersediaan stok dan mengajukan peminjaman.'));
    }

    var btn = el('button', { class: 'sesd-btn sesd-btn-success', style: 'width:100%', html: ic('clipboard') + ' Ajukan Pinjam' });
    btn.addEventListener('click', function () {
      if (loggedIn()) location.href = 'ajukanpinjam.html';
      else { toast('Silakan masuk untuk meminjam', 'info'); setTimeout(function () { location.href = 'login.html'; }, 700); }
    });
    root.appendChild(btn);
  }

  function boot() {
    wireGuestAuth();
    var p = page();
    if (p === 'katalog') renderKatalog();
    else if (p === 'aset-detail') renderDetail();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
