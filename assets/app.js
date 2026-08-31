/* ============================================================
   SESDIAN — shared client runtime (static frontend + Neon backend)

   Dual mode:
   • REAL  — talks to the serverless /api endpoints (Neon Postgres):
             real JWT auth, all lists/stats render from the database,
             "ajukan pinjam" inserts a real borrowing (atomic stock reserve).
   • DEMO  — config.BACKEND==='demo' or opened from file://: keeps the
             built-in seed markup + a localStorage stub so the UI still works.
   ============================================================ */
(function () {
  'use strict';

  var DB = window.SESDIAN_DB || { configured: false };
  var REAL = !!DB.configured && /^https?:$/.test(location.protocol);
  var KEY = 'sesdian_user';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var byText = function (re, sel) { return $$(sel || 'button,a').filter(function (el) { return re.test((el.textContent || '').trim()); }); };
  var initials = function (n) { return (n || '').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || 'U'; };
  var page = function () { return document.body.getAttribute('data-page'); };
  var go = function (href) { return function () { location.href = href; }; };

  var STATUS = {
    pending: { label: 'Pending', bg: '#fef3c7', fg: '#92400e' },
    approved: { label: 'Disetujui', bg: '#dbeafe', fg: '#1e40af' },
    borrowed: { label: 'Dipinjam', bg: '#ede9fe', fg: '#5b21b6' },
    returned: { label: 'Kembali', bg: '#dcfce7', fg: '#166534' },
  };

  /* ---------------- toast ---------------- */
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'sesd-toast-wrap'; document.body.appendChild(wrap); }
    var t = document.createElement('div');
    t.className = 'sesd-toast ' + (type || 'info');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s,transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(function () { t.remove(); }, 320); }, 2800);
  }

  /* ---------------- session ---------------- */
  function demoUser() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function currentUser() {
    if (REAL) { var u = DB.auth.currentUser(); return u ? { nip: u.nip, name: u.name, role: u.role, initials: initials(u.name) } : null; }
    return demoUser();
  }

  /* ---------------- field helpers ---------------- */
  function field(n) { return $('[data-field="' + n + '"]'); }
  function val(n) { var el = field(n); return el ? (el.value || '').trim() : ''; }

  /* ---------------- auth actions ---------------- */
  async function doLogin() {
    var nip = (val('nip') || ($('input[placeholder*="NIP" i]') || {}).value || '').trim();
    var pwd = val('password') || ($('input[type="password"]') || {}).value || '';
    if (!nip) { toast('Masukkan NIP Anda', 'error'); return; }
    if (!pwd) { toast('Masukkan password Anda', 'error'); return; }
    if (REAL) {
      try { await DB.auth.signIn({ nip: nip, password: pwd }); toast('Berhasil masuk', 'success'); setTimeout(go('dashboard.html'), 350); }
      catch (e) { toast((e && e.message) || 'Gagal masuk', 'error'); }
      return;
    }
    var name = nip === '123456789012345678' ? 'Adi Septriansyah' : 'Pengguna SESDIAN';
    localStorage.setItem(KEY, JSON.stringify({ nip: nip, name: name, initials: initials(name) }));
    toast('Berhasil masuk', 'success'); setTimeout(go('dashboard.html'), 350);
  }

  async function doRegister() {
    var name = val('name'), nip = val('nip'), pwd = val('password'), confirm = val('confirm');
    if (!name) { toast('Lengkapi nama lengkap', 'error'); return; }
    if (!nip) { toast('Lengkapi NIP', 'error'); return; }
    if (!pwd || pwd.length < 8) { toast('Password minimal 8 karakter', 'error'); return; }
    if (confirm && pwd !== confirm) { toast('Konfirmasi password tidak cocok', 'error'); return; }
    if (REAL) {
      try { await DB.auth.signUp({ nip: nip, name: name, password: pwd }); toast('Akun berhasil dibuat', 'success'); setTimeout(go('dashboard.html'), 500); }
      catch (e) { toast((e && e.message) || 'Gagal mendaftar', 'error'); }
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ nip: nip, name: name, initials: initials(name) }));
    toast('Akun berhasil dibuat', 'success'); setTimeout(go('dashboard.html'), 500);
  }

  async function doLogout() {
    if (REAL) { try { await DB.auth.signOut(); } catch (e) {} } else { try { localStorage.removeItem(KEY); } catch (e) {} }
    location.href = 'login.html';
  }

  /* ---------------- auth guard ---------------- */
  function guard() {
    var needsAuth = document.body.hasAttribute('data-auth');
    var user = currentUser();
    if (needsAuth && !user) { location.replace('login.html'); return { redirect: true }; }
    if ((page() === 'login' || page() === 'register') && user) { location.replace('dashboard.html'); return { redirect: true }; }
    return { redirect: false, user: user };
  }

  /* ---------------- identity ---------------- */
  function fillIdentity(user) {
    if (!user) return;
    $$('[data-user-name]').forEach(function (el) { el.textContent = user.name; });
    $$('[data-user-initials]').forEach(function (el) { el.textContent = user.initials || initials(user.name); });
    $$('[data-user-firstname]').forEach(function (el) { el.textContent = (user.name || '').split(/\s+/)[0]; });
  }

  /* ---------------- rendering ---------------- */
  function setStatusBadge(el, status) {
    var s = STATUS[status] || { label: status || '', bg: '', fg: '' };
    var dot = el.firstElementChild;
    el.textContent = s.label;
    if (dot) { if (s.fg) dot.style.background = s.fg; el.insertBefore(dot, el.firstChild); }
    if (s.fg) el.style.color = s.fg;
    var pill = (el.matches && el.matches('[style*="border-radius"]')) ? el : (el.closest ? el.closest('[style*="border-radius"]') : null);
    if (pill && s.bg) { pill.style.background = s.bg; if (s.fg) pill.style.color = s.fg; }
  }

  function applyBinds(node, rec) {
    var els = $$('[data-bind]', node);
    if (node.matches && node.matches('[data-bind]')) els.unshift(node);
    els.forEach(function (el) {
      var f = el.getAttribute('data-bind');
      if (f === 'stock_bar') { var pct = rec.stock_total ? Math.round((rec.stock_available / rec.stock_total) * 100) : (rec.total ? Math.round(rec.available / rec.total * 100) : 0); el.style.width = pct + '%'; return; }
      if (f === 'status_badge') { setStatusBadge(el, rec.status); return; }
      var v = rec[f];
      if (v !== undefined && v !== null) el.textContent = v;
    });
  }

  function appendEmpty(container, msg) {
    var isTable = container.tagName === 'TBODY' || container.tagName === 'TABLE';
    var e;
    if (isTable) { e = document.createElement('tr'); e.className = 'sesd-empty'; var td = document.createElement('td'); td.colSpan = 99; td.style.cssText = 'text-align:center;padding:2rem;color:var(--text-muted)'; td.textContent = msg || 'Belum ada data.'; e.appendChild(td); }
    else { e = document.createElement('div'); e.className = 'sesd-empty'; e.textContent = msg || 'Belum ada data.'; }
    container.appendChild(e);
  }

  // clone the template element for each record; container = template's parent
  function renderList(tplSel, records, fill) {
    var tpl = $(tplSel);
    if (!tpl) return;
    var container = tpl.parentNode;
    var src = tpl.cloneNode(true);
    ['data-template', 'data-monitor-template', 'data-recent-template'].forEach(function (a) { src.removeAttribute(a); });
    container.innerHTML = '';
    if (!records.length) { appendEmpty(container); return; }
    records.forEach(function (rec) { var n = src.cloneNode(true); applyBinds(n, rec); if (fill) fill(n, rec); container.appendChild(n); });
  }

  /* ---------------- per-page data load (REAL only) ---------------- */
  async function loadAndRender(p) {
    try {
      if (p === 'dashboard') {
        var d = await DB.dashboard();
        Object.keys(d.stats).forEach(function (k) { var el = $('[data-stat="' + k + '"]'); if (el) el.textContent = d.stats[k]; });
        renderList('[data-monitor-template]', d.monitor);
        renderList('[data-recent-template]', d.recent);
      } else if (p === 'dataaset') {
        renderList('[data-template]', await DB.assets(), function (n, r) {
          n.setAttribute('data-type', (r.type || '').toLowerCase() === 'non-bmn' ? 'non-bmn' : 'bmn');
          n.setAttribute('data-status', r.stock_available > 0 ? 'available' : 'borrowed');
          n.setAttribute('data-asset-id', r.id);
        });
      } else if (p === 'kategoriaset') {
        renderList('[data-template]', await DB.categories());
      } else if (p === 'ruangan') {
        renderList('[data-template]', await DB.rooms());
      } else if (p === 'daftarpinjam') {
        var bs = await DB.borrowings();
        renderList('[data-template]', bs, function (n, r) { n.setAttribute('data-status', r.status); });
        var counts = { pending: 0, approved: 0, borrowed: 0, returned: 0 };
        bs.forEach(function (b) { if (counts[b.status] != null) counts[b.status]++; });
        Object.keys(counts).forEach(function (k) { var el = $('[data-count="' + k + '"]'); if (el) el.textContent = counts[k]; });
      } else if (p === 'ajukanpinjam') {
        renderList('[data-template]', await DB.assets(), function (n, r) {
          var cb = $('[data-asset-checkbox]', n) || $('input[type="checkbox"]', n);
          if (cb) cb.value = String(r.id);
        });
      }
    } catch (e) {
      if (e && e.status === 401) { location.replace('login.html'); return; }
      toast('Gagal memuat data: ' + ((e && e.message) || e), 'error');
    }
  }

  /* ---------------- password toggle ---------------- */
  function togglePassword(btn) {
    var wrap = btn.closest('div'); var input = wrap ? wrap.querySelector('input') : null;
    if (!input || (input.type !== 'password' && input.type !== 'text')) input = $('input[type="password"]') || field('password');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  }

  /* ---------------- search + filter ---------------- */
  var filterState = {};
  function itemMatches(item, q) {
    if (q && (item.textContent || '').toLowerCase().indexOf(q) === -1) return false;
    for (var dim in filterState) { var w = filterState[dim]; if (!w || w === 'all') continue; if (item.getAttribute('data-' + dim) !== w) return false; }
    return true;
  }
  function applyFilters(group) {
    var items = $$('[data-search-item="' + group + '"]');
    var input = $('[data-search="' + group + '"]');
    var q = input ? input.value.trim().toLowerCase() : '';
    var visible = 0;
    items.forEach(function (it) { var ok = itemMatches(it, q); it.classList.toggle('sesd-hide', !ok); if (ok) visible++; });
    var list = $('[data-list="' + group + '"]');
    if (list) {
      var empty = list.querySelector('.sesd-empty');
      if (visible === 0 && items.length) {
        if (!empty) { appendEmpty(list, 'Tidak ada data yang cocok.'); }
      } else if (empty) { empty.remove(); }
    }
  }
  function wireSearch() { $$('[data-search]').forEach(function (input) { var g = input.getAttribute('data-search'); input.addEventListener('input', function () { applyFilters(g); }); }); }
  function wireFilters() {
    var groups = {};
    $$('[data-filter]').forEach(function (b) { var d = b.getAttribute('data-filter'); (groups[d] = groups[d] || []).push(b); });
    var anyItem = $('[data-search-item]');
    var group = anyItem ? anyItem.getAttribute('data-search-item') : null;
    Object.keys(groups).forEach(function (dim) {
      var btns = groups[dim];
      var active = btns.filter(function (b) { return b.hasAttribute('data-filter-active'); })[0] || btns[0];
      var inactive = btns.filter(function (b) { return b !== active; })[0];
      var activeStyle = active ? active.style.cssText : '', inactiveStyle = inactive ? inactive.style.cssText : '';
      filterState[dim] = active ? (active.getAttribute('data-filter-val') || 'all') : 'all';
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          filterState[dim] = b.getAttribute('data-filter-val') || 'all';
          btns.forEach(function (x) { if (inactiveStyle) x.style.cssText = inactiveStyle; });
          if (activeStyle) b.style.cssText = activeStyle;
          if (group) applyFilters(group);
        });
      });
    });
  }

  /* ---------------- navigation ---------------- */
  function wireNav() {
    $$('[data-nav]').forEach(function (el) { el.addEventListener('click', function (e) { e.preventDefault(); location.href = el.getAttribute('data-nav'); }); });
    $$('[data-open-detail]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var inner = e.target.closest('a[href],button[data-action],button[data-nav]');
        if (inner && inner !== el) return;
        location.href = el.getAttribute('data-open-detail');
      });
    });
  }

  /* ---------------- ajukan pinjam submit ---------------- */
  async function submitPinjam() {
    var boxes = $$('input[type="checkbox"]');
    var checked = boxes.filter(function (c) { return c.checked; });
    if (boxes.length && !checked.length) { toast('Pilih minimal satu aset', 'error'); return; }
    var date = val('date') || ($('input[type="date"]') || {}).value || '';
    if ($('input[type="date"]') && !date) { toast('Pilih tanggal kembali', 'error'); return; }
    var notes = val('notes');
    if (REAL) {
      try {
        for (var i = 0; i < checked.length; i++) {
          var id = parseInt(checked[i].value, 10);
          if (id) await DB.requestBorrowing({ assetId: id, qty: 1, dueDate: date || null, notes: notes });
        }
        toast('Pengajuan peminjaman berhasil dikirim', 'success');
        setTimeout(go('daftarpinjam.html'), 900);
      } catch (e) {
        if (e && e.status === 401) { location.replace('login.html'); return; }
        toast((e && e.message) || 'Gagal mengirim pengajuan', 'error');
      }
      return;
    }
    toast('Pengajuan peminjaman berhasil dikirim', 'success');
    setTimeout(go('daftarpinjam.html'), 900);
  }

  /* ---------------- actions ---------------- */
  function wireActions() {
    $$('[data-action]').forEach(function (el) {
      var act = el.getAttribute('data-action');
      el.addEventListener('click', function (e) {
        if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
        if (act === 'login') doLogin();
        else if (act === 'register') doRegister();
        else if (act === 'logout') doLogout();
        else if (act === 'toggle-password') togglePassword(el);
        else if (act === 'submit-pinjam') submitPinjam();
      });
    });
    if (page() === 'login' || page() === 'register') {
      $$('input').forEach(function (input) { input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); page() === 'login' ? doLogin() : doRegister(); } }); });
    }
  }

  /* ---------------- fallbacks ---------------- */
  function fallbacks() {
    if (!$('[data-action="logout"]')) byText(/^(Keluar|Logout|Log out)$/i).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); doLogout(); }); });
    if (page() === 'login' && !$('[data-action="login"]')) { byText(/^Masuk/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); doLogin(); }); }); byText(/👁/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); togglePassword(b); }); }); }
    if (page() === 'register' && !$('[data-action="register"]')) byText(/^Daftar/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); doRegister(); }); });
    if (page() === 'ajukanpinjam' && !$('[data-action="submit-pinjam"]')) byText(/Ajukan/).forEach(function (b) { if (b.tagName === 'BUTTON') b.addEventListener('click', function (e) { e.preventDefault(); submitPinjam(); }); });
  }

  /* ---------------- demo notice ---------------- */
  function setupNotice() {
    if (REAL) return;
    if (!(page() === 'login' || page() === 'register')) return;
    setTimeout(function () { toast('Mode demo — backend Neon aktif setelah deploy ke Vercel + set DATABASE_URL', 'info'); }, 700);
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    var g = guard();
    if (g.redirect) return;
    if (REAL) await loadAndRender(page());
    fillIdentity(g.user);
    wireActions(); wireNav(); wireSearch(); wireFilters(); fallbacks(); setupNotice();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
