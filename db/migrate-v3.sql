-- ============================================================
--  SESDIAN - migration v3 (non-destructive; safe to run once)
--  Adds: dual verification (admin + verifikator), QR codes for
--  asset detail pages, and indexes for the borrowing reports.
--  Run in the Neon SQL Editor or: psql $DATABASE_URL -f migrate-v3.sql
-- ============================================================

-- 1) Dual verification fields on borrowings ------------------
--    Flow: pending -> approved (admin) -> verified (verifikator) -> borrowed -> returned
alter table borrowings add column if not exists approved_by  bigint references users(id);
alter table borrowings add column if not exists approved_at  timestamptz;
alter table borrowings add column if not exists verified_by  bigint references users(id);
alter table borrowings add column if not exists verified_at  timestamptz;

-- 2) QR code fields on assets --------------------------------
alter table assets add column if not exists qr_code         text;
alter table assets add column if not exists qr_generated_at timestamptz;

-- unique QR codes (partial unique index tolerates the NULLs on un-tagged assets)
create unique index if not exists uq_assets_qr_code on assets (qr_code) where qr_code is not null;

-- 3) Generate the first 10 sample QR codes -------------------
--    QR000001 .. QR000010 -> the 10 lowest-id assets that don't have one yet.
with first10 as (
  select id from assets where qr_code is null order by id limit 10
)
update assets a
   set qr_code = 'QR' || lpad(a.id::text, 6, '0'),
       qr_generated_at = now()
  from first10 f
 where a.id = f.id;

-- 4) Indexes for the reports (daily / weekly / monthly) ------
create index if not exists idx_borrowings_created       on borrowings (created_at);
create index if not exists idx_borrowings_status_created on borrowings (status, created_at);
create index if not exists idx_borrowings_user_created   on borrowings (user_id, created_at);
create index if not exists idx_borrowings_approved_by    on borrowings (approved_by);
create index if not exists idx_borrowings_verified_by    on borrowings (verified_by);
create index if not exists idx_users_role                on users (role);

-- ============================================================
-- Notes
--  * The 'verifikator' role is just a value in users.role
--    ('user' | 'admin' | 'verifikator'); no schema change needed.
--    Promote a user from the admin panel (Kelola User) or by hand:
--      update users set role = 'verifikator' where nip = '...';
--  * Self-registration is disabled in the API; create users from the
--    admin "Kelola User" page (POST /api/users).
--  * New assets created from the app get a QR code automatically
--    (see api/assets.js). To (re)tag everything in bulk later:
--      update assets set qr_code = 'QR' || lpad(id::text,6,'0'),
--                        qr_generated_at = now()
--       where qr_code is null;
-- ============================================================
