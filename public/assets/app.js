/* ============================================================
   SESDIAN - shared client runtime (static frontend + Neon backend)

   • Roles: 'user' and 'admin'. Admins get CRUD + approvals (UI injected here).
   • DB-first: every list/stat renders from the data layer (real API or the
     in-memory demo set) - the static HTML templates are hidden via CSS, so no
     hardcoded data ever flashes before the database loads.
   ============================================================ */
(function () {
  'use strict';

  var DB = window.SESDIAN_DB || { configured: false };
  var REAL = !!DB.configured && /^https?:$/.test(location.protocol);
  var KEY = 'sesdian_user';
  var USER = null, IS_ADMIN = false, IS_VERIFIKATOR = false, IS_STAFF = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var byText = function (re, sel) { return $$(sel || 'button,a').filter(function (e) { return re.test((e.textContent || '').trim()); }); };
  var initials = function (n) { return (n || '').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || 'U'; };
  var page = function () { return document.body.getAttribute('data-page'); };
  var go = function (href) { return function () { location.href = href; }; };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  var ic = function (n) { return window.sesdIcon ? window.sesdIcon(n) : ''; };          // '<span class="ic">svg</span>'
  var iconFor = function (v) {                                                            // emoji or icon-name -> svg name
    var E = window.SESDIAN_EMOJI || {}, I = window.SESDIAN_ICONS || {};
    var key = String(v == null ? '' : v).replace(/️/g, '');
    if (E[key]) return E[key];
    if (I[key]) return key;
    return null;
  };

  var PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='130'%3E%3Crect width='200' height='130' fill='%23e0e7ff'/%3E%3Cg fill='none' stroke='%236366f1' stroke-width='4'%3E%3Cpath d='M100 42 72 56v34l28 14 28-14V56z'/%3E%3Cpath d='M72 56l28 14 28-14M100 70v34'/%3E%3C/g%3E%3C/svg%3E";

  var STATUS = {
    pending: { label: 'Pending', bg: '#fdecd9', fg: '#7a3d00' },
    approved: { label: 'Disetujui Admin', bg: '#e3f0fb', fg: '#005bab' },
    verified: { label: 'Terverifikasi', bg: '#daf0ef', fg: '#1c6e6a' },
    borrowed: { label: 'Dipinjam', bg: '#efe5fb', fg: '#3a1d58' },
    return_pending: { label: 'Menunggu Verifikasi Kembali', bg: '#fce4ef', fg: '#8e2f63' },
    returned: { label: 'Kembali', bg: '#e2f6e7', fg: '#127a2b' },
    rejected: { label: 'Ditolak', bg: '#fbe4e4', fg: '#a02020' },
  };

  /* ---------------- toast ---------------- */
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap');
    if (!wrap) { wrap = el('div', { class: 'sesd-toast-wrap' }); document.body.appendChild(wrap); }
    var t = el('div', { class: 'sesd-toast ' + (type || 'info') }, msg);
    wrap.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s,transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(function () { t.remove(); }, 320); }, 2800);
  }

  /* ---------------- data loader (three dots, only in the data area) ----------------
     The loader is shown ONLY inside the page's data container (the list/table that
     the DB fills), so the title, cards, controls and table headers stay visible.
     The subsequent render clears the container (removing the loader). */
  function pageDataContainer() {
    var tpl = $('[data-template]') || $('[data-recent-template]') || $('[data-monitor-template]');
    if (tpl && tpl.parentNode) return tpl.parentNode;
    return $('[data-dipinjam]') || $('[data-users-list]') || $('[data-report-rows]') || $('[data-list]');
  }
  function showPageLoader() {
    var c = pageDataContainer(); if (!c) return;
    if (c.querySelector('.sesd-page-loader')) return;
    if (c.tagName === 'TBODY') {
      c.appendChild(el('tr', { 'data-loader-row': '', html: '<td colspan="99" style="padding:0"><div class="sesd-page-loader" style="min-height:160px"><span></span><span></span><span></span></div></td>' }));
    } else {
      c.appendChild(el('div', { class: 'sesd-page-loader', style: 'min-height:180px;grid-column:1/-1', html: '<span></span><span></span><span></span>' }));
    }
  }
  function hidePageLoader() {
    $$('.sesd-page-loader').forEach(function (e) { var tr = e.closest && e.closest('tr[data-loader-row]'); if (tr) tr.remove(); else e.remove(); });
  }

  /* ---------------- session ---------------- */
  function demoUser() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function currentUser() {
    if (REAL) { var u = DB.auth.currentUser(); return u ? { nip: u.nip, name: u.name, role: u.role || 'user', initials: initials(u.name) } : null; }
    return demoUser();
  }

  function field(n) { return $('[data-field="' + n + '"]'); }
  function val(n) { var e = field(n); return e ? (e.value || '').trim() : ''; }

  /* ---------- multi-step login helpers ---------- */
  var _loginNip = ''; // NIP entered in step 1, carried through steps 2/3

  function showStep(id) {
    $$('.sesd-login__step').forEach(function (s) { s.classList.remove('active'); });
    var target = document.getElementById(id);
    if (target) target.classList.add('active');
    // auto-focus first visible input in the step
    var inp = target ? target.querySelector('input:not([type="hidden"])') : null;
    if (inp) setTimeout(function () { inp.focus(); }, 80);
  }

  function goBackToNip() {
    _loginNip = '';
    showStep('step-nip');
    var nipInput = document.getElementById('input-nip');
    if (nipInput) { nipInput.value = ''; setTimeout(function () { nipInput.focus(); }, 80); }
  }

  async function doCheckNip() {
    var nipInput = document.getElementById('input-nip');
    var nip = nipInput ? nipInput.value.trim() : '';
    if (!nip) { toast('Masukkan NIP Anda', 'error'); return; }
    _loginNip = nip;

    if (REAL) {
      try {
        var d = await DB.auth.checkNip(nip);
        if (!d.exists) { toast('NIP tidak ditemukan', 'error'); return; }
        if (d.has_password) {
          // NIP sudah punya password → tampilkan form password
          var pw = document.getElementById('nip-display-pw');
          if (pw) pw.textContent = nip;
          var pwInput = document.getElementById('input-password');
          if (pwInput) pwInput.value = '';
          showStep('step-password');
        } else {
          // NIP belum punya password → tampilkan form claim (nama + password)
          var cl = document.getElementById('nip-display-claim');
          if (cl) cl.textContent = nip;
          var nameInput = document.getElementById('input-claim-name');
          var claimPw = document.getElementById('input-claim-password');
          var claimConf = document.getElementById('input-claim-confirm');
          if (nameInput) nameInput.value = '';
          if (claimPw) claimPw.value = '';
          if (claimConf) claimConf.value = '';
          showStep('step-claim');
        }
      } catch (e) { toast((e && e.message) || 'Gagal memeriksa NIP', 'error'); }
      return;
    }
    // demo mode: just show password step
    var pw2 = document.getElementById('nip-display-pw');
    if (pw2) pw2.textContent = nip;
    showStep('step-password');
  }

  async function doLogin() {
    var nip = _loginNip;
    var pwd = val('password') || ($('input[type="password"]') || {}).value || '';
    if (!nip) { toast('NIP tidak ditemukan, ulangi dari awal', 'error'); goBackToNip(); return; }
    if (!pwd) { toast('Masukkan password Anda', 'error'); return; }
    if (REAL) {
      try {
        var d = await DB.auth.signIn({ nip: nip, password: pwd });
        if (d && d.claim_required) { openClaimForm(nip); return; }
        toast('Berhasil masuk', 'success'); setTimeout(go('dashboard.html'), 350);
      }
      catch (e) { toast((e && e.message) || 'Gagal masuk', 'error'); }
      return;
    }
    var name = nip === '123456789012345678' ? 'Adi Septriansyah' : 'Pengguna SESDIAN';
    localStorage.setItem(KEY, JSON.stringify({ nip: nip, name: name, initials: initials(name), role: 'admin' })); // demo = admin so all features are previewable
    toast('Berhasil masuk (mode demo: admin)', 'success'); setTimeout(go('dashboard.html'), 350);
  }

  async function doClaimSubmit() {
    var nip = _loginNip;
    if (!nip) { toast('NIP tidak ditemukan, ulangi dari awal', 'error'); goBackToNip(); return; }
    var nameInput = document.getElementById('input-claim-name');
    var pwInput = document.getElementById('input-claim-password');
    var confInput = document.getElementById('input-claim-confirm');
    var name = nameInput ? nameInput.value.trim() : '';
    var pw = pwInput ? pwInput.value : '';
    var confirm = confInput ? confInput.value : '';
    if (!name) { toast('Masukkan nama lengkap', 'error'); return; }
    if (!pw || pw.length < 8) { toast('Password minimal 8 karakter', 'error'); return; }
    if (pw !== confirm) { toast('Konfirmasi password tidak cocok', 'error'); return; }
    if (REAL) {
      try {
        await DB.auth.claimAccount({ nip: nip, name: name, password: pw });
        toast('Akun aktif. Selamat datang!', 'success');
        setTimeout(go('dashboard.html'), 500);
      } catch (e) { toast((e && e.message) || 'Gagal mengaktifkan akun', 'error'); }
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ nip: nip, name: name, initials: initials(name), role: 'admin' }));
    toast('Akun berhasil dibuat (demo)', 'success'); setTimeout(go('dashboard.html'), 500);
  }

  // fallback: if server somehow returns claim_required on a signIn (edge case),
  // navigate to the inline claim step instead of overlay
  function openClaimForm(nip) {
    _loginNip = nip;
    var cl = document.getElementById('nip-display-claim');
    if (cl) cl.textContent = nip;
    showStep('step-claim');
  }

  async function doRegister() {
    var name = val('name'), nip = val('nip'), pwd = val('password'), confirm = val('confirm'), phone = val('phone');
    if (!name) { toast('Lengkapi nama lengkap', 'error'); return; }
    if (!nip) { toast('Lengkapi NIP', 'error'); return; }
    if (!pwd || pwd.length < 8) { toast('Password minimal 8 karakter', 'error'); return; }
    if (confirm && pwd !== confirm) { toast('Konfirmasi password tidak cocok', 'error'); return; }
    if (REAL) {
      try { await DB.auth.signUp({ nip: nip, name: name, password: pwd, phone: phone }); toast('Akun berhasil dibuat', 'success'); setTimeout(go('dashboard.html'), 500); }
      catch (e) { toast((e && e.message) || 'Gagal mendaftar', 'error'); }
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ nip: nip, name: name, initials: initials(name), role: 'admin' }));
    toast('Akun berhasil dibuat', 'success'); setTimeout(go('dashboard.html'), 500);
  }

  async function doLogout() {
    if (REAL) { try { await DB.auth.signOut(); } catch (e) {} } else { try { localStorage.removeItem(KEY); } catch (e) {} }
    location.href = 'login.html';
  }

  /* ---------------- guard ---------------- */
  function guard() {
    var needsAuth = document.body.hasAttribute('data-auth');
    var needsAdmin = document.body.hasAttribute('data-admin');
    var roleList = (document.body.getAttribute('data-roles') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var user = currentUser();
    if (needsAuth && !user) { location.replace('login.html'); return { redirect: true }; }
    if ((page() === 'login' || page() === 'register') && user) { location.replace('dashboard.html'); return { redirect: true }; }
    if (needsAdmin && (!user || user.role !== 'admin')) { location.replace('dashboard.html'); return { redirect: true }; }
    if (roleList.length && (!user || roleList.indexOf(user.role) === -1)) { location.replace('dashboard.html'); return { redirect: true }; }
    return { redirect: false, user: user };
  }

  function fillIdentity(user) {
    if (!user) return;
    $$('[data-user-name]').forEach(function (e) {
      e.textContent = user.name;
      setTimeout(function() { e.style.opacity = '1'; }, 100);
    });
    var avatar = '';
    try { avatar = localStorage.getItem('sesdian_avatar_' + (user.nip || user.name)) || ''; } catch (e) {}
    $$('[data-user-initials]').forEach(function (e) {
      if (avatar) e.innerHTML = '<img alt="" src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">';
      else e.textContent = user.initials || initials(user.name);
      setTimeout(function() { e.style.opacity = '1'; }, 150);
    });
    $$('[data-user-firstname]').forEach(function (e) {
      e.textContent = (user.name || '').split(/\s+/)[0];
      setTimeout(function() { e.style.opacity = '1'; }, 200);
    });
    $$('[data-user-role]').forEach(function (e) {
      e.textContent = user.role || 'user';
      setTimeout(function() { e.style.opacity = '1'; }, 250);
    });
    // #7 — show the NIP consistently. Any opt-in [data-user-nip] element gets it,
    // and the sidebar account card's sub-line surfaces the NIP so the left-sidebar
    // identity matches the top-right header (both carry the NIP).
    var nipText = user.nip ? ('NIP ' + user.nip) : '';
    $$('[data-user-nip]').forEach(function (e) {
      e.textContent = nipText;
      setTimeout(function() { e.style.opacity = '1'; }, 250);
    });
    if (user.nip) $$('aside > div:last-child [data-user-role]').forEach(function (e) {
      e.textContent = nipText;
      e.style.textTransform = 'none';
      e.style.letterSpacing = '0.2px';
    });
  }

  /* ---------------- rendering ---------------- */
  function setStatusBadge(e, status) {
    var s = STATUS[status] || { label: status || '', bg: '', fg: '' };
    var dot = e.firstElementChild;
    e.textContent = s.label;
    if (dot) { if (s.fg) dot.style.background = s.fg; e.insertBefore(dot, e.firstChild); }
    if (s.fg) e.style.color = s.fg;
    var pill = (e.matches && e.matches('[style*="border-radius"]')) ? e : (e.closest ? e.closest('[style*="border-radius"]') : null);
    if (pill && s.bg) { pill.style.background = s.bg; if (s.fg) pill.style.color = s.fg; }
  }

  function applyBinds(node, rec) {
    var els = $$('[data-bind]', node);
    if (node.matches && node.matches('[data-bind]')) els.unshift(node);
    els.forEach(function (e) {
      var f = e.getAttribute('data-bind');
      if (f === 'stock_bar') { var pct = rec.stock_total ? Math.round((rec.stock_available / rec.stock_total) * 100) : (rec.total ? Math.round(rec.available / rec.total * 100) : 0); e.style.width = pct + '%'; return; }
      if (f === 'status_badge') { setStatusBadge(e, rec.status); return; }
      if (f === 'image') { e.loading = 'lazy'; e.decoding = 'async'; e.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; }; e.src = rec.image || PLACEHOLDER; return; }
      if (f === 'icon') { var nm = iconFor(rec.icon); if (nm) { e.innerHTML = window.SESDIAN_ICONS[nm]; e.style.color = 'var(--primary)'; } else { e.textContent = rec.icon || ''; } return; }
      var v = rec[f];
      if (v !== undefined && v !== null) e.textContent = v;
    });
  }

  function appendEmpty(container, msg) {
    // Remove skeleton if exists
    var skeleton = container.querySelector('.sesd-skeleton-container');
    if (skeleton) skeleton.remove();
    
    var isTable = container.tagName === 'TBODY' || container.tagName === 'TABLE';
    var e;
    if (isTable) { e = el('tr', { class: 'sesd-empty' }); var td = el('td', { style: 'text-align:center;padding:2rem;color:var(--text-muted)' }, msg || 'Belum ada data.'); td.colSpan = 99; e.appendChild(td); }
    else { e = el('div', { class: 'sesd-empty' }, msg || 'Belum ada data.'); }
    container.appendChild(e);
  }

  // cache the template (detached from the DOM so it is never counted/filtered/visible)
  // so admin edits can re-render the same list repeatedly.
  var TPL = {};
  function renderList(tplSel, records, fill) {
    var entry = TPL[tplSel];
    if (!entry) {
      var tpl = $(tplSel);
      if (!tpl) return;
      var container = tpl.parentNode;
      var src = tpl.cloneNode(true);
      ['data-template', 'data-monitor-template', 'data-recent-template', 'data-asset-template'].forEach(function (a) { src.removeAttribute(a); });
      tpl.remove();                       // drop the original seed row from the DOM
      entry = TPL[tplSel] = { container: container, src: src };
    }

    // Remove skeleton loading
    var skeleton = entry.container.querySelector('.sesd-skeleton-container');
    if (skeleton) skeleton.remove();

    entry.container.innerHTML = '';
    if (!records.length) { appendEmpty(entry.container); return; }

    // Build everything off-DOM, then append in ONE reflow (handles 1 or 1000 rows
    // smoothly). Only the first few items fade in with a light stagger — the rest
    // appear instantly, so large lists feel fast without dropping the polish.
    var frag = document.createDocumentFragment();
    var animated = [];
    var STAGGER_MAX = 16;
    records.forEach(function (rec, index) {
      var n = entry.src.cloneNode(true);
      applyBinds(n, rec);
      if (fill) fill(n, rec);
      if (index < STAGGER_MAX) { n.style.opacity = '0'; n.style.transition = 'opacity 0.3s ease'; animated.push(n); }
      frag.appendChild(n);
    });
    entry.container.appendChild(frag);
    if (animated.length) {
      requestAnimationFrame(function () {
        animated.forEach(function (n, i) { setTimeout(function () { n.style.opacity = '1'; }, i * 30); });
      });
    }
  }

  /* ====================== NO PREPLOADING - handled by preloader.js ====================== */
  // Removed prepLoading() - preloader.js handles all loading states

  /* ---------------- per-page data load (BOTH modes) ---------------- */
  async function loadAndRender(p) {
    // No prepLoading() - preloader.js handles loading states
    try {
      if (p === 'dashboard') {
        var d = await DB.dashboard();
        // Animate stats loading
        var statsKeys = Object.keys(d.stats);
        statsKeys.forEach(function (k, i) {
          var e = $('[data-stat="' + k + '"]');
          if (e) {
            // Remove loading indicator
            var loadingSpan = e.querySelector('.sesd-loading-inline');
            if (loadingSpan) loadingSpan.remove();

            // Set the value
            e.textContent = d.stats[k];
            e.style.opacity = '0';
            e.style.transition = 'opacity 0.3s ease';

            // Animate in
            setTimeout(function() {
              e.style.opacity = '1';
            }, i * 100);
          }

          // Mark stat card as loaded with stagger animation
          var card = $('[data-stat-card="' + k + '"]');
          if (card) {
            setTimeout(function() {
              card.classList.add('loaded');
            }, i * 100);
          }
        });
        renderList('[data-recent-template]', d.recent);
        wireRecentToolbar();          // #11 — replace "Lihat Semua" with search + filter
      } else if (p === 'dataaset') {
        var assets = await DB.assets();
        var groups = groupAssets(assets);                        // collapse identical items into tidy cards
        renderAssetGrid(groups);                                 // clean Notion cards (#6 empty chips, #7 stock X/Y, #8 status badge)
        var sum = function (k) { return assets.reduce(function (t, a) { return t + (a[k] || 0); }, 0); };
        var aStats = { total_assets: assets.length, total_stock: sum('stock_total'), stock_available: sum('stock_available'), stock_borrowed: sum('stock_borrowed'), maintenance: 0 };
        Object.keys(aStats).forEach(function (k) { var e = $('[data-stat="' + k + '"]'); if (e) e.textContent = aStats[k]; });
        var sub = $('[data-asset-subtitle]'); if (sub) sub.textContent = groups.length + ' jenis · ' + assets.length + ' unit · ' + aStats.total_stock + ' total stok';
      } else if (p === 'kategoriaset') {
        var cats = await DB.categories();
        var catSub = $('[data-cat-subtitle]'); if (catSub) catSub.textContent = cats.length + ' kategori';
        renderList('[data-template]', cats, function (n, r) { n.setAttribute('data-id', r.id); if (IS_ADMIN) enhanceSimpleCard(n, r, 'category'); });
      } else if (p === 'ruangan') {
        var roomsSub = $('[data-room-subtitle]');
        renderList('[data-template]', await DB.rooms().then(function (rs) { if (roomsSub) roomsSub.textContent = rs.length + ' ruangan terdaftar'; return rs; }), function (n, r) {
          n.setAttribute('data-id', r.id);
          n.style.cursor = 'pointer';
          n.addEventListener('click', function (e) { if (e.target.closest('.sesd-admin-actions')) return; openRoomDetail(r); });   // #9 — view/edit room contents
          if (IS_ADMIN) enhanceSimpleCard(n, r, 'room');
        });
      } else if (p === 'daftarpinjam') {
        // #9 — full borrowing history (Riwayat). The API scopes rows per role:
        // a user sees only their own loans (so the page finally works for users);
        // admin/verifikator see everyone's and can search by borrower name.
        var allbs = await DB.borrowings();
        var bs = allbs;
        var bSub = $('[data-borrow-subtitle]'); if (bSub) bSub.textContent = allbs.length + ' total transaksi';
        ensureAksiHeader();
        renderList('[data-template]', bs, function (n, r) { n.setAttribute('data-status', r.status); enhanceBorrowingRow(n, r); });
        var counts = { all: allbs.length, pending: 0, approved: 0, rejected: 0, returned: 0 };
        allbs.forEach(function (b) { if (counts[b.status] != null) counts[b.status]++; });
        // "Semua" segment is default-active in the markup, so the FULL history shows
        // by default; just fill the per-status count badges.
        Object.keys(counts).forEach(function (k) { var e = $('[data-count="' + k + '"]'); if (e) e.textContent = counts[k]; });
        if ($('[data-asset-template]')) {
          renderList('[data-asset-template]', await DB.assets(), function (n, r) { var cb = $('[data-asset-checkbox]', n) || $('input[type="checkbox"]', n); if (cb) cb.value = String(r.id); });
        }
      } else if (p === 'verifikasi') {
        var allb = await DB.borrowings();
        // Role-aware queue: the admin's verification work is verif 1 (pending) and
        // return verification; the verifikator's is verif 2 (approved) + returns.
        // Before this, the page only listed 'approved', so admins saw it empty.
        var queueStatuses = IS_ADMIN ? ['pending', 'return_pending'] : ['approved', 'return_pending'];
        var queue = allb.filter(function (b) { return queueStatuses.indexOf(b.status) !== -1; });
        var vSub = $('h1') && $('h1').nextElementSibling;
        if (vSub && IS_ADMIN) vSub.textContent = 'Verifikasi pertama (persetujuan) dan verifikasi pengembalian oleh admin.';
        ensureAksiHeader();
        renderList('[data-template]', queue, function (n, r) {
          n.setAttribute('data-status', r.status); enhanceBorrowingRow(n, r);
          var bc = $('[data-bind="borrower"]', n);      // peminjam photo beside the name
          if (bc) {
            bc.textContent = '';
            var wrap = el('div', { style: 'display:flex;align-items:center;gap:9px' });
            wrap.appendChild(borrowerAvatar(r.borrower, r.borrower_avatar, 30));
            wrap.appendChild(el('span', { style: 'font-weight:600;color:var(--text)' }, r.borrower || '-'));
            bc.appendChild(wrap);
          }
        });
        var qc = $('[data-count="approved"]'); if (qc) qc.textContent = queue.length;
        var done = allb.filter(function (b) { return b.status === 'verified' || b.status === 'borrowed' || b.status === 'returned'; }).length;
        var dc = $('[data-count="verified"]'); if (dc) dc.textContent = done;
        buildVerifChart(allb);                          // status distribution donut beside the queue
      } else if (p === 'dipinjam') {
        var alld = await DB.borrowings();
        var out = alld.filter(function (b) { return b.status === 'borrowed' || b.status === 'verified' || b.status === 'return_pending'; });
        var bc = $('[data-count="borrowed"]'); if (bc) bc.textContent = out.filter(function (b) { return b.status === 'borrowed' || b.status === 'verified'; }).length;
        var rc = $('[data-count="return_pending"]'); if (rc) rc.textContent = out.filter(function (b) { return b.status === 'return_pending'; }).length;
        renderDipinjam(out);
      } else if (p === 'ajukanpinjam') {
        buildAjukanList(groupAssets(await DB.assets()));
      } else if (p === 'users') {
        await renderUsers();
      } else if (p === 'profil') {
        await renderProfile();
      }
    } catch (e) {
      if (e && e.status === 401) { location.replace('login.html'); return; }
      toast('Gagal memuat data: ' + ((e && e.message) || e), 'error');
    }
  }

  function reapplyFilters() { var it = $('[data-search-item]'); if (it) applyFilters(it.getAttribute('data-search-item')); }
  async function reloadData() { await loadAndRender(page()); reapplyFilters(); labelizeTables(); }

  /* ====================== ADMIN UI ====================== */
  function overlay() { return el('div', { class: 'sesd-overlay' }); }
  // Only ever allow one modal at a time: spamming Edit/Tambah/etc. (e.g. on a
  // laggy network) can't stack duplicate popups. Nested dialogs close their
  // parent first (see openGroupDetail) so confirmations still work.
  function modalOpen() { return !!$('.sesd-overlay'); }

  function fileToDataURL(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 400, w = img.width, h = img.height;
          if (w > max) { h = Math.round(h * max / w); w = max; }
          try { var c = el('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); resolve(c.toDataURL('image/webp', 0.70)); }
          catch (e) { resolve(fr.result); }
        };
        img.onerror = function () { resolve(fr.result); };
        img.src = fr.result;
      };
      fr.onerror = reject; fr.readAsDataURL(file);
    });
  }

  function overlayForm(opts) {
    if (modalOpen()) return;
    var ov = overlay(), m = el('div', { class: 'sesd-modal' });
    m.appendChild(el('h3', {}, opts.title));
    if (opts.desc) m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:.83rem;margin:-6px 0 14px' }, opts.desc));
    var inputs = {};
    opts.fields.forEach(function (f) {
      var wrap = el('div', { class: 'sesd-field' });
      wrap.appendChild(el('label', {}, f.label));
      var input;
      if (f.type === 'select') { input = el('select'); (f.options || []).forEach(function (o) { var op = el('option', { value: o.value }, o.label); if (String(f.value) === String(o.value)) op.selected = true; input.appendChild(op); }); }
      else if (f.type === 'textarea') { input = el('textarea'); if (f.value) input.value = f.value; }
      else if (f.type === 'file') { input = el('input', { type: 'file', accept: 'image/*' }); }
      else if (f.type === 'datalist') {
        // free-text input with autocomplete suggestions (type existing OR a new value)
        input = el('input', { type: 'text', autocomplete: 'off' });
        if (f.value != null) input.value = f.value;
        if (f.placeholder) input.placeholder = f.placeholder;
        var listId = 'dl-' + f.name + '-' + Math.random().toString(36).slice(2, 7);
        input.setAttribute('list', listId);
        var dl = el('datalist', { id: listId });
        (f.options || []).forEach(function (o) { dl.appendChild(el('option', { value: (o && o.value != null) ? o.value : o })); });
        wrap.appendChild(dl);
      }
      else { input = el('input', { type: f.type || 'text' }); if (f.value != null) input.value = f.value; if (f.placeholder) input.placeholder = f.placeholder; if (f.maxlength) input.setAttribute('maxlength', f.maxlength); if (f.inputmode) input.setAttribute('inputmode', f.inputmode); }
      inputs[f.name] = input;
      wrap.appendChild(input);
      if (f.type === 'file') {
        var prev = el('img', { class: 'sesd-imgprev' }); if (f.value) { prev.src = f.value; prev.style.display = 'block'; } wrap.appendChild(prev);
        input.addEventListener('change', async function () { if (input.files && input.files[0]) { try { var u = await fileToDataURL(input.files[0]); input._dataurl = u; prev.src = u; prev.style.display = 'block'; } catch (e) { toast('Gagal membaca gambar', 'error'); } } });
      }
      if (f.hint) {
        var hintEl = el('div', { style: 'font-size:0.72rem;margin-top:5px;color:var(--text-muted)' });
        var upd = function () { var h = f.hint(input.value); hintEl.textContent = h ? h.text : ''; hintEl.style.color = (h && h.color) || 'var(--text-muted)'; };
        input.addEventListener('input', upd); upd();
        wrap.appendChild(hintEl);
      }
      m.appendChild(wrap);
    });
    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    var save = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'flex:1' }, opts.submitLabel || 'Simpan');
    var cancel = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Batal');
    foot.appendChild(save); foot.appendChild(cancel); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    cancel.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    save.addEventListener('click', async function () {
      var vals = {};
      opts.fields.forEach(function (f) { var inp = inputs[f.name]; vals[f.name] = f.type === 'file' ? (inp._dataurl || f.value || null) : inp.value; });
      save.disabled = true; save.textContent = 'Menyimpan…';
      try { await opts.onSave(vals); close(); } catch (e) { toast((e && e.message) || 'Gagal menyimpan', 'error'); save.disabled = false; save.textContent = opts.submitLabel || 'Simpan'; }
    });
  }

  function confirmDelete(label, onYes) {
    if (modalOpen()) return;
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:360px' });
    m.appendChild(el('h3', {}, 'Hapus ' + label + '?'));
    m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:.85rem;margin-bottom:1rem' }, 'Tindakan ini tidak dapat dibatalkan.'));
    var foot = el('div', { style: 'display:flex;gap:8px' });
    var yes = el('button', { class: 'sesd-btn sesd-btn-danger', style: 'flex:1' }, 'Hapus');
    var no = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Batal');
    foot.appendChild(yes); foot.appendChild(no); m.appendChild(foot); ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    no.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    yes.addEventListener('click', async function () { yes.disabled = true; try { await onYes(); close(); } catch (e) { toast((e && e.message) || 'Gagal', 'error'); yes.disabled = false; } });
  }

  // #8 — generic second-confirmation dialog ("apakah anda yakin? ya/tidak") used
  // for every verification action (approve, verify, return, reject, ...).
  function confirmAction(opts, onYes) {
    // must be allowed ON TOP of another modal (e.g. the "Sedang Dipinjam" list
    // modal) — only block a duplicate confirm dialog.
    if (document.querySelector('.sesd-confirm-overlay')) return;
    opts = opts || {};
    var ov = overlay(); ov.classList.add('sesd-confirm-overlay'); ov.style.zIndex = '10001';
    var m = el('div', { class: 'sesd-modal', style: 'width:390px' });
    m.appendChild(el('h3', {}, opts.title || 'Konfirmasi'));
    m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:.9rem;line-height:1.5;margin-bottom:1.15rem' }, opts.message || 'Apakah Anda yakin ingin melanjutkan?'));
    var foot = el('div', { style: 'display:flex;gap:8px' });
    var yes = el('button', { class: 'sesd-btn sesd-btn-' + (opts.variant || 'primary'), style: 'flex:1' }, opts.confirmLabel || 'Ya');
    var no = el('button', { class: 'sesd-btn sesd-btn-ghost', style: 'flex:1' }, opts.cancelLabel || 'Tidak');
    foot.appendChild(yes); foot.appendChild(no); m.appendChild(foot); ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    no.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    yes.addEventListener('click', async function () { yes.disabled = true; try { await onYes(); close(); } catch (e) { toast((e && e.message) || 'Gagal', 'error'); yes.disabled = false; } });
  }

  // Dialog informasi satu tombol; boleh tampil di atas/tepat setelah modal lain.
  function infoDialog(title, message) {
    var ov = overlay(); ov.classList.add('sesd-confirm-overlay'); ov.style.zIndex = '10001';
    var m = el('div', { class: 'sesd-modal', style: 'width:430px' });
    m.appendChild(el('h3', {}, title));
    m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:.9rem;line-height:1.6;margin-bottom:1.15rem' }, message));
    var ok = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'width:100%' }, 'Mengerti');
    m.appendChild(ok); ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    ok.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  }

  var DD_CARET = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  // Custom styled dropdown (consistent font/style) with optional inline add + per-option delete.
  function buildDropdown(opts) {
    var options = (opts.options || []).slice();
    var state = { value: (opts.value != null && opts.value !== '') ? String(opts.value) : '' };
    var wrap = el('div', { class: 'sesd-dd' });
    var btn = el('button', { type: 'button', class: 'sesd-dd-btn' });
    var lbl = el('span', { class: 'sesd-dd-label' });
    btn.appendChild(lbl); btn.appendChild(el('span', { class: 'sesd-dd-caret', html: DD_CARET }));
    var menu = el('div', { class: 'sesd-dd-menu' });
    wrap.appendChild(btn); wrap.appendChild(menu);
    function curLabel() { var o = options.filter(function (x) { return String(x.value) === state.value; })[0]; return o ? o.label : (opts.placeholder || 'Pilih'); }
    function paint() { lbl.textContent = curLabel(); lbl.classList.toggle('is-ph', !state.value); }
    var open = false;
    function onDoc(e) { if (open && !wrap.contains(e.target)) setOpen(false); }
    function setOpen(v) { open = v; wrap.classList.toggle('is-open', open); if (open) { render(); document.addEventListener('click', onDoc, true); } else { document.removeEventListener('click', onDoc, true); } }
    function render() {
      menu.innerHTML = '';
      if (!options.length) menu.appendChild(el('div', { class: 'sesd-dd-empty' }, 'Belum ada pilihan'));
      options.forEach(function (o) {
        var row = el('div', { class: 'sesd-dd-opt' + (String(o.value) === state.value ? ' is-active' : '') });
        row.appendChild(el('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, o.label));
        row.addEventListener('click', function () { state.value = String(o.value); paint(); setOpen(false); if (opts.onChange) opts.onChange(o.value); });
        if (opts.onDelete && o.deletable !== false) {
          var del = el('button', { type: 'button', class: 'sesd-dd-del', title: 'Hapus', html: ic('trash') });
          del.addEventListener('click', function (e) { e.stopPropagation(); opts.onDelete(o, function () { options = options.filter(function (x) { return String(x.value) !== String(o.value); }); if (String(o.value) === state.value) { state.value = ''; paint(); } render(); }); });
          row.appendChild(del);
        }
        menu.appendChild(row);
      });
      if (opts.onAdd) {
        var addRow = el('div', { class: 'sesd-dd-add' });
        var ai = el('input', { type: 'text', placeholder: opts.addPlaceholder || 'Nama baru' });
        var ab = el('button', { type: 'button', class: 'sesd-btn sesd-btn-sm sesd-btn-primary' }, 'Tambah');
        function doAdd() { var v = ai.value.trim(); if (!v) return; opts.onAdd(v, function (newOpt) { if (newOpt) { options.push(newOpt); state.value = String(newOpt.value); paint(); } ai.value = ''; render(); }); }
        ab.addEventListener('click', function (e) { e.stopPropagation(); doAdd(); });
        ai.addEventListener('click', function (e) { e.stopPropagation(); });
        ai.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        addRow.appendChild(ai); addRow.appendChild(ab); menu.appendChild(addRow);
      }
    }
    btn.addEventListener('click', function (e) { e.preventDefault(); setOpen(!open); });
    paint();
    return { wrap: wrap, get: function () { return state.value; } };
  }

  // Name field: type-to-filter suggestion dropdown + a right-side status chip (icon + short label).
  function buildNameField(value, names, nameMap) {
    var wrap = el('div', { class: 'sesd-ac' });
    var input = el('input', { type: 'text', class: 'sesd-ac-input', autocomplete: 'off', placeholder: 'Ketik atau pilih nama barang' });
    if (value) input.value = value;
    var status = el('span', { class: 'sesd-ac-status' });
    var menu = el('div', { class: 'sesd-ac-menu' });
    wrap.appendChild(input); wrap.appendChild(status); wrap.appendChild(menu);
    function updateStatus() {
      var k = (input.value || '').trim().toLowerCase();
      if (!k) { status.style.display = 'none'; return; }
      status.style.display = 'inline-flex';
      if (nameMap[k]) { status.className = 'sesd-ac-status is-exist'; status.innerHTML = ic('check_circle') + '<span>Sudah ada</span>'; status.title = 'Nama sudah ada, masuk ke jenis yang sama'; }
      else { status.className = 'sesd-ac-status is-new'; status.innerHTML = ic('tag') + '<span>Baru</span>'; status.title = 'Barang baru (jenis belum ada)'; }
    }
    function drawMenu() {
      var q = (input.value || '').trim().toLowerCase();
      var matches = names.filter(function (n) { return q && n.toLowerCase().indexOf(q) !== -1 && n.toLowerCase() !== q; }).slice(0, 8);
      menu.innerHTML = '';
      if (!matches.length) { wrap.classList.remove('is-open'); return; }
      matches.forEach(function (n) {
        var row = el('div', { class: 'sesd-ac-opt' }, n);
        row.addEventListener('mousedown', function (e) { e.preventDefault(); input.value = n; updateStatus(); wrap.classList.remove('is-open'); });
        menu.appendChild(row);
      });
      wrap.classList.add('is-open');
    }
    input.addEventListener('input', function () { updateStatus(); drawMenu(); });
    input.addEventListener('focus', drawMenu);
    input.addEventListener('blur', function () { setTimeout(function () { wrap.classList.remove('is-open'); }, 150); });
    updateStatus();
    return { wrap: wrap, get: function () { return input.value; } };
  }

  // Image picker WITH cropping: drag & drop / click to browse, then pan (drag)
  // and zoom (slider or mouse wheel) inside a fixed 640x420 viewport — like a
  // typical avatar/photo uploader. get() renders the visible crop to a WebP
  // data-URL; returns null until the user picks a file.
  function buildImageCropper(initialUrl) {
    var st = { img: null, natW: 0, natH: 0, z: 1, ox: 0, oy: 0 };
    var wrap = el('div');
    var input = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });

    // dropzone (shown until a file is picked; shows the current image as preview)
    var zone = el('div', { class: 'sesd-drop' + (initialUrl ? ' has-img' : '') });
    var prev = el('img', { class: 'sesd-drop-prev', alt: '' });
    if (initialUrl) prev.src = initialUrl;
    prev.onerror = function () { zone.classList.remove('has-img'); };
    var hint = el('div', { class: 'sesd-drop-hint', html: ic('archive') + '<div style="margin-top:6px"><b>Tarik gambar ke sini</b><br><span style="font-size:.75rem;color:var(--text-muted)">atau klik untuk memilih file</span></div>' });
    zone.appendChild(prev); zone.appendChild(hint);

    // crop stage (hidden until a file is picked)
    var cropBox = el('div', { style: 'display:none' });
    var stage = el('div', { class: 'sesd-crop-stage' });
    var cimg = el('img', { class: 'sesd-crop-img', alt: '', draggable: 'false' });
    stage.appendChild(cimg);
    var tools = el('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:8px' });
    tools.appendChild(el('span', { style: 'font-size:.72rem;font-weight:700;color:var(--text-muted)' }, 'ZOOM'));
    var zoom = el('input', { type: 'range', min: '1', max: '3', step: '0.01', value: '1', style: 'flex:1' });
    var rePick = el('button', { type: 'button', class: 'sesd-btn sesd-btn-sm sesd-btn-ghost' }, 'Ganti file');
    tools.appendChild(zoom); tools.appendChild(rePick);
    cropBox.appendChild(stage); cropBox.appendChild(tools);
    cropBox.appendChild(el('div', { style: 'font-size:.7rem;color:var(--text-muted);margin-top:4px' }, 'Geser gambar untuk mengatur posisinya; zoom bisa diperkecil sampai seluruh gambar terlihat.'));
    wrap.appendChild(zone); wrap.appendChild(cropBox); wrap.appendChild(input);

    function baseScale() { return Math.max(stage.clientWidth / st.natW, stage.clientHeight / st.natH); }
    // zoom out is allowed down to "fit" (the whole image visible, letterboxed on
    // the paper background), zoom in up to 3x cover
    function zMin() {
      var contain = Math.min(stage.clientWidth / st.natW, stage.clientHeight / st.natH);
      return Math.min(1, contain / baseScale());
    }
    function clampPan() {
      var s = baseScale() * st.z;
      // symmetric clamp: when the image overflows the stage this limits panning to
      // the excess; when it is SMALLER (zoomed out) it keeps it fully inside
      var mx = Math.abs(st.natW * s - stage.clientWidth) / 2;
      var my = Math.abs(st.natH * s - stage.clientHeight) / 2;
      st.ox = Math.min(mx, Math.max(-mx, st.ox));
      st.oy = Math.min(my, Math.max(-my, st.oy));
    }
    function paint() {
      if (!st.img) return;
      cimg.style.width = (st.natW * baseScale()) + 'px';
      cimg.style.transform = 'translate(-50%, -50%) translate(' + st.ox + 'px,' + st.oy + 'px) scale(' + st.z + ')';
    }
    function handleFile(f) {
      if (!f) return;
      if ((f.type || '').indexOf('image/') !== 0) { toast('File harus berupa gambar', 'error'); return; }
      var r = new FileReader();
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          st.img = im; st.natW = im.width; st.natH = im.height; st.z = 1; st.ox = 0; st.oy = 0;
          cimg.src = im.src; zoom.value = '1';
          zone.style.display = 'none'; cropBox.style.display = 'block';
          requestAnimationFrame(function () { zoom.min = String(Math.floor(zMin() * 100) / 100); clampPan(); paint(); });
        };
        im.onerror = function () { toast('Gagal membaca gambar', 'error'); };
        im.src = r.result;
      };
      r.onerror = function () { toast('Gagal membaca gambar', 'error'); };
      r.readAsDataURL(f);
    }

    zone.addEventListener('click', function () { input.click(); });
    rePick.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { if (input.files && input.files[0]) handleFile(input.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      [zone, stage].forEach(function (t) { t.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.add('is-over'); }); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      [zone, stage].forEach(function (t) { t.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.remove('is-over'); }); });
    });
    [zone, stage].forEach(function (t) { t.addEventListener('drop', function (e) { handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); }); });

    // pan by dragging, zoom via slider or wheel
    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      if (!st.img) return;
      drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy };
      stage.setPointerCapture(e.pointerId); stage.classList.add('is-dragging');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      st.ox = drag.ox + (e.clientX - drag.x); st.oy = drag.oy + (e.clientY - drag.y);
      clampPan(); paint();
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) { stage.addEventListener(ev, function () { drag = null; stage.classList.remove('is-dragging'); }); });
    zoom.addEventListener('input', function () { st.z = Math.max(zMin(), parseFloat(zoom.value) || 1); clampPan(); paint(); });
    stage.addEventListener('wheel', function (e) {
      if (!st.img) return;
      e.preventDefault();
      st.z = Math.min(3, Math.max(zMin(), st.z + (e.deltaY < 0 ? 0.08 : -0.08)));
      zoom.value = String(st.z); clampPan(); paint();
    }, { passive: false });

    return {
      wrap: wrap,
      // render the visible viewport to 640x420 WebP (null until a file is picked).
      // Drawn destination-side so zoom OUT (image smaller than the viewport) works
      // too — uncovered areas get a clean white letterbox.
      get: function () {
        if (!st.img) return null;
        var W = stage.clientWidth, H = stage.clientHeight, k = 640 / W;
        var s = baseScale() * st.z;
        var dw = st.natW * s * k, dh = st.natH * s * k;
        var dx = (W / 2 + st.ox) * k - dw / 2, dy = (H / 2 + st.oy) * (420 / H) - dh / 2;
        var c = document.createElement('canvas'); c.width = 640; c.height = 420;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 420);
        ctx.drawImage(st.img, dx, dy, dw, dh);
        var out = c.toDataURL('image/webp', 0.82);
        if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.82); // Safari fallback
        return out;
      },
    };
  }

  // Change the image for a WHOLE jenis (every unit sharing the name) in ONE
  // request (asset_images upsert) — no per-unit patching. Stacks on top of the
  // group modal.
  function openGroupImageModal(g, onDone) {
    if (document.querySelector('.sesd-imgedit-overlay')) return;
    var ov = overlay(); ov.classList.add('sesd-imgedit-overlay'); ov.style.zIndex = '10001';
    var m = el('div', { class: 'sesd-modal', style: 'width:440px' });
    m.appendChild(el('h3', {}, 'Ganti Gambar'));
    m.appendChild(el('div', { style: 'color:var(--text-muted);font-size:.82rem;margin:-6px 0 12px' }, (g.name || '-') + ' · satu gambar untuk semua ' + g.units.length + ' unit'));
    var crop = buildImageCropper(g.image || null);
    m.appendChild(crop.wrap);
    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    var save = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'flex:1' }, 'Simpan Gambar');
    var cancel = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Batal');
    foot.appendChild(save); foot.appendChild(cancel); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    cancel.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    save.addEventListener('click', async function () {
      var url = crop.get();
      if (!url) { toast('Pilih gambar terlebih dahulu', 'error'); return; }
      save.disabled = true; cancel.disabled = true; save.textContent = 'Menyimpan…';
      try {
        await DB.setJenisImage(g.name, g.brand, url);   // one upsert covers every unit of this nama+merk
        g.image = url; g.units.forEach(function (u) { u.image = url; });
        toast('Gambar "' + g.name + (g.brand ? ' ' + g.brand : '') + '" diperbarui', 'success');
        close(); if (onDone) onDone(url); reloadData();
      } catch (e) {
        toast((e && e.message) || 'Gagal menyimpan gambar', 'error');
        save.disabled = false; cancel.disabled = false; save.textContent = 'Simpan Gambar';
      }
    });
  }

  async function openAssetForm(rec) {
    if (modalOpen()) return;
    // build the modal immediately (with a loader) so rapid clicks during a slow
    // fetch can't stack several form instances (same pattern as openRoomDetail).
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:440px;max-height:90vh;overflow:auto' });
    m.appendChild(el('h3', {}, rec ? 'Edit Aset' : 'Tambah Aset'));
    var loader = el('div', { class: 'sesd-page-loader', style: 'min-height:120px', html: '<span></span><span></span><span></span>' });
    m.appendChild(loader);
    ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    var cats = [], rms = [], allAssets = [];
    try { cats = await DB.categories(); rms = await DB.rooms(); allAssets = await DB.assets(); } catch (e) {}
    loader.remove();
    var nameMap = {};
    allAssets.forEach(function (a) { if (a.name) { var k = a.name.trim().toLowerCase(); if (!nameMap[k]) nameMap[k] = a.name.trim(); } });
    var names = Object.keys(nameMap).map(function (k) { return nameMap[k]; }).sort();
    function field(labelText, control) { var w = el('div', { class: 'sesd-field' }); w.appendChild(el('label', {}, labelText)); w.appendChild(control); return w; }

    var nameW = buildNameField(rec && rec.name, names, nameMap);          // #6 — autocomplete + status icon
    m.appendChild(field('Nama Aset', nameW.wrap));
    var codeInput = el('input', { type: 'text', placeholder: 'Kode unik untuk barang ini' }); if (rec && rec.code) codeInput.value = rec.code;
    m.appendChild(field('Kode', codeInput));
    var catDD = buildDropdown({                                           // #8 — styled category dropdown + add/delete
      value: rec && rec.category_id, placeholder: 'Pilih kategori',
      options: cats.map(function (c) { return { value: c.id, label: c.name }; }),
      addPlaceholder: 'Nama kategori baru',
      onAdd: function (name, done) {
        if (cats.some(function (c) { return (c.name || '').trim().toLowerCase() === name.toLowerCase(); })) { toast('Kategori sudah ada', 'error'); done(); return; }
        DB.createCategory({ name: name }).then(function (res) { var id = res && (res.id != null ? res.id : (res.category && res.category.id)); cats.push({ id: id, name: name }); toast('Kategori ditambahkan', 'success'); reloadData(); done({ value: id, label: name }); }).catch(function (e) { toast((e && e.message) || 'Gagal', 'error'); done(); });
      },
      onDelete: function (o, done) {
        confirmAction({ title: 'Hapus Kategori', message: 'Hapus kategori "' + o.label + '"? Aset yang memakainya menjadi tanpa kategori.', variant: 'danger', confirmLabel: 'Ya, hapus' }, async function () {
          await DB.deleteCategory(o.value); cats = cats.filter(function (c) { return c.id !== o.value; }); toast('Kategori dihapus', 'success'); reloadData(); done();
        });
      },
    });
    m.appendChild(field('Kategori', catDD.wrap));
    var brandInput = el('input', { type: 'text' }); if (rec && rec.brand) brandInput.value = rec.brand;
    m.appendChild(field('Merek', brandInput));
    var roomDD = buildDropdown({ value: rec && rec.room_id, placeholder: 'Tanpa ruangan', options: [{ value: '', label: 'Tanpa ruangan' }].concat(rms.map(function (r) { return { value: r.id, label: r.name }; })) });
    m.appendChild(field('Ruangan (opsional)', roomDD.wrap));
    var jenisDD = buildDropdown({ value: (rec && rec.type) || 'BMN', options: [{ value: 'BMN', label: 'BMN' }, { value: 'Non-BMN', label: 'Non-BMN' }] });
    m.appendChild(field('Jenis', jenisDD.wrap));
    var kondisiDD = buildDropdown({ value: (rec && rec.condition) || 'Baik', options: ['Baik', 'Rusak Ringan', 'Rusak Berat'].map(function (k) { return { value: k, label: k }; }) });
    m.appendChild(field('Kondisi', kondisiDD.wrap));
    var imgCrop = buildImageCropper((rec && rec.image) || null);   // drag & drop + crop/zoom
    m.appendChild(field('Gambar jenis ini (opsional, berlaku untuk semua unit senama)', imgCrop.wrap));

    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    var save = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'flex:1' }, rec ? 'Simpan' : 'Tambah');
    var cancel = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Batal');
    foot.appendChild(save); foot.appendChild(cancel); m.appendChild(foot);
    cancel.addEventListener('click', close);
    save.addEventListener('click', async function () {
      var name = (nameW.get() || '').trim(), code = (codeInput.value || '').trim();
      if (!name || !code) { toast('Nama dan kode wajib diisi', 'error'); return; }
      var codeK = code.toLowerCase();
      if (allAssets.some(function (a) { return (!rec || a.id !== rec.id) && (a.code || '').trim().toLowerCase() === codeK; })) { toast('Kode "' + code + '" sudah dipakai barang lain', 'error'); return; }
      save.disabled = true; save.textContent = 'Menyimpan...';
      try {
        var payload = {
          name: name, code: code,
          category_id: catDD.get() ? parseInt(catDD.get(), 10) : null,
          room_id: roomDD.get() ? parseInt(roomDD.get(), 10) : null,
          brand: (brandInput.value || '').trim() || null,
          type: jenisDD.get() || 'BMN', condition: kondisiDD.get() || 'Baik',
          stock_total: 1,
        };
        if (rec) await DB.updateAsset(rec.id, payload); else await DB.createAsset(payload);
        // image is stored once per jenis (nama + merk), not per unit — a fresh
        // crop upserts the shared image for every unit with this name+brand
        var pickedImg = imgCrop.get();
        if (pickedImg) await DB.setJenisImage(name, payload.brand, pickedImg);
        toast(rec ? 'Aset diperbarui' : 'Aset ditambahkan', 'success'); close(); reloadData();
      } catch (e) { toast((e && e.message) || 'Gagal menyimpan', 'error'); save.disabled = false; save.textContent = rec ? 'Simpan' : 'Tambah'; }
    });
  }
  // #8 — manage categories (add / delete) without a dedicated page.
  async function openCategoryManager() {
    if (modalOpen()) return;
    var cats = [];
    try { cats = await DB.categories(); } catch (e) {}
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:420px' });
    m.appendChild(el('h3', {}, 'Kelola Kategori'));
    m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:.85rem;margin:-6px 0 12px' }, 'Tambah kategori baru atau hapus yang tidak dipakai.'));
    var list = el('div', { style: 'display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto;margin-bottom:12px' });
    function row(c) {
      var r = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:.5rem .7rem;border:1px solid var(--border);border-radius:10px' });
      r.appendChild(el('span', { style: 'flex:1;font-weight:600;font-size:.85rem' }, c.name));
      var del = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger', html: ic('trash') });
      del.addEventListener('click', function () {
        confirmAction({ title: 'Hapus Kategori', message: 'Hapus kategori "' + c.name + '"? Aset yang memakainya akan menjadi tanpa kategori.', variant: 'danger', confirmLabel: 'Ya, hapus' }, async function () {
          await DB.deleteCategory(c.id); cats = cats.filter(function (x) { return x.id !== c.id; }); draw(); toast('Kategori dihapus', 'success'); reloadData();
        });
      });
      r.appendChild(del); return r;
    }
    function draw() { list.innerHTML = ''; if (!cats.length) list.appendChild(el('div', { style: 'color:var(--text-muted);font-size:.85rem;padding:.5rem' }, 'Belum ada kategori.')); else cats.forEach(function (c) { list.appendChild(row(c)); }); }
    draw(); m.appendChild(list);
    var addWrap = el('div', { style: 'display:flex;gap:8px' });
    var addInput = el('input', { type: 'text', placeholder: 'Nama kategori baru', style: 'flex:1' });
    var addBtn = el('button', { class: 'sesd-btn sesd-btn-primary', html: ic('check') + ' Tambah' });
    function doAdd() {
      var name = addInput.value.trim(); if (!name) return;
      if (cats.some(function (c) { return (c.name || '').trim().toLowerCase() === name.toLowerCase(); })) { toast('Kategori sudah ada', 'error'); return; }
      withLoading(addBtn, async function () {
        var res = await DB.createCategory({ name: name });
        cats.push({ id: res && (res.id != null ? res.id : (res.category && res.category.id)), name: name });
        addInput.value = ''; draw(); toast('Kategori ditambahkan', 'success'); reloadData();
      });
    }
    addBtn.addEventListener('click', doAdd);
    addInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    addWrap.appendChild(addInput); addWrap.appendChild(addBtn); m.appendChild(addWrap);
    var closeBtn = el('button', { class: 'sesd-btn sesd-btn-ghost', style: 'width:100%;margin-top:12px' }, 'Tutup');
    closeBtn.addEventListener('click', function () { ov.remove(); });
    m.appendChild(closeBtn);
    ov.appendChild(m); document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  }

  // Lightbox gambar aset (klik gambar = lihat ukuran penuh, Esc/klik = tutup).
  function openImagePopup(imgSrc, caption) {
    if (!imgSrc || imgSrc === PLACEHOLDER || $('.sesd-lightbox')) return;
    var ov = el('div', { class: 'sesd-lightbox', role: 'dialog', 'aria-label': 'Pratinjau gambar' });
    var img = el('img', { src: imgSrc, alt: caption || 'Gambar aset' });
    img.onerror = function () { ov.remove(); };
    ov.appendChild(img);
    if (caption) ov.appendChild(el('div', { class: 'sesd-lightbox-cap' }, caption));
    var onKey = function (e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', onKey); } };
    ov.addEventListener('click', function () { ov.remove(); document.removeEventListener('keydown', onKey); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  }

  function openAssetDetail(r) {
    if (modalOpen()) return;
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:520px' });
    var dImg = el('img', { src: r.image || PLACEHOLDER, style: 'width:100%;height:180px;object-fit:cover;border-radius:12px;background:linear-gradient(135deg,#eef4fb,#e3f0fb);cursor:pointer' });
    dImg.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    dImg.addEventListener('click', function () { openImagePopup(dImg.src, (r.name || '') + (r.brand ? ' · ' + r.brand : '')); });
    m.appendChild(dImg);
    m.appendChild(el('div', { style: 'font-family:"JetBrains Mono",monospace;font-size:.72rem;color:var(--text-muted);margin-top:.75rem' }, r.code || ''));
    m.appendChild(el('h3', { style: 'font-size:1.3rem;font-weight:800;margin:2px 0' }, r.name || ''));
    m.appendChild(el('p', { style: 'color:var(--text-muted);font-size:.85rem;margin-bottom:1rem' }, r.brand || ''));
    var grid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:1rem' });
    [['Kategori', r.category], ['Ruangan', r.room], ['Tahun', r.year], ['Kondisi', r.condition], ['Jenis', r.type], ['Tipe', r.asset_type]].forEach(function (kv) {
      var box = el('div', { style: 'background:var(--bg);border-radius:10px;padding:.6rem .75rem' });
      box.appendChild(el('div', { style: 'font-size:.66rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:.5px' }, kv[0]));
      box.appendChild(el('div', { style: 'font-size:.85rem;font-weight:600;margin-top:2px' }, (kv[1] != null && kv[1] !== '') ? String(kv[1]) : '-'));
      grid.appendChild(box);
    });
    m.appendChild(grid);
    var stock = el('div', { style: 'display:flex;gap:.6rem;margin-bottom:1rem' });
    [['Total', r.stock_total, 'var(--text)'], ['Tersedia', r.stock_available, 'rgb(16,185,129)'], ['Dipinjam', r.stock_borrowed, 'rgb(245,158,11)']].forEach(function (s) {
      var b = el('div', { style: 'flex:1;text-align:center;background:var(--bg);border-radius:10px;padding:.6rem' });
      b.appendChild(el('div', { style: 'font-size:1.2rem;font-weight:800;color:' + s[2] }, String(s[1] != null ? s[1] : 0)));
      b.appendChild(el('div', { style: 'font-size:.7rem;color:var(--text-muted)' }, s[0]));
      stock.appendChild(b);
    });
    m.appendChild(stock);
    var foot = el('div', { style: 'display:flex;gap:8px' });
    var ajukan = el('button', { class: 'sesd-btn sesd-btn-success', style: 'flex:1', html: ic('clipboard') + ' Ajukan Pinjam' });
    ajukan.addEventListener('click', function () { location.href = 'ajukanpinjam.html'; });
    var close = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Tutup');
    close.addEventListener('click', function () { ov.remove(); });
    foot.appendChild(ajukan); foot.appendChild(close); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  }
  function enhanceAssetCard(card, rec) {
    // Prevent duplicate buttons
    if (card.querySelector('.sesd-admin-actions')) return;

    var bar = el('div', { class: 'sesd-admin-actions', style: 'padding:0 1rem 1rem' });
    var edit = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-ghost', html: ic('pencil') + ' Edit' });
    var del = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger', html: ic('trash') + ' Hapus' });
    edit.addEventListener('click', function (e) { e.stopPropagation(); openAssetForm(rec); });
    del.addEventListener('click', function (e) { e.stopPropagation(); confirmDelete('aset "' + rec.name + '"', async function () { await DB.deleteAsset(rec.id); toast('Aset dihapus', 'success'); reloadData(); }); });
    bar.appendChild(edit); bar.appendChild(del); card.appendChild(bar);
  }

  /* ---- grouped asset view: many identical items (same name+category) collapse
          into one tidy card, while each physical unit stays individual in the DB ---- */
  function groupAssets(list) {
    var map = {}, order = [];
    list.forEach(function (a) {
      // group by name + MEREK: units sharing the same (nama, merk) form one jenis
      // card and share ONE image (per user request, aligned with daftar aset 2026).
      var key = (a.name || '').trim().toLowerCase() + '|' + (a.brand || '').trim().toLowerCase();
      var g = map[key];
      if (!g) { g = map[key] = { name: a.name, category: a.category, brand: a.brand, room: a.room, type: a.type, condition: a.condition, image: a.image, units: [], stock_total: 0, stock_available: 0, stock_borrowed: 0 }; order.push(key); }
      g.units.push(a);
      g.stock_total += (a.stock_total != null ? a.stock_total : 1);
      g.stock_available += (a.stock_available || 0);
      g.stock_borrowed += (a.stock_borrowed || 0);
      if (!g.image && a.image) g.image = a.image;
      if (g.category && a.category && g.category !== a.category) g.category = 'Beragam';
      if (g.room && a.room && g.room !== a.room) g.room = 'Beberapa ruangan';
    });
    return order.map(function (k) {
      var g = map[k];
      g.available = g.stock_available;
      g.code = g.units.length > 1 ? (g.units.length + ' unit') : (g.units[0].code || '');
      return g;
    }).sort(function (x, y) { return (x.name || '').localeCompare(y.name || ''); });
  }
  function openGroupDetail(g) {
    if (modalOpen()) return;
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:560px' });
    m.appendChild(el('h3', {}, g.name || 'Aset'));
    if (g.brand) {   // merk = badge tersendiri di bawah judul, bukan bagian teks nama
      var mrow = el('div', { style: 'margin:-4px 0 8px' });
      mrow.appendChild(el('span', { class: 'sesd-aset-merk' }, g.brand));
      m.appendChild(mrow);
    }
    m.appendChild(el('div', { style: 'color:var(--text-muted);font-size:.82rem;margin:-2px 0 12px' }, g.category || '-'));
    var sum = el('div', { style: 'display:flex;gap:.6rem;margin-bottom:1rem' });
    [['Total', g.stock_total, 'var(--text)'], ['Tersedia', g.stock_available, 'rgb(16,185,129)'], ['Dipinjam', g.stock_borrowed, 'rgb(245,158,11)']].forEach(function (s) {
      var b = el('div', { style: 'flex:1;text-align:center;background:var(--bg);border-radius:10px;padding:.6rem' });
      b.appendChild(el('div', { style: 'font-size:1.2rem;font-weight:800;color:' + s[2] }, String(s[1] != null ? s[1] : 0)));
      b.appendChild(el('div', { style: 'font-size:.7rem;color:var(--text-muted)' }, s[0]));
      sum.appendChild(b);
    });
    m.appendChild(sum);
    // one image per jenis — semua role bisa melihatnya (klik = ukuran penuh);
    // hanya admin yang mendapat tombol Ganti Gambar
    var imgRow = el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px;border:1px solid var(--border);border-radius:12px;background:var(--bg)' });
    var thumb = el('img', { src: g.image || PLACEHOLDER, alt: g.name || '', class: 'sesd-img-zoom', title: 'Klik untuk melihat gambar penuh', style: 'width:76px;height:50px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--bg-mid)' });
    thumb.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    thumb.addEventListener('click', function () { openImagePopup(thumb.src, (g.name || '') + (g.brand ? ' · ' + g.brand : '')); });
    var imgInfo = el('div', { style: 'flex:1;min-width:0' });
    imgInfo.appendChild(el('div', { style: 'font-size:.8rem;font-weight:700' }, 'Gambar jenis ini'));
    imgInfo.appendChild(el('div', { style: 'font-size:.7rem;color:var(--text-muted)' }, IS_ADMIN ? ('Satu gambar untuk semua ' + g.units.length + ' unit') : 'Klik gambar untuk melihat ukuran penuh'));
    imgRow.appendChild(thumb); imgRow.appendChild(imgInfo);
    if (IS_ADMIN) {
      var gbtn = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-primary', html: ic('pencil') + ' Ganti Gambar' });
      gbtn.addEventListener('click', function () { openGroupImageModal(g, function (url) { thumb.src = url; }); });
      imgRow.appendChild(gbtn);
    }
    m.appendChild(imgRow);
    m.appendChild(el('div', { style: 'font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px' }, 'Pilih unit untuk dipinjam (' + g.units.length + ' terdaftar)'));
    var selected = {};
    var ajukan = el('button', { class: 'sesd-btn sesd-btn-success', style: 'flex:1' });
    function refreshAjukan() {
      var n = Object.keys(selected).length;
      if (n) { ajukan.removeAttribute('disabled'); ajukan.style.opacity = '1'; ajukan.style.cursor = 'pointer'; ajukan.innerHTML = ic('clipboard') + ' Ajukan Pinjam (' + n + ')'; }
      else { ajukan.setAttribute('disabled', ''); ajukan.style.opacity = '0.55'; ajukan.style.cursor = 'not-allowed'; ajukan.innerHTML = ic('clipboard') + ' Pilih unit untuk dipinjam'; }
    }
    var listWrap = el('div', { style: 'max-height:280px;overflow:auto;border:1px solid var(--border);border-radius:12px' });
    g.units.forEach(function (u) {
      var avail = (u.stock_available || 0) > 0;
      var row = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:.55rem .75rem;border-top:1px solid var(--border)' + (avail ? ';cursor:pointer' : '') });
      if (avail) {
        var box = el('div', { style: 'width:20px;height:20px;border-radius:6px;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff' });
        var toggle = function () {
          if (selected[u.id]) { delete selected[u.id]; box.style.background = 'transparent'; box.style.borderColor = 'var(--border)'; box.innerHTML = ''; row.style.background = ''; }
          else { selected[u.id] = u; box.style.background = 'var(--primary)'; box.style.borderColor = 'var(--primary)'; box.innerHTML = ic('check'); row.style.background = 'var(--primary-light)'; }
          refreshAjukan();
        };
        box.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
        row.addEventListener('click', function (e) { if (e.target.closest('button')) return; toggle(); });
        row.appendChild(box);
      } else { row.appendChild(el('div', { style: 'width:20px;flex-shrink:0' })); }
      var info = el('div', { style: 'flex:1;min-width:0' });
      var line1 = el('div', { style: 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap' });
      line1.appendChild(el('span', { style: 'font-family:"JetBrains Mono",monospace;font-size:.75rem;font-weight:700' }, u.code || '-'));
      if (u.brand) line1.appendChild(el('span', { style: 'font-size:.78rem;font-weight:600;color:var(--text)' }, u.brand));
      info.appendChild(line1);
      info.appendChild(el('div', { style: 'font-size:.7rem;color:var(--text-muted)' }, (u.condition || 'Baik') + ' · ' + (avail ? 'Tersedia' : 'Dipinjam') + (u.qr_code ? (' · ' + u.qr_code) : '')));
      row.appendChild(info);
      var qrBtn = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-ghost', html: ic('tag') + ' QR' });
      qrBtn.addEventListener('click', function (e) { e.stopPropagation(); if (window.SESDIAN_QR) { ov.remove(); window.SESDIAN_QR.showFor(u); } else { toast('Modul QR belum siap', 'error'); } });
      row.appendChild(qrBtn);
      if (IS_ADMIN) {
        var edit = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-ghost', html: ic('pencil') });
        edit.addEventListener('click', function (e) { e.stopPropagation(); ov.remove(); openAssetForm(u); });
        var del = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger', html: ic('trash') });
        del.addEventListener('click', function (e) { e.stopPropagation(); ov.remove(); confirmDelete('aset "' + (u.code || u.name) + '"', async function () { await DB.deleteAsset(u.id); toast('Aset dihapus', 'success'); reloadData(); }); });
        row.appendChild(edit); row.appendChild(del);
      }
      listWrap.appendChild(row);
    });
    m.appendChild(listWrap);
    var dateWrap = el('div', { style: 'margin-top:.85rem' });
    dateWrap.appendChild(el('label', { style: 'font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px' }, 'Tanggal Jatuh Tempo Kembali (wajib)'));
    var dateInput = el('input', { type: 'date', value: '', min: todayISO(), style: 'width:100%;padding:.6rem .8rem;border:1.5px solid var(--border);border-radius:10px;font-size:.875rem;outline:none;box-sizing:border-box' });
    dateWrap.appendChild(dateInput); m.appendChild(dateWrap);
    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    ajukan.addEventListener('click', async function () {
      var ids = Object.keys(selected);
      if (!ids.length) { toast('Pilih unit yang ingin dipinjam', 'error'); return; }
      if (!dateInput.value) { toast('Tanggal jatuh tempo kembali wajib diisi', 'error'); dateInput.focus(); return; }
      ajukan.disabled = true;
      try {
        for (var i = 0; i < ids.length; i++) await DB.requestBorrowing({ assetId: parseInt(ids[i], 10), qty: 1, dueDate: dateInput.value, notes: null });
        toast('Pengajuan ' + ids.length + ' unit terkirim', 'success');
        ov.remove();
        if (page() === 'ajukanpinjam') setTimeout(function () { location.href = 'daftarpinjam.html'; }, 600); else reloadData();
      } catch (e) { if (e && e.status === 401) { location.replace('login.html'); return; } toast((e && e.message) || 'Gagal mengirim pengajuan', 'error'); ajukan.disabled = false; }
    });
    var close = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Tutup');
    close.addEventListener('click', function () { ov.remove(); });
    foot.appendChild(ajukan); foot.appendChild(close); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    refreshAjukan();
  }

  /* ---- Sedang Dipinjam: per-user view (staff) + own items (user) ---- */
  function borrowedItemRow(b, staff, onChange) {
    var row = el('div', { style: 'display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:0.7rem 1rem;box-shadow:var(--shadow)' });
    var info = el('div', { style: 'flex:1;min-width:0' });
    info.appendChild(el('div', { style: 'font-weight:700;font-size:0.9rem' }, b.asset_name || '-'));
    var st = STATUS[b.status] ? STATUS[b.status].label : b.status;
    info.appendChild(el('div', { style: 'font-size:0.72rem;color:var(--text-muted)' }, (b.asset_code ? b.asset_code + ' · ' : '') + st + (b.due_date ? ' · jatuh tempo ' + String(b.due_date).slice(0, 10) : '')));
    row.appendChild(info);
    if (staff) {
      var verify = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-success' }, b.status === 'return_pending' ? 'Verifikasi Dikembalikan' : 'Tandai Dikembalikan');
      verify.addEventListener('click', function () {
        confirmAction({ title: 'Verifikasi Pengembalian', message: 'Konfirmasi bahwa barang "' + (b.asset_name || 'ini') + '" sudah benar-benar dikembalikan?', variant: 'success', confirmLabel: 'Ya, sudah kembali' }, async function () {
          await DB.updateBorrowingStatus(b.id, 'returned'); toast('Diverifikasi dikembalikan', 'success'); if (onChange) onChange(b);
        });
      });
      row.appendChild(verify);
    } else if (b.status === 'borrowed' || b.status === 'verified') {
      var conf = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-primary' }, 'Konfirmasi Pengembalian');
      conf.addEventListener('click', function () { changeStatus(b, 'return_pending'); });
      row.appendChild(conf);
    } else { row.appendChild(el('span', { style: 'font-size:0.75rem;color:var(--text-muted)' }, 'Menunggu verifikasi admin')); }
    return row;
  }
  function openUserBorrowedModal(name, items) {
    if (modalOpen()) return;
    var changed = false;
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:560px' });
    m.appendChild(el('h3', {}, name || 'Peminjam'));
    var subtitle = el('div', { style: 'color:var(--text-muted);font-size:.82rem;margin:-6px 0 12px' }, items.length + ' barang sedang dipinjam');
    m.appendChild(subtitle);
    var listWrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px;max-height:340px;overflow:auto' });
    function onChange(b) {
      changed = true;
      var idx = items.indexOf(b); if (idx !== -1) items.splice(idx, 1);
      subtitle.textContent = items.length + ' barang sedang dipinjam';
      draw();
      if (!items.length) { ov.remove(); reloadData(); }
    }
    function draw() { listWrap.innerHTML = ''; items.forEach(function (b) { listWrap.appendChild(borrowedItemRow(b, true, onChange)); }); }
    draw();
    m.appendChild(listWrap);
    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    var close = el('button', { class: 'sesd-btn sesd-btn-ghost', style: 'flex:1' }, 'Tutup');
    close.addEventListener('click', function () { ov.remove(); if (changed) reloadData(); });
    foot.appendChild(close); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) { ov.remove(); if (changed) reloadData(); } });
  }
  function renderDipinjam(out) {
    var root = $('[data-dipinjam]'); if (!root) return;
    root.innerHTML = '';
    if (!out.length) { appendEmpty(root, 'Tidak ada barang yang sedang dipinjam.'); return; }
    if (IS_STAFF) {
      var byUser = {}, order = [];
      out.forEach(function (b) { var k = b.borrower || '-'; if (!byUser[k]) { byUser[k] = []; order.push(k); } byUser[k].push(b); });
      root.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem';
      order.forEach(function (name) {
        var items = byUser[name];
        var waiting = items.filter(function (b) { return b.status === 'return_pending'; }).length;
        var card = el('div', { style: 'background:#fff;border-radius:16px;border:1px solid var(--border);box-shadow:var(--shadow);padding:1.1rem;cursor:pointer;transition:transform .15s' });
        card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-3px)'; });
        card.addEventListener('mouseleave', function () { card.style.transform = 'none'; });
        card.addEventListener('click', function () { openUserBorrowedModal(name, items.slice()); });
        var head = el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:8px' });
        head.appendChild(el('div', { style: 'width:40px;height:40px;border-radius:11px;flex-shrink:0;background:linear-gradient(135deg,rgb(99,102,241),rgb(139,92,246));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.8rem' }, initials(name)));
        head.appendChild(el('div', { style: 'font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, name));
        card.appendChild(head);
        card.appendChild(el('div', { style: 'font-size:0.8rem;color:var(--text-muted)' }, items.length + ' barang' + (waiting ? (' · ' + waiting + ' menunggu verifikasi') : '')));
        root.appendChild(card);
      });
    } else {
      root.style.cssText = 'display:flex;flex-direction:column;gap:8px';
      out.forEach(function (b) { root.appendChild(borrowedItemRow(b, false)); });
    }
  }

  function openCategoryForm(rec) {
    overlayForm({
      title: rec ? 'Edit Kategori' : 'Tambah Kategori', submitLabel: rec ? 'Simpan' : 'Tambah',
      fields: [
        { name: 'name', label: 'Nama Kategori', value: rec && rec.name },
        { name: 'icon', label: 'Ikon', type: 'select', value: iconFor(rec && rec.icon) || 'package',
          options: ['package', 'monitor', 'chair', 'car', 'wrench', 'file', 'tag', 'archive', 'home', 'building', 'phone'].map(function (k) { return { value: k, label: k }; }) },
      ],
      onSave: async function (v) { if (!v.name) throw new Error('Nama wajib diisi'); if (rec) await DB.updateCategory(rec.id, v); else await DB.createCategory(v); toast('Tersimpan', 'success'); reloadData(); },
    });
  }
  function openRoomForm(rec) {
    overlayForm({
      title: rec ? 'Edit Ruangan' : 'Tambah Ruangan', submitLabel: rec ? 'Simpan' : 'Tambah',
      fields: [{ name: 'name', label: 'Nama Ruangan', value: rec && rec.name }, { name: 'code', label: 'Kode', value: rec && rec.code }, { name: 'pic', label: 'Penanggung Jawab', value: rec && rec.pic }],
      onSave: async function (v) { if (!v.name) throw new Error('Nama wajib diisi'); if (rec) await DB.updateRoom(rec.id, v); else await DB.createRoom(v); toast('Tersimpan', 'success'); reloadData(); },
    });
  }
  // Merge an asset's current fields with a change set. The assets PATCH overwrites
  // category_id/brand/room_id/year when they're absent, so a partial update must
  // resend everything it wants to keep.
  function assetPatch(a, changes) {
    return Object.assign({
      code: a.code, name: a.name, category_id: a.category_id, brand: a.brand,
      room_id: a.room_id, year: a.year, condition: a.condition, type: a.type,
      asset_type: a.asset_type, stock_total: a.stock_total,
    }, changes || {});
  }
  function roomCatalogUrl(room) {
    var origin = location.origin + location.pathname.replace(/[^/]*$/, '');
    return origin + 'katalog.html?room=' + encodeURIComponent(room.name || '');
  }
  // #10 — QR that opens the room's public catalog (what's inside the room).
  async function showRoomQR(room) {
    if (!window.SESDIAN_QR) { toast('Modul QR belum siap', 'error'); return; }
    // opens ON TOP of the room-detail modal, so only block a duplicate QR dialog
    if (document.querySelector('.sesd-qr-overlay')) return;
    var url = roomCatalogUrl(room);
    var ov = overlay(); ov.classList.add('sesd-qr-overlay'); ov.style.zIndex = '10001';
    var m = el('div', { class: 'sesd-modal', style: 'width:340px;text-align:center' });
    m.appendChild(el('h3', {}, 'QR Ruangan'));
    var holder = el('div', { style: 'display:flex;align-items:center;justify-content:center;min-height:160px' });
    holder.innerHTML = '<div class="sesd-page-loader" style="min-height:0"><span></span><span></span><span></span></div>';
    m.appendChild(holder);
    m.appendChild(el('div', { style: 'font-weight:700;margin-top:8px' }, room.name || ''));
    m.appendChild(el('div', { style: 'font-size:.72rem;color:var(--text-muted);margin-top:2px' }, 'Scan untuk melihat isi ruangan'));
    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    var printBtn = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'flex:1' }, 'Cetak QR');
    var closeBtn = el('button', { class: 'sesd-btn sesd-btn-ghost' }, 'Tutup');
    foot.appendChild(printBtn); foot.appendChild(closeBtn); m.appendChild(foot);
    ov.appendChild(m); document.body.appendChild(ov);
    closeBtn.addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    var dataUrl = '';
    try { await window.SESDIAN_QR.ensure(); dataUrl = window.SESDIAN_QR.dataUrl(url); holder.innerHTML = '<img src="' + dataUrl + '" style="width:200px;height:200px;image-rendering:pixelated">'; }
    catch (e) { holder.textContent = 'Gagal memuat QR (perlu internet).'; }
    printBtn.addEventListener('click', function () {
      if (!dataUrl) return;
      var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      var w = window.open('', '_blank', 'width=420,height=560'); if (!w) return;
      w.document.write('<html><head><title>QR ' + esc(room.name || 'Ruangan') + '</title></head><body style="font-family:sans-serif;text-align:center;padding:24px" onload="window.print()"><img src="' + dataUrl + '" style="width:240px;height:240px;image-rendering:pixelated"><div style="font-weight:700;margin-top:10px;font-size:15px">' + esc(room.name || '') + '</div><div style="font-size:12px;color:#555;margin-top:2px">Isi ruangan</div></body></html>');
      w.document.close();
    });
  }
  // #9 — room detail: everyone sees what's in the room; admin adds/removes items.
  async function openRoomDetail(room) {
    if (modalOpen()) return;
    // build the modal immediately (with a loader) so rapid clicks can't open
    // several instances while the assets are still loading.
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:560px;max-height:90vh;overflow:auto' });
    m.appendChild(el('h3', {}, room.name || 'Ruangan'));
    var loader = el('div', { class: 'sesd-page-loader', style: 'min-height:120px', html: '<span></span><span></span><span></span>' });
    m.appendChild(loader);
    ov.appendChild(m); document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    var assets = [];
    try { assets = await DB.assets(); } catch (e) {}
    loader.remove();

    var inRoom = assets.filter(function (a) { return String(a.room_id) === String(room.id); });
    var editing = false;
    var sub = el('div', { style: 'color:var(--text-muted);font-size:.82rem;margin:-6px 0 12px' });
    function setSub() { sub.textContent = (room.code ? room.code + ' · ' : '') + inRoom.length + ' barang' + (room.pic ? (' · PJ: ' + room.pic) : ''); }
    setSub(); m.appendChild(sub);

    var actions = el('div', { style: 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap' });
    actions.appendChild(el('a', { href: roomCatalogUrl(room), class: 'sesd-btn sesd-btn-sm sesd-btn-ghost', html: ic('search') + ' Katalog Ruangan' }));
    var qrBtn = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-ghost', html: ic('tag') + ' QR Ruangan' });
    qrBtn.addEventListener('click', function () { showRoomQR(room); });
    actions.appendChild(qrBtn);
    var editBtn = null, addBox = null, addSearch = null, poolWrap = null;
    if (IS_ADMIN) {
      editBtn = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-primary', html: ic('pencil') + ' Edit Isi' });
      editBtn.addEventListener('click', function () {
        editing = !editing;
        editBtn.innerHTML = editing ? (ic('check') + ' Selesai') : (ic('pencil') + ' Edit Isi');
        editBtn.className = 'sesd-btn sesd-btn-sm ' + (editing ? 'sesd-btn-success' : 'sesd-btn-primary');
        if (addBox) { addBox.style.display = editing ? 'block' : 'none'; if (editing) drawPool(); }
        drawList();
      });
      actions.appendChild(editBtn);
    }
    m.appendChild(actions);

    // roomier add-item panel: a persistent search + scrollable list of "Tambah" rows
    // (replaces the cramped dropdown that was hard to read/navigate).
    function drawPool() {
      if (!poolWrap) return;
      var q = (addSearch.value || '').trim().toLowerCase();
      var pool = assets.filter(function (a) { return String(a.room_id) !== String(room.id); })
        .filter(function (a) { var s = ((a.name || '') + ' ' + (a.code || '')).toLowerCase(); return !q || s.indexOf(q) !== -1; }).slice(0, 80);
      poolWrap.innerHTML = '';
      if (!pool.length) { poolWrap.appendChild(el('div', { style: 'padding:.9rem;text-align:center;color:var(--text-muted);font-size:.82rem' }, q ? 'Tidak ada barang yang cocok' : 'Semua barang sudah ada di ruangan ini')); return; }
      pool.forEach(function (a) {
        var row = el('div', { style: 'display:flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:9px;padding:.5rem .7rem' });
        var info = el('div', { style: 'flex:1;min-width:0' });
        info.appendChild(el('div', { style: 'font-weight:600;font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, a.name || '-'));
        info.appendChild(el('div', { style: 'font-size:.7rem;color:var(--text-muted);font-family:"JetBrains Mono",monospace' }, (a.code || '') + (a.room ? (' · di ' + a.room) : ' · tanpa ruangan')));
        row.appendChild(info);
        var addBtn = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-primary' }, 'Tambah');
        addBtn.addEventListener('click', function () {
          addBtn.disabled = true;
          DB.updateAsset(a.id, assetPatch(a, { room_id: room.id })).then(function () {
            a.room_id = room.id; a.room = room.name; inRoom.push(a); setSub(); drawList(); drawPool(); toast('Barang ditambahkan', 'success'); reloadData();
          }).catch(function (e) { toast((e && e.message) || 'Gagal menambahkan', 'error'); addBtn.disabled = false; });
        });
        row.appendChild(addBtn); poolWrap.appendChild(row);
      });
    }
    if (IS_ADMIN) {
      addBox = el('div', { style: 'display:none;margin-bottom:12px;border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--bg-mid)' });
      addBox.appendChild(el('div', { style: 'font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px' }, 'Tambahkan barang ke ruangan'));
      addSearch = el('input', { type: 'search', placeholder: 'Cari barang (nama atau kode)', style: 'width:100%;margin-bottom:8px' });
      addSearch.addEventListener('input', drawPool);
      poolWrap = el('div', { class: 'sesd-scroll', style: 'max-height:240px;overflow:auto;display:flex;flex-direction:column;gap:6px' });
      addBox.appendChild(addSearch); addBox.appendChild(poolWrap);
      m.appendChild(addBox);
    }

    var listWrap = el('div', { class: 'sesd-scroll', style: 'max-height:280px;overflow:auto;border:1px solid var(--border);border-radius:12px;margin-bottom:12px' });
    function itemRow(a) {
      var row = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:.55rem .75rem;border-top:1px solid var(--border)' });
      var info = el('div', { style: 'flex:1;min-width:0' });
      info.appendChild(el('div', { style: 'font-weight:600;font-size:.85rem' }, a.name || '-'));
      info.appendChild(el('div', { style: 'font-size:.72rem;color:var(--text-muted);font-family:"JetBrains Mono",monospace' }, (a.code || '') + (a.brand ? (' · ' + a.brand) : '')));
      row.appendChild(info);
      if (IS_ADMIN && editing) {
        var rm = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger', html: ic('x') + ' Keluarkan' });
        rm.addEventListener('click', function () {
          confirmAction({ title: 'Keluarkan Barang', message: 'Keluarkan "' + a.name + '" dari ' + (room.name || 'ruangan ini') + '?', variant: 'danger', confirmLabel: 'Ya, keluarkan' }, async function () {
            await DB.updateAsset(a.id, assetPatch(a, { room_id: null }));
            inRoom = inRoom.filter(function (x) { return x.id !== a.id; }); a.room_id = null;
            setSub(); drawList(); drawPool(); toast('Barang dikeluarkan', 'success'); reloadData();
          });
        });
        row.appendChild(rm);
      }
      return row;
    }
    function drawList() { listWrap.innerHTML = ''; if (!inRoom.length) listWrap.appendChild(el('div', { style: 'padding:1rem;text-align:center;color:var(--text-muted);font-size:.85rem' }, 'Belum ada barang di ruangan ini.')); else inRoom.forEach(function (a) { listWrap.appendChild(itemRow(a)); }); }
    drawList(); m.appendChild(listWrap);

    var closeBtn = el('button', { class: 'sesd-btn sesd-btn-ghost', style: 'width:100%' }, 'Tutup');
    closeBtn.addEventListener('click', close);
    m.appendChild(closeBtn);
  }

  function enhanceSimpleCard(card, rec, kind) {
    // Prevent duplicate buttons
    if (card.querySelector('.sesd-admin-actions')) return;

    var bar = el('div', { class: 'sesd-admin-actions', style: 'margin-top:10px' });
    var edit = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-ghost', html: ic('pencil') + ' Edit' });
    var del = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger', html: ic('trash') + ' Hapus' });
    edit.addEventListener('click', function (e) { e.stopPropagation(); kind === 'category' ? openCategoryForm(rec) : openRoomForm(rec); });
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      confirmDelete((kind === 'category' ? 'kategori "' : 'ruangan "') + rec.name + '"', async function () {
        if (kind === 'category') await DB.deleteCategory(rec.id); else await DB.deleteRoom(rec.id);
        toast('Dihapus', 'success'); reloadData();
      });
    });
    bar.appendChild(edit); bar.appendChild(del); card.appendChild(bar);
  }

  function ensureAksiHeader() {
    var tr = $('thead tr'); if (!tr || tr.querySelector('[data-aksi-th]')) return;
    var th0 = tr.querySelector('th');
    tr.appendChild(el('th', { 'data-aksi-th': '', style: th0 ? th0.getAttribute('style') : 'padding:0.875rem 1rem;text-align:left' }, 'Aksi'));
  }
  function todayISO() { var d = new Date(); var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function isOverdue(rec) { return ['pending', 'approved', 'borrowed'].indexOf(rec.status) !== -1 && rec.due_date && rec.due_date < todayISO(); }
  function openWaLink(wa, text) { if (wa) window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text || ''), '_blank'); }
  async function doNotify(rec, kind, okMsg) {
    try {
      var r = await DB.notify(rec.id, kind);
      if (r && !r.auto) { if (r.wa) openWaLink(r.wa, r.text); else { toast('Nomor WhatsApp tujuan belum tersedia', 'error'); return; } }
      toast(okMsg, 'success');
    } catch (e) { toast((e && e.message) || 'Gagal mengirim notifikasi', 'error'); }
  }
  var STATUS_CONFIRM = {
    approved:       { title: 'Setujui Peminjaman',      message: 'Apakah Anda yakin menyetujui peminjaman ini? (Verifikasi 1)', variant: 'success', confirmLabel: 'Ya, setujui' },
    borrowed:       { title: 'Verifikasi & Serah Terima', message: 'Verifikasi kedua dan serahkan barang ke peminjam?',            variant: 'success', confirmLabel: 'Ya, verifikasi' },
    returned:       { title: 'Verifikasi Pengembalian',  message: 'Konfirmasi bahwa barang sudah benar-benar dikembalikan?',       variant: 'success', confirmLabel: 'Ya, sudah kembali' },
    return_pending: { title: 'Konfirmasi Pengembalian',  message: 'Ajukan pengembalian barang ini ke admin?',                     variant: 'primary', confirmLabel: 'Ya, kembalikan' },
    rejected:       { title: 'Tolak Permintaan',         message: 'Apakah Anda yakin menolak permintaan ini?',                    variant: 'danger',  confirmLabel: 'Ya, tolak' },
  };
  // #8 — every status change asks for a second confirmation before it runs.
  function changeStatus(rec, status) {
    var c = STATUS_CONFIRM[status] || { title: 'Konfirmasi', message: 'Apakah Anda yakin ingin melanjutkan?' };
    confirmAction(c, async function () {
      await DB.updateBorrowingStatus(rec.id, status); toast('Status diperbarui', 'success');
      if (status === 'returned') { DB.notify(rec.id, 'returned').then(function (r) { if (r && !r.auto && r.wa) openWaLink(r.wa, r.text); }).catch(function () {}); } // best-effort, silent
      else if (status === 'return_pending') { DB.notify(rec.id, 'return-request').catch(function () {}); }                                                                  // notify admin (auto-send if gateway set)
      reloadData();
    });
  }
  function enhanceBorrowingRow(row, rec) {
    // Prevent duplicate buttons
    if (row.querySelector('.sesd-admin-actions')) return;

    if (isOverdue(rec)) { var dd = $('[data-bind="due_date"]', row); if (dd) { dd.style.color = 'var(--danger)'; dd.style.fontWeight = '700'; } }
    var cell = el('td', { style: 'padding:0.875rem 1rem' });           // dedicated Aksi cell (never the date cell)
    var bar = el('div', { class: 'sesd-admin-actions' });
    var btns = [];
    // Dual verification: pending --admin--> approved --verifikator--> verified --staff--> borrowed --staff--> returned
    if (IS_STAFF) {
      if (IS_ADMIN && rec.status === 'pending') { btns.push(['Setujui (Verifikasi 1)', 'success', function () { changeStatus(rec, 'approved'); }], ['Tolak', 'danger', function () { changeStatus(rec, 'rejected'); }]); }
      else if (IS_VERIFIKATOR && rec.status === 'approved') { btns.push(['Verifikasi (Verifikasi 2)', 'success', function () { changeStatus(rec, 'borrowed'); }], ['Tolak', 'danger', function () { changeStatus(rec, 'rejected'); }]); }
      else if (rec.status === 'borrowed' || rec.status === 'verified') { btns.push(['Kembalikan', 'success', function () { changeStatus(rec, 'returned'); }]); }
      else if (rec.status === 'return_pending') { btns.push(['Verifikasi Pengembalian', 'success', function () { changeStatus(rec, 'returned'); }], ['Tolak', 'danger', function () { changeStatus(rec, 'borrowed'); }]); }
      else if (IS_ADMIN && rec.status === 'approved') { cell._note = 'Menunggu verifikator'; }
      if (isOverdue(rec) && (rec.status === 'borrowed' || rec.status === 'verified')) btns.unshift(['Ingatkan WA', 'warning', function () { return doNotify(rec, 'remind', 'Pengingat dikirim ke peminjam'); }]);
    } else if (rec.status === 'borrowed' || rec.status === 'verified') {
      btns.push(['Konfirmasi Pengembalian', 'primary', function () { changeStatus(rec, 'return_pending'); }]);
    } else if (rec.status === 'return_pending') {
      cell._note = 'Menunggu verifikasi admin';
    }
    if (!btns.length) cell.appendChild(el('span', { style: 'color:var(--text-muted);font-size:.78rem' }, cell._note || '-'));
    btns.forEach(function (a) {
      var b = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-' + a[1] }, a[0]);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var r = a[2]();
        // async actions without a confirm dialog (e.g. Ingatkan WA) lock their
        // button until they settle, so a slow network can't queue duplicate sends
        if (r && typeof r.then === 'function') { b.disabled = true; r.then(function () { b.disabled = false; }, function () { b.disabled = false; }); }
      });
      bar.appendChild(b);
    });
    if (btns.length) cell.appendChild(bar);
    row.appendChild(cell);
  }

  var ROLE_META = {
    admin: ['Admin', 'shield', '#e3f0fb', '#005bab'],
    verifikator: ['Verifikator', 'check_circle', '#daf0ef', '#1c6e6a'],
    user: ['User', 'user', '#eceae7', '#615d59'],
  };
  function roleBadge(role) {
    var m = ROLE_META[role] || ROLE_META.user;
    return el('span', { class: 'sesd-role', style: 'background:' + m[2] + ';color:' + m[3], html: ic(m[1]) + ' ' + m[0] });
  }
  async function renderUsers() {
    var list = $('[data-users-list]'); if (!list) return;
    var users = [];
    try { users = await (DB.usersFresh ? DB.usersFresh() : DB.users()); } catch (e) { if (e && e.status === 401) { location.replace('login.html'); return; } toast((e && e.message) || 'Gagal memuat user', 'error'); }
    var cnt = $('[data-users-count]'); if (cnt) cnt.textContent = users.length;
    list.innerHTML = '';
    if (!users.length) { appendEmpty(list); return; }
    var td = 'padding:0.875rem 1rem;font-size:0.875rem;border-top:1px solid var(--border)';
    users.forEach(function (u) {
      var tr = el('tr');
      var nameTd = el('td', { style: td + ';font-weight:600' });
      if (u.claimed === false) {
        // akun berisi NIP saja: pemiliknya belum mengatur nama & password
        nameTd.appendChild(el('span', { style: 'color:var(--text-muted);font-style:italic;font-weight:500' }, u.name || 'Belum diatur'));
        nameTd.appendChild(el('span', { style: 'margin-left:8px;font-size:0.62rem;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:0.14rem 0.5rem;border-radius:999px;background:rgba(221,91,0,0.12);color:var(--warning);white-space:nowrap', title: 'Pemilik NIP belum mengatur nama dan password' }, 'Belum aktif'));
      } else {
        nameTd.textContent = u.name;
      }
      tr.appendChild(nameTd);
      tr.appendChild(el('td', { style: td + ';color:var(--text-muted);font-family:"JetBrains Mono",monospace;font-size:0.8rem' }, u.nip));
      var roleTd = el('td', { style: td });
      roleTd.appendChild(roleBadge(u.role));
      tr.appendChild(roleTd);
      var actTd = el('td', { style: td });
      var wrap = el('div', { class: 'sesd-role-actions' });   // #2 — one cohesive, equally-rounded control group
      var sel = el('select', { class: 'sesd-role-select', 'aria-label': 'Ubah peran ' + u.name, style: 'border-radius:12px!important;-webkit-appearance:none!important;appearance:none!important' });
      ['user', 'verifikator', 'admin'].forEach(function (r) { var o = el('option', { value: r }, ROLE_META[r][0]); if (u.role === r) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', async function () { sel.disabled = true; try { await DB.setUserRole(u.id, sel.value); toast('Role diperbarui', 'success'); renderUsers(); } catch (e) { toast((e && e.message) || 'Gagal', 'error'); renderUsers(); } });
      var del = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger sesd-role-del', html: ic('trash') });
      del.addEventListener('click', function () { confirmDelete('user "' + (u.name || ('NIP ' + u.nip)) + '"', async function () { await DB.deleteUser(u.id); toast('User dihapus', 'success'); renderUsers(); }); });
      wrap.appendChild(sel); wrap.appendChild(del);
      actTd.appendChild(wrap); tr.appendChild(actTd);
      list.appendChild(tr);
    });
  }

  /* ====================== #6 — Profile page ====================== */
  function avatarKeyFor(u) { return 'sesdian_avatar_' + ((u && (u.nip || u.name)) || 'anon'); }
  function getAvatarLS(u) { try { return localStorage.getItem(avatarKeyFor(u)) || ''; } catch (e) { return ''; } }
  function setAvatarLS(u, d) { try { localStorage.setItem(avatarKeyFor(u), d); } catch (e) {} }
  function cropSquare(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2, out = 320;
        var c = el('canvas'); c.width = out; c.height = out;
        c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, out, out);
        try { cb(c.toDataURL('image/webp', 0.85)); } catch (e) { try { cb(c.toDataURL('image/jpeg', 0.85)); } catch (e2) { cb(null); } }
      };
      img.onerror = function () { cb(null); };
      img.src = fr.result;
    };
    fr.onerror = function () { cb(null); };
    fr.readAsDataURL(file);
  }
  function pfCard(title, subtitle) {
    var card = el('div', { class: 'sesd-prof-card' });
    card.appendChild(el('div', { class: 'sesd-prof-card-title' }, title));
    if (subtitle) card.appendChild(el('div', { class: 'sesd-prof-card-sub' }, subtitle));
    return card;
  }
  function pfField(label, input, hint) {
    var w = el('div', { class: 'sesd-field' });
    w.appendChild(el('label', {}, label));
    w.appendChild(input);
    if (hint) w.appendChild(el('div', { style: 'font-size:0.72rem;color:var(--text-muted);margin-top:5px' }, hint));
    return w;
  }
  async function renderProfile() {
    var root = $('[data-profile-root]'); if (!root) return;
    var prof = null;
    try { prof = await DB.profile(); } catch (e) {}
    var u = prof || USER || {};
    var roleLabel = (ROLE_META[u.role] && ROLE_META[u.role][0]) || (u.role || 'user');
    root.innerHTML = '';

    /* hero header */
    var hero = el('div', { class: 'sesd-prof-hero' });
    var avWrap = el('div', { class: 'sesd-prof-av' });
    var av = u.avatar || getAvatarLS(u);       // prefer the server copy so it shows on any device
    if (u.avatar) setAvatarLS(u, u.avatar);    // cache it locally for the rest of the shell
    if (av) avWrap.appendChild(el('img', { src: av, alt: 'Foto profil' }));
    else avWrap.appendChild(el('span', {}, initials(u.name)));
    var camBtn = el('button', { class: 'sesd-prof-av-edit', type: 'button', title: 'Ubah foto profil', html: ic('pencil') });
    var fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    avWrap.appendChild(camBtn); avWrap.appendChild(fileInput);
    hero.appendChild(avWrap);
    var heroInfo = el('div', { style: 'min-width:0;flex:1' });
    heroInfo.appendChild(el('div', { class: 'sesd-prof-name' }, u.name || 'Pengguna'));
    var metaRow = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap' });
    metaRow.appendChild(roleBadge(u.role));
    metaRow.appendChild(el('span', { style: 'font-family:"JetBrains Mono",monospace;font-size:0.78rem;color:var(--text-muted)' }, 'NIP ' + (u.nip || '-')));
    heroInfo.appendChild(metaRow);
    hero.appendChild(heroInfo);
    var logoutBtn = el('button', { class: 'sesd-btn sesd-btn-ghost sesd-prof-logout', html: ic('lock') + ' Keluar' });
    logoutBtn.addEventListener('click', function () { withLoading(logoutBtn, doLogout); });
    hero.appendChild(logoutBtn);
    root.appendChild(hero);

    function applyNewPhoto(dataurl) {
      setAvatarLS(u, dataurl);
      avWrap.innerHTML = '';
      avWrap.appendChild(el('img', { src: dataurl, alt: 'Foto profil' }));
      avWrap.appendChild(camBtn); avWrap.appendChild(fileInput);
      $$('[data-user-initials]').forEach(function (e) { e.innerHTML = '<img alt="" src="' + dataurl + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">'; });
      if (window.SESDIAN_APPLY_AVATAR) window.SESDIAN_APPLY_AVATAR();
      DB.updateProfile({ avatar: dataurl }).catch(function () {});   // persist server-side so it syncs across devices
      toast('Foto profil diperbarui', 'success');
    }
    camBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { if (fileInput.files && fileInput.files[0]) cropSquare(fileInput.files[0], function (d) { if (d) applyNewPhoto(d); else toast('Gagal membaca gambar', 'error'); }); });

    /* two-column body */
    var grid = el('div', { class: 'sesd-prof-grid' });

    /* account info card */
    var info = pfCard('Informasi Akun', 'Perbarui identitas akun Anda.');
    var nameInput = el('input', { type: 'text', value: u.name || '' });
    var nipInput = el('input', { type: 'text', value: u.nip || '', readonly: 'readonly', style: 'font-family:"JetBrains Mono",monospace;opacity:0.75;cursor:not-allowed' });
    var phoneInput = el('input', { type: 'tel', value: u.phone || '', placeholder: 'mis. 0812xxxxxxx' });
    info.appendChild(pfField('Nama Lengkap', nameInput));
    info.appendChild(pfField('NIP', nipInput, 'NIP tidak dapat diubah.'));
    info.appendChild(pfField('Nomor WhatsApp', phoneInput));
    var saveInfo = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'margin-top:auto', html: ic('check') + ' Simpan Perubahan' });
    saveInfo.addEventListener('click', function () {
      withLoading(saveInfo, async function () {
        if (!nameInput.value.trim()) { toast('Nama tidak boleh kosong', 'error'); return; }
        try {
          await DB.updateProfile({ name: nameInput.value.trim(), phone: phoneInput.value.trim() });
          $$('[data-user-name]').forEach(function (e) { e.textContent = nameInput.value.trim(); });
          var hn = root.querySelector('.sesd-prof-name'); if (hn) hn.textContent = nameInput.value.trim();
          toast('Profil disimpan', 'success');
        } catch (e) { toast((e && e.message) || 'Gagal menyimpan profil', 'error'); }
      });
    });
    info.appendChild(saveInfo);
    grid.appendChild(info);

    /* security card */
    var sec = pfCard('Keamanan', 'Ganti password akun secara berkala.');
    var curPw = el('input', { type: 'password', placeholder: 'Password saat ini' });
    var newPw = el('input', { type: 'password', placeholder: 'Min. 8 karakter' });
    var confPw = el('input', { type: 'password', placeholder: 'Ulangi password baru' });
    sec.appendChild(pfField('Password Saat Ini', curPw));
    sec.appendChild(pfField('Password Baru', newPw));
    sec.appendChild(pfField('Konfirmasi Password Baru', confPw));
    var savePw = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'margin-top:auto', html: ic('lock') + ' Perbarui Password' });
    savePw.addEventListener('click', function () {
      withLoading(savePw, async function () {
        if (!newPw.value || newPw.value.length < 8) { toast('Password baru minimal 8 karakter', 'error'); return; }
        if (newPw.value !== confPw.value) { toast('Konfirmasi password tidak cocok', 'error'); return; }
        try {
          await DB.changePassword(curPw.value, newPw.value);
          curPw.value = newPw.value = confPw.value = '';
          toast('Password berhasil diperbarui', 'success');
        } catch (e) { toast((e && e.message) || 'Gagal memperbarui password', 'error'); }
      });
    });
    sec.appendChild(savePw);
    grid.appendChild(sec);

    /* WhatsApp notification number (admin only) — moved here from Kelola User */
    if (IS_ADMIN) {
      var wa = pfCard('Notifikasi WhatsApp', 'Nomor admin yang menerima pemberitahuan saat ada pengajuan peminjaman.');
      var waInput = el('input', { type: 'tel', placeholder: '08xxxxxxxxxx' });
      wa.appendChild(pfField('Nomor WhatsApp Admin', waInput));
      var waStatus = el('div', { style: 'font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;text-align:center' });
      function waNote(s) { waStatus.textContent = s.wa_auto ? 'Auto-kirim via gateway aktif.' : (s.wa_number ? 'Notifikasi dikirim lewat tautan WhatsApp saat user mengajukan.' : 'Belum ada nomor admin.'); }
      DB.getSettings().then(function (s) { waInput.value = s.wa_number || ''; waNote(s); }).catch(function () {});
      var waSave = el('button', { class: 'sesd-btn sesd-btn-primary', style: 'width:100%', html: ic('check') + ' Simpan Nomor' });
      waSave.addEventListener('click', function () {
        withLoading(waSave, async function () {
          try { var r = await DB.setWaNumber(waInput.value); waInput.value = r.wa_number || ''; waNote(r); toast('Nomor WhatsApp disimpan', 'success'); }
          catch (e) { toast((e && e.message) || 'Gagal menyimpan', 'error'); }
        });
      });
      var waBottomWrap = el('div', { style: 'margin-top:auto' });
      waBottomWrap.appendChild(waStatus);
      waBottomWrap.appendChild(waSave);
      wa.appendChild(waBottomWrap);
      grid.appendChild(wa);
    }

    root.appendChild(grid);
  }

  function openUserForm() {
    // Admin hanya mendaftarkan NIP (plus role dan HP). Nama dan password TIDAK
    // bisa diisi admin: pemilik NIP mengaturnya sendiri saat pertama kali masuk
    // (alur "Aktifkan Akun" di halaman login).
    overlayForm({
      title: 'Tambah User', submitLabel: 'Daftarkan NIP',
      desc: 'Admin hanya mendaftarkan NIP. Nama dan password diatur sendiri oleh pemilik NIP saat pertama kali masuk.',
      fields: [
        {
          name: 'nip', label: 'NIP (18 digit)', placeholder: '18 digit angka', maxlength: 18, inputmode: 'numeric',
          hint: function (v) {
            var d = (v || '').replace(/\D/g, '');
            if (!v) return { text: 'Wajib 18 digit angka.', color: 'var(--text-muted)' };
            if (!/^\d+$/.test(v)) return { text: 'NIP hanya boleh berisi angka.', color: '#e03e3e' };
            if (d.length !== 18) return { text: d.length + ' dari 18 digit', color: '#e03e3e' };
            return { text: 'NIP valid (18 digit).', color: '#1aae39' };
          },
        },
        { name: 'role', label: 'Role', type: 'select', value: 'user', options: [{ value: 'user', label: 'User' }, { value: 'verifikator', label: 'Verifikator' }, { value: 'admin', label: 'Admin' }] },
        { name: 'phone', label: 'No. HP / WhatsApp (opsional)' },
      ],
      onSave: async function (v) {
        if (!v.nip) throw new Error('NIP wajib diisi');
        if (!/^\d{18}$/.test(String(v.nip).trim())) throw new Error('NIP harus 18 digit angka, tidak boleh lebih atau kurang');
        await DB.createUser({ nip: v.nip, role: v.role, phone: v.phone });
        reloadData();
        infoDialog('NIP terdaftar', 'Beritahu pemilik NIP ' + v.nip + ': buka halaman login, masukkan NIP saja lalu klik Masuk, kemudian atur nama dan password sendiri. Akun berstatus "Belum aktif" sampai itu dilakukan.');
      },
    });
  }

  function sectionHeader(label) {
    // Theme-variable colours so every section header (UTAMA/ASET/PEMINJAMAN/MANAJEMEN)
    // renders identically — including the ones injected by JS — and adapts to light/dark.
    var divider = '<div style="flex:1 1 0%;height:2px;background:var(--sidebar-divider);border-radius:2px"></div>';
    return el('div', { style: 'display:flex;align-items:center;gap:6px;padding:0.6rem 0.5rem 0.25rem', html: divider + '<span style="font-size:0.55rem;color:var(--text-muted);font-weight:800;letter-spacing:1.5px;white-space:nowrap">' + label + '</span>' + divider });
  }
  function makeNavLink(href, iconName, title, subtitle) {
    var active = (page() + '.html') === href;
    var base = 'display:flex;align-items:center;gap:10px;padding:0.55rem 0.75rem;border-radius:10px;margin-bottom:2px;text-decoration:none;transition:0.18s;justify-content:flex-start;';
    var style = active
      ? base + 'color:rgb(255,255,255);background:rgb(245,158,11);box-shadow:rgba(245,158,11,0.35) 0px 4px 12px;'
      : base + 'color:rgb(100,116,139);background:transparent;box-shadow:none;';
    var sub = active ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)';
    var icon = (window.SESDIAN_ICONS && window.SESDIAN_ICONS[iconName]) || '';
    return el('a', { href: href, style: style, html: '<span class="ic" style="font-size:1rem;flex-shrink:0;line-height:1">' + icon + '</span><div style="overflow:hidden;flex:1 1 0%"><div style="font-size:0.8rem;font-weight:700;white-space:nowrap;color:inherit">' + title + '</div><div style="font-size:0.62rem;color:' + sub + ';white-space:nowrap;margin-top:1px">' + subtitle + '</div></div>' });
  }
  function injectRoleNav() {
    if (!IS_STAFF) return;
    if ($('aside [data-role-nav]')) return;
    var ref = $('aside a[href="ajukanpinjam.html"]'); if (!ref) return;
    var navContainer = ref.parentNode.parentNode;
    var sec = el('div', { 'data-role-nav': '', style: 'margin-bottom:0.25rem' });
    sec.appendChild(sectionHeader('MANAJEMEN'));
    sec.appendChild(makeNavLink('laporan.html', 'chart', 'Laporan', 'Harian · bulanan'));
    sec.appendChild(makeNavLink('verifikasi.html', 'check_circle', 'Verifikasi', 'Persetujuan ke-2'));
    if (IS_ADMIN) sec.appendChild(makeNavLink('users.html', 'users', 'Kelola User', 'User & admin'));
    navContainer.appendChild(sec);
  }

  /* ---------------- dynamic app shell (for new pages that opt in) ----------------
     A page using <aside data-shell></aside> + a sticky <div data-topbar></div>
     gets the standard sidebar + topbar built here, so it needs no copied markup. */
  var PAGE_TITLES = { dashboard: 'Dashboard', dataaset: 'Data Aset', kategoriaset: 'Kategori Aset', ruangan: 'Ruangan', daftarpinjam: 'Daftar Pinjam', ajukanpinjam: 'Ajukan Pinjam', dipinjam: 'Sedang Dipinjam', users: 'Kelola User', verifikasi: 'Verifikasi', laporan: 'Laporan', profil: 'Profil Saya' };
  // Per-page chrome icons (topbar breadcrumb). NAV_ICONS keys map a sidebar link's
  // href → the same icon, so the menu and the header always agree (fixes the old
  // hard-coded "home" icon that showed on every page — see REDESIGN-GUIDE #2/#5).
  var PAGE_ICONS = { dashboard: 'zap', dataaset: 'package', kategoriaset: 'tag', ruangan: 'home', daftarpinjam: 'refresh', ajukanpinjam: 'clipboard', dipinjam: 'clock', users: 'users', verifikasi: 'check_circle', laporan: 'chart', katalog: 'search', profil: 'user' };
  var NAV_ICONS = { 'dashboard.html': 'zap', 'dataaset.html': 'package', 'kategoriaset.html': 'tag', 'ruangan.html': 'home', 'daftarpinjam.html': 'refresh', 'ajukanpinjam.html': 'clipboard', 'dipinjam.html': 'clock', 'users.html': 'users', 'verifikasi.html': 'check_circle', 'laporan.html': 'chart', 'katalog.html': 'search' };
  function pageIcon(p) { return (window.SESDIAN_ICONS && window.SESDIAN_ICONS[PAGE_ICONS[p] || 'home']) || ''; }
  // "Sedang Dipinjam" link for everyone (added into the PEMINJAMAN section).
  function injectBorrowedNav() {
    if ($('aside a[href="dipinjam.html"]')) return;
    var ref = $('aside a[href="daftarpinjam.html"]'); if (!ref) return;
    ref.parentNode.insertBefore(makeNavLink('dipinjam.html', 'clock', 'Sedang Dipinjam', 'Barang belum kembali'), ref.nextSibling);
  }
  function navSection(label, links) { var d = el('div', { style: 'margin-bottom:0.25rem' }); d.appendChild(sectionHeader(label)); links.forEach(function (l) { d.appendChild(l); }); return d; }
  function buildShell() {
    var aside = $('aside[data-shell]');
    if (aside && !aside.children.length) {
      aside.appendChild(el('div', { style: 'padding:1rem;border-bottom:1px solid rgb(26,37,64);display:flex;align-items:center;gap:8px;min-height:60px', html: '<div><div style="font-size:1.15rem;font-weight:900;color:var(--text);letter-spacing:-0.5px;line-height:1">SES<span style="color:rgb(99,102,241)">DIAN</span></div><div style="font-size:0.55rem;color:var(--text-muted);margin-top:3px;font-family:\'JetBrains Mono\';letter-spacing:2px">ASSET MANAGEMENT</div></div>' }));
      var nav = el('div', { style: 'flex:1 1 0%;overflow:hidden auto;padding:0.5rem' });
      nav.appendChild(navSection('UTAMA', [makeNavLink('dashboard.html', 'zap', 'Dashboard', 'Ringkasan & statistik')]));
      nav.appendChild(navSection('ASET', [makeNavLink('dataaset.html', 'package', 'Data Aset', 'Lihat semua aset'), makeNavLink('ruangan.html', 'home', 'Ruangan', 'Daftar ruangan')]));
      nav.appendChild(navSection('PEMINJAMAN', [makeNavLink('daftarpinjam.html', 'refresh', 'Daftar Pinjam', 'Riwayat peminjaman'), makeNavLink('ajukanpinjam.html', 'clipboard', 'Ajukan Pinjam', 'Request baru')]));
      aside.appendChild(nav);
      aside.appendChild(el('div', { style: 'padding:0.75rem;border-top:1px solid rgb(26,37,64)', html: '<div style="display:flex;align-items:center;gap:8px;padding:0.6rem;border-radius:10px;background:linear-gradient(135deg,rgb(26,37,64),rgb(15,23,42));border:1px solid rgb(30,41,59)"><div data-user-initials style="width:34px;height:34px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,rgb(99,102,241),rgb(139,92,246));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.75rem">AS</div><div style="flex:1 1 0%;min-width:0px"><div data-user-name style="color:rgb(226,232,240);font-size:0.75rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Pengguna</div><div data-user-role style="color:rgb(51,65,85);font-size:0.6rem;text-transform:uppercase;letter-spacing:1px">user</div></div><button data-action="logout" style="background:transparent;border:1px solid rgb(30,41,59);color:rgb(71,85,105);cursor:pointer;font-size:0.7rem;padding:0.25rem 0.5rem;border-radius:6px;flex-shrink:0">Keluar</button></div>' }));
    }
    var top = $('[data-topbar]');
    if (top && !top.children.length) {
      top.appendChild(el('div', { class: 'sesd-topbar-crumb', style: 'display:flex;align-items:center;gap:8px', html: '<span class="ic" style="color:var(--text-muted);display:inline-flex">' + pageIcon(page()) + '</span><span style="color:var(--text);font-weight:600;font-size:0.9rem;white-space:nowrap">' + (PAGE_TITLES[page()] || '') + '</span>' }));
      top.appendChild(el('div', { style: 'display:flex;align-items:center;gap:6px', html: '<div style="width:7px;height:7px;border-radius:50%;background:rgb(16,185,129);box-shadow:rgba(16,185,129,0.2) 0px 0px 0px 3px"></div><span style="font-size:0.75rem;color:rgb(100,116,139);font-weight:500">Online</span>' }));
    }
  }

  /* ---------------- chrome normalizer (REDESIGN-GUIDE #1/#2/#3/#5) ----------------
     One source of truth that runs on every authed page — static-shell or
     dynamic-shell alike — so the brand logo, sidebar icons and topbar breadcrumb
     are identical everywhere instead of being hand-maintained across 7 HTML files. */
  function installBrandLogo() {
    var aside = $('aside'); if (!aside) return;
    var head = aside.firstElementChild; if (!head || head.querySelector('.sesd-brand-logo')) return;
    var img = el('img', { class: 'sesd-brand-logo', src: 'assets/logosesdian.png', alt: 'SESDIAN' });
    head.insertBefore(img, head.firstChild);
    // Hide the now-redundant text wordmark (the logo already reads "SESDiAN").
    var wm = head.querySelector('div'); if (wm) wm.classList.add('sesd-brand-wordmark');
  }
  function normalizeSidebarIcons() {
    $$('aside a[href]').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('/').pop();
      var name = NAV_ICONS[href]; if (!name) return;
      var icon = (window.SESDIAN_ICONS && window.SESDIAN_ICONS[name]) || '';
      var slot = a.querySelector('.ic'); if (slot && icon) slot.innerHTML = icon;
    });
  }
  function normalizeTopbar() {
    var header = $('[data-topbar]') || ($('main') && $('main').firstElementChild);
    if (!header) return;
    header.classList.add('sesd-topbar');
    var left = header.firstElementChild; if (!left) return;
    left.className = 'sesd-topbar-crumb';
    left.setAttribute('style', 'display:flex;align-items:center;gap:8px;min-width:0');
    left.innerHTML = '<span class="ic" style="color:var(--text-muted);display:inline-flex;flex-shrink:0">' + pageIcon(page()) +
      '</span><span style="color:var(--text);font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      (PAGE_TITLES[page()] || '') + '</span>';
    // #3 — header stays pinned and casts a subtle shadow once the page scrolls.
    if (!header._sesdScroll) {
      header._sesdScroll = true;
      var mainEl = $('main');
      var onScroll = function () {
        var y = Math.max(window.pageYOffset || 0, document.documentElement.scrollTop || 0, mainEl ? mainEl.scrollTop : 0);
        header.classList.toggle('sesd-scrolled', y > 4);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      if (mainEl) mainEl.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }
  function normalizeChrome() {
    installBrandLogo();
    normalizeSidebarIcons();
    normalizeTopbar();
    // #8 — the Kategori Aset page is gone (managed from the Data Aset toolbar);
    // drop its nav link on the static-shell pages that still hard-code it.
    $$('aside a[href="kategoriaset.html"]').forEach(function (a) { a.remove(); });
  }

  function injectAdminBars() {
    var p = page();
    var content = $$('main > div').pop(); if (!content) return;
    var inner = content.firstElementChild || content;
    function bar(buttons) {
      var wrap = el('div', { class: 'sesd-admin-bar' });
      buttons.forEach(function (b) {
        var btn = el('button', { class: 'sesd-btn sesd-btn-lg sesd-btn-' + (b.variant || 'primary'), html: (b.icon ? ic(b.icon) + ' ' : '') + b.label });
        btn.addEventListener('click', b.onClick); wrap.appendChild(btn);
      });
      // #3 — dock the action buttons to the right of the page title instead of
      // stacking them above the management area.
      var h1 = inner.querySelector('h1');
      if (h1) {
        var titleBlock = h1.parentElement;                 // wrapper holding the <h1> (+ subtitle)
        var row = titleBlock && titleBlock.parentElement;  // the row that the title block sits in
        var rowIsFlexHeader = row && /space-between/.test(row.getAttribute('style') || '');
        wrap.style.marginBottom = '0';
        wrap.style.alignSelf = 'center';
        if (rowIsFlexHeader) {
          // Existing header is already a flex space-between row → just add the bar on the right.
          wrap.style.marginLeft = 'auto';
          row.appendChild(wrap);
        } else {
          // Title and subtitle live bare in their wrapper → turn it into a header row.
          var textBlock = el('div');
          while (titleBlock.firstChild) textBlock.appendChild(titleBlock.firstChild);
          titleBlock.style.display = 'flex';
          titleBlock.style.justifyContent = 'space-between';
          titleBlock.style.alignItems = 'center';
          titleBlock.style.flexWrap = 'wrap';
          titleBlock.style.gap = '12px';
          titleBlock.appendChild(textBlock);
          titleBlock.appendChild(wrap);
        }
      } else {
        inner.insertBefore(wrap, inner.firstChild);
      }
    }
    if (p === 'dataaset') bar([
      { label: 'Tambah Aset', icon: 'package', onClick: function () { openAssetForm(null); } },
      { label: 'Import Excel', variant: 'success', icon: 'archive', onClick: function () { if (window.SESDIAN_IMPORT) window.SESDIAN_IMPORT.open(); else toast('Modul import belum siap', 'error'); } },
    ]);
    else if (p === 'kategoriaset') bar([{ label: 'Tambah Kategori', onClick: function () { openCategoryForm(null); } }]);
    else if (p === 'ruangan') bar([{ label: 'Tambah Ruangan', onClick: function () { openRoomForm(null); } }]);
    else if (p === 'users') bar([{ label: 'Tambah User', icon: 'user', onClick: function () { openUserForm(); } }]);
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
    if (list) { var empty = list.querySelector('.sesd-empty'); if (visible === 0 && items.length) { if (!empty) appendEmpty(list, 'Tidak ada data yang cocok.'); } else if (empty) empty.remove(); }
  }
  function wireSearch() { $$('[data-search]').forEach(function (input) { var g = input.getAttribute('data-search'); input.addEventListener('input', function () { applyFilters(g); }); }); }
  function wireFilters() {
    var groups = {};
    $$('[data-filter]').forEach(function (b) { var d = b.getAttribute('data-filter'); (groups[d] = groups[d] || []).push(b); });
    var anyItem = $('[data-search-item]'); var group = anyItem ? anyItem.getAttribute('data-search-item') : null;
    Object.keys(groups).forEach(function (dim) {
      var btns = groups[dim];
      var active = btns.filter(function (b) { return b.hasAttribute('data-filter-active'); })[0] || btns[0];
      var inactive = btns.filter(function (b) { return b !== active; })[0];
      var activeStyle = active ? active.style.cssText : '', inactiveStyle = inactive ? inactive.style.cssText : '';
      filterState[dim] = active ? (active.getAttribute('data-filter-val') || 'all') : 'all';
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          filterState[dim] = b.getAttribute('data-filter-val') || 'all';
          btns.forEach(function (x) { if (inactiveStyle) x.style.cssText = inactiveStyle; x.removeAttribute('data-filter-active'); });
          if (activeStyle) b.style.cssText = activeStyle;
          b.setAttribute('data-filter-active', '');   // drives CSS active state for .sesd-segfilter
          if (group) applyFilters(group);
        });
      });
    });
  }

  /* ---------------- navigation ---------------- */
  function wireNav() {
    $$('[data-nav]').forEach(function (e) { e.addEventListener('click', function (ev) { ev.preventDefault(); location.href = e.getAttribute('data-nav'); }); });
    $$('[data-open-detail]').forEach(function (e) {
      e.addEventListener('click', function (ev) {
        var inner = ev.target.closest('a[href],button[data-action],button[data-nav],.sesd-admin-actions');
        if (inner && inner !== e) return;
        location.href = e.getAttribute('data-open-detail');
      });
    });
  }

  /* ---------------- modal ---------------- */
  function showModal(name, on) { var m = $('[data-modal="' + name + '"]'); if (m) m.style.display = on ? 'flex' : 'none'; }
  function wireModal() {
    $$('[data-modal-open]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); showModal(b.getAttribute('data-modal-open'), true); }); });
    $$('[data-modal-close]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); showModal(b.getAttribute('data-modal-close'), false); }); });
    $$('[data-modal]').forEach(function (m) { m.addEventListener('click', function (e) { if (e.target === m) m.style.display = 'none'; }); });
  }

  /* ---------------- asset card selection (ajukan page) ---------------- */
  function wireAssetSelect() {
    var cards = $$('[data-asset-select]'); if (!cards.length) return;
    var submit = $('[data-action="submit-pinjam"]');
    function refresh() {
      var any = $$('[data-asset-select].sesd-selected').length > 0;
      if (!submit) return;
      if (any) { submit.removeAttribute('disabled'); submit.style.background = 'linear-gradient(135deg, rgb(16, 185, 129), rgb(5, 150, 105))'; submit.style.color = 'rgb(255,255,255)'; submit.style.cursor = 'pointer'; submit.textContent = 'Ajukan Peminjaman'; }
      else { submit.setAttribute('disabled', ''); submit.style.background = 'rgb(226, 232, 240)'; submit.style.color = 'rgb(148, 163, 184)'; submit.style.cursor = 'not-allowed'; submit.textContent = 'Pilih aset yang tersedia'; }
    }
    cards.forEach(function (card) {
      if (card._wired) return; card._wired = true;
      card.addEventListener('click', function () {
        var box = $('[data-select-box]', card);
        var sel = card.classList.toggle('sesd-selected');
        if (sel) { card.style.border = '2px solid var(--primary)'; if (box) { box.style.background = 'var(--primary)'; box.style.borderColor = 'var(--primary)'; box.innerHTML = ic('check'); } }
        else { card.style.border = '2px solid var(--border)'; if (box) { box.style.background = 'transparent'; box.style.borderColor = 'var(--border)'; box.textContent = ''; } }
        refresh();
      });
    });
    refresh();
  }

  /* ---------------- ajukan pinjam submit ---------------- */
  function nameOf(node) { var e = node && node.querySelector ? node.querySelector('[data-bind="name"]') : null; return e ? e.textContent : ''; }
  async function notifyWa(names, date) {
    try {
      var s = await DB.getSettings();
      if (!s || !s.wa_number || s.wa_auto) return;     // server auto-sends, or no number set
      var who = (USER && USER.name) || 'pengguna';
      var msg = 'Halo Admin, saya ' + who + ' mengajukan peminjaman: ' + names.join(', ') + (date ? ('. Jatuh tempo ' + date) : '') + '.';
      window.open('https://wa.me/' + s.wa_number + '?text=' + encodeURIComponent(msg), '_blank');
    } catch (e) {}
  }
  /* ajukan pinjam: grouped by item type (like Data Aset), pick a quantity per
     type. Each unit is still a separate borrowing in the DB. */
  // Ajukan Pinjam page: grouped cards (like Data Aset). Click a card -> detail
  // modal where the exact unit(s) to borrow are picked. The old right-side
  // "Detail Peminjaman" panel is hidden since borrowing now happens in the modal.
  /* ---- Data Aset grid: built fully in JS so we control empty chips (#6),
          the X/Y stock format (#7) and a meaningful availability badge (#8).
          Theme-aware via CSS classes (no hard-coded colours) — see #4. ---- */
  function assetChip(iconName, text) {
    if (text == null || String(text).trim() === '') return null;   // #6 — never render an empty chip
    var chip = el('span', { class: 'sesd-aset-chip' });
    chip.innerHTML = ic(iconName);
    chip.appendChild(el('span', {}, String(text)));
    return chip;
  }
  function renderAssetGrid(groups) {
    var grid = $('[data-list="assets"]'); if (!grid) return;
    grid.innerHTML = '';                                          // drops the hidden seed template too
    if (!groups.length) { appendEmpty(grid, 'Belum ada aset.'); return; }
    groups.forEach(function (g, index) {
      var avail = g.available || 0, total = g.stock_total || 0, borrowed = g.stock_borrowed || 0;
      var isNon = (g.type || '').toLowerCase() === 'non-bmn';
      var card = el('div', {
        'data-search-item': 'assets',
        'data-type': isNon ? 'non-bmn' : 'bmn',
        'data-status': avail > 0 ? 'available' : 'borrowed',
        class: 'sesd-aset-card' + (index < 16 ? ' animate-fade-up' : ''),
      });
      card.addEventListener('click', function (ev) { if (ev.target.closest('.sesd-admin-actions')) return; openGroupDetail(g); });
      if (g.image) {
        var band = el('div', { class: 'sesd-aset-img sesd-img-zoom', title: 'Klik untuk melihat gambar penuh' });
        var gImg = el('img', { src: g.image, alt: g.name || '', loading: 'lazy', decoding: 'async' });
        gImg.onerror = function () { band.remove(); };   // no generated file for this name: card falls back to text-only
        band.appendChild(gImg);
        // klik gambar = lihat ukuran penuh; klik bagian kartu lain tetap buka detail
        band.addEventListener('click', function (ev) { ev.stopPropagation(); openImagePopup(g.image, (g.name || '') + (g.brand ? ' · ' + g.brand : '')); });
        card.appendChild(band);
      }
      var body = el('div', { class: 'sesd-aset-body' });
      var top = el('div', { class: 'sesd-aset-top' });
      top.appendChild(el('span', { class: 'sesd-aset-type ' + (isNon ? 'is-non' : 'is-bmn') }, isNon ? 'Non-BMN' : 'BMN'));
      var availBadge = el('span', { class: 'sesd-aset-avail ' + (avail > 0 ? 'is-ok' : 'is-out') });
      availBadge.innerHTML = ic(avail > 0 ? 'check_circle' : 'x');   // #8 — clear status, no stray "-"
      availBadge.appendChild(el('span', {}, avail > 0 ? ('Tersedia ' + avail) : 'Habis'));
      top.appendChild(availBadge);
      body.appendChild(top);
      if (g.code) body.appendChild(el('div', { class: 'sesd-aset-code' }, g.code));
      body.appendChild(el('div', { class: 'sesd-aset-name' }, g.name || '-'));
      // merk = badge tersendiri di bawah nama (bukan bagian teks nama)
      if (g.brand) body.appendChild(el('span', { class: 'sesd-aset-merk' }, g.brand));
      var chips = el('div', { class: 'sesd-aset-chips' });
      [['tag', g.category], ['pin', g.room]].forEach(function (c) {
        var ch = assetChip(c[0], c[1]); if (ch) chips.appendChild(ch);
      });
      if (chips.children.length) body.appendChild(chips);
      if (g.condition) body.appendChild(el('span', { class: 'sesd-aset-cond' }, g.condition));  // #1 — keep STOK as the last (bottom-pinned) element
      var stock = el('div', { class: 'sesd-aset-stock' });
      var sr = el('div', { class: 'sesd-aset-stock-row' });
      sr.appendChild(el('span', { class: 'sesd-aset-stock-label' }, 'STOK'));
      var num = el('span', { class: 'sesd-aset-stock-num' });       // #7 — "16/16" with a slash
      num.appendChild(el('span', { class: 'is-avail' }, String(avail)));
      num.appendChild(el('span', { class: 'is-sep' }, '/'));
      num.appendChild(el('span', { class: 'is-total' }, String(total)));
      sr.appendChild(num); stock.appendChild(sr);
      var bar = el('div', { class: 'sesd-aset-bar' });
      bar.appendChild(el('div', { class: 'sesd-aset-bar-fill', style: 'width:' + (total ? Math.round((avail / total) * 100) : 0) + '%' }));
      stock.appendChild(bar);
      if (borrowed > 0) {
        var bnote = el('div', { class: 'sesd-aset-borrowed' });
        bnote.innerHTML = ic('refresh');
        bnote.appendChild(el('span', {}, borrowed + ' dipinjam'));
        stock.appendChild(bnote);
      }
      body.appendChild(stock);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function buildAjukanList(groups) {
    var container = $('[data-list="assets"]'); if (!container) return;
    var leftCol = container.parentNode, grid = leftCol && leftCol.parentNode;
    if (grid) { grid.style.gridTemplateColumns = '1fr'; var sb = grid.children[1]; if (sb && sb !== leftCol) sb.style.display = 'none'; }
    container.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem';
    container.innerHTML = '';
    var availTotal = 0;
    if (!groups.length) { appendEmpty(container, 'Belum ada aset.'); return; }
    groups.forEach(function (g) {
      var avail = (g.available != null) ? g.available : g.units.reduce(function (n, u) { return n + (u.stock_available || 0); }, 0);
      availTotal += avail;
      var card = el('div', { 'data-search-item': 'assets', 'data-status': avail > 0 ? 'available' : 'unavailable', style: 'background:#fff;border-radius:16px;border:1px solid var(--border);box-shadow:var(--shadow);padding:1rem;cursor:pointer;transition:transform .15s' });
      card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-3px)'; });
      card.addEventListener('mouseleave', function () { card.style.transform = 'none'; });
      card.addEventListener('click', function () { openGroupDetail(g); });
      var top = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px' });
      top.appendChild(el('span', { style: 'font-size:0.65rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:20px;background:rgb(219,234,254);color:rgb(30,64,175)' }, g.type || 'BMN'));
      top.appendChild(el('span', { style: 'font-size:0.68rem;font-weight:800;padding:0.15rem 0.55rem;border-radius:20px;' + (avail > 0 ? 'background:rgb(220,252,231);color:rgb(22,101,52)' : 'background:rgb(254,226,226);color:rgb(153,27,27)') }, avail > 0 ? ('Tersedia ' + avail) : 'Habis'));
      card.appendChild(top);
      card.appendChild(el('div', { style: 'font-weight:700;font-size:0.95rem;margin-bottom:4px' }, g.name || ''));
      if (g.brand) {   // merk = badge tersendiri di bawah nama
        var mrow = el('div', { style: 'margin-bottom:6px' });
        mrow.appendChild(el('span', { class: 'sesd-aset-merk' }, g.brand));
        card.appendChild(mrow);
      }
      card.appendChild(el('div', { style: 'font-size:0.75rem;color:var(--text-muted)' }, (g.category || '-') + ' · ' + g.units.length + ' unit'));
      container.appendChild(card);
    });
    var sub = $('[data-ajukan-avail]'); if (sub) sub.textContent = availTotal + ' unit tersedia';
  }
  async function submitPinjam() {
    var picked = [];
    var qtyInputs = $$('[data-ajukan-qty]');
    if (qtyInputs.length) {
      qtyInputs.forEach(function (inp) {
        var qty = parseInt(inp.value, 10) || 0, units = inp._units || [];
        for (var i = 0; i < qty && i < units.length; i++) picked.push({ id: units[i].id, name: inp._name || '' });
      });
      if (!picked.length) { toast('Pilih minimal 1 unit', 'error'); return; }
    } else {
      $$('input[type="checkbox"]').forEach(function (c) { if (c.checked) { var v = parseInt(c.value, 10); if (v) picked.push({ id: v, name: nameOf(c.closest('label') || c.parentNode) || ('Aset #' + v) }); } });
      $$('[data-asset-select].sesd-selected').forEach(function (e) { var v = parseInt(e.getAttribute('data-asset-id'), 10); if (v) picked.push({ id: v, name: nameOf(e) || ('Aset #' + v) }); });
      var hasUI = $$('input[type="checkbox"]').length > 0 || $$('[data-asset-select]').length > 0;
      if (hasUI && !picked.length) { toast('Pilih minimal satu aset', 'error'); return; }
    }
    var date = val('date') || ($('input[type="date"]') || {}).value || '';
    if (!date) { toast('Tanggal jatuh tempo kembali wajib diisi', 'error'); return; }
    var notes = val('notes');
    try {
      for (var i = 0; i < picked.length; i++) await DB.requestBorrowing({ assetId: picked[i].id, qty: 1, dueDate: date, notes: notes });
      await notifyWa(picked.map(function (p) { return p.name; }), date);
      toast('Pengajuan peminjaman berhasil dikirim', 'success'); setTimeout(go('daftarpinjam.html'), 900);
    } catch (e) { if (e && e.status === 401) { location.replace('login.html'); return; } toast((e && e.message) || 'Gagal mengirim pengajuan', 'error'); }
  }

  /* ---------------- actions ---------------- */
  async function withLoading(btnEl, fn) {
    if (!btnEl || btnEl.tagName !== 'BUTTON') return await fn();
    var orig = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.textContent = 'Memproses...';
    try { await fn(); } finally { btnEl.disabled = false; btnEl.innerHTML = orig; }
  }

  function wireActions() {
    $$('[data-action]').forEach(function (e) {
      var act = e.getAttribute('data-action');
      e.addEventListener('click', function (ev) {
        if (e.tagName === 'A' || e.tagName === 'BUTTON') ev.preventDefault();
        if (act === 'login') withLoading(e, doLogin);
        else if (act === 'register') withLoading(e, doRegister);
        else if (act === 'logout') withLoading(e, doLogout);
        else if (act === 'toggle-password') togglePassword(e);
        else if (act === 'submit-pinjam') withLoading(e, submitPinjam);
      });
    });

    // Multi-step login wiring
    if (page() === 'login') {
      var btnCheckNip = document.getElementById('btn-check-nip');
      if (btnCheckNip) btnCheckNip.addEventListener('click', function (ev) { ev.preventDefault(); withLoading(btnCheckNip, doCheckNip); });

      var btnBackPw = document.getElementById('btn-back-password');
      if (btnBackPw) btnBackPw.addEventListener('click', function (ev) { ev.preventDefault(); goBackToNip(); });

      var btnBackClaim = document.getElementById('btn-back-claim');
      if (btnBackClaim) btnBackClaim.addEventListener('click', function (ev) { ev.preventDefault(); goBackToNip(); });

      var btnClaimSubmit = document.getElementById('btn-claim-submit');
      if (btnClaimSubmit) btnClaimSubmit.addEventListener('click', function (ev) { ev.preventDefault(); withLoading(btnClaimSubmit, doClaimSubmit); });

      // Enter key per step
      var nipInput = document.getElementById('input-nip');
      if (nipInput) nipInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (btnCheckNip) btnCheckNip.click(); } });

      var pwInput = document.getElementById('input-password');
      if (pwInput) pwInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); var loginBtn = $('#step-password [data-action="login"]'); if (loginBtn) loginBtn.click(); }
      });

      // Enter in claim fields → submit claim
      ['input-claim-name', 'input-claim-password', 'input-claim-confirm'].forEach(function (id) {
        var inp = document.getElementById(id);
        if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (btnClaimSubmit) btnClaimSubmit.click(); } });
      });
    }

    if (page() === 'register') {
      $$('input').forEach(function (input) { input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var b = $('[data-action="register"]') || byText(/^Daftar/)[0]; if (b) b.click(); else doRegister(); } }); });
    }
  }

  function fallbacks() {
    if (!$('[data-action="logout"]')) byText(/^(Keluar|Logout|Log out)$/i).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); withLoading(b, doLogout); }); });
    if (page() === 'register' && !$('[data-action="register"]')) byText(/^Daftar/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); withLoading(b, doRegister); }); });
  }

  function setupNotice() {
    if (REAL) return;
    if (!(page() === 'login' || page() === 'register')) return;
    setTimeout(function () { toast('Mode demo - backend Neon aktif setelah deploy ke Vercel + set DATABASE_URL', 'info'); }, 700);
  }

  function setupMobileLayout() {
    var aside = $('aside');
    var header = $('main > div');
    if (!aside || !header) return;
    if ($('.sesd-hamburger')) return;   // idempotent: never inject twice
    var backdrop = el('div', { class: 'sesd-mobile-backdrop' });
    document.body.appendChild(backdrop);
    var hamburger = el('button', { class: 'sesd-hamburger' });
    hamburger.innerHTML = '☰';
    header.insertBefore(hamburger, header.firstChild);
    var toggle = function(e) { if (e) e.preventDefault(); aside.classList.toggle('sesd-open'); backdrop.classList.toggle('sesd-open'); };
    hamburger.addEventListener('click', toggle);
    backdrop.addEventListener('click', toggle);
  }

  /* #3 — collapsible sidebar. The header toggle rails the sidebar to an icon-only
     strip on desktop (persisted), and closes the drawer on mobile. Works on both
     static-shell pages (which ship a "‹" button) and dynamic-shell pages (where we
     create the button). */
  var SIDEBAR_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  function setupSidebarCollapse() {
    var aside = $('aside'); if (!aside) return;
    var head = aside.firstElementChild;
    // idempotent: prefer an already-wired button, then the static "‹" one; only
    // create as a last resort — and remove any strays so a double boot (or a
    // stale DOM) can never leave TWO collapse boxes in the header.
    var btn = aside.querySelector('.sesd-collapse-btn') || byText(/^‹$/, 'aside button')[0];
    if (!btn) {
      if (!head) return;
      btn = el('button', { type: 'button', style: 'margin-left:auto' });
      head.appendChild(btn);
    }
    $$('aside .sesd-collapse-btn').concat(byText(/^‹$/, 'aside button')).forEach(function (x) { if (x !== btn) x.remove(); });
    btn.classList.add('sesd-collapse-btn');
    if (btn._sesdWired) return;   // never stack duplicate click handlers
    btn._sesdWired = true;
    btn.innerHTML = SIDEBAR_CHEVRON;
    btn.setAttribute('aria-label', 'Tutup atau buka sidebar');
    btn.title = 'Tutup / buka sidebar';
    // tooltips so railed icons stay identifiable
    $$('aside a[href]').forEach(function (a) {
      if (a.title) return;
      var t = a.querySelector('div');
      var label = t ? ((t.firstElementChild ? t.firstElementChild.textContent : t.textContent) || '').trim() : '';
      if (label) a.title = label;
    });
    // #1 — tag every section header so rail mode can drop the separators cleanly
    $$('aside [style*="letter-spacing: 1.5px"], aside [style*="letter-spacing:1.5px"]').forEach(function (lbl) {
      if (lbl.parentNode) lbl.parentNode.classList.add('sesd-navsec');
    });
    var isMobile = function () { return window.matchMedia('(max-width: 768px)').matches; };
    // sync the JS class with the pre-paint preference (set by the inline <head> script)
    try { if (localStorage.getItem('sesdian_rail') === '1' && !isMobile()) aside.classList.add('sesd-rail'); } catch (e) {}
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (isMobile()) {
        aside.classList.remove('sesd-open');
        var bd = $('.sesd-mobile-backdrop'); if (bd) bd.classList.remove('sesd-open');
      } else {
        var railed = aside.classList.toggle('sesd-rail');
        document.documentElement.classList.toggle('sesd-rail-pref', railed);   // keep pre-paint state in sync
        try { localStorage.setItem('sesdian_rail', railed ? '1' : '0'); } catch (e2) {}
      }
    });
  }

  // #7 — dashboard greeting: time-of-day + role-aware copy for all three actors
  function setupGreeting() {
    var hiEl = $('[data-greet-hi]'), subEl = $('[data-greet-sub]');
    if (!hiEl && !subEl) return;
    var h = new Date().getHours();
    var hi = h < 11 ? 'Selamat pagi' : (h < 15 ? 'Selamat siang' : (h < 18 ? 'Selamat sore' : 'Selamat malam'));
    if (hiEl) hiEl.textContent = hi;
    var dEl = $('[data-greet-date]');
    if (dEl) dEl.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    var role = (USER && USER.role) || 'user';
    var rEl = $('[data-greet-role]'); if (rEl) rEl.textContent = (ROLE_META[role] && ROLE_META[role][0]) || role;
    var subs = {
      admin: 'Pantau, kelola, dan setujui peminjaman aset di seluruh organisasi.',
      verifikator: 'Verifikasi peminjaman yang masuk dan pastikan aset tetap terpantau.',
      user: 'Ajukan dan pantau peminjaman aset Anda dengan mudah.'
    };
    if (subEl) subEl.textContent = subs[role] || subs.user;
  }

  function setupDates() {
    // Elemen tanggal ditandai data-now di HTML (placeholder netral, bukan teks
    // tanggal basi yang bisa flash sebelum JS jalan).
    var now = new Date();
    var shortDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    var longDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    $$('[data-now]').forEach(function (e) { e.textContent = e.getAttribute('data-now') === 'long' ? longDate : shortDate; });
  }

  function translateBreadcrumbs() {
    var map = { dashboard: 'Dashboard', dataaset: 'Data Aset', kategoriaset: 'Kategori Aset', ruangan: 'Ruangan', daftarpinjam: 'Daftar Pinjam', ajukanpinjam: 'Ajukan Pinjam', users: 'Kelola User' };
    var p = page();
    if (map[p]) {
      byText(new RegExp('^' + p + '$', 'i'), 'span').forEach(function(e) { e.textContent = map[p]; });
    }
  }

  /* ---------------- boot ---------------- */
  // expose the single page loader so page-specific scripts (reports.js) can use it
  window.SESDIAN_LOADER = { show: showPageLoader, hide: hidePageLoader };
  /* ====================== #11 — mobile card tables ======================
     On phones every table row becomes a self-contained card whose cells carry
     their column name (from the matching <th>) as a data-label. Generic: works
     for every table, template-rendered or JS-rendered. Re-run after each render. */
  function labelizeTables() {
    $$('main table').forEach(function (t) {
      var heads = $$('thead th', t).map(function (th) { return (th.textContent || '').replace(/\s+/g, ' ').trim(); });
      if (!heads.length) return;
      t.classList.add('sesd-cardtable');
      $$('tbody tr', t).forEach(function (tr) {
        $$('td', tr).forEach(function (td, i) {
          if (heads[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i]);
        });
      });
    });
  }

  /* ====================== #11 — table toolbar (search + filter) ======================
     Replaces the "Lihat Semua" button above the dashboard recent table with a live
     search box and a filter-icon dropdown (status). */
  function wireRecentToolbar() {
    var host = $('[data-recent-list]'); if (!host) return;
    var btn = document.querySelector('[data-nav="daftarpinjam.html"]');
    var bar = btn ? btn.parentNode : null; if (!bar || bar._sesdToolbar) return; bar._sesdToolbar = true;
    var tools = el('div', { class: 'sesd-table-tools' });
    var search = el('input', { type: 'search', placeholder: 'Cari peminjaman…', class: 'sesd-table-search' });
    var filterBtn = el('button', { type: 'button', class: 'sesd-table-filter', title: 'Filter status', html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>' });
    tools.appendChild(search); tools.appendChild(filterBtn);
    if (btn) btn.replaceWith(tools); else bar.appendChild(tools);
    var STAT = ['Semua', 'Pending', 'Disetujui', 'Dipinjam', 'Kembali', 'Ditolak'];
    var curStat = 'Semua', menu = null;
    function apply() {
      var q = (search.value || '').toLowerCase();
      $$('tr', host).forEach(function (tr) {
        if (tr.hasAttribute('data-recent-template')) return;
        var txt = (tr.textContent || '').toLowerCase();
        var ok = (!q || txt.indexOf(q) !== -1) && (curStat === 'Semua' || txt.indexOf(curStat.toLowerCase()) !== -1);
        tr.style.display = ok ? '' : 'none';
      });
    }
    search.addEventListener('input', apply);
    function closeMenu() { if (menu) { menu.remove(); menu = null; } document.removeEventListener('click', onDoc, true); }
    function onDoc(e) { if (menu && !menu.contains(e.target) && e.target !== filterBtn && !filterBtn.contains(e.target)) closeMenu(); }
    filterBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (menu) { closeMenu(); return; }
      menu = el('div', { class: 'sesd-table-filter-menu' });
      STAT.forEach(function (s) {
        var it = el('button', { type: 'button', class: 'sesd-table-filter-opt' + (s === curStat ? ' is-active' : '') }, s);
        it.addEventListener('click', function () { curStat = s; apply(); closeMenu(); });
        menu.appendChild(it);
      });
      document.body.appendChild(menu);
      var r = filterBtn.getBoundingClientRect();
      menu.style.top = (r.bottom + 6) + 'px'; menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
      setTimeout(function () { document.addEventListener('click', onDoc, true); }, 0);
    });
  }

  // Small round avatar: the peminjam's photo if we have one, else their initials.
  function borrowerAvatar(name, photo, size) {
    size = size || 30;
    var box = el('span', { style: 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex-shrink:0;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.38) + 'px;font-weight:700;color:#fff;background:var(--primary)' });
    if (photo) { box.style.background = 'var(--bg-mid)'; box.appendChild(el('img', { src: photo, alt: '', style: 'width:100%;height:100%;object-fit:cover' })); }
    else {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      box.textContent = parts.length ? ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase() : '?';
    }
    return box;
  }

  /* ====================== verifikasi status chart ======================
     Donut of the overall borrowing-status distribution beside the queue table:
     Sedang Dipinjam / Telah Dikembalikan / Menunggu Approval / Ditolak. */
  function buildVerifChart(all) {
    var tbody = $('[data-list="verif"]'); if (!tbody) return;
    var card = tbody.closest('div');                    // the table's wrapper card
    if (card && card.parentNode && !$('.sesd-verif-grid')) {
      var grid = el('div', { class: 'sesd-verif-grid', style: 'display:grid;grid-template-columns:1fr 300px;gap:1rem;align-items:start' });
      card.parentNode.insertBefore(grid, card);
      grid.appendChild(card);
      var chartCard = el('div', { class: 'animate-fade-up', style: 'background:var(--bg-card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:1.25rem' });
      chartCard.appendChild(el('div', { style: 'font-size:0.95rem;font-weight:800' }, 'Ringkasan Peminjaman'));
      chartCard.appendChild(el('div', { style: 'font-size:0.72rem;color:var(--text-muted);margin-bottom:1.1rem' }, 'Distribusi status seluruh peminjaman'));
      chartCard.appendChild(el('div', { 'data-verif-chart': '' }));
      grid.appendChild(chartCard);
    }
    var host = $('[data-verif-chart]'); if (!host) return;
    var count = function (statuses) { return (all || []).filter(function (b) { return statuses.indexOf(b.status) !== -1; }).length; };
    var segs = [
      ['Sedang Dipinjam', count(['borrowed', 'verified', 'return_pending']), '#7b54c0'],
      ['Telah Dikembalikan', count(['returned']), '#1aae39'],
      ['Menunggu Approval', count(['pending', 'approved']), '#dd5b00'],
      ['Ditolak', count(['rejected']), '#e03e3e'],
    ];
    var total = segs.reduce(function (s, r) { return s + r[1]; }, 0);
    host.innerHTML = '';
    var acc = 0, stops = total
      ? segs.map(function (r) { var a = acc; acc += (r[1] / total) * 100; return r[2] + ' ' + a + '% ' + acc + '%'; })
      : ['var(--border) 0 100%'];
    var donut = el('div', { style: 'width:160px;height:160px;border-radius:50%;margin:0 auto;background:conic-gradient(' + stops.join(',') + ');display:flex;align-items:center;justify-content:center' });
    var hole = el('div', { style: 'width:108px;height:108px;border-radius:50%;background:var(--bg-card);display:flex;flex-direction:column;align-items:center;justify-content:center' });
    hole.appendChild(el('div', { style: 'font-size:1.7rem;font-weight:800;line-height:1' }, String(total)));
    hole.appendChild(el('div', { style: 'font-size:0.62rem;color:var(--text-muted);margin-top:2px' }, 'total peminjaman'));
    donut.appendChild(hole); host.appendChild(donut);
    var legend = el('div', { style: 'margin-top:1.25rem;display:flex;flex-direction:column;gap:10px' });
    segs.forEach(function (r) {
      var row = el('div', { style: 'display:flex;align-items:center;gap:8px;font-size:0.8rem' });
      row.appendChild(el('span', { style: 'width:10px;height:10px;border-radius:3px;flex-shrink:0;background:' + r[2] }));
      row.appendChild(el('span', { style: 'flex:1;color:var(--text-muted)' }, r[0]));
      row.appendChild(el('span', { style: 'font-weight:800' }, String(r[1])));
      legend.appendChild(row);
    });
    host.appendChild(legend);
  }

  /* ====================== #3 — notifications (bell) ====================== */
  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'baru saja';
    var m = Math.floor(s / 60); if (m < 60) return m + ' menit lalu';
    var h = Math.floor(m / 60); if (h < 24) return h + ' jam lalu';
    var d = Math.floor(h / 24); if (d < 30) return d + ' hari lalu';
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  function notifSeenKey() { return 'sesdian_notif_seen_' + ((USER && USER.nip) || 'anon'); }
  function getNotifSeen() { try { return parseInt(localStorage.getItem(notifSeenKey()) || '0', 10) || 0; } catch (e) { return 0; } }
  function setNotifSeen(ts) { try { localStorage.setItem(notifSeenKey(), String(ts)); } catch (e) {} }
  function notifItem(dateStr, icon, text, href) { var ts = dateStr ? new Date(dateStr).getTime() : Date.now(); if (isNaN(ts)) ts = Date.now(); return { ts: ts, icon: icon, text: text, href: href }; }
  // Derived from the borrowings feed (no extra table): staff see incoming requests
  // and return requests; a user sees updates on their own borrowings.
  async function buildNotifList() {
    var list = [];
    try {
      var rows = await DB.borrowings();   // returns a plain array (already formatted by db.js)
      rows.forEach(function (b) {
        if (IS_STAFF) {
          if (b.status === 'pending') list.push(notifItem(b.created_at, 'clipboard', (b.borrower || 'Seseorang') + ' mengajukan peminjaman ' + (b.asset_name || ''), 'daftarpinjam.html'));
          else if (b.status === 'approved' && IS_VERIFIKATOR) list.push(notifItem(b.approved_at || b.created_at, 'check_circle', 'Peminjaman ' + (b.asset_name || '') + ' menunggu verifikasi kedua', 'verifikasi.html'));
          else if (b.status === 'return_pending') list.push(notifItem(b.created_at, 'refresh', (b.borrower || 'Seseorang') + ' mengajukan pengembalian ' + (b.asset_name || ''), 'dipinjam.html'));
        } else {
          if (b.status === 'pending') list.push(notifItem(b.created_at, 'clock', 'Pengajuan ' + (b.asset_name || '') + ' terkirim, menunggu persetujuan admin', 'daftarpinjam.html'));
          else if (b.status === 'approved') list.push(notifItem(b.approved_at || b.created_at, 'check_circle', 'Peminjaman ' + (b.asset_name || '') + ' disetujui admin', 'daftarpinjam.html'));
          else if (b.status === 'borrowed') list.push(notifItem(b.verified_at || b.created_at, 'check_circle', (b.asset_name || 'Barang') + ' siap diserahterimakan', 'daftarpinjam.html'));
          else if (b.status === 'return_pending') list.push(notifItem(b.created_at, 'refresh', 'Pengembalian ' + (b.asset_name || '') + ' menunggu verifikasi admin', 'daftarpinjam.html'));
          else if (b.status === 'rejected') list.push(notifItem(b.approved_at || b.created_at, 'x', 'Peminjaman ' + (b.asset_name || '') + ' ditolak', 'daftarpinjam.html'));
          else if (b.status === 'returned') list.push(notifItem(b.returned_at || b.created_at, 'check', 'Pengembalian ' + (b.asset_name || '') + ' selesai', 'daftarpinjam.html'));
        }
      });
    } catch (e) {}
    list.sort(function (a, b) { return b.ts - a.ts; });
    return list.slice(0, 30);
  }
  function wireNotifBell(tries) {
    tries = tries || 0;
    var bell = document.querySelector('.sesd-head-iconbtn[aria-label="Notifikasi"]');
    if (!bell) { if (tries < 30) setTimeout(function () { wireNotifBell(tries + 1); }, 80); return; }
    if (bell._sesdNotif) return; bell._sesdNotif = true;
    bell.style.position = 'relative';
    var badge = el('span', { class: 'sesd-notif-badge' }); badge.style.display = 'none'; bell.appendChild(badge);
    var menu = null, items = [];
    function paintBadge() {
      var seen = getNotifSeen();
      var unread = items.filter(function (i) { return i.ts > seen; }).length;
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.style.display = unread ? 'flex' : 'none';
    }
    function closeMenu() { if (menu) { menu.remove(); menu = null; } document.removeEventListener('click', onDoc, true); }
    function onDoc(e) { if (menu && !menu.contains(e.target) && !bell.contains(e.target)) closeMenu(); }
    bell.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (menu) { closeMenu(); return; }
      var seen = getNotifSeen();
      menu = el('div', { class: 'sesd-notif-menu' });
      menu.appendChild(el('div', { class: 'sesd-notif-head' }, 'Notifikasi'));
      if (!items.length) menu.appendChild(el('div', { class: 'sesd-notif-empty' }, 'Belum ada notifikasi.'));
      else items.forEach(function (i) {
        var row = el('a', { class: 'sesd-notif-row' + (i.ts > seen ? ' is-unread' : ''), href: i.href || '#' });
        row.appendChild(el('span', { class: 'sesd-notif-ic', html: ic(i.icon) }));
        var body = el('div', { style: 'min-width:0' });
        body.appendChild(el('div', { class: 'sesd-notif-text' }, i.text));
        body.appendChild(el('div', { class: 'sesd-notif-time' }, timeAgo(i.ts)));
        row.appendChild(body);
        menu.appendChild(row);
      });
      document.body.appendChild(menu);
      var r = bell.getBoundingClientRect();
      menu.style.top = (r.bottom + 8) + 'px';
      menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
      if (items.length) setNotifSeen(items[0].ts);   // opening the panel marks all read
      badge.style.display = 'none';
      setTimeout(function () { document.addEventListener('click', onDoc, true); }, 0);
    });
    function refresh() { buildNotifList().then(function (l) { items = l; if (!menu) paintBadge(); }); }
    refresh();
    // #1 — poll so new borrow requests reach the admin without a manual reload,
    // and refresh whenever the tab regains focus.
    setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
  }

  async function boot() {
    setTimeout(function () { document.body.classList.add('sesd-ready'); }, 6000); // safety: never get stuck on the loader
    var g = guard();
    if (g.redirect) return;
    USER = g.user;
    IS_ADMIN = !!(USER && USER.role === 'admin');
    IS_VERIFIKATOR = !!(USER && USER.role === 'verifikator');
    IS_STAFF = IS_ADMIN || IS_VERIFIKATOR;
    // No data caching: every page fetches fresh from the DB, so always show the
    // loader while the data loads (the laporan page hands the loader to reports.js).
    showPageLoader();
    buildShell();                 // fill dynamic sidebar/topbar on pages that opt in
    fillIdentity(USER);
    // #1 — pull fresh identity (name + photo) from the server so profile edits made
    // on one device show everywhere; non-blocking, best-effort.
    if (USER && DB.profile) DB.profile().then(function (p) {
      if (!p) return;
      if (p.name) { USER.name = p.name; }
      if (p.name || p.nip) fillIdentity(USER);
      if (p.avatar) { try { localStorage.setItem(avatarKeyFor(USER), p.avatar); } catch (e) {} if (window.SESDIAN_APPLY_AVATAR) window.SESDIAN_APPLY_AVATAR(); }
    }).catch(function () {});
    injectBorrowedNav();          // "Sedang Dipinjam" link for all authed users
    if (IS_STAFF) injectRoleNav();
    setupGreeting();              // dashboard greeting (role-aware)
    normalizeChrome();            // brand logo + per-page sidebar/topbar icons (#1/#2/#5)
    if (IS_ADMIN) injectAdminBars();
    // Kerangka halaman (chevron sidebar, tanggal, breadcrumb, layout mobile) tidak
    // butuh data DB — pasang SEBELUM menunggu load supaya tampilan saat loading
    // sudah sama persis dengan tampilan sesudah data masuk.
    setupMobileLayout();
    setupSidebarCollapse();
    setupDates();
    translateBreadcrumbs();
    await loadAndRender(page());
    if (page() !== 'laporan') hidePageLoader();
    document.body.classList.add('sesd-ready');   // reveal once DB data is rendered (no hardcoded flash)
    wireActions(); wireNav(); wireModal(); wireSearch(); wireFilters(); fallbacks(); setupNotice();
    reapplyFilters();
    wireNotifBell();              // #3 — functional notification bell (badge + dropdown)
    labelizeTables();             // #11 — mobile card-table labels
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
