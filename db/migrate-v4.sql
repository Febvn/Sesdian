-- ============================================================
--  SESDIAN - migration v4 (non-destructive; safe to run once)
--  Adds return verification: a "return_pending" status (item handed
--  back, awaiting admin verification) and a returned_at timestamp.
--  Run in Neon SQL Editor, or locally: npm run db:run db/migrate-v4.sql
-- ============================================================

alter table borrowings add column if not exists returned_at timestamptz;

-- (status 'return_pending' is just a text value; no schema change needed)
create index if not exists idx_borrowings_returned_at on borrowings (returned_at);
