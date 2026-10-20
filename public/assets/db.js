/* ============================================================
   SESDIAN - data layer
   Real mode: talks to the Neon-backed /api endpoints (JWT auth).
   Demo mode (config.BACKEND==='demo' / no backend): an in-memory
   dataset with the same API, so every page renders from JS in BOTH
   modes - the static HTML never shows hardcoded data first.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.SESDIAN_CONFIG || {};
  var BASE = (CFG.API_BASE || '').replace(/\/$/, '');
  var TKEY = 'sesdian_token';
  var demo = CFG.BACKEND === 'demo';

  function url(p) { return BASE + '/api/' + p; }
  function token() { try { return localStorage.getItem(TKEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { localStorage.setItem(TKEY, t); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TKEY); } catch (e) {} }

  async function req(p, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
    var res = await fetch(url(p), { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    var data = null; try { data = await res.json(); } catch (e) {}
    if (res.status === 401) { clearToken(); var err = new Error('Unauthorized'); err.status = 401; throw err; }
    if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  function decode(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }

  /* ====================== DEMO in-memory store ====================== */
  var DEMO = {
    seq: 100,
    categories: [['Elektronik', 'monitor'], ['Furnitur', 'chair'], ['Kendaraan', 'car'], ['Peralatan', 'wrench'], ['Dokumen', 'file'], ['Lain-lain', 'package']].map(function (c, i) { return { id: i + 1, name: c[0], icon: c[1] }; }),
    rooms: [['Ruang Kepala', 'RK-01'], ['Ruang Tata Usaha', 'TU-01'], ['Ruang Rapat', 'RR-01'], ['Ruang Pelayanan', 'RP-01'], ['Gudang', 'GD-01'], ['Laboratorium', 'LB-01']].map(function (r, i) { return { id: i + 1, name: r[0], code: r[1], pic: '' }; }),
    assets: [{ id: 1, code: '123', name: 'Laptop', category_id: 1, brand: 'Acer', room_id: 2, year: 2024, condition: 'Baik', type: 'BMN', asset_type: 'Fixed Asset', stock_total: 14, stock_available: 9, stock_borrowed: 5, image: null, qr_code: 'QR000001', status: 'tersedia' }],
    borrowings: [{ id: 1, asset_id: 1, borrower_name: 'Adi Septriansyah', qty: 1, status: 'pending', due_date: '2026-06-18', created_at: '2026-06-15T08:00:00Z' }],
    users: [{ id: 1, nip: '123456789012345678', name: 'Adi Septriansyah', role: 'admin' }, { id: 2, nip: '987654321098765432', name: 'Budi Santoso', role: 'user' }],
    settings: { wa_number: '' },
  };
  var catName = function (id) { var c = DEMO.categories.filter(function (x) { return x.id == id; })[0]; return c ? c.name : ''; };
  var roomName = function (id) { var r = DEMO.rooms.filter(function (x) { return x.id == id; })[0]; return r ? r.name : ''; };
  function demoAsset(a) { return Object.assign({}, a, { category: catName(a.category_id), room: roomName(a.room_id) }); }
  var P = function (v) { return Promise.resolve(v); };

  /* ====================== auth ====================== */
  var auth = {
    // check NIP existence and password status (step 1 of multi-step login)
    async checkNip(nip) { return await req('login', { method: 'POST', body: { nip: nip, action: 'check' } }); },
    async signUp(o) { var d = await req('register', { method: 'POST', body: { nip: o.nip, name: o.name, password: o.password, phone: o.phone } }); setToken(d.token); return d; },
    async signIn(o) {
      var d = await req('login', { method: 'POST', body: { nip: o.nip, password: o.password } });
      // akun NIP-saja menjawab { claim_required: true } tanpa token
      if (d.token) setToken(d.token);
      return d;
    },
    // klaim akun NIP-saja: pemilik NIP mengatur nama + password lalu langsung masuk
    async claimAccount(o) {
      var d = await req('login', { method: 'POST', body: { nip: o.nip, claim: true, name: o.name, password: o.password } });
      if (d.token) setToken(d.token);
      return d;
    },
    async signOut() { clearToken(); },
    currentUser() {
      var t = token(); if (!t) return null;
      var p = decode(t); if (!p) return null;
      if (p.exp && p.exp < Math.floor(Date.now() / 1000)) { clearToken(); return null; }
      return { nip: p.nip, name: p.name, role: p.role || 'user' };
    },
  };

  /* ====================== reads ====================== */
  async function cachedReq(key, ttlMs) {
    try {
      var raw = sessionStorage.getItem('sesdian_cache_' + key);
      if (raw) {
        var item = JSON.parse(raw);
        if (Date.now() - item.ts < ttlMs) return item.data;
      }
    } catch (e) {}

    var data = await req(key);

    try {
      sessionStorage.setItem('sesdian_cache_' + key, JSON.stringify({ data: data, ts: Date.now() }));
    } catch (e) {}
    return data;
  }

  async function categories() { return demo ? P(DEMO.categories.slice()) : (await cachedReq('categories', 60000)).categories; }
  async function rooms() { return demo ? P(DEMO.rooms.slice()) : (await cachedReq('rooms', 60000)).rooms; }

  // Image priority per asset: (1) jenis image (one per NAME, uploaded via the
  // group editor and served as binary from /api/public?resource=img), then
  // (2) legacy per-unit photo in assets.image, then (3) the generated
  // assets/aset/<slug>.webp illustration. slugAsset MUST stay in sync with
  // scripts/generate-asset-images.mjs and the SQL key in the API joins.
  // /assets/* is served immutable for 1 year (vercel.json), so bump ASSET_IMG_V
  // whenever the webp files are regenerated or browsers will keep the old ones.
  var ASSET_IMG_V = '4';
  function slugAsset(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  // image identity = (nama, merk): units sharing name+brand share ONE image
  function assetImgKey(name, brand) { return slugAsset(String(name || '') + ' ' + String(brand || '')); }
  function fillAssetImage(a) {
    if (!a) return a;
    if (a.jenis_key && a.jenis_ver) a.image = 'api/public?resource=img&key=' + encodeURIComponent(a.jenis_key) + '&t=' + a.jenis_ver;
    else if (!a.image) { var k = assetImgKey(a.name, a.brand); if (k) a.image = 'assets/aset/' + k + '.webp?v=' + ASSET_IMG_V; }
    return a;
  }
  // one image per jenis (nama + merk): a single upsert covers every matching unit
  async function setJenisImage(name, brand, image) {
    if (demo) {
      var key = assetImgKey(name, brand);
      DEMO.assets.forEach(function (a) { if (assetImgKey(a.name, a.brand) === key) a.image = image; });
      return P({ ok: true });
    }
    return req('assets', { method: 'POST', body: { jenis_image: { name: String(name || '') + ' ' + String(brand || ''), image: image } } });
  }
  // In-memory cache for assets — avoids redundant round-trips when opening the
  // edit form (categories + rooms + assets fire in parallel now, but the assets
  // call was the slowest). A write (create/update/delete) invalidates the cache.
  var _assetsCache = null;
  var _assetsCacheTs = 0;
  var ASSETS_CACHE_TTL = 30000; // 30 seconds
  function invalidateAssetsCache() { _assetsCache = null; _assetsCacheTs = 0; }
  async function assets() {
    if (demo) return P(DEMO.assets.map(demoAsset).map(fillAssetImage));
    var now = Date.now();
    if (_assetsCache && (now - _assetsCacheTs < ASSETS_CACHE_TTL)) return _assetsCache.slice();
    var data = (await req('assets')).assets.map(fillAssetImage);
    _assetsCache = data;
    _assetsCacheTs = now;
    return data.slice();
  }

  function fmtBorrow(b) {
    var d = b.created_at ? new Date(b.created_at) : null;
    return {
      id: b.id, asset_name: b.asset_name || '-', asset_code: b.asset_code || '',
      borrower: b.borrower_name || '-', borrower_avatar: b.borrower_avatar || '', qty: b.qty, status: b.status,
      due_date: b.due_date ? String(b.due_date).slice(0, 10) : '',
      request_date: d ? (d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()) : '',
      // raw timestamps for the notification bell (event time per status)
      created_at: b.created_at || null, approved_at: b.approved_at || null,
      verified_at: b.verified_at || null, returned_at: b.returned_at || null,
    };
  }
  async function borrowings() {
    if (demo) {
      return P(DEMO.borrowings.slice().sort(function (a, b) { return b.id - a.id; }).map(function (b) {
        var a = DEMO.assets.filter(function (x) { return x.id === b.asset_id; })[0] || {};
        return fmtBorrow(Object.assign({}, b, { asset_name: a.name, asset_code: a.code }));
      }));
    }
    return (await req('borrowings')).borrowings.map(fmtBorrow);
  }

  async function dashboard() {
    if (demo) {
      var as = await assets(); var bs = await borrowings();
      var sum = function (k) { return as.reduce(function (t, a) { return t + (a[k] || 0); }, 0); };
      return {
        stats: { total_assets: as.length, total_stock: sum('stock_total'), stock_available: sum('stock_available'), stock_borrowed: sum('stock_borrowed'), pending: bs.filter(function (b) { return b.status === 'pending'; }).length },
        monitor: as.map(function (a) { return { name: a.name, code: a.code, available: a.stock_available, total: a.stock_total }; }),
        recent: bs.slice(0, 5),
      };
    }
    const data = await req('dashboard');
    if (data.recent) data.recent = data.recent.map(fmtBorrow);
    return data;
  }

  async function requestBorrowing(o) {
    if (demo) {
      var q = Math.max(1, parseInt(o.qty || 1, 10));
      var a = DEMO.assets.filter(function (x) { return x.id == o.assetId; })[0];
      if (!a || a.stock_available < q) return Promise.reject(new Error('Stok tidak mencukupi'));
      a.stock_available -= q; a.stock_borrowed += q;
      var b = { id: ++DEMO.seq, asset_id: a.id, borrower_name: 'Pengguna Demo', qty: q, status: 'pending', due_date: o.dueDate || null, created_at: new Date(2026, 5, 18).toISOString() };
      DEMO.borrowings.push(b); return P(b);
    }
    return (await req('borrowings', { method: 'POST', body: { assetId: o.assetId, qty: o.qty || 1, dueDate: o.dueDate || null, notes: o.notes || null } })).borrowing;
  }

  /* ====================== public catalog / detail (guest) ====================== */
  function publicAsset(a) { return { id: a.id, code: a.code, name: a.name, brand: a.brand, type: a.type, image: a.image, qr_code: a.qr_code, category: a.category, room: a.room }; }
  async function catalog() {
    if (demo) {
      var as = await assets();
      var sum = function (k) { return as.reduce(function (t, a) { return t + (a[k] || 0); }, 0); };
      var bs = await borrowings();
      return P({
        assets: as.map(publicAsset), categories: DEMO.categories.slice(), rooms: DEMO.rooms.slice(),
        stats: { total_assets: as.length, total_stock: sum('stock_total'), stock_available: sum('stock_available'), stock_borrowed: sum('stock_borrowed'), pending: bs.filter(function (b) { return b.status === 'pending'; }).length, maintenance: as.filter(function (a) { return a.status === 'maintenance'; }).length }
      });
    }
    var data = await req('public?resource=catalog');
    if (data.assets) data.assets = data.assets.map(fillAssetImage);
    return data;
  }
  async function assetDetail(o) {
    o = o || {};
    if (demo) {
      var as = await assets();
      var a = as.filter(function (x) { return (o.id && x.id == o.id) || (o.qr && x.qr_code === o.qr); })[0];
      if (!a) return Promise.reject(new Error('Aset tidak ditemukan'));
      return P({ asset: publicAsset(a), authed: !!currentUserRaw() });
    }
    var qs = o.qr ? ('qr=' + encodeURIComponent(o.qr)) : ('id=' + encodeURIComponent(o.id));
    var data = await req('public?resource=detail&' + qs);
    if (data.asset) fillAssetImage(data.asset);
    return data;
  }

  /* ====================== reports (admin/verifikator) ====================== */
  async function reports(params) {
    params = params || {};
    if (demo) {
      var list = await borrowings();
      var bs = {};
      var total = list.length;
      list.forEach(function (b) {
        bs[b.status] = (bs[b.status] || 0) + 1;
      });
      var rows = list.map(function (b) {
        return {
          id: b.id,
          borrower_name: b.borrower,
          qty: b.qty,
          status: b.status,
          due_date: b.due_date,
          created_at: b.created_at,
          returned_at: b.returned_at || null,
          asset_name: b.asset_name,
          asset_code: b.asset_code,
          admin_name: b.status === 'approved' || b.status === 'borrowed' || b.status === 'returned' ? 'Admin Demo' : '',
          verifikator_name: b.status === 'borrowed' || b.status === 'returned' ? 'Verifikator Demo' : '',
          borrower_avatar: b.borrower_avatar
        };
      });
      return P({ period: params.period || 'daily', start: '2026-06-01', end: '2026-06-30', total: total, series: [], by_status: bs, top_assets: [], top_borrowers: [], rows: rows });
    }
    var qs = Object.keys(params).filter(function (k) { return params[k]; }).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return req('dashboard?view=reports' + (qs ? ('&' + qs) : ''));
  }

  /* ====================== admin: bulk import ====================== */
  async function importAssets(rows) {
    if (demo) { return P({ success: rows.length, skipped: 0, failed: 0, errors: [] }); }
    return req('assets', { method: 'POST', body: { rows: rows } });
  }

  /* ====================== admin: users ====================== */
  function currentUserRaw() { var t = token(); return t ? decode(t) : null; }
  async function users() { return demo ? P(DEMO.users.slice()) : (await req('users')).users; }
  // always hits the API (never served from the preloader cache) so the Kelola
  // User table can't show a stale/empty snapshot.
  async function usersFresh() { return demo ? P(DEMO.users.slice()) : (await req('users')).users; }
  async function setUserRole(id, role) {
    if (demo) { var u = DEMO.users.filter(function (x) { return x.id == id; })[0]; if (u) u.role = role; return P(u); }
    return (await req('users', { method: 'PATCH', body: { id: id, role: role } })).user;
  }
  async function createUser(d) {
    // hanya NIP + role + HP; nama & password diatur pemilik NIP saat klaim
    if (demo) { var u = { id: ++DEMO.seq, nip: d.nip, name: '', role: d.role || 'user', claimed: false }; DEMO.users.push(u); return P(u); }
    return (await req('users', { method: 'POST', body: { nip: d.nip, role: d.role, phone: d.phone } })).user;
  }
  async function deleteUser(id) {
    if (demo) { DEMO.users = DEMO.users.filter(function (x) { return x.id != id; }); return P({ ok: true }); }
    return req('users', { method: 'DELETE', body: { id: id } });
  }
  /* ====================== self-service profile ====================== */
  async function profile() {
    if (demo) { var p = currentUserRaw() || {}; return P({ nip: p.nip || '123456789012345678', name: p.name || 'Pengguna Demo', phone: '', role: p.role || 'admin' }); }
    return (await req('profile')).user;
  }
  async function updateProfile(d) {
    if (demo) return P(Object.assign({}, currentUserRaw(), d));
    return (await req('profile', { method: 'PATCH', body: { name: d.name, phone: d.phone, avatar: d.avatar } })).user;
  }
  async function changePassword(currentPassword, newPassword) {
    if (demo) { if (!newPassword || newPassword.length < 8) return Promise.reject(new Error('Password baru minimal 8 karakter')); return P({ ok: true }); }
    return req('profile', { method: 'PATCH', body: { currentPassword: currentPassword, newPassword: newPassword } });
  }

  /* ====================== admin: assets ====================== */
  async function createAsset(d) {
    invalidateAssetsCache();
    if (demo) { var a = Object.assign({ id: ++DEMO.seq, stock_borrowed: 0 }, d); a.stock_total = parseInt(d.stock_total || 1, 10); a.stock_available = a.stock_total; a.status = d.status || 'tersedia'; DEMO.assets.push(a); return P(a); }
    return req('assets', { method: 'POST', body: d });
  }
  async function updateAsset(id, d) {
    invalidateAssetsCache();
    if (demo) { var a = DEMO.assets.filter(function (x) { return x.id == id; })[0]; if (a) { Object.assign(a, d); a.stock_total = parseInt(d.stock_total != null ? d.stock_total : a.stock_total, 10); a.stock_available = Math.max(0, a.stock_total - a.stock_borrowed); if (d.status) a.status = d.status; } return P(a); }
    return req('assets', { method: 'PATCH', body: Object.assign({ id: id }, d) });
  }
  async function deleteAsset(id) {
    invalidateAssetsCache();
    if (demo) { DEMO.assets = DEMO.assets.filter(function (x) { return x.id != id; }); return P({ ok: true }); }
    return req('assets', { method: 'DELETE', body: { id: id } });
  }

  /* ====================== admin: categories ====================== */
  async function createCategory(d) { if (demo) { var c = { id: ++DEMO.seq, name: d.name, icon: d.icon || '📦' }; DEMO.categories.push(c); return P(c); } return req('categories', { method: 'POST', body: d }); }
  async function updateCategory(id, d) { if (demo) { var c = DEMO.categories.filter(function (x) { return x.id == id; })[0]; if (c) Object.assign(c, d); return P(c); } return req('categories', { method: 'PATCH', body: Object.assign({ id: id }, d) }); }
  async function deleteCategory(id) { if (demo) { DEMO.categories = DEMO.categories.filter(function (x) { return x.id != id; }); return P({ ok: true }); } return req('categories', { method: 'DELETE', body: { id: id } }); }

  /* ====================== admin: rooms ====================== */
  async function createRoom(d) { if (demo) { var r = { id: ++DEMO.seq, name: d.name, code: d.code || '', pic: d.pic || '' }; DEMO.rooms.push(r); return P(r); } return req('rooms', { method: 'POST', body: d }); }
  async function updateRoom(id, d) { if (demo) { var r = DEMO.rooms.filter(function (x) { return x.id == id; })[0]; if (r) Object.assign(r, d); return P(r); } return req('rooms', { method: 'PATCH', body: Object.assign({ id: id }, d) }); }
  async function deleteRoom(id) { if (demo) { DEMO.rooms = DEMO.rooms.filter(function (x) { return x.id != id; }); return P({ ok: true }); } return req('rooms', { method: 'DELETE', body: { id: id } }); }

  /* ====================== admin: borrowings status ====================== */
  async function updateBorrowingStatus(id, status) {
    if (demo) {
      var b = DEMO.borrowings.filter(function (x) { return x.id == id; })[0];
      if (b) {
        var RES = ['pending', 'approved', 'verified', 'borrowed', 'return_pending'];
        var wasOut = RES.indexOf(b.status) !== -1, nowOut = RES.indexOf(status) !== -1;
        var a = DEMO.assets.filter(function (x) { return x.id === b.asset_id; })[0];
        if (a) {
          if (wasOut && !nowOut) { a.stock_available += b.qty; a.stock_borrowed = Math.max(0, a.stock_borrowed - b.qty); }
          else if (!wasOut && nowOut) { if (a.stock_available < b.qty) return Promise.reject(new Error('Stok tidak mencukupi')); a.stock_available -= b.qty; a.stock_borrowed += b.qty; }
        }
        b.status = status;
      }
      return P({ ok: true });
    }
    return req('borrowings', { method: 'PATCH', body: { id: id, status: status } });
  }

  /* ====================== settings (WhatsApp) ====================== */
  function normWa(n) { var d = String(n || '').replace(/\D/g, ''); if (d.charAt(0) === '0') d = '62' + d.slice(1); return d; }
  async function getSettings() { return demo ? P({ wa_number: DEMO.settings.wa_number, wa_auto: false }) : req('settings'); }
  async function setWaNumber(n) { if (demo) { DEMO.settings.wa_number = normWa(n); return P({ wa_number: DEMO.settings.wa_number, wa_auto: false }); } return req('settings', { method: 'PATCH', body: { wa_number: n } }); }
  async function notify(borrowingId, kind) {
    if (demo) { return P({ auto: false, wa: kind === 'return-request' ? DEMO.settings.wa_number : '', text: 'Notifikasi demo (' + kind + ')' }); }
    return req('notify', { method: 'POST', body: { borrowingId: borrowingId, kind: kind } });
  }

  window.SESDIAN_DB = {
    configured: !demo, backend: demo ? 'demo' : 'api',
    getSettings: getSettings, setWaNumber: setWaNumber, notify: notify,
    auth: auth,
    categories: categories, rooms: rooms, assets: assets, borrowings: borrowings, dashboard: dashboard, requestBorrowing: requestBorrowing,
    catalog: catalog, assetDetail: assetDetail, reports: reports, importAssets: importAssets,
    users: users, usersFresh: usersFresh, setUserRole: setUserRole, createUser: createUser, deleteUser: deleteUser,
    profile: profile, updateProfile: updateProfile, changePassword: changePassword,
    createAsset: createAsset, updateAsset: updateAsset, deleteAsset: deleteAsset, setJenisImage: setJenisImage,
    createCategory: createCategory, updateCategory: updateCategory, deleteCategory: deleteCategory,
    createRoom: createRoom, updateRoom: updateRoom, deleteRoom: deleteRoom,
    updateBorrowingStatus: updateBorrowingStatus,
  };
})();
