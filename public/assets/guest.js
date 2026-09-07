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

  /* header auth button (Masuk / Buka Dashboard) */
  function wireGuestAuth() {
    var slot = $('[data-guest-auth]'); if (!slot) return;
    var u = loggedIn();
    slot.innerHTML = '';
    var style = 'padding:0.55rem 1.1rem;border-radius:10px;font-weight:700;font-size:0.85rem;text-decoration:none;color:#fff;background:linear-gradient(135deg,rgb(99,102,241),rgb(139,92,246));box-shadow:rgba(99,102,241,0.35) 0px 4px 14px';
    slot.appendChild(el('a', { href: u ? 'dashboard.html' : 'login.html', style: style }, u ? 'Buka Dashboard' : 'Masuk'));
  }

  /* ---------------- catalog ---------------- */
  function assetCard(a) {
    var card = el('div', { style: 'background:#fff;border-radius:16px;overflow:hidden;box-shadow:rgba(0,0,0,0.08) 0px 8px 24px;border:1px solid var(--border);cursor:pointer;transition:transform .2s,box-shadow .2s' });
    card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-4px)'; });
    card.addEventListener('mouseleave', function () { card.style.transform = 'none'; });
    card.addEventListener('click', function () { location.href = 'aset-detail.html?id=' + a.id; });
    card.appendChild(el('div', { style: 'height:130px;overflow:hidden', html: '<img src="' + (a.image || PLACEHOLDER) + '" alt="" style="width:100%;height:100%;object-fit:cover;background:linear-gradient(135deg,#eef2ff,#e0e7ff)">' }));
    var body = el('div', { style: 'padding:1rem' });
    body.appendChild(el('span', { style: 'font-size:0.65rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:20px;background:rgb(219,234,254);color:rgb(30,64,175)' }, a.type || 'BMN'));
    body.appendChild(el('div', { style: 'font-family:"JetBrains Mono",monospace;font-size:0.68rem;color:var(--text-muted);margin:8px 0 2px' }, a.code || ''));
    body.appendChild(el('div', { style: 'font-weight:700;font-size:0.95rem;margin-bottom:8px' }, a.name || ''));
    var chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' });
    [['tag', a.category], ['pin', a.room]].forEach(function (c) {
      if (!c[1]) return;
      chips.appendChild(el('span', { style: 'background:rgb(241,245,249);padding:0.1rem 0.5rem;border-radius:6px;font-size:0.72rem;color:var(--text-muted)', html: ic(c[0]) + ' ' + c[1] }));
    });
    body.appendChild(chips);
    card.appendChild(body);
    return card;
  }

  async function renderKatalog() {
    var grid = $('[data-catalog-grid]'); if (!grid) return;
    var data;
    try { data = await DB.catalog(); } catch (e) { grid.innerHTML = '<div class="sesd-empty">Gagal memuat katalog.</div>'; return; }
    var assets = data.assets || [], cats = data.categories || [];
    var sub = $('[data-catalog-sub]'); if (sub) sub.textContent = assets.length + ' aset tersedia untuk dilihat';
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
    function chipStyle(active) { return 'padding:0.5rem 1rem;border-radius:999px;border:1px solid ' + (active ? 'var(--primary)' : 'var(--border)') + ';background:' + (active ? 'var(--primary-light)' : '#fff') + ';color:' + (active ? 'var(--primary)' : 'var(--text-muted)') + ';cursor:pointer;font-size:0.8rem;font-weight:700;white-space:nowrap'; }

    var search = $('[data-search]');
    if (search) search.addEventListener('input', function () { state.q = search.value.trim().toLowerCase(); draw(); });

    function draw() {
      var list = assets.filter(function (a) {
        if (state.cat !== 'all' && a.category !== state.cat) return false;
        if (state.q && (a.name + ' ' + a.code + ' ' + (a.brand || '')).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
      grid.innerHTML = '';
      if (!list.length) { grid.appendChild(el('div', { class: 'sesd-empty' }, 'Tidak ada aset yang cocok.')); return; }
      list.forEach(function (a) { grid.appendChild(assetCard(a)); });
    }
    draw();
  }

  /* ---------------- detail (by id or qr) ---------------- */
  async function renderDetail() {
    var root = $('[data-detail-root]'); if (!root) return;
    var id = qs('id'), qr = qs('qr');
    if (!id && !qr) { root.innerHTML = '<div class="sesd-empty">Aset tidak ditemukan.</div>'; return; }
    var res;
    try { res = await DB.assetDetail(id ? { id: id } : { qr: qr }); }
    catch (e) { root.innerHTML = '<div class="sesd-empty">Aset tidak ditemukan.</div>'; return; }
    var a = res.asset, authed = res.authed;
    root.innerHTML = '';
    root.appendChild(el('img', { src: a.image || PLACEHOLDER, style: 'width:100%;height:240px;object-fit:cover;border-radius:16px;background:linear-gradient(135deg,#eef2ff,#e0e7ff)' }));
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
      [['Total', a.stock_total, 'var(--text)'], ['Tersedia', a.stock_available, 'rgb(16,185,129)'], ['Dipinjam', a.stock_borrowed, 'rgb(245,158,11)']].forEach(function (s) {
        var b = el('div', { style: 'flex:1;text-align:center;background:var(--bg);border-radius:10px;padding:0.6rem' });
        b.appendChild(el('div', { style: 'font-size:1.2rem;font-weight:800;color:' + s[2] }, String(s[1] != null ? s[1] : 0)));
        b.appendChild(el('div', { style: 'font-size:0.7rem;color:var(--text-muted)' }, s[0]));
        stock.appendChild(b);
      });
      root.appendChild(stock);
    } else {
      root.appendChild(el('div', { style: 'background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:0.75rem;font-size:0.82rem;margin-bottom:1rem' }, 'Masuk untuk melihat ketersediaan stok dan mengajukan peminjaman.'));
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
