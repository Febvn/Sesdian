# SESDIAN — Backend / API / SQL Audit

_Date: 2026-07-01 · Scope: `api/*`, `db/*`, and the `public/assets/db.js` data layer._
_Addendum (audit ke-2): 2026-07-02 — see "Second pass" at the bottom._

A pass over every serverless endpoint, the Neon (Postgres) access layer, the auth/JWT
helpers, the WhatsApp gateway, and the SQL schema/migrations. Below: what was **fixed**
this pass, what is **noted** (left as-is, with rationale or a recommendation), and what
was **verified OK**.

---

## Fixed in this pass

### 1. `assets.js` PATCH silently wiped fields on a partial update — **High**
`category_id`, `brand`, `room_id`, `year` were written as `${b.x || null}` (not
`coalesce`). Any PATCH that omitted those keys **set them to NULL**. The frontend
worked around it by resending everything (`assetPatch`), but any partial update
(e.g. moving an asset between rooms) would blank out the category/brand/year.

**Fix:** the handler now reads the current row and only changes a field when the
request actually includes its key (`hasOwnProperty`). Sending an explicit
`null`/`''` for `category_id`/`room_id` still clears them — so "remove from room"
keeps working, but an omitted field is preserved.

### 2. WhatsApp (Fonnte) fetch had no timeout — **Medium**
`sendWa()` `await`ed `fetch(...)` with no abort. Because the borrow `POST` awaits
`notifyAdminBorrow → sendWa`, a hung gateway could stall the whole request until the
serverless function's own timeout. **Fix:** a 6s `AbortController` bounds the call
(`finally clearTimeout`), so a slow/broken gateway can never stall a borrow.

### 3. `categories.js` / `rooms.js` never called `ensureSchema` — **Low**
Every other data endpoint self-heals the schema (and runs the stock reconcile) via
`ensureSchema`. These two didn't, so if a cold serverless instance's first request
happened to be `categories`/`rooms`, the reconcile wouldn't run until another
endpoint was hit. **Fix:** both now call `ensureSchema(sql)`.

### 4. Deleting an asset could nuke live borrowing history — **Medium**
`borrowings.asset_id` is `on delete cascade`. Deleting an asset that was still out
(or mid-approval) silently deleted its borrowing rows — losing history and desyncing
stock. **Fix:** `DELETE /api/assets` now returns **409** if the asset has any
borrowing in a non-final state (`pending/approved/verified/borrowed/return_pending`).

### 5. Laporan "verifikator" column was always blank — **Medium** _(fixed previously, noted here for completeness)_
`verified_by` was only stamped when `status = 'verified'`, but the real 2-step flow
transitions `approved → borrowed`. It's now stamped on the `approved → borrowed`
(verifikasi 2) transition, so the report shows who verified. Historic rows verified
before the fix have no verifikator recorded (that data was never captured).

### 6. Required due date on borrow — **Medium** _(fixed previously)_
`POST /api/borrowings` now rejects a create without `dueDate`, matching the new
frontend requirement, so an item can't be borrowed without a return date.

### 7. `users.js` self-guard compared number vs string — **Medium** _(fixed previously)_
The "can't demote/delete your own account" checks compared `parseInt(id)` (number)
with the JWT `sub` (Neon returns `bigint` as a **string**), so the guard never fired.
Now `String()`-normalised, matching the pattern used in `borrowings.js`.

---

## Noted (intentional / low-risk / future work)

- **`reserving` branch in `borrowings.js` PATCH is unreachable.** Every in-pipeline
  status is "reserved", and no transition goes _from_ a final state (`returned`/
  `rejected`) _into_ a reserved one, so `!wasOut && nowOut` never triggers. Harmless
  dead code; left in place as a defensive guard. The `releasing` path (giving stock
  back) is real and runs inside the single atomic statement — no desync there.
- **`notifyAdminBorrow` is awaited in the borrow POST.** With the new timeout this is
  bounded (≤6s). True fire-and-forget isn't reliable on serverless (the function may
  freeze after the response), so awaiting is the safer trade-off.
- **`reconcileStock` runs once per cold start.** Two guarded `UPDATE`s that only touch
  out-of-sync rows. Fine at the current scale; if the asset table grows large,
  consider gating it behind a version flag or a scheduled job instead of per-instance.
- **`GET /api/assets` and `/api/public?resource=catalog` return everything** (default
  limit 5000, no real pagination in the UI). Fine for the current inventory; add
  server-side paging/virtualised lists before this reaches tens of thousands of rows.
- **Avatars are stored as data-URLs in `users.avatar`.** Simple and self-contained,
  but it bloats the row and every `profile` GET ships the image. If avatars grow,
  move them to object storage and store only a URL.
- **CORS is `Access-Control-Allow-Origin: *`.** Acceptable because auth is a `Bearer`
  token (not cookies), so there's no CSRF surface. If cookies are ever introduced,
  lock the origin down.
