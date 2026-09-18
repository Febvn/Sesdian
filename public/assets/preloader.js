/* ============================================================
   SESDIAN - data caching DISABLED.
   The old preloader cached API responses in sessionStorage and served
   pages from that cache. It sometimes showed stale or empty data after
   navigation ("database tidak ke-load"), so it has been removed.
   Every page now fetches fresh from the DB on each load and shows the
   single page loader (see app.js) while loading. This file is kept as a
   no-op so the existing <script src="assets/preloader.js"> tags still work.
   ============================================================ */
(function () {
  'use strict';
  // intentionally empty: no caching, no DB patching, no skeletons.
})();
