/* ============================================================
   SESDIAN - Preloader & Cache Manager
   Load semua data di awal, cache di memory, instant access
   ============================================================ */
(function () {
  'use strict';

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }

  var CACHE_VERSION = '1.0.0';
  var CACHE_KEY = 'sesdian_cache_v' + CACHE_VERSION;
  var CACHE_DURATION = 5 * 60 * 1000; // 5 menit

  // Global cache object
  window.SESDIAN_CACHE = {
    loaded: false,
    data: {},
    timestamp: 0,
  };

  /* ====================== Storage Helper ====================== */
  function saveToStorage(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: data,
        timestamp: Date.now(),
      }));
    } catch (e) {
      // Storage penuh, ignore
    }
  }

  function loadFromStorage() {
    try {
      var stored = sessionStorage.getItem(CACHE_KEY);
      if (!stored) return null;
      var parsed = JSON.parse(stored);
      // Check if cache expired
      if (Date.now() - parsed.timestamp > CACHE_DURATION) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clearStorage() {
    try {
      // Clear old cache versions
      Object.keys(sessionStorage).forEach(function (key) {
        if (key.startsWith('sesdian_cache_') && key !== CACHE_KEY) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}
  }

  /* ====================== Preloader ====================== */
  async function preloadAllData() {
    var DB = window.SESDIAN_DB;
    if (!DB) throw new Error('DB not initialized');

    // Check session storage first
    var cached = loadFromStorage();
    if (cached && cached.data) {
      window.SESDIAN_CACHE.data = cached.data;
      window.SESDIAN_CACHE.timestamp = cached.timestamp;
      window.SESDIAN_CACHE.loaded = true;
      return cached.data;
    }

    // Preload semua data sekaligus (parallel)
    var promises = [
      DB.categories().catch(function () { return []; }),
      DB.rooms().catch(function () { return []; }),
      DB.assets().catch(function () { return []; }),
      DB.borrowings().catch(function () { return []; }),
      DB.dashboard().catch(function () { return { stats: {}, monitor: [], recent: [] }; }),
    ];

    // Admin data (optional, skip jika tidak ada akses)
    var user = DB.auth ? DB.auth.currentUser() : null;
    if (user && user.role === 'admin') {
      promises.push(DB.users().catch(function () { return []; }));
      promises.push(DB.getSettings().catch(function () { return {}; }));
    }

    var results = await Promise.all(promises);

    var data = {
      categories: results[0],
      rooms: results[1],
      assets: results[2],
      borrowings: results[3],
      dashboard: results[4],
      users: results[5] || [],
      settings: results[6] || {},
    };

    // Save to cache
    window.SESDIAN_CACHE.data = data;
    window.SESDIAN_CACHE.timestamp = Date.now();
    window.SESDIAN_CACHE.loaded = true;

    // Save to session storage
    saveToStorage(data);

    return data;
  }

  /* ====================== Show/Hide Loading ====================== */
  function showLoading(msg) {
    // Check if we should show full loader (first load only)
    var hasLoadedOnce = sessionStorage.getItem('sesdian_loaded_once');

    if (hasLoadedOnce) {
      // Already loaded before, just show minimal loading indicator
      showMinimalLoading();
      return null;
    }

    var loader = document.getElementById('sesd-preloader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'sesd-preloader';
      loader.innerHTML =
        '<div class="sesd-preloader-content">' +
          '<div class="sesd-spinner"></div>' +
          '<p class="sesd-loading-text">' + (msg || 'Memuat data...') + '</p>' +
        '</div>';
      document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
    return loader;
  }

  function showMinimalLoading() {
    // Add loading class to body for skeleton display
    document.body.classList.add('sesd-loading-page');

    // Show skeleton loading for tables and lists
    $$('[data-list],[data-monitor-list],[data-recent-list],[data-users-list],[data-asset-options]').forEach(function (container) {
      // Skip if already has skeleton or has data
      if (container.querySelector('.sesd-skeleton-container,.sesd-skeleton-row')) return;
      if (container.children.length > 0 && !container.querySelector('[data-template]')) return;

      // For table bodies, show skeleton rows with shimmer effect
      if (container.tagName === 'TBODY') {
        showTableSkeleton(container);
      } else {
        // For other containers, show dots skeleton
        var skeleton = el('div', {
          class: 'sesd-skeleton-container',
          style: 'data-skeleton="true"'
        });
        skeleton.innerHTML = '<div class="sesd-loading-dots-alt">' +
          '<div class="dot"></div>' +
          '<div class="dot"></div>' +
          '<div class="dot"></div>' +
          '</div>';

        // Hide templates
        var templates = container.querySelectorAll('[data-template],[data-monitor-template],[data-recent-template],[data-asset-template]');
        templates.forEach(function(t) { t.style.display = 'none'; });

        container.appendChild(skeleton);
      }
    });
  }

  function showTableSkeleton(container) {
    // Show 5 skeleton rows with shimmer animation
    var numRows = 5;
    for (var i = 0; i < numRows; i++) {
      var row = el('tr', { class: 'sesd-skeleton-row' });
      row.innerHTML = '<td style="padding:0.875rem 1rem"><div class="sesd-skeleton-text" style="width:60%"></div></td>' +
        '<td style="padding:0.875rem 1rem"><div class="sesd-skeleton-text" style="width:30%"></div></td>' +
        '<td style="padding:0.875rem 1rem"><div class="sesd-skeleton-text" style="width:40%"></div></td>' +
        '<td style="padding:0.875rem 1rem"><div class="sesd-skeleton-text" style="width:20%"></div></td>' +
        '<td style="padding:0.875rem 1rem"><div class="sesd-skeleton-text" style="width:25%"></div></td>';
      container.appendChild(row);
    }
  }

  function hideLoading() {
    // Remove body loading class
    document.body.classList.remove('sesd-loading-page');

    // Remove all skeleton elements
    var loader = document.getElementById('sesd-preloader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(function () {
        loader.style.display = 'none';
      }, 300);
    }

    // Remove skeleton containers
    document.querySelectorAll('.sesd-skeleton-container').forEach(function(el) {
      el.remove();
    });

    // Remove skeleton rows
    document.querySelectorAll('.sesd-skeleton-row').forEach(function(el) {
      el.remove();
    });

    // Show hidden templates
    document.querySelectorAll('[data-template],[data-monitor-template],[data-recent-template],[data-asset-template]').forEach(function(t) {
      t.style.display = '';
    });

    // Mark stat cards as loaded with animation
    setTimeout(function() {
      var cards = document.querySelectorAll('.dashboard-stat-card');
      cards.forEach(function(card, i) {
        setTimeout(function() {
          card.classList.add('loaded');
        }, i * 100); // Stagger animation
      });
    }, 100);
  }

  function updateLoadingText(text) {
    var textEl = document.querySelector('.sesd-loading-text');
    if (textEl) textEl.textContent = text;
  }

  /* ====================== Fast Access Functions ====================== */
  function getCached(key) {
    if (!window.SESDIAN_CACHE.loaded) return null;
    return window.SESDIAN_CACHE.data[key] || null;
  }

  function isCacheValid() {
    if (!window.SESDIAN_CACHE.loaded) return false;
    var age = Date.now() - window.SESDIAN_CACHE.timestamp;
    return age < CACHE_DURATION;
  }

  function invalidateCache() {
    window.SESDIAN_CACHE.loaded = false;
    window.SESDIAN_CACHE.data = {};
    window.SESDIAN_CACHE.timestamp = 0;
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (e) {}
  }

  /* ====================== Override DB Functions ====================== */
  function patchDBWithCache() {
    var DB = window.SESDIAN_DB;
    if (!DB) return;

    // Store original functions
    var original = {
      categories: DB.categories,
      rooms: DB.rooms,
      assets: DB.assets,
      borrowings: DB.borrowings,
      dashboard: DB.dashboard,
      users: DB.users,
      getSettings: DB.getSettings,
    };

    // Override dengan cached version (INSTANT)
    DB.categories = function () {
      var cached = getCached('categories');
      if (cached) return Promise.resolve(cached);
      // If not cached, fetch and cache
      return original.categories().then(function(data) {
        if (!window.SESDIAN_CACHE.data.categories) {
          window.SESDIAN_CACHE.data.categories = data;
        }
        return data;
      });
    };

    DB.rooms = function () {
      var cached = getCached('rooms');
      if (cached) return Promise.resolve(cached);
      return original.rooms().then(function(data) {
        if (!window.SESDIAN_CACHE.data.rooms) {
          window.SESDIAN_CACHE.data.rooms = data;
        }
        return data;
      });
    };

    DB.assets = function () {
      var cached = getCached('assets');
      if (cached) return Promise.resolve(cached);
      return original.assets().then(function(data) {
        if (!window.SESDIAN_CACHE.data.assets) {
          window.SESDIAN_CACHE.data.assets = data;
        }
        return data;
      });
    };

    DB.borrowings = function () {
      var cached = getCached('borrowings');
      if (cached) return Promise.resolve(cached);
      return original.borrowings().then(function(data) {
        if (!window.SESDIAN_CACHE.data.borrowings) {
          window.SESDIAN_CACHE.data.borrowings = data;
        }
        return data;
      });
    };

    DB.dashboard = function () {
      var cached = getCached('dashboard');
      if (cached) return Promise.resolve(cached);
      return original.dashboard().then(function(data) {
        if (!window.SESDIAN_CACHE.data.dashboard) {
          window.SESDIAN_CACHE.data.dashboard = data;
        }
        return data;
      });
    };

    DB.users = function () {
      var cached = getCached('users');
      if (cached) return Promise.resolve(cached);
      return original.users().then(function(data) {
        if (!window.SESDIAN_CACHE.data.users) {
          window.SESDIAN_CACHE.data.users = data;
        }
        return data;
      });
    };

    DB.getSettings = function () {
      var cached = getCached('settings');
      if (cached) return Promise.resolve(cached);
      return original.getSettings().then(function(data) {
        if (!window.SESDIAN_CACHE.data.settings) {
          window.SESDIAN_CACHE.data.settings = data;
        }
        return data;
      });
    };

    // Invalidate cache on write operations
    var writes = ['createAsset', 'updateAsset', 'deleteAsset',
                  'createCategory', 'updateCategory', 'deleteCategory',
                  'createRoom', 'updateRoom', 'deleteRoom',
                  'requestBorrowing', 'updateBorrowingStatus',
                  'setUserRole', 'createUser', 'deleteUser', 'importAssets', 'setWaNumber'];

    writes.forEach(function (fn) {
      if (DB[fn]) {
        var origFn = DB[fn];
        DB[fn] = async function () {
          var result = await origFn.apply(DB, arguments);
          invalidateCache();
          return result;
        };
      }
    });
  }

  /* ====================== Init on Page Load ====================== */
  async function init() {
    // Patch DB immediately untuk auto-cache saat first fetch
    if (window.SESDIAN_DB) {
      patchDBWithCache();
    }

    // Clear old caches
    clearStorage();

    // Check if we need to preload (not on login/register page)
    var page = document.body.getAttribute('data-page');
    if (page === 'login' || page === 'register') {
      // No preload needed for public pages
      return;
    }

    // Warm cache (memory) -> navigation is instant, show NO loading UI.
    if (window.SESDIAN_CACHE.loaded && isCacheValid()) {
      patchDBWithCache();
      return;
    }

    // Warm cache (sessionStorage, carried from a previous page) -> instant, no loading UI.
    var storedCache = loadFromStorage();
    if (storedCache && storedCache.data) {
      window.SESDIAN_CACHE.data = storedCache.data;
      window.SESDIAN_CACHE.timestamp = storedCache.timestamp;
      window.SESDIAN_CACHE.loaded = true;
      patchDBWithCache();
      return;
    }

    // COLD load (first visit / cache expired): app.js shows the single page
    // loader; here we just fetch data in the background and warm the cache.
    try {
      // Wait for DB to be ready
      var maxWait = 50; // 5 detik
      while (!window.SESDIAN_DB && maxWait > 0) {
        await new Promise(function (r) { setTimeout(r, 100); });
        maxWait--;
      }
      if (!window.SESDIAN_DB) throw new Error('Database tidak tersedia');

      await preloadAllData();
      patchDBWithCache();
    } catch (e) {
      console.error('Preload error:', e);
      if (e && e.status === 401) { location.replace('login.html'); return; }
      if (window.toast) window.toast('Gagal memuat data: ' + (e.message || e), 'error');
    }
  }

  /* ====================== Public API ====================== */
  window.SESDIAN_PRELOADER = {
    init: init,
    reload: async function () {
      invalidateCache();
      return preloadAllData();
    },
    getCached: getCached,
    isValid: isCacheValid,
    invalidate: invalidateCache,
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Auto-patch DB saat tersedia (untuk halaman tanpa preloader.js)
  var checkDB = setInterval(function() {
    if (window.SESDIAN_DB && !window.SESDIAN_DB._patched) {
      patchDBWithCache();
      window.SESDIAN_DB._patched = true;
      clearInterval(checkDB);
    }
  }, 100);

  // Stop checking setelah 5 detik
  setTimeout(function() {
    clearInterval(checkDB);
  }, 5000);

})();
