# SESDIAN — Asset Management

Lightweight asset-management app: a **static, zero-build frontend** (vanilla
HTML/CSS/JS, ~190 KB) backed by a **Neon Postgres database** through small
**Vercel serverless functions**. The frontend stays instant; the backend gives
real auth and real data persistence.

> Replaces the original Laravel + React build that shipped a 1.1 MB JS bundle per page.

## Architecture
```
Browser ──fetch──▶ /api/* (Vercel Serverless, Node)  ──SQL──▶  Neon Postgres
  static pages        register · login · me                     users
  assets/app.js       categories · rooms · assets               categories
  assets/db.js        borrowings (GET list / POST create)       rooms · assets
                                                                 borrowings
```
- **Auth:** JWT (HS256) signed server-side; passwords hashed with scrypt. The
  token is stored in `localStorage` and sent as `Authorization: Bearer …`.
- **Security:** the Neon connection string lives only in the Vercel env var
  `DATABASE_URL` — never in the browser. Every data endpoint requires a valid token.
- **Dual mode:** if the backend isn't configured (e.g. opened from `file://`, or
  `assets/config.js` `BACKEND:'demo'`), the UI runs offline on its seed markup with
  a localStorage stub, so it's always previewable.

## Pages
`index` (router) · `login` · `register` · `dashboard` · `dataaset` ·
`asetdetail` · `kategoriaset` · `ruangan` · `daftarpinjam` · `ajukanpinjam`

## Project layout
```
*.html              static pages (pixel-faithful snapshots + data-* hooks)
assets/app.css      design tokens + animations
assets/app.js       runtime: auth, rendering, search/filter, nav, toasts
assets/db.js        data layer (calls /api, manages the JWT)
assets/config.js    BACKEND mode + optional API base (no secrets)
api/*.js            serverless functions (register, login, me, categories,
                    rooms, assets, borrowings) + _db.js / _auth.js helpers
neon-schema.sql     database schema + seed data
package.json        declares @neondatabase/serverless (installed by Vercel)
vercel.json         clean URLs
```

## Setup (≈5 minutes)
1. **Create a Neon database** at https://neon.tech → copy the connection string
   (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
2. **Create the tables**: open Neon's SQL Editor, paste `neon-schema.sql`, Run.
   (Or `psql "<connection string>" -f neon-schema.sql`.)
3. **Deploy to Vercel** (import this repo) and add two Environment Variables:
   - `DATABASE_URL` = your Neon connection string
   - `JWT_SECRET`   = any long random string (e.g. `openssl rand -hex 32`)
4. Redeploy. Open the site → **Register** an account → you're live.

## Local development
- Full stack: install the [Vercel CLI](https://vercel.com/docs/cli) and run
  `vercel dev` (set `DATABASE_URL` and `JWT_SECRET` in a `.env` / via the CLI).
- UI only (no backend): set `BACKEND: 'demo'` in `assets/config.js`, then open
  `index.html` or run `npx serve .`.

## Notes
- Demo/offline login accepts any NIP + password (NIP `123456789012345678` shows as
  "Adi Septriansyah"). In real mode, accounts are created via **Register**.
- Borrowing is atomic: stock is reserved and the record inserted in a single SQL
  statement, so concurrent requests can't oversubscribe stock.
