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
    await sql`alter table assets add column if not exists acquisition_date date`;   // tanggal perolehan (satu per barang)
    await sql`alter table borrowings add column if not exists approved_by  bigint`;
    await sql`alter table borrowings add column if not exists approved_at  timestamptz`;
    await sql`alter table borrowings add column if not exists verified_by  bigint`;
    await sql`alter table borrowings add column if not exists verified_at  timestamptz`;
    await sql`alter table borrowings add column if not exists returned_at  timestamptz`;
    // Keep loan history when a staff account is deleted: the approver/verifier
    // columns must be ON DELETE SET NULL so the borrowing row survives (only the
    // processor name goes blank). Older deployments created these as NO ACTION,
    // which would make deleting such an account fail. Normalize once per instance.
    const fks = await sql`select con.conname, con.confdeltype from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      where c.relname = 'borrowings' and con.contype = 'f'
        and con.conname in ('borrowings_approved_by_fkey','borrowings_verified_by_fkey')`;
    const byName = {}; fks.forEach((r) => { byName[r.conname] = r.confdeltype; });
    if (byName['borrowings_approved_by_fkey'] !== 'n') {
      await sql`alter table borrowings drop constraint if exists borrowings_approved_by_fkey`;
      await sql`alter table borrowings add constraint borrowings_approved_by_fkey foreign key (approved_by) references users(id) on delete set null`;
    }
    if (byName['borrowings_verified_by_fkey'] !== 'n') {
      await sql`alter table borrowings drop constraint if exists borrowings_verified_by_fkey`;
      await sql`alter table borrowings add constraint borrowings_verified_by_fkey foreign key (verified_by) references users(id) on delete set null`;
    }
    // one image per asset NAME (jenis) — changing it is a single upsert instead of
    // patching every unit; served as binary via /api/public?resource=img&key=...
    await sql`create table if not exists asset_images (
      name_key   text primary key,
      image      text,
      updated_at timestamptz default now()
    )`;
    // failed-login ledger for per-NIP rate limiting (see api/login.js); rows expire after a day
    await sql`create table if not exists login_attempts (
      id         bigserial primary key,
      nip        text not null,
      created_at timestamptz not null default now()
    )`;
    await sql`create index if not exists idx_login_attempts_nip on login_attempts (nip, created_at)`;
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
