-- ============================================================
--  SESDIAN - incremental migration for an EXISTING Neon database
--  (non-destructive; safe to run once). Use this instead of
--  re-running neon-schema.sql, which would drop your data.
-- ============================================================

-- WhatsApp notification settings table
create table if not exists settings (
  key   text primary key,
  value text
);
insert into settings (key, value) values ('wa_number', '') on conflict (key) do nothing;

-- (Admin bootstrap is automatic: the first account to log in becomes admin
--  when no admin exists yet. If you prefer to set it by hand, run:)
-- update users set role = 'admin' where id = (select id from users order by id limit 1);