- **No login rate-limiting / lockout.** `login.js` will happily accept unlimited
  attempts. Passwords are scrypt + timing-safe compared, but add throttling
  (per-IP/per-NIP) before this is exposed to the public internet.
- **No server-side session revocation.** Logout is client-side token deletion; a
  leaked JWT stays valid until its 7-day `exp`. Acceptable for an internal tool; add
  a token version/blocklist if stronger guarantees are needed.
- **`readJson` swallows malformed bodies as `{}`.** Endpoints then fail their own
  required-field checks, so bad input is rejected — but the error is generic. Fine.

---

## Verified OK

- **`_db.js`** memoises a single `neon()` client per instance — correct for the Neon
  serverless (HTTP) driver; no connection leak, no pool to drain.
- **Auth/JWT (`_auth.js`)** — HS256 signed with a required `JWT_SECRET` (fails closed
  if unset), signature checked with `timingSafeEqual`, `exp` required + enforced.
  Passwords: scrypt with per-user salt, `timingSafeEqual` verify. `readJson` caps
  bodies at 5MB.
- **Stock accounting on borrow** — `POST /api/borrowings` does the availability guard
  (`where stock_available >= qty`) and the borrowing insert in **one** CTE, so it
  can't oversell under concurrency; status change + stock adjustment on PATCH are a
  single statement (can't desync).
- **FK cleanup** — `category_id`/`room_id` are `on delete set null`, so deleting a
  category/room leaves assets intact (now surfaced in the UI as "tanpa kategori/
  ruangan"). `borrowings.user_id` is `on delete set null` (history survives a user
  deletion; `borrower_name` is denormalised on the row).
- **Role gates** — write endpoints use `requireAdmin` / `requireRoles`; the settings
  PATCH (WA number) is admin-only; the profile endpoint is self-service and scoped to
  the caller's own `sub`.
- **Reconcile ↔ RESERVED parity** — `reconcileStock` uses the same reserved-status set
  as `borrowings.js`, so healed counters match the live borrowing state.

---

## Second pass (2026-07-02): vulnerabilities, bugs, mismatches

### Fixed

1. **`notify.js` rejected verifikator (frontend/backend mismatch) — Medium.**
   The UI shows "Ingatkan WA" to all staff, and a verifikator verifying a return also
   fires the `returned` notification — but the API required `role === 'admin'`, so a
   verifikator always got 403 (reminder button errored; return notification silently
   dropped). Both staff roles are now accepted for `remind`/`returned`.

2. **Deleting a user with active loans orphaned them — Medium.**
   `borrowings.user_id` is `on delete set null`; deleting a borrower mid-loan meant
   the loan could never be confirmed back by its owner. `DELETE /api/users` now
   returns 409 while the user has any borrowing in a non-final state (mirrors the
   asset-delete guard).

3. **`dueDate` was unvalidated on borrow POST — Low/Medium.**
   Any string went straight into a `date` column (garbage produced a raw 500 with a
   DB error message) and past dates were accepted server-side (the date floor lived
   only in the frontend). Now: strict `YYYY-MM-DD` shape check plus a
   not-in-the-past check against UTC today (never blocks WIB/WITA/WIT users early).

4. **XSS hardening in the room-QR print window — Low.**
   `showRoomQR` interpolated `room.name` unescaped into `document.write` HTML.
   Only admins define room names, but it is now escaped (same pattern as the
   laporan print view, which was already escaping correctly).

### Verified OK in this pass

- **Auth**: scrypt + `timingSafeEqual`, HS256 JWT fails closed without `JWT_SECRET`,
  `exp` enforced; login adds a delay on failure (soft brute-force friction) and
  leaks nothing about which field was wrong.
- **Self-registration** stays disabled except the documented zero-users bootstrap.
- **Ownership checks**: `notify return-request` and the borrow status transitions
  compare ids as strings (bigint-safe); profile writes are scoped to `auth.sub`.
- **SQL injection**: every query uses the neon tagged-template parameterization;
  no string-built SQL anywhere in `api/`.
- **Guest surface** (`public.js`): catalog/detail expose specs only; stock figures
  require a valid token; writes all sit behind `requireAdmin`/`requireRoles`.
- **Stock accounting**: borrow POST reserves stock and inserts in one CTE
  (oversell-safe under concurrency); PATCH adjusts stock and stamps audit fields in
  one statement; `reconcileStock` heals drift per cold start.
- **Client contract** (`db.js` vs API): all method/shape pairs match after the
  notification-bell fix (array vs `{borrowings}` was the last drift).

### Known trade-offs (unchanged, documented)

- Role changes take effect on next login (JWT carries the role for up to 7 days).
- No per-IP rate limiting (only the login failure delay); add before public exposure.
- `Access-Control-Allow-Origin: *` is safe with Bearer tokens (no cookies/CSRF),
  revisit if cookie auth is ever introduced.
- An asset's photo cannot be cleared once set (no UI for it; PATCH keeps existing
  image when the field is present-but-empty by design of the keep-or-set rule).
