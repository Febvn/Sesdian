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
    localStorage.setItem(KEY, JSON.stringify({ nip: nip, name: name, initials: initials(name), role: 'admin' })); // demo = admin so all features are previewable
    toast('Berhasil masuk (mode demo: admin)', 'success'); setTimeout(go('dashboard.html'), 350);
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
    $$('[data-user-initials]').forEach(function (e) {
      e.textContent = user.initials || initials(user.name);
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
      if (f === 'image') { e.loading = 'lazy'; e.decoding = 'async'; e.src = rec.image || PLACEHOLDER; return; }
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
      } else if (p === 'dataaset') {
        var assets = await DB.assets();
        var groups = groupAssets(assets);                        // collapse identical items into tidy cards
        renderList('[data-template]', groups, function (n, g) {
          n.setAttribute('data-type', (g.type || '').toLowerCase() === 'non-bmn' ? 'non-bmn' : 'bmn');
          n.setAttribute('data-status', g.available > 0 ? 'available' : 'borrowed');
          n.removeAttribute('data-open-detail');                 // detail is a dynamic modal, not a static page
          n.addEventListener('click', function (ev) { if (ev.target.closest('.sesd-admin-actions')) return; openGroupDetail(g); });
        });
        var sum = function (k) { return assets.reduce(function (t, a) { return t + (a[k] || 0); }, 0); };
        var aStats = { total_assets: assets.length, total_stock: sum('stock_total'), stock_available: sum('stock_available'), stock_borrowed: sum('stock_borrowed'), maintenance: 0 };
        Object.keys(aStats).forEach(function (k) { var e = $('[data-stat="' + k + '"]'); if (e) e.textContent = aStats[k]; });
        var sub = $('[data-asset-subtitle]'); if (sub) sub.textContent = groups.length + ' jenis · ' + assets.length + ' unit · ' + aStats.total_stock + ' total stok';
      } else if (p === 'kategoriaset') {
        renderList('[data-template]', await DB.categories(), function (n, r) { n.setAttribute('data-id', r.id); if (IS_ADMIN) enhanceSimpleCard(n, r, 'category'); });
      } else if (p === 'ruangan') {
        renderList('[data-template]', await DB.rooms(), function (n, r) { n.setAttribute('data-id', r.id); if (IS_ADMIN) enhanceSimpleCard(n, r, 'room'); });
      } else if (p === 'daftarpinjam') {
        // requests still in the approval/verification pipeline (not yet out, not returned)
        var allbs = await DB.borrowings();
        var bs = allbs.filter(function (b) { return b.status === 'pending' || b.status === 'approved' || b.status === 'rejected'; });
        ensureAksiHeader();
        renderList('[data-template]', bs, function (n, r) { n.setAttribute('data-status', r.status); enhanceBorrowingRow(n, r); });
        var counts = { pending: 0, approved: 0, rejected: 0, returned: 0 };
        allbs.forEach(function (b) { if (counts[b.status] != null) counts[b.status]++; });
        Object.keys(counts).forEach(function (k) { var e = $('[data-count="' + k + '"]'); if (e) e.textContent = counts[k]; });
        if ($('[data-asset-template]')) {
          renderList('[data-asset-template]', await DB.assets(), function (n, r) { var cb = $('[data-asset-checkbox]', n) || $('input[type="checkbox"]', n); if (cb) cb.value = String(r.id); });
        }
      } else if (p === 'verifikasi') {
        var allb = await DB.borrowings();
        var queue = allb.filter(function (b) { return b.status === 'approved'; });
        ensureAksiHeader();
        renderList('[data-template]', queue, function (n, r) { n.setAttribute('data-status', r.status); enhanceBorrowingRow(n, r); });
        var qc = $('[data-count="approved"]'); if (qc) qc.textContent = queue.length;
        var done = allb.filter(function (b) { return b.status === 'verified' || b.status === 'borrowed' || b.status === 'returned'; }).length;
        var dc = $('[data-count="verified"]'); if (dc) dc.textContent = done;
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
        await wireWaSettings();
      }
    } catch (e) {
      if (e && e.status === 401) { location.replace('login.html'); return; }
      toast('Gagal memuat data: ' + ((e && e.message) || e), 'error');
    }
  }

  function reapplyFilters() { var it = $('[data-search-item]'); if (it) applyFilters(it.getAttribute('data-search-item')); }
  async function reloadData() { await loadAndRender(page()); reapplyFilters(); }

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
    var inputs = {};
    opts.fields.forEach(function (f) {
      var wrap = el('div', { class: 'sesd-field' });
      wrap.appendChild(el('label', {}, f.label));
      var input;
      if (f.type === 'select') { input = el('select'); (f.options || []).forEach(function (o) { var op = el('option', { value: o.value }, o.label); if (String(f.value) === String(o.value)) op.selected = true; input.appendChild(op); }); }
      else if (f.type === 'textarea') { input = el('textarea'); if (f.value) input.value = f.value; }
      else if (f.type === 'file') { input = el('input', { type: 'file', accept: 'image/*' }); }
      else { input = el('input', { type: f.type || 'text' }); if (f.value != null) input.value = f.value; if (f.placeholder) input.placeholder = f.placeholder; }
      inputs[f.name] = input;
      wrap.appendChild(input);
      if (f.type === 'file') {
        var prev = el('img', { class: 'sesd-imgprev' }); if (f.value) { prev.src = f.value; prev.style.display = 'block'; } wrap.appendChild(prev);
        input.addEventListener('change', async function () { if (input.files && input.files[0]) { try { var u = await fileToDataURL(input.files[0]); input._dataurl = u; prev.src = u; prev.style.display = 'block'; } catch (e) { toast('Gagal membaca gambar', 'error'); } } });
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

  async function openAssetForm(rec) {
    var cats = [], rms = [];
    try { cats = await DB.categories(); rms = await DB.rooms(); } catch (e) {}
    overlayForm({
      title: rec ? 'Edit Aset' : 'Tambah Aset', submitLabel: rec ? 'Simpan' : 'Tambah',
      fields: [
        { name: 'name', label: 'Nama Aset', value: rec && rec.name },
        { name: 'code', label: 'Kode', value: rec && rec.code },
        { name: 'category_id', label: 'Kategori', type: 'select', value: rec && rec.category_id, options: cats.map(function (c) { return { value: c.id, label: c.name }; }) },
        { name: 'room_id', label: 'Ruangan', type: 'select', value: rec && rec.room_id, options: rms.map(function (r) { return { value: r.id, label: r.name }; }) },
        { name: 'brand', label: 'Merek', value: rec && rec.brand },
        { name: 'year', label: 'Tahun', type: 'number', value: rec && rec.year },
        { name: 'type', label: 'Jenis', type: 'select', value: (rec && rec.type) || 'BMN', options: [{ value: 'BMN', label: 'BMN' }, { value: 'Non-BMN', label: 'Non-BMN' }] },
        { name: 'condition', label: 'Kondisi', value: (rec && rec.condition) || 'Baik' },
        { name: 'stock_total', label: 'Jumlah Stok', type: 'number', value: (rec && rec.stock_total != null) ? rec.stock_total : 1 },
        { name: 'image', label: 'Gambar (opsional)', type: 'file', value: rec && rec.image },
      ],
      onSave: async function (v) {
        if (!v.name || !v.code) throw new Error('Nama dan kode wajib diisi');
        if (rec) await DB.updateAsset(rec.id, v); else await DB.createAsset(v);
        toast(rec ? 'Aset diperbarui' : 'Aset ditambahkan', 'success'); reloadData();
      },
    });
  }
  function openAssetDetail(r) {
    if (modalOpen()) return;
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:520px' });
    m.appendChild(el('img', { src: r.image || PLACEHOLDER, style: 'width:100%;height:180px;object-fit:cover;border-radius:12px;background:linear-gradient(135deg,#eef4fb,#e3f0fb)' }));
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
      var key = (a.name || '').trim().toLowerCase() + '|' + (a.category || '').toLowerCase();
      var g = map[key];
      if (!g) { g = map[key] = { name: a.name, category: a.category, brand: a.brand, room: a.room, type: a.type, condition: a.condition, image: a.image, units: [], stock_total: 0, stock_available: 0, stock_borrowed: 0 }; order.push(key); }
      g.units.push(a);
      g.stock_total += (a.stock_total != null ? a.stock_total : 1);
      g.stock_available += (a.stock_available || 0);
      g.stock_borrowed += (a.stock_borrowed || 0);
      if (!g.image && a.image) g.image = a.image;
      if (g.brand && a.brand && g.brand !== a.brand) g.brand = 'Beragam';
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
    m.appendChild(el('div', { style: 'color:var(--text-muted);font-size:.82rem;margin:-6px 0 12px' }, (g.category || '-') + (g.brand ? (' · ' + g.brand) : '')));
    var sum = el('div', { style: 'display:flex;gap:.6rem;margin-bottom:1rem' });
    [['Total', g.stock_total, 'var(--text)'], ['Tersedia', g.stock_available, 'rgb(16,185,129)'], ['Dipinjam', g.stock_borrowed, 'rgb(245,158,11)']].forEach(function (s) {
      var b = el('div', { style: 'flex:1;text-align:center;background:var(--bg);border-radius:10px;padding:.6rem' });
      b.appendChild(el('div', { style: 'font-size:1.2rem;font-weight:800;color:' + s[2] }, String(s[1] != null ? s[1] : 0)));
      b.appendChild(el('div', { style: 'font-size:.7rem;color:var(--text-muted)' }, s[0]));
      sum.appendChild(b);
    });
    m.appendChild(sum);
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
    dateWrap.appendChild(el('label', { style: 'font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px' }, 'Tanggal Kembali'));
    var dateInput = el('input', { type: 'date', value: '', style: 'width:100%;padding:.6rem .8rem;border:1.5px solid var(--border);border-radius:10px;font-size:.875rem;outline:none;box-sizing:border-box' });
    dateWrap.appendChild(dateInput); m.appendChild(dateWrap);
    var foot = el('div', { style: 'display:flex;gap:8px;margin-top:1rem' });
    ajukan.addEventListener('click', async function () {
      var ids = Object.keys(selected);
      if (!ids.length) { toast('Pilih unit yang ingin dipinjam', 'error'); return; }
      ajukan.disabled = true;
      try {
        for (var i = 0; i < ids.length; i++) await DB.requestBorrowing({ assetId: parseInt(ids[i], 10), qty: 1, dueDate: dateInput.value || null, notes: null });
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
      verify.addEventListener('click', async function () {
        verify.disabled = true;
        try { await DB.updateBorrowingStatus(b.id, 'returned'); toast('Diverifikasi dikembalikan', 'success'); if (onChange) onChange(b); }
        catch (e) { toast((e && e.message) || 'Gagal', 'error'); verify.disabled = false; }
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
  async function changeStatus(rec, status) {
    try {
      await DB.updateBorrowingStatus(rec.id, status); toast('Status diperbarui', 'success');
      if (status === 'returned') { DB.notify(rec.id, 'returned').then(function (r) { if (r && !r.auto && r.wa) openWaLink(r.wa, r.text); }).catch(function () {}); } // best-effort, silent
      reloadData();
    }
    catch (e) { toast((e && e.message) || 'Gagal', 'error'); }
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
      if (isOverdue(rec) && (rec.status === 'borrowed' || rec.status === 'verified')) btns.unshift(['Ingatkan WA', 'warning', function () { doNotify(rec, 'remind', 'Pengingat dikirim ke peminjam'); }]);
    } else if (rec.status === 'borrowed' || rec.status === 'verified') {
      btns.push(['Konfirmasi Pengembalian', 'primary', function () { changeStatus(rec, 'return_pending'); }]);
    } else if (rec.status === 'return_pending') {
      cell._note = 'Menunggu verifikasi admin';
    }
    if (!btns.length) cell.appendChild(el('span', { style: 'color:var(--text-muted);font-size:.78rem' }, cell._note || '-'));
    btns.forEach(function (a) {
      var b = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-' + a[1] }, a[0]);
      b.addEventListener('click', function (e) { e.stopPropagation(); a[2](); });
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
      tr.appendChild(el('td', { style: td + ';font-weight:600' }, u.name));
      tr.appendChild(el('td', { style: td + ';color:var(--text-muted);font-family:"JetBrains Mono",monospace;font-size:0.8rem' }, u.nip));
      var roleTd = el('td', { style: td });
      roleTd.appendChild(roleBadge(u.role));
      tr.appendChild(roleTd);
      var actTd = el('td', { style: td });
      var wrap = el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' });
      var sel = el('select', { style: 'padding:0.35rem 0.5rem;border:1.5px solid var(--border);border-radius:8px;font-size:0.78rem;font-family:inherit;cursor:pointer' });
      ['user', 'verifikator', 'admin'].forEach(function (r) { var o = el('option', { value: r }, ROLE_META[r][0]); if (u.role === r) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', async function () { try { await DB.setUserRole(u.id, sel.value); toast('Role diperbarui', 'success'); renderUsers(); } catch (e) { toast((e && e.message) || 'Gagal', 'error'); renderUsers(); } });
      var del = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger', html: ic('trash') });
      del.addEventListener('click', function () { confirmDelete('user "' + u.name + '"', async function () { await DB.deleteUser(u.id); toast('User dihapus', 'success'); renderUsers(); }); });
      wrap.appendChild(sel); wrap.appendChild(del);
      actTd.appendChild(wrap); tr.appendChild(actTd);
      list.appendChild(tr);
    });
  }
  function openUserForm() {
    overlayForm({
      title: 'Tambah User', submitLabel: 'Tambah',
      fields: [
        { name: 'name', label: 'Nama Lengkap' },
        { name: 'nip', label: 'NIP' },
        { name: 'password', label: 'Password (min. 8 karakter)', type: 'password' },
        { name: 'role', label: 'Role', type: 'select', value: 'user', options: [{ value: 'user', label: 'User' }, { value: 'verifikator', label: 'Verifikator' }, { value: 'admin', label: 'Admin' }] },
        { name: 'phone', label: 'No. HP / WhatsApp (opsional)' },
      ],
      onSave: async function (v) {
        if (!v.name || !v.nip) throw new Error('Nama dan NIP wajib diisi');
        if (!v.password || v.password.length < 8) throw new Error('Password minimal 8 karakter');
        await DB.createUser({ nip: v.nip, name: v.name, password: v.password, role: v.role, phone: v.phone });
        toast('User ditambahkan', 'success'); reloadData();
      },
    });
  }

  async function wireWaSettings() {
    var input = $('[data-wa-input]'), save = $('[data-wa-save]'), status = $('[data-wa-status]');
    if (!input || !save) return;
    function note(s) { if (!status) return; status.textContent = s.wa_auto ? 'Auto-kirim via gateway aktif.' : (s.wa_number ? 'Notifikasi dikirim lewat tautan WhatsApp saat user mengajukan.' : 'Belum ada nomor admin.'); }
    try { var s = await DB.getSettings(); input.value = s.wa_number || ''; note(s); } catch (e) {}
    save.addEventListener('click', async function () {
      save.disabled = true;
      try { var r = await DB.setWaNumber(input.value); toast('Nomor WhatsApp disimpan', 'success'); input.value = r.wa_number || ''; note(r); }
      catch (e) { toast((e && e.message) || 'Gagal menyimpan', 'error'); }
      save.disabled = false;
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
    return el('a', { href: href, style: style, html: '<span class="ic" style="font-size:1rem;flex-shrink:0;line-height:1">' + icon + '</span><div style="overflow:hidden;flex:1 1 0%"><div style="font-size:0.8rem;font-weight:' + (active ? '700' : '500') + ';white-space:nowrap;color:inherit">' + title + '</div><div style="font-size:0.62rem;color:' + sub + ';white-space:nowrap;margin-top:1px">' + subtitle + '</div></div>' });
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
  var PAGE_TITLES = { dashboard: 'Dashboard', dataaset: 'Data Aset', kategoriaset: 'Kategori Aset', ruangan: 'Ruangan', daftarpinjam: 'Daftar Pinjam', ajukanpinjam: 'Ajukan Pinjam', dipinjam: 'Sedang Dipinjam', users: 'Kelola User', verifikasi: 'Verifikasi', laporan: 'Laporan' };
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
      nav.appendChild(navSection('ASET', [makeNavLink('dataaset.html', 'package', 'Data Aset', 'Lihat semua aset'), makeNavLink('kategoriaset.html', 'tag', 'Kategori Aset', 'Jenis-jenis aset'), makeNavLink('ruangan.html', 'home', 'Ruangan', 'Daftar ruangan')]));
      nav.appendChild(navSection('PEMINJAMAN', [makeNavLink('daftarpinjam.html', 'refresh', 'Daftar Pinjam', 'Riwayat peminjaman'), makeNavLink('ajukanpinjam.html', 'clipboard', 'Ajukan Pinjam', 'Request baru')]));
      aside.appendChild(nav);
      aside.appendChild(el('div', { style: 'padding:0.75rem;border-top:1px solid rgb(26,37,64)', html: '<div style="display:flex;align-items:center;gap:8px;padding:0.6rem;border-radius:10px;background:linear-gradient(135deg,rgb(26,37,64),rgb(15,23,42));border:1px solid rgb(30,41,59)"><div data-user-initials style="width:34px;height:34px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,rgb(99,102,241),rgb(139,92,246));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.75rem">AS</div><div style="flex:1 1 0%;min-width:0px"><div data-user-name style="color:rgb(226,232,240);font-size:0.75rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Pengguna</div><div data-user-role style="color:rgb(51,65,85);font-size:0.6rem;text-transform:uppercase;letter-spacing:1px">user</div></div><button data-action="logout" style="background:transparent;border:1px solid rgb(30,41,59);color:rgb(71,85,105);cursor:pointer;font-size:0.7rem;padding:0.25rem 0.5rem;border-radius:6px;flex-shrink:0">Keluar</button></div>' }));
    }
    var top = $('[data-topbar]');
    if (top && !top.children.length) {
      top.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px', html: '<span class="ic" style="color:var(--text-muted)">' + ((window.SESDIAN_ICONS && window.SESDIAN_ICONS.home) || '') + '</span><span style="color:var(--text);font-weight:600">' + (PAGE_TITLES[page()] || '') + '</span>' }));
      top.appendChild(el('div', { style: 'display:flex;align-items:center;gap:6px', html: '<div style="width:7px;height:7px;border-radius:50%;background:rgb(16,185,129);box-shadow:rgba(16,185,129,0.2) 0px 0px 0px 3px"></div><span style="font-size:0.75rem;color:rgb(100,116,139);font-weight:500">Online</span>' }));
    }
  }

  function injectAdminBars() {
    var p = page();
    var content = $$('main > div').pop(); if (!content) return;
    var inner = content.firstElementChild || content;
    function bar(buttons) {
      var wrap = el('div', { class: 'sesd-admin-bar' });
      buttons.forEach(function (b) {
        var btn = el('button', { class: 'sesd-btn sesd-btn-' + (b.variant || 'primary'), html: (b.icon ? ic(b.icon) + ' ' : '') + b.label });
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
          btns.forEach(function (x) { if (inactiveStyle) x.style.cssText = inactiveStyle; });
          if (activeStyle) b.style.cssText = activeStyle;
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
  function buildAjukanList(groups) {
    var container = $('[data-list="assets"]'); if (!container) return;
    var leftCol = container.parentNode, grid = leftCol && leftCol.parentNode;
    if (grid) { grid.style.gridTemplateColumns = '1fr'; var sb = grid.children[1]; if (sb && sb !== leftCol) sb.style.display = 'none'; }
    container.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem';
    container.innerHTML = '';
    var availTotal = 0;
    if (!groups.length) { appendEmpty(container, 'Belum ada aset.'); return; }
    groups.forEach(function (g) {
      var avail = g.units.filter(function (u) { return (u.stock_available || 0) > 0; }).length;
      availTotal += avail;
      var card = el('div', { 'data-search-item': 'assets', 'data-status': avail > 0 ? 'available' : 'unavailable', style: 'background:#fff;border-radius:16px;border:1px solid var(--border);box-shadow:var(--shadow);padding:1rem;cursor:pointer;transition:transform .15s' });
      card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-3px)'; });
      card.addEventListener('mouseleave', function () { card.style.transform = 'none'; });
      card.addEventListener('click', function () { openGroupDetail(g); });
      var top = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px' });
      top.appendChild(el('span', { style: 'font-size:0.65rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:20px;background:rgb(219,234,254);color:rgb(30,64,175)' }, g.type || 'BMN'));
      top.appendChild(el('span', { style: 'font-size:0.68rem;font-weight:800;padding:0.15rem 0.55rem;border-radius:20px;' + (avail > 0 ? 'background:rgb(220,252,231);color:rgb(22,101,52)' : 'background:rgb(254,226,226);color:rgb(153,27,27)') }, avail > 0 ? ('Tersedia ' + avail) : 'Habis'));
      card.appendChild(top);
      card.appendChild(el('div', { style: 'font-weight:700;font-size:0.95rem;margin-bottom:6px' }, g.name || ''));
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
    if ($('input[type="date"]') && !date) { toast('Pilih tanggal kembali', 'error'); return; }
    var notes = val('notes');
    try {
      for (var i = 0; i < picked.length; i++) await DB.requestBorrowing({ assetId: picked[i].id, qty: 1, dueDate: date || null, notes: notes });
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
    if (page() === 'login' || page() === 'register') {
      $$('input').forEach(function (input) { input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var b = $('[data-action="' + page() + '"]') || byText(page() === 'login' ? /^Masuk/ : /^Daftar/)[0]; if (b) b.click(); else page() === 'login' ? doLogin() : doRegister(); } }); });
    }
  }

  function fallbacks() {
    if (!$('[data-action="logout"]')) byText(/^(Keluar|Logout|Log out)$/i).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); withLoading(b, doLogout); }); });
    if (page() === 'login' && !$('[data-action="login"]')) { byText(/^Masuk/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); withLoading(b, doLogin); }); }); byText(/👁/).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); togglePassword(b); }); }); }
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
    var backdrop = el('div', { class: 'sesd-mobile-backdrop' });
    document.body.appendChild(backdrop);
    var hamburger = el('button', { class: 'sesd-hamburger' });
    hamburger.innerHTML = '☰';
    header.insertBefore(hamburger, header.firstChild);
    var toggle = function(e) { if (e) e.preventDefault(); aside.classList.toggle('sesd-open'); backdrop.classList.toggle('sesd-open'); };
    hamburger.addEventListener('click', toggle);
    backdrop.addEventListener('click', toggle);
    var closeBtn = byText(/^‹$/, 'aside button')[0];
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); toggle(); });
  }

  function setupDates() {
    var now = new Date();
    var shortDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    var longDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    $$('span, div').forEach(function(e) {
      if (e.children.length === 0) {
        if (/18 Jun 2026/i.test(e.textContent)) e.textContent = shortDate;
        else if (/KAMIS, 18 JUNI 2026/i.test(e.textContent)) e.textContent = longDate;
      }
    });
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
    injectBorrowedNav();          // "Sedang Dipinjam" link for all authed users
    if (IS_STAFF) injectRoleNav();
    if (IS_ADMIN) injectAdminBars();
    await loadAndRender(page());
    if (page() !== 'laporan') hidePageLoader();
    setupMobileLayout();
    setupDates();
    translateBreadcrumbs();
    document.body.classList.add('sesd-ready');   // reveal once DB data is rendered (no hardcoded flash)
    wireActions(); wireNav(); wireModal(); wireSearch(); wireFilters(); fallbacks(); setupNotice();
    reapplyFilters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
