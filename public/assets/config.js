/* ============================================================
   SESDIAN - frontend config (Neon backend via serverless / Node API)
   ------------------------------------------------------------
   Domain Resmi Instansi : https://sesdian-lpg.bppmhkp.id/
   The Neon connection string lives ONLY on the server (environment
   var DATABASE_URL) - never in the browser. The frontend just talks
   to the /api endpoints, so there are no secrets here.

     BACKEND : 'api'  -> use the live backend (Neon)
               'demo' -> offline UI only (localStorage stub, seed markup)
     API_BASE: '' = same origin (/api). Set a full URL only if the API
               is hosted on a different domain than the static site.
   ============================================================ */
window.SESDIAN_CONFIG = {
  BACKEND: 'api',
  API_BASE: '',
  DOMAIN: 'https://sesdian-lpg.bppmhkp.id',
  OFFICIAL_HOST: 'sesdian-lpg.bppmhkp.id',
};
