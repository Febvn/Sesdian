// Self-healing schema: make sure the columns the app relies on exist, even if
// the migrations (migrate-v3 / migrate-v4) were never run by hand. Idempotent
// and memoized, so it's a cheap no-op after the first request per instance.
let _ensured = false;

export async function ensureSchema(sql) {
  if (_ensured) return;
  try {
    await sql`alter table users add column if not exists phone text`;
    await sql`alter table users add column if not exists avatar text`;   // data-URL profile photo (syncs across devices)
    await sql`alter table assets add column if not exists qr_code text`;
    await sql`alter table assets add column if not exists qr_generated_at timestamptz`;
    await sql`alter table assets add column if not exists status text default 'tersedia'`;
    await sql`alter table borrowings add column if not exists approved_by  bigint`;
    await sql`alter table borrowings add column if not exists approved_at  timestamptz`;
    await sql`alter table borrowings add column if not exists verified_by  bigint`;
    await sql`alter table borrowings add column if not exists verified_at  timestamptz`;
    await sql`alter table borrowings add column if not exists returned_at  timestamptz`;
    // one image per asset NAME (jenis) — changing it is a single upsert instead of
    // patching every unit; served as binary via /api/public?resource=img&key=...
    await sql`create table if not exists asset_images (
      name_key   text primary key,
      image      text,
      updated_at timestamptz default now()
    )`;
    await reconcileStock(sql);
    _ensured = true;
  } catch (e) {
    // tolerate: if a table is missing the caller will surface its own error
  }
}

// Heal stock counters that desynced from the borrowings table (old seed rows set
// stock_borrowed by hand, early-implementation conflicts, etc.). The source of
// truth is the borrowings table: an item is "out" while a borrowing sits in any
// non-final state. Runs once per instance (cheap, idempotent) so a returned item
// can never keep showing as "dipinjam" in Data Aset. Mirrors RESERVED in borrowings.js.
export async function reconcileStock(sql) {
  // set stock_borrowed = sum of active qty, stock_available = total - borrowed
  await sql`
    update assets a set
      stock_borrowed  = coalesce(b.cnt, 0),
      stock_available = greatest(0, a.stock_total - coalesce(b.cnt, 0))
    from (
      select asset_id, sum(qty)::int as cnt
      from borrowings
      where status in ('pending','approved','verified','borrowed','return_pending')
        and asset_id is not null
      group by asset_id
    ) b
    where a.id = b.asset_id
      and (a.stock_borrowed <> coalesce(b.cnt, 0)
        or a.stock_available <> greatest(0, a.stock_total - coalesce(b.cnt, 0)))`;
  // assets with no active borrowings → fully available
  await sql`
    update assets a set stock_borrowed = 0, stock_available = a.stock_total
    where (a.stock_borrowed <> 0 or a.stock_available <> a.stock_total)
      and not exists (
        select 1 from borrowings b
        where b.asset_id = a.id
          and b.status in ('pending','approved','verified','borrowed','return_pending'))`;
}
