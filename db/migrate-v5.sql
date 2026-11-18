-- ============================================================
--  migrate-v5 — one-off data corrections after the switch to the individual-item model.
--  Run ONCE in the Neon SQL editor (or: npm run db:run db/migrate-v5.sql).
--  These are destructive; review before running.
-- ============================================================

-- Hard reset room placement. Every asset is currently pinned to
-- "Ruang Kepala"; clear it so assets have no room and can be re-placed
-- (room_id is already nullable, so "no room" is a valid state).
update assets
   set room_id = null
 where room_id in (select id from rooms where name = 'Ruang Kepala');
-- (If you want to clear EVERY assignment regardless of room, use instead:)
-- update assets set room_id = null;

-- Restore asset codes to match daftaraset2025.xlsx. The importer split
-- codes like 325872859 into "32587285-9" (treating the trailing part as the
-- Nth-copy sequence). Rejoin so the stored code equals the spreadsheet code.
update assets
   set code = regexp_replace(code, '-(\d+)$', '\1')
 where code ~ '-\d+$';

-- Sanity check after running:
--   select code from assets where code like '%-%';   -- expect 0 rows with a trailing -N
--   select count(*) from assets where room_id is not null;
