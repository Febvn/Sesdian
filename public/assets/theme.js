/* ============================================================
   SESDIAN — Theme Manager (theme.js)
   Manages light/dark mode toggle with localStorage persistence.
   Default: light mode. Applies [data-theme="dark"] on <html>.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'sesdian_theme';
  var DARK = 'dark';
  var LIGHT = 'light';

  /* ── Apply theme immediately (before paint to avoid flash) ── */
  function getPreferred() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === DARK || stored === LIGHT) return stored;
    } catch (e) {}
    // Default: light mode (ignore system preference)
    return LIGHT;
  }

  function applyTheme(theme) {
    if (theme === DARK) {
      document.documentElement.setAttribute('data-theme', DARK);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  }

  // Apply ASAP to prevent flash
  applyTheme(getPreferred());

  /* ── Inject toggle button after DOM is ready ── */
  function injectToggleButton() {
    if (document.getElementById('sesd-theme-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'sesd-theme-btn';
    btn.title = 'Toggle Light / Dark Mode';
    btn.setAttribute('aria-label', 'Toggle theme');

    function updateIcon() {
      var isDark = document.documentElement.hasAttribute('data-theme');
      btn.innerHTML = isDark
        ? '<span class="theme-icon" style="line-height:1;display:inline-flex;align-items:center">☀️</span>'
        : '<span class="theme-icon" style="line-height:1;display:inline-flex;align-items:center">🌙</span>';
      btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }

    btn.addEventListener('click', function () {
      var isDark = document.documentElement.hasAttribute('data-theme');
      var newTheme = isDark ? LIGHT : DARK;

      // Animate icon spin
      var icon = btn.querySelector('.theme-icon');
      if (icon) {
        icon.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        icon.style.transform = 'rotate(360deg) scale(0.7)';
        setTimeout(function () { icon.style.transform = ''; }, 400);
      }

      applyTheme(newTheme);
      updateIcon();

      // Smooth page transition flash
      document.documentElement.style.transition = 'background-color 0.3s, color 0.3s';
      setTimeout(function () { document.documentElement.style.transition = ''; }, 400);
    });

    updateIcon();
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggleButton);
  } else {
    injectToggleButton();
  }
})();
