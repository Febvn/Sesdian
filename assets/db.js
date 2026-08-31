/* ============================================================
   SESDIAN — data layer (talks to the Neon-backed /api endpoints)
   Exposes window.SESDIAN_DB. Auth uses a JWT stored in localStorage;
   the token is decoded client-side for identity (no network needed for
   the route guard) and sent as a Bearer header on data requests.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.SESDIAN_CONFIG || {};
  var BASE = (CFG.API_BASE || '').replace(/\/$/, '');
  var TKEY = 'sesdian_token';
  var demo = CFG.BACKEND === 'demo';

  function url(path) { return BASE + '/api/' + path; }
  function token() { try { return localStorage.getItem(TKEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { localStorage.setItem(TKEY, t); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TKEY); } catch (e) {} }

  async function req(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
    var res = await fetch(url(path), {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401) { clearToken(); var err = new Error('Unauthorized'); err.status = 401; throw err; }
    if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  function decode(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';                 // restore base64 padding
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }

  /* ---------------- auth ---------------- */
  var auth = {
    async signUp(o) { var d = await req('register', { method: 'POST', body: { nip: o.nip, name: o.name, password: o.password } }); setToken(d.token); return d; },
    async signIn(o) { var d = await req('login', { method: 'POST', body: { nip: o.nip, password: o.password } }); setToken(d.token); return d; },
    async signOut() { clearToken(); },
    currentUser() {
      var t = token(); if (!t) return null;
      var p = decode(t); if (!p) return null;
      if (p.exp && p.exp < Math.floor(Date.now() / 1000)) { clearToken(); return null; }
      return { nip: p.nip, name: p.name, role: p.role };
    },
  };

  /* ---------------- data ---------------- */
  async function categories() { return (await req('categories')).categories; }
  async function rooms() { return (await req('rooms')).rooms; }
  async function assets() { return (await req('assets')).assets; }

  function fmtBorrow(b) {
    var d = b.created_at ? new Date(b.created_at) : null;
    return {
      id: b.id, asset_name: b.asset_name || '—', asset_code: b.asset_code || '',
      borrower: b.borrower_name || '—', qty: b.qty, status: b.status,
      due_date: b.due_date ? String(b.due_date).slice(0, 10) : '',
      request_date: d ? (d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()) : '',
    };
  }
  async function borrowings() { return (await req('borrowings')).borrowings.map(fmtBorrow); }

  async function dashboard() {
    var as = await assets();
    var bs = await borrowings();
    var sum = function (k) { return as.reduce(function (t, a) { return t + (a[k] || 0); }, 0); };
    return {
      stats: {
        total_assets: as.length, total_stock: sum('stock_total'),
        stock_available: sum('stock_available'), stock_borrowed: sum('stock_borrowed'),
        pending: bs.filter(function (b) { return b.status === 'pending'; }).length,
      },
      monitor: as.map(function (a) { return { name: a.name, code: a.code, available: a.stock_available, total: a.stock_total }; }),
      recent: bs.slice(0, 5),
    };
  }

  async function requestBorrowing(o) {
    return (await req('borrowings', { method: 'POST', body: { assetId: o.assetId, qty: o.qty || 1, dueDate: o.dueDate || null, notes: o.notes || null } })).borrowing;
  }

  window.SESDIAN_DB = {
    configured: !demo, backend: demo ? 'demo' : 'api',
    auth: auth,
    categories: categories, rooms: rooms, assets: assets,
    borrowings: borrowings, dashboard: dashboard, requestBorrowing: requestBorrowing,
  };
})();
