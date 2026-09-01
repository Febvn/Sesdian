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
`kategoriaset` · `ruangan` · `daftarpinjam` · `ajukanpinjam` · `users` (admin)

Asset detail is a dynamic modal rendered from the database (opened by clicking an
asset card), so there is no separate hardcoded detail page.

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
   The **first** account to register automatically becomes the **admin**.

## Roles
- **User**: browse assets/categories/rooms, submit borrowing requests.
- **Admin** (additional powers, UI appears automatically when logged in as admin):
  - **Approve / reject / lend / return** borrowings (Daftar Pinjam) — stock is
    reserved on request and released on return/reject.
  - **Add / edit / delete assets** (Data Aset), including an **image upload**
    (auto-downscaled to a JPEG data URL stored in the DB).
  - **Add / edit / delete categories** (Kategori Aset) and **rooms** (Ruangan).
  - **Manage users** (Kelola User, admin-only page): list everyone and
    promote/demote between user and admin.
- Bootstrap: the first registered account is admin; admins promote others.

## Local development
- Full stack: install the [Vercel CLI](https://vercel.com/docs/cli) and run
  `vercel dev` (set `DATABASE_URL` and `JWT_SECRET` in a `.env` / via the CLI).
- UI only (no backend): set `BACKEND: 'demo'` in `assets/config.js`, then open
  `index.html` or run `npx serve .`.

## Notes
- Every page renders from the database (or the in-memory demo set) — the static
  HTML templates are hidden, so no hardcoded data flashes before the DB loads.
- Demo/offline mode (`BACKEND:'demo'`) signs you in as an **admin** so all features
  are previewable without a backend; data lives in memory for the session only.
- In real mode, accounts are created via **Register** (first = admin).
- Borrowing is atomic: stock is reserved and the record inserted in a single SQL
  statement, so concurrent requests can't oversubscribe stock.
- Asset images are downscaled client-side (max 800px, JPEG) and stored as a data
  URL in `assets.image`; keep uploads modest (Vercel request body limit ~4.5 MB).
