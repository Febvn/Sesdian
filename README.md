# SESDIAN - Asset Management

Lightweight asset-management app: a static, zero-build frontend (vanilla
HTML/CSS/JS) backed by a Neon Postgres database through small Vercel serverless
functions. The frontend stays instant; the backend gives real auth, roles, and
data persistence.

> Replaces the original Laravel + React build that shipped a ~1.1 MB JS bundle per page.

## Architecture
```
Browser  -->  /api/* (Vercel serverless, Node)  -->  Neon Postgres
 public/        register, login, me, settings        users, settings
 *.html         categories, rooms, assets            categories, rooms
 assets/app.js  borrowings (list/create/approve)     assets, borrowings
 assets/db.js   users (list/role)
```
- Auth: JWT (HS256) signed server-side; passwords hashed with scrypt; token in
  localStorage, sent as a Bearer header. `JWT_SECRET` is required (no fallback).
- The Neon connection string lives only in the Vercel env var `DATABASE_URL`,
  never in the browser. Every data endpoint checks the token; writes check admin.
- DB-first: pages render entirely from the database (or an in-memory demo set);
  the static templates are hidden, so no seed data flashes before the DB loads.

## Roles
- First account to log in (when no admin exists yet) becomes the admin; everyone
  else is a normal user. Admins can promote/demote others on the Kelola User page.
- User: browse assets/categories/rooms, submit borrowing requests.
- Admin: approve / reject / lend / return borrowings (stock adjusts automatically),
  add/edit/delete assets (with image upload), categories and rooms, manage users,
  and set the WhatsApp notification number.

## WhatsApp notifications
- An admin sets the notification number on the Kelola User page.
- When a user submits a borrowing request:
  - If `FONNTE_TOKEN` (a https://fonnte.com gateway token) is set on the server,
    the API auto-sends a WhatsApp message to the admin number.
  - Otherwise the app opens a `wa.me` click-to-send link prefilled to the admin.

## Project layout
```
public/             the static site (served by Vercel)
  *.html            pages
  assets/app.css    design tokens + animations
  assets/app.js     runtime: auth, rendering, search/filter, admin UI, toasts
  assets/db.js      data layer (calls /api, manages the JWT, demo dataset)
  assets/config.js  BACKEND mode + optional API base (no secrets)
  favicon.svg
api/                serverless functions
  register, login, me, categories, rooms, assets, borrowings, users, settings
  _auth.js _db.js _wa.js   (shared helpers, not routed)
neon-schema.sql     full schema + seed (fresh install)
migrate.sql         incremental, non-destructive migration (existing DB)
package.json        declares @neondatabase/serverless (installed by Vercel)
vercel.json         outputDirectory: public, clean URLs
```

## Setup
1. Create a Neon database (https://neon.tech) and copy the connection string.
2. Fresh DB: run `neon-schema.sql` in the Neon SQL Editor.
   Existing DB (already has data): run `migrate.sql` instead (it only adds the
   settings table; it does not drop anything).
3. Deploy to Vercel and add environment variables:
   - `DATABASE_URL`  (required) - your Neon connection string
   - `JWT_SECRET`    (required) - a long random string, e.g. `openssl rand -hex 32`
   - `FONNTE_TOKEN`  (optional) - enables automatic WhatsApp sending
4. Log in with your existing account; since it is the only account and there is
   no admin yet, it is promoted to admin automatically. New sign-ups are users.

## Local development
- Full stack: `vercel dev` (set `DATABASE_URL` and `JWT_SECRET` locally).
- UI only (no backend): set `BACKEND: 'demo'` in `public/assets/config.js`, then
  open `public/index.html` or run `npx serve public`. Demo signs you in as an
  admin so every feature is previewable; data lives in memory for the session.

## Notes
- Borrowing is atomic: stock is reserved and the record inserted in a single SQL
  statement; status changes adjust stock in one statement with a re-reserve guard.
- Asset images are downscaled client-side (max 800px, JPEG) and stored as a data
  URL in `assets.image`; keep uploads modest (Vercel request body limit ~4.5 MB).
