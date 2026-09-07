/* ============================================================
   SESDIAN - Preloader & Cache Manager
   Load semua data di awal, cache di memory, instant access
   ============================================================ */
(function () {
  'use strict';

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

  function hideLoading() {
    var loader = document.getElementById('sesd-preloader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(function () {
        loader.style.display = 'none';
        // Optional: remove dari DOM setelah fade out
        // loader.remove();
      }, 300);
    }
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
                  'setUserRole', 'setWaNumber'];

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

    // Check if already cached in memory
    if (window.SESDIAN_CACHE.loaded && isCacheValid()) {
      return;
    }

    // Check if cached in sessionStorage (from previous page)
    var storedCache = loadFromStorage();
    if (storedCache && storedCache.data) {
      // Data sudah ada di session storage, skip preload UI
      window.SESDIAN_CACHE.data = storedCache.data;
      window.SESDIAN_CACHE.timestamp = storedCache.timestamp;
      window.SESDIAN_CACHE.loaded = true;
      patchDBWithCache();
      return;
    }

    // Show loading (hanya untuk pertama kali login/muat)
    var loader = showLoading('Memuat data...');

    try {
      // Wait for DB to be ready
      var maxWait = 50; // 5 detik
      while (!window.SESDIAN_DB && maxWait > 0) {
        await new Promise(function (r) { setTimeout(r, 100); });
        maxWait--;
      }

      if (!window.SESDIAN_DB) {
        throw new Error('Database tidak tersedia');
      }

      updateLoadingText('Mengambil data...');

      // Preload all data
      await preloadAllData();

      // Patch DB functions dengan cached version
      patchDBWithCache();

      updateLoadingText('Selesai!');

      // Hide loading setelah selesai
      setTimeout(hideLoading, 200);

    } catch (e) {
      console.error('Preload error:', e);
      hideLoading();
      
      // Jika auth error, redirect ke login
      if (e && e.status === 401) {
        location.replace('login.html');
        return;
      }

      // Show error toast jika ada
      if (window.toast) {
        window.toast('Gagal memuat data: ' + (e.message || e), 'error');
      }
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
