/* ============================================================
   SESDIAN — shared client runtime (static, no framework)
   Provides: auth/session, login/register/logout, password toggle,
   live search, tab/status filtering (pixel-faithful active state),
   card navigation, "ajukan pinjam" submit, toasts.

   Wiring is driven by data-* hooks injected into each page, with
   heuristic fallbacks for the critical auth/nav flows so the core
   always works:
     body[data-page], body[data-auth="required"]
     [data-action="login|register|logout|toggle-password|submit-pinjam"]
     [data-field="nip|password|name|email|phone|confirm|date|notes"]
     [data-nav="<file.html>"]              click -> navigate
     [data-open-detail="<file.html>"]      click -> navigate (asset card)
     [data-search="<group>"]               text filter input
     [data-search-item="<group>"]          a filterable item (card/row)
     [data-list="<group>"]                 the items' container (empty-state host)
     [data-filter="type|status"][data-filter-val][data-filter-active]
     [data-user-name] [data-user-initials] sidebar identity (optional)
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'sesdian_user';
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var byText = function (re, sel) {
    return $$(sel || 'button,a').filter(function (el) { return re.test((el.textContent || '').trim()); });
  };

  /* ---------------- session ---------------- */
  function getUser() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function setUser(u) { localStorage.setItem(KEY, JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem(KEY); }
  function initials(name) {
    return (name || '').trim().split(/\s+/).map(function (w) { return w[0] || ''; })
      .join('').slice(0, 2).toUpperCase() || 'U';
  }

  /* ---------------- toast ---------------- */
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'sesd-toast-wrap'; document.body.appendChild(wrap); }
    var t = document.createElement('div');
    t.className = 'sesd-toast ' + (type || 'info');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
      setTimeout(function () { t.remove(); }, 320);
    }, 2600);
  }

  /* ---------------- auth guard ---------------- */
  function guard() {
    var page = document.body.getAttribute('data-page');
    var needsAuth = document.body.hasAttribute('data-auth');
    var user = getUser();
    if (needsAuth && !user) { location.replace('login.html'); return false; }
    if ((page === 'login' || page === 'register') && user) { location.replace('dashboard.html'); return false; }
    return true;
  }

  /* ---------------- identity injection ---------------- */
  function fillIdentity() {
    var user = getUser();
    if (!user) return;
    $$('[data-user-name]').forEach(function (el) { el.textContent = user.name; });
    $$('[data-user-initials]').forEach(function (el) { el.textContent = user.initials || initials(user.name); });
  }

  /* ---------------- field helpers ---------------- */
  function field(name, scope) {
    return $('[data-field="' + name + '"]', scope);
  }
  function val(name, scope) {
    var el = field(name, scope);
    return el ? (el.value || '').trim() : '';
  }

  /* ---------------- login ---------------- */
  function doLogin() {
    var nip = val('nip') || (function () { var i = $('input[placeholder*="NIP" i]'); return i ? i.value.trim() : ''; })();
    var pwd = val('password') || (function () { var i = $('input[type="password"]'); return i ? i.value : ''; })();
    if (!nip) { toast('Masukkan NIP Anda', 'error'); return; }
    if (!pwd) { toast('Masukkan password Anda', 'error'); return; }
    var name = nip === '123456789012345678' ? 'Adi Septriansyah' : 'Pengguna SESDIAN';
    setUser({ nip: nip, name: name, initials: initials(name) });
    toast('Berhasil masuk', 'success');
    setTimeout(function () { location.href = 'dashboard.html'; }, 400);
  }

  /* ---------------- register ---------------- */
  function doRegister() {
    var name = val('name'), nip = val('nip'), pwd = val('password'), confirm = val('confirm');
    if (!name) { toast('Lengkapi nama lengkap', 'error'); return; }
    if (!nip) { toast('Lengkapi NIP', 'error'); return; }
    if (pwd && pwd.length < 8) { toast('Password minimal 8 karakter', 'error'); return; }
    if (confirm && pwd !== confirm) { toast('Konfirmasi password tidak cocok', 'error'); return; }
    setUser({ nip: nip, name: name, initials: initials(name) });
    toast('Akun berhasil dibuat', 'success');
    setTimeout(function () { location.href = 'dashboard.html'; }, 500);
  }

  /* ---------------- password visibility ---------------- */
  function togglePassword(btn) {
    // toggle the nearest password input within the same field wrapper, else any
    var wrap = btn.closest('div');
    var input = wrap ? wrap.querySelector('input') : null;
    if (!input || (input.type !== 'password' && input.type !== 'text')) {
      input = $('input[type="password"]') || $('[data-field="password"]');
    }
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  }

  /* ---------------- search + filter ---------------- */
  var filterState = {}; // dimension -> value

  function itemMatches(item, q) {
    if (q && (item.textContent || '').toLowerCase().indexOf(q) === -1) return false;
    for (var dim in filterState) {
      var want = filterState[dim];
      if (!want || want === 'all') continue;
      var have = item.getAttribute('data-' + dim);
      if (have !== want) return false;
    }
    return true;
  }

  function applyFilters(group) {
    var items = $$('[data-search-item="' + group + '"]');
    var input = $('[data-search="' + group + '"]');
    var q = input ? input.value.trim().toLowerCase() : '';
    var visible = 0;
    items.forEach(function (item) {
      var ok = itemMatches(item, q);
      item.classList.toggle('sesd-hide', !ok);
      if (ok) visible++;
    });
    var list = $('[data-list="' + group + '"]');
    if (list) {
      var empty = list.querySelector('.sesd-empty');
      if (visible === 0) {
        if (!empty) {
          var isTable = list.tagName === 'TBODY' || list.tagName === 'TABLE';
          if (isTable) {
            empty = document.createElement('tr');
            empty.className = 'sesd-empty';
            var td = document.createElement('td');
            td.colSpan = 99;
            td.style.textAlign = 'center';
            td.style.padding = '2rem 1rem';
            td.style.color = 'var(--text-muted)';
            td.textContent = 'Tidak ada data yang cocok dengan pencarian/filter.';
            empty.appendChild(td);
          } else {
            empty = document.createElement('div');
            empty.className = 'sesd-empty';
            empty.textContent = 'Tidak ada data yang cocok dengan pencarian/filter.';
          }
          list.appendChild(empty);
        }
      } else if (empty) { empty.remove(); }
    }
  }

  function wireSearch() {
    $$('[data-search]').forEach(function (input) {
      var group = input.getAttribute('data-search');
      input.addEventListener('input', function () { applyFilters(group); });
    });
  }

  function wireFilters() {
    // group filter buttons by their dimension within the page
    var groups = {};
    $$('[data-filter]').forEach(function (btn) {
      var dim = btn.getAttribute('data-filter');
      (groups[dim] = groups[dim] || []).push(btn);
    });
    Object.keys(groups).forEach(function (dim) {
      var btns = groups[dim];
      var activeEl = btns.filter(function (b) { return b.hasAttribute('data-filter-active'); })[0] || btns[0];
      var inactiveEl = btns.filter(function (b) { return b !== activeEl; })[0];
      var activeStyle = activeEl ? activeEl.style.cssText : '';
      var inactiveStyle = inactiveEl ? inactiveEl.style.cssText : '';
      filterState[dim] = activeEl ? (activeEl.getAttribute('data-filter-val') || 'all') : 'all';
      // figure out which search group this filter belongs to (single group per page typical)
      var group = (function () {
        var anyItem = $('[data-search-item]');
        return anyItem ? anyItem.getAttribute('data-search-item') : null;
      })();
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          filterState[dim] = btn.getAttribute('data-filter-val') || 'all';
          btns.forEach(function (b) { if (inactiveStyle) b.style.cssText = inactiveStyle; });
          if (activeStyle) btn.style.cssText = activeStyle;
          if (group) applyFilters(group);
        });
      });
    });
  }

  /* ---------------- navigation hooks ---------------- */
  function wireNav() {
    $$('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); location.href = el.getAttribute('data-nav'); });
    });
    $$('[data-open-detail]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        // don't hijack clicks on inner links/buttons that have their own behavior
        if (e.target.closest('a[href],button[data-action],button[data-nav]') && e.target.closest('a[href],button[data-action],button[data-nav]') !== el) return;
        location.href = el.getAttribute('data-open-detail');
      });
    });
  }

  /* ---------------- ajukan pinjam submit ---------------- */
  function submitPinjam() {
    var checked = $$('input[type="checkbox"]').filter(function (c) { return c.checked; });
    var hasCheckboxes = $$('input[type="checkbox"]').length > 0;
    if (hasCheckboxes && checked.length === 0) { toast('Pilih minimal satu aset', 'error'); return; }
    var date = val('date') || (function () { var d = $('input[type="date"]'); return d ? d.value : ''; })();
    if (($('input[type="date"]')) && !date) { toast('Pilih tanggal kembali', 'error'); return; }
    toast('Pengajuan peminjaman berhasil dikirim', 'success');
    setTimeout(function () { location.href = 'daftarpinjam.html'; }, 900);
  }

  /* ---------------- action dispatch ---------------- */
  function wireActions() {
    $$('[data-action]').forEach(function (el) {
      var act = el.getAttribute('data-action');
      el.addEventListener('click', function (e) {
        if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
        switch (act) {
          case 'login': doLogin(); break;
          case 'register': doRegister(); break;
          case 'logout': clearUser(); location.href = 'login.html'; break;
          case 'toggle-password': togglePassword(el); break;
          case 'submit-pinjam': submitPinjam(); break;
        }
      });
    });

    // Enter-to-submit on auth forms
    var page = document.body.getAttribute('data-page');
    if (page === 'login' || page === 'register') {
      $$('input').forEach(function (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); page === 'login' ? doLogin() : doRegister(); }
        });
      });
    }
  }

  /* ---------------- heuristic fallbacks ----------------
     Guarantee the critical flows even if a page is missing hooks. */
  function fallbacks() {
    var page = document.body.getAttribute('data-page');
    // logout
    if (!$('[data-action="logout"]')) {
      byText(/^(Keluar|Logout|Log out)$/i).forEach(function (b) {
        b.addEventListener('click', function (e) { e.preventDefault(); clearUser(); location.href = 'login.html'; });
      });
    }
    if (page === 'login' && !$('[data-action="login"]')) {
      byText(/^Masuk/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); doLogin(); }); });
      byText(/👁/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); togglePassword(b); }); });
    }
    if (page === 'register' && !$('[data-action="register"]')) {
      byText(/^Daftar/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); doRegister(); }); });
    }
    if (page === 'ajukanpinjam' && !$('[data-action="submit-pinjam"]')) {
      byText(/Ajukan/).forEach(function (b) {
        if (b.tagName === 'BUTTON') b.addEventListener('click', function (e) { e.preventDefault(); submitPinjam(); });
      });
    }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (!guard()) return;
    fillIdentity();
    wireActions();
    wireNav();
    wireSearch();
    wireFilters();
    fallbacks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
