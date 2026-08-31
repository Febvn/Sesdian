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

-- borrower WhatsApp number (for overdue / return reminders)
alter table users add column if not exists phone text;

-- map any legacy emoji category icons to icon names (safe if already names / absent)
update categories set icon = 'monitor' where icon = '💻';
update categories set icon = 'chair'   where icon = '🪑';
update categories set icon = 'car'     where icon = '🚗';
update categories set icon = 'wrench'  where icon = '🔧';
update categories set icon = 'file'    where icon = '📄';
update categories set icon = 'package' where icon = '📦';

-- (Admin bootstrap is automatic: the first account to log in becomes admin
--  when no admin exists yet. If you prefer to set it by hand, run:)
-- update users set role = 'admin' where id = (select id from users order by id limit 1);
