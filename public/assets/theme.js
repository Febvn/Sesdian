/* ============================================================
   SESDIAN — Theme Manager (theme.js)
   Light / dark mode with localStorage persistence. Default: light.
   Applies [data-theme="dark"] on <html>.

   The toggle is the Uiverse animated sun/moon switch, docked in the
   page header's top-right cluster together with the date, a
   notification bell and a profile placeholder:

        [ ☀/☾ switch ]   [ date ]   [ bell ]   [ profile ]

   A separate "back to top" button lives in the bottom-right corner and
   appears once the page is scrolled down.

   NOTE: the first-paint theme is set by a tiny inline script in each
   page's <head> so navigating between pages never flashes light->dark.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'sesdian_theme';
  var DARK = 'dark';
  var LIGHT = 'light';

  function getPreferred() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === DARK || stored === LIGHT) return stored;
    } catch (e) {}
    return LIGHT; // default light, ignore system preference
  }

  function applyTheme(theme) {
    if (theme === DARK) document.documentElement.setAttribute('data-theme', DARK);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  }

  // Redundant with the inline <head> script, but harmless and keeps the
  // file self-sufficient if the inline guard is ever missing on a page.
  applyTheme(getPreferred());

  /* ── User text-size preference (small / medium / large) ── */
  var TEXTSIZE_KEY = 'sesdian_textsize';
  function getTextSize() {
    try { var t = localStorage.getItem(TEXTSIZE_KEY); if (t === 'small' || t === 'large' || t === 'medium') return t; } catch (e) {}
    return 'medium';
  }
  function applyTextSize(sz) {
    if (sz === 'small' || sz === 'large') document.documentElement.setAttribute('data-textsize', sz);
    else document.documentElement.removeAttribute('data-textsize');
    try { localStorage.setItem(TEXTSIZE_KEY, sz); } catch (e) {}
  }
  applyTextSize(getTextSize());   // apply as early as possible

  /* ── Current user + per-user avatar (stored client-side) ── */
  function currentUserLS() {
    // API mode stores a JWT (with nip/name/role), not a 'sesdian_user' object —
    // read identity from the token first so the header profile shows the NIP.
    try { var db = window.SESDIAN_DB; if (db && db.auth && db.auth.currentUser) { var u = db.auth.currentUser(); if (u && (u.nip || u.name)) return u; } } catch (e) {}
    try { return JSON.parse(localStorage.getItem('sesdian_user') || 'null'); } catch (e) { return null; }
  }
  function avatarKey(u) { return 'sesdian_avatar_' + ((u && (u.nip || u.name)) || 'anon'); }
  function getAvatar(u) { try { return localStorage.getItem(avatarKey(u)) || ''; } catch (e) { return ''; } }
  function setAvatar(u, d) { try { localStorage.setItem(avatarKey(u), d); } catch (e) {} }
  function initialsOf(name) { return (name || '').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || 'U'; }

  /* ── small inline icons, matched to the app's stroke icon language ── */
  var ICON_CAL  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/></svg>';
  var ICON_BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10.5 21a1.5 1.5 0 0 0 3 0"/></svg>';
  var ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  var ICON_UP   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
  // Uiverse star field (by Galahhad)
  var STARS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 55" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z" fill="currentColor"></path></svg>';

  /* ── Uiverse animated theme switch (by Galahhad), wired to applyTheme ── */
  function buildSwitch() {
    var label = document.createElement('label');
    label.className = 'theme-switch';
    label.id = 'sesd-theme-toggle';
    label.title = 'Mode Terang / Gelap';
    label.innerHTML =
      '<input type="checkbox" class="theme-switch__checkbox" aria-label="Toggle dark mode">' +
      '<div class="theme-switch__container">' +
        '<div class="theme-switch__clouds"></div>' +
        '<div class="theme-switch__stars-container">' + STARS + '</div>' +
        '<div class="theme-switch__circle-container">' +
          '<div class="theme-switch__sun-moon-container">' +
            '<div class="theme-switch__moon">' +
              '<div class="theme-switch__spot"></div>' +
              '<div class="theme-switch__spot"></div>' +
              '<div class="theme-switch__spot"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    var cb = label.querySelector('.theme-switch__checkbox');
    cb.checked = document.documentElement.hasAttribute('data-theme'); // checked = dark
    cb.addEventListener('change', function () {
      applyTheme(cb.checked ? DARK : LIGHT); // instant, no flash
    });
    return label;
  }

  function todayStr() {
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var d = new Date();
    return d.getDate() + ' ' + m[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ── Text-size segmented control (A small / medium / large) ── */
  function buildTextSize() {
    var wrap = document.createElement('div');
    wrap.className = 'sesd-textsize';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Ukuran teks');
    var sizes = [['small', '0.68rem', 'Teks kecil'], ['medium', '0.92rem', 'Teks sedang'], ['large', '1.18rem', 'Teks besar']];
    var cur = getTextSize();
    sizes.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.title = s[2]; b.setAttribute('data-ts', s[0]);
      b.setAttribute('aria-label', s[2]);
      b.innerHTML = '<span style="font-size:' + s[1] + '">A</span>';
      if (s[0] === cur) b.className = 'is-active';
      b.addEventListener('click', function () {
        applyTextSize(s[0]);
        Array.prototype.forEach.call(wrap.querySelectorAll('button'), function (x) {
          x.className = (x.getAttribute('data-ts') === s[0]) ? 'is-active' : '';
        });
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  /* ── Apply the saved avatar to the header button + sidebar tile ── */
  function applyAvatarEverywhere(u) {
    var av = getAvatar(u);
    var prof = document.querySelector('.sesd-head-profile');
    if (prof) prof.innerHTML = av ? '<img alt="Foto profil" src="' + av + '">' : '<span class="ic">' + ICON_USER + '</span>';
    var sb = document.querySelector('aside [data-user-initials]');
    if (sb && av) sb.innerHTML = '<img alt="" src="' + av + '">';
  }
  // let other scripts (the profile page) refresh the avatar after a photo change
  window.SESDIAN_APPLY_AVATAR = function () { applyAvatarEverywhere(currentUserLS()); };
  function centerCropSquare(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2, out = 256;
        var c = document.createElement('canvas'); c.width = out; c.height = out;
        c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, out, out);
        try { cb(c.toDataURL('image/webp', 0.85)); } catch (e) { try { cb(c.toDataURL('image/jpeg', 0.85)); } catch (e2) { cb(null); } }
      };
      img.onerror = function () { cb(null); };
      img.src = fr.result;
    };
    fr.onerror = function () { cb(null); };
    fr.readAsDataURL(file);
  }
  function buildProfileMenu(u) {
    var menu = document.createElement('div');
    menu.className = 'sesd-profile-menu';
    var av = getAvatar(u);
    menu.innerHTML =
      '<div class="sesd-profile-head">' +
        '<div class="sesd-profile-av" data-pf-av>' + (av ? '<img alt="Foto profil" src="' + av + '">' : initialsOf(u && u.name)) + '</div>' +
        '<div style="min-width:0">' +
          '<div class="sesd-profile-name">' + ((u && u.name) || 'Pengguna') + '</div>' +
          '<div class="sesd-profile-nip">NIP ' + ((u && u.nip) || '-') + '</div>' +
          '<span class="sesd-profile-role">' + ((u && u.role) || 'user') + '</span>' +
        '</div>' +
      '</div>' +
      '<a href="profil.html" class="sesd-btn sesd-btn-primary" data-pf-detail>Detail Profil</a>' +
      '<div class="sesd-profile-divider"></div>' +
      '<button type="button" class="sesd-btn sesd-btn-danger" data-pf-logout>Keluar</button>';
    menu.querySelector('[data-pf-logout]').addEventListener('click', function () {
      var lo = document.querySelector('[data-action="logout"]');
      if (!lo) {
        Array.prototype.forEach.call(document.querySelectorAll('aside button'), function (x) {
          if (!lo && /^(keluar|logout|log out)$/i.test((x.textContent || '').trim())) lo = x;
        });
      }
      if (lo) lo.click(); else { try { localStorage.removeItem('sesdian_user'); } catch (e) {} location.href = 'login.html'; }
    });
    return menu;
  }
  function wireProfile() {
    var prof = document.querySelector('.sesd-head-profile'); if (!prof) return;
    applyAvatarEverywhere(currentUserLS());
    var menu = null;
    function close() { if (menu) { menu.remove(); menu = null; } document.removeEventListener('click', onDoc, true); }
    function position() { if (!menu) return; var r = prof.getBoundingClientRect(); menu.style.top = (r.bottom + 8) + 'px'; menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px'; }
    function onDoc(e) { if (menu && !menu.contains(e.target) && !prof.contains(e.target)) close(); }
    prof.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (menu) { close(); return; }
      menu = buildProfileMenu(currentUserLS());
      document.body.appendChild(menu);
      position();
      setTimeout(function () { document.addEventListener('click', onDoc, true); }, 0);
      window.addEventListener('resize', position, { passive: true });
    });
  }

  /* ── Normalised header right-cluster: toggle | text-size | date | bell | profile ── */
  function buildHeaderCluster() {
    var wrap = document.createElement('div');
    wrap.className = 'sesd-headbar';

    wrap.appendChild(buildSwitch());
    wrap.appendChild(buildTextSize());

    var date = document.createElement('span');
    date.className = 'sesd-head-date';
    date.innerHTML = '<span class="ic">' + ICON_CAL + '</span><span>' + todayStr() + '</span>';
    wrap.appendChild(date);

    var bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'sesd-head-iconbtn';
    bell.setAttribute('aria-label', 'Notifikasi');
    bell.title = 'Notifikasi';
    bell.innerHTML = '<span class="ic">' + ICON_BELL + '</span>';
    wrap.appendChild(bell);

    var prof = document.createElement('button');
    prof.type = 'button';
    prof.className = 'sesd-head-profile';
    prof.setAttribute('aria-label', 'Profil');
    prof.title = 'Profil';
    prof.innerHTML = '<span class="ic">' + ICON_USER + '</span>';
    wrap.appendChild(prof);

    return wrap;
  }

  /* ── Back-to-top button (bottom-right corner) ── */
  function buildToTopButton() {
    var btn = document.createElement('button');
    btn.id = 'sesd-totop-btn';
    btn.type = 'button';
    btn.title = 'Kembali ke atas';
    btn.setAttribute('aria-label', 'Kembali ke atas');
    btn.innerHTML = ICON_UP;
    btn.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      var m = document.querySelector('main');
      if (m && m.scrollTop > 0) { try { m.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { m.scrollTop = 0; } }
    });
    return btn;
  }

  /* ── Inject header cluster + back-to-top once the shell exists ── */
  var tries = 0;
  function inject() {
    // Only app-shell pages (which have an <aside>) expose their topbar as
    // main's first child. On guest pages (katalog / aset-detail / auth) there is
    // no shell, so we must NOT treat main's first child as a topbar — doing so
    // injected the theme cluster into the hero / back-link. Fall back to the
    // floating toggle there instead.
    var hasShell = !!document.querySelector('aside');
    var header =
      document.querySelector('[data-topbar]') ||
      (hasShell && document.querySelector('main') ? document.querySelector('main').firstElementChild : null);

    // The dynamic shell pages build their topbar asynchronously; wait for it.
    if (header && !header.children.length && tries < 20) { tries++; return setTimeout(inject, 60); }

    var controls = document.querySelector('[data-guest-controls]');
    if (header && !document.getElementById('sesd-theme-toggle')) {
      var cluster = buildHeaderCluster();
      if (header.children.length >= 2) {
        header.replaceChild(cluster, header.lastElementChild);
      } else {
        header.appendChild(cluster);
      }
      wireProfile();      // Make the profile button open the per-user menu
    } else if (controls && !document.getElementById('sesd-theme-toggle')) {
      // Guest pages (katalog): theme + text-size live in the page header,
      // mirroring the dashboard chrome, instead of a floating toggle.
      controls.insertBefore(buildTextSize(), controls.firstChild);
      controls.insertBefore(buildSwitch(), controls.firstChild);
    } else if (!header && !document.getElementById('sesd-theme-toggle')) {
      // No header at all: keep the toggle reachable as a floating control.
      var fallback = buildSwitch();
      fallback.classList.add('sesd-theme-floating');
      document.body.appendChild(fallback);
    }

    if (!document.getElementById('sesd-totop-btn')) {
      var topBtn = buildToTopButton();
      document.body.appendChild(topBtn);
      var scrolled = function () {
        var m = document.querySelector('main');
        return Math.max(window.pageYOffset || 0, document.documentElement.scrollTop || 0,
          document.body.scrollTop || 0, m ? m.scrollTop : 0);
      };
      var onScroll = function () {
        if (scrolled() > 240) topBtn.classList.add('show');
        else topBtn.classList.remove('show');
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      var mainEl = document.querySelector('main');
      if (mainEl) mainEl.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
