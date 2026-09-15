/* ============================================================
   SESDIAN — Theme Manager (theme.js)
   Manages light/dark mode toggle with localStorage persistence.
   Default: light mode. Applies [data-theme="dark"] on <html>.

   #4 — The toggle now lives inside the page header (top bar).
        The bottom-right corner it used to occupy is repurposed
        into a "back to top" button that appears once the page is
        scrolled down and smooth-scrolls back to the very top.
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

  /* ── Theme toggle button (placed inside the header) ── */
  function buildThemeButton() {
    var btn = document.createElement('button');
    btn.id = 'sesd-theme-btn';
    btn.type = 'button';
    btn.title = 'Toggle Light / Dark Mode';
    btn.setAttribute('aria-label', 'Toggle theme');

    // Stroke icons matched to the app's icon language (no emoji) — sun in dark
    // mode (tap to go light), moon in light mode (tap to go dark).
    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    function updateIcon() {
      var isDark = document.documentElement.hasAttribute('data-theme');
      btn.innerHTML = '<span class="theme-icon" style="line-height:0;display:inline-flex;align-items:center;justify-content:center">' + (isDark ? SUN : MOON) + '</span>';
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
    return btn;
  }

  /* ── Back-to-top button (the toggle's old corner) ── */
  function buildToTopButton() {
    var btn = document.createElement('button');
    btn.id = 'sesd-totop-btn';
    btn.type = 'button';
    btn.title = 'Kembali ke atas';
    btn.setAttribute('aria-label', 'Kembali ke atas');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';

    function scrollTopAll() {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      var m = document.querySelector('main');
      if (m && m.scrollTop > 0) {
        try { m.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { m.scrollTop = 0; }
      }
    }
    btn.addEventListener('click', scrollTopAll);
    return btn;
  }

  /* ── Inject both buttons after DOM is ready ── */
  function inject() {
    // Theme toggle → into the page header's right-hand cluster
    if (!document.getElementById('sesd-theme-btn')) {
      var themeBtn = buildThemeButton();
      var header =
        document.querySelector('[data-topbar]') ||
        (document.querySelector('main') && document.querySelector('main').firstElementChild);
      var cluster = header && header.lastElementChild;
      if (cluster && cluster !== header && cluster.nodeType === 1) {
        themeBtn.classList.add('in-header');
        cluster.appendChild(themeBtn);
      } else {
        // Fallback: keep it reachable as a floating button
        document.body.appendChild(themeBtn);
      }
    }

    // Back-to-top → fixed bottom-right corner
    if (!document.getElementById('sesd-totop-btn')) {
      var topBtn = buildToTopButton();
      document.body.appendChild(topBtn);

      var scrolledAmount = function () {
        var m = document.querySelector('main');
        return Math.max(
          window.pageYOffset || 0,
          document.documentElement.scrollTop || 0,
          document.body.scrollTop || 0,
          m ? m.scrollTop : 0
        );
      };
      var onScroll = function () {
        if (scrolledAmount() > 240) topBtn.classList.add('show');
        else topBtn.classList.remove('show');
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      var mainEl = document.querySelector('main');
      if (mainEl) mainEl.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
