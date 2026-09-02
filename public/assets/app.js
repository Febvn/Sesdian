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
  var USER = null, IS_ADMIN = false;

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
    pending: { label: 'Pending', bg: '#fef3c7', fg: '#92400e' },
    approved: { label: 'Disetujui', bg: '#dbeafe', fg: '#1e40af' },
    borrowed: { label: 'Dipinjam', bg: '#ede9fe', fg: '#5b21b6' },
    returned: { label: 'Kembali', bg: '#dcfce7', fg: '#166534' },
    rejected: { label: 'Ditolak', bg: '#fee2e2', fg: '#991b1b' },
  };

  /* ---------------- toast ---------------- */
  function toast(msg, type) {
    var wrap = $('.sesd-toast-wrap');
    if (!wrap) { wrap = el('div', { class: 'sesd-toast-wrap' }); document.body.appendChild(wrap); }
    var t = el('div', { class: 'sesd-toast ' + (type || 'info') }, msg);
    wrap.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s,transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(function () { t.remove(); }, 320); }, 2800);
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
    var user = currentUser();
    if (needsAuth && !user) { location.replace('login.html'); return { redirect: true }; }
    if ((page() === 'login' || page() === 'register') && user) { location.replace('dashboard.html'); return { redirect: true }; }
    if (needsAdmin && (!user || user.role !== 'admin')) { location.replace('dashboard.html'); return { redirect: true }; }
    return { redirect: false, user: user };
  }

  function fillIdentity(user) {
    if (!user) return;
    $$('[data-user-name]').forEach(function (e) { e.textContent = user.name; });
    $$('[data-user-initials]').forEach(function (e) { e.textContent = user.initials || initials(user.name); });
    $$('[data-user-firstname]').forEach(function (e) { e.textContent = (user.name || '').split(/\s+/)[0]; });
    $$('[data-user-role]').forEach(function (e) { e.textContent = user.role || 'user'; });
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
      if (f === 'image') { e.src = rec.image || PLACEHOLDER; return; }
      if (f === 'icon') { var nm = iconFor(rec.icon); if (nm) { e.innerHTML = window.SESDIAN_ICONS[nm]; e.style.color = 'var(--primary)'; } else { e.textContent = rec.icon || ''; } return; }
      var v = rec[f];
      if (v !== undefined && v !== null) e.textContent = v;
    });
  }

  function appendEmpty(container, msg) {
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
    entry.container.innerHTML = '';
    if (!records.length) { appendEmpty(entry.container); return; }
    records.forEach(function (rec) { var n = entry.src.cloneNode(true); applyBinds(n, rec); if (fill) fill(n, rec); entry.container.appendChild(n); });
  }

  function prepLoading() { $$('[data-stat],[data-count]').forEach(function (e) { e.textContent = ''; }); }

  /* ---------------- per-page data load (BOTH modes) ---------------- */
  async function loadAndRender(p) {
    try {
      if (p === 'dashboard') {
        var d = await DB.dashboard();
        Object.keys(d.stats).forEach(function (k) { var e = $('[data-stat="' + k + '"]'); if (e) e.textContent = d.stats[k]; });
        renderList('[data-monitor-template]', d.monitor);
        renderList('[data-recent-template]', d.recent);
      } else if (p === 'dataaset') {
        var assets = await DB.assets();
        renderList('[data-template]', assets, function (n, r) {
          n.setAttribute('data-type', (r.type || '').toLowerCase() === 'non-bmn' ? 'non-bmn' : 'bmn');
          n.setAttribute('data-status', r.stock_available > 0 ? 'available' : 'borrowed');
          n.setAttribute('data-asset-id', r.id);
          n.removeAttribute('data-open-detail');                 // detail is a dynamic modal, not a static page
          n.addEventListener('click', function (ev) { if (ev.target.closest('.sesd-admin-actions')) return; openAssetDetail(r); });
          if (IS_ADMIN) enhanceAssetCard(n, r);
        });
        var sum = function (k) { return assets.reduce(function (t, a) { return t + (a[k] || 0); }, 0); };
        var aStats = { total_assets: assets.length, total_stock: sum('stock_total'), stock_available: sum('stock_available'), stock_borrowed: sum('stock_borrowed'), maintenance: 0 };
        Object.keys(aStats).forEach(function (k) { var e = $('[data-stat="' + k + '"]'); if (e) e.textContent = aStats[k]; });
        var sub = $('[data-asset-subtitle]'); if (sub) sub.textContent = aStats.total_assets + ' aset · ' + aStats.total_stock + ' total unit stok';
      } else if (p === 'kategoriaset') {
        renderList('[data-template]', await DB.categories(), function (n, r) { n.setAttribute('data-id', r.id); if (IS_ADMIN) enhanceSimpleCard(n, r, 'category'); });
      } else if (p === 'ruangan') {
        renderList('[data-template]', await DB.rooms(), function (n, r) { n.setAttribute('data-id', r.id); if (IS_ADMIN) enhanceSimpleCard(n, r, 'room'); });
      } else if (p === 'daftarpinjam') {
        var bs = await DB.borrowings();
        ensureAksiHeader();
        renderList('[data-template]', bs, function (n, r) { n.setAttribute('data-status', r.status); enhanceBorrowingRow(n, r); });
        var counts = { pending: 0, approved: 0, borrowed: 0, returned: 0 };
        bs.forEach(function (b) { if (counts[b.status] != null) counts[b.status]++; });
        Object.keys(counts).forEach(function (k) { var e = $('[data-count="' + k + '"]'); if (e) e.textContent = counts[k]; });
        if ($('[data-asset-template]')) {
          renderList('[data-asset-template]', await DB.assets(), function (n, r) { var cb = $('[data-asset-checkbox]', n) || $('input[type="checkbox"]', n); if (cb) cb.value = String(r.id); });
        }
      } else if (p === 'ajukanpinjam') {
        renderList('[data-template]', await DB.assets(), function (n, r) {
          n.setAttribute('data-asset-id', r.id);
          n.setAttribute('data-status', r.stock_available > 0 ? 'available' : 'unavailable');
        });
        wireAssetSelect();
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

  function fileToDataURL(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 800, w = img.width, h = img.height;
          if (w > max) { h = Math.round(h * max / w); w = max; }
          try { var c = el('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); resolve(c.toDataURL('image/jpeg', 0.82)); }
          catch (e) { resolve(fr.result); }
        };
        img.onerror = function () { resolve(fr.result); };
        img.src = fr.result;
      };
      fr.onerror = reject; fr.readAsDataURL(file);
    });
  }

  function overlayForm(opts) {
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
    var ov = overlay(), m = el('div', { class: 'sesd-modal', style: 'width:520px' });
    m.appendChild(el('img', { src: r.image || PLACEHOLDER, style: 'width:100%;height:180px;object-fit:cover;border-radius:12px;background:linear-gradient(135deg,#eef2ff,#e0e7ff)' }));
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
    var bar = el('div', { class: 'sesd-admin-actions', style: 'padding:0 1rem 1rem' });
    var edit = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-ghost', html: ic('pencil') + ' Edit' });
    var del = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-danger', html: ic('trash') + ' Hapus' });
    edit.addEventListener('click', function (e) { e.stopPropagation(); openAssetForm(rec); });
    del.addEventListener('click', function (e) { e.stopPropagation(); confirmDelete('aset "' + rec.name + '"', async function () { await DB.deleteAsset(rec.id); toast('Aset dihapus', 'success'); reloadData(); }); });
    bar.appendChild(edit); bar.appendChild(del); card.appendChild(bar);
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
    if (isOverdue(rec)) { var dd = $('[data-bind="due_date"]', row); if (dd) { dd.style.color = 'var(--danger)'; dd.style.fontWeight = '700'; } }
    var cell = el('td', { style: 'padding:0.875rem 1rem' });           // dedicated Aksi cell (never the date cell)
    var bar = el('div', { class: 'sesd-admin-actions' });
    var btns = [];
    if (IS_ADMIN) {
      if (rec.status === 'pending') { btns.push(['Setujui', 'success', function () { changeStatus(rec, 'approved'); }], ['Tolak', 'danger', function () { changeStatus(rec, 'rejected'); }]); }
      else if (rec.status === 'approved') { btns.push(['Pinjamkan', 'primary', function () { changeStatus(rec, 'borrowed'); }], ['Tolak', 'danger', function () { changeStatus(rec, 'rejected'); }]); }
      else if (rec.status === 'borrowed') { btns.push(['Kembalikan', 'ghost', function () { changeStatus(rec, 'returned'); }]); }
      if (isOverdue(rec) && (rec.status === 'approved' || rec.status === 'borrowed')) btns.unshift(['Ingatkan WA', 'warning', function () { doNotify(rec, 'remind', 'Pengingat dikirim ke peminjam'); }]);
    } else if (rec.status === 'approved' || rec.status === 'borrowed') {
      btns.push(['Konfirmasi Pengembalian', 'primary', function () { doNotify(rec, 'return-request', 'Konfirmasi dikirim ke admin'); }]);
    }
    if (!btns.length) cell.appendChild(el('span', { style: 'color:var(--text-muted);font-size:.78rem' }, '-'));
    btns.forEach(function (a) {
      var b = el('button', { class: 'sesd-btn sesd-btn-sm sesd-btn-' + a[1] }, a[0]);
      b.addEventListener('click', function (e) { e.stopPropagation(); a[2](); });
      bar.appendChild(b);
    });
    if (btns.length) cell.appendChild(bar);
    row.appendChild(cell);
  }

  async function renderUsers() {
    var list = $('[data-users-list]'); if (!list) return;
    var users = [];
    try { users = await DB.users(); } catch (e) { if (e && e.status === 401) { location.replace('login.html'); return; } toast((e && e.message) || 'Gagal memuat user', 'error'); }
    var cnt = $('[data-users-count]'); if (cnt) cnt.textContent = users.length;
    list.innerHTML = '';
    if (!users.length) { appendEmpty(list); return; }
    var td = 'padding:0.875rem 1rem;font-size:0.875rem;border-top:1px solid var(--border)';
    users.forEach(function (u) {
      var tr = el('tr');
      tr.appendChild(el('td', { style: td + ';font-weight:600' }, u.name));
      tr.appendChild(el('td', { style: td + ';color:var(--text-muted);font-family:"JetBrains Mono",monospace;font-size:0.8rem' }, u.nip));
      var roleTd = el('td', { style: td });
      roleTd.appendChild(el('span', { class: 'sesd-role sesd-role-' + (u.role === 'admin' ? 'admin' : 'user'), html: (u.role === 'admin' ? ic('shield') + ' Admin' : ic('user') + ' User') }));
      tr.appendChild(roleTd);
      var actTd = el('td', { style: td });
      var toAdmin = u.role !== 'admin';
      var btn = el('button', { class: 'sesd-btn sesd-btn-sm ' + (toAdmin ? 'sesd-btn-primary' : 'sesd-btn-ghost') }, toAdmin ? 'Jadikan Admin' : 'Jadikan User');
      btn.addEventListener('click', async function () { try { await DB.setUserRole(u.id, toAdmin ? 'admin' : 'user'); toast('Role diperbarui', 'success'); renderUsers(); } catch (e) { toast((e && e.message) || 'Gagal', 'error'); } });
      actTd.appendChild(btn); tr.appendChild(actTd);
      list.appendChild(tr);
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

  function injectAdminNav() {
    if ($('aside a[href="users.html"]')) { markUsersActive(); return; }
    var ref = $('aside a[href="ajukanpinjam.html"]'); if (!ref) return;
    var navContainer = ref.parentNode.parentNode;
    var sec = el('div', { style: 'margin-bottom:0.25rem' });
    sec.appendChild(el('div', { style: 'display:flex;align-items:center;gap:6px;padding:0.6rem 0.5rem 0.25rem', html: '<div style="flex:1 1 0%;height:1px;background:rgb(26,37,64)"></div><span style="font-size:0.55rem;color:rgb(51,65,85);font-weight:800;letter-spacing:1.5px;white-space:nowrap">ADMIN</span><div style="flex:1 1 0%;height:1px;background:rgb(26,37,64)"></div>' }));
    var a = el('a', { href: 'users.html', style: 'display:flex;align-items:center;gap:10px;padding:0.55rem 0.75rem;border-radius:10px;margin-bottom:2px;color:rgb(100,116,139);background:transparent;text-decoration:none', html: '<span class="ic" style="font-size:1rem;flex-shrink:0;line-height:1">' + (window.SESDIAN_ICONS && window.SESDIAN_ICONS.users || '') + '</span><div style="overflow:hidden;flex:1 1 0%"><div style="font-size:0.8rem;font-weight:500;white-space:nowrap;color:inherit">Kelola User</div><div style="font-size:0.62rem;color:rgb(51,65,85);white-space:nowrap;margin-top:1px">User &amp; admin</div></div>' });
    sec.appendChild(a); navContainer.appendChild(sec);
    markUsersActive();
  }
  function markUsersActive() {
    if (page() !== 'users') return;
    var a = $('aside a[href="users.html"]'); if (!a) return;
    a.style.color = 'rgb(255,255,255)'; a.style.background = 'rgb(245,158,11)'; a.style.boxShadow = 'rgba(245,158,11,0.35) 0px 4px 12px';
    var lbl = a.querySelector('div div'); if (lbl) lbl.style.fontWeight = '700';
  }

  function injectAdminBars() {
    var p = page();
    var content = $$('main > div').pop(); if (!content) return;
    var inner = content.firstElementChild || content;
    function bar(label, onClick) { var b = el('button', { class: 'sesd-btn sesd-btn-primary' }, label); b.addEventListener('click', onClick); var wrap = el('div', { class: 'sesd-admin-bar' }); wrap.appendChild(b); inner.insertBefore(wrap, inner.firstChild); }
    if (p === 'dataaset') bar('Tambah Aset', function () { openAssetForm(null); });
    else if (p === 'kategoriaset') bar('Tambah Kategori', function () { openCategoryForm(null); });
    else if (p === 'ruangan') bar('Tambah Ruangan', function () { openRoomForm(null); });
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
  function wireSearch() { $$('[data-search]').forEach(function (input) { var g = input.getAttribute('data-search'); if (/<[^>]+>/.test(input.placeholder)) { input.placeholder = '\u{1F50D}  ' + input.placeholder.replace(/<[^>]+>/g, '').trim(); } input.addEventListener('input', function () { applyFilters(g); }); }); }
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
  async function submitPinjam() {
    var picked = [];
    $$('input[type="checkbox"]').forEach(function (c) { if (c.checked) { var v = parseInt(c.value, 10); if (v) picked.push({ id: v, name: nameOf(c.closest('label') || c.parentNode) || ('Aset #' + v) }); } });
    $$('[data-asset-select].sesd-selected').forEach(function (e) { var v = parseInt(e.getAttribute('data-asset-id'), 10); if (v) picked.push({ id: v, name: nameOf(e) || ('Aset #' + v) }); });
    var hasUI = $$('input[type="checkbox"]').length > 0 || $$('[data-asset-select]').length > 0;
    if (hasUI && !picked.length) { toast('Pilih minimal satu aset', 'error'); return; }
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
    byText(/18 Jun 2026/i, 'span, div').forEach(function(e) { e.textContent = shortDate; });
    byText(/KAMIS, 18 JUNI 2026/i, 'div').forEach(function(e) { e.textContent = longDate; });
  }

  function translateBreadcrumbs() {
    var map = { dashboard: 'Dashboard', dataaset: 'Data Aset', kategoriaset: 'Kategori Aset', ruangan: 'Ruangan', daftarpinjam: 'Daftar Pinjam', ajukanpinjam: 'Ajukan Pinjam', users: 'Kelola User' };
    var p = page();
    if (map[p]) {
      byText(new RegExp('^' + p + '$', 'i'), 'span').forEach(function(e) { e.textContent = map[p]; });
    }
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    setTimeout(function () { document.body.classList.add('sesd-ready'); }, 4000); // safety: never get stuck on the loader
    prepLoading();
    var g = guard();
    if (g.redirect) return;
    USER = g.user; IS_ADMIN = !!(USER && USER.role === 'admin');
    fillIdentity(USER);
    if (IS_ADMIN) { injectAdminNav(); injectAdminBars(); }
    await loadAndRender(page());
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
