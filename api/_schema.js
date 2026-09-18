// Self-healing schema: make sure the columns the app relies on exist, even if
// the migrations (migrate-v3 / migrate-v4) were never run by hand. Idempotent
// and memoized, so it's a cheap no-op after the first request per instance.
let _ensured = false;

export async function ensureSchema(sql) {
  if (_ensured) return;
  try {
    await sql`alter table users add column if not exists phone text`;
    await sql`alter table assets add column if not exists qr_code text`;
    await sql`alter table assets add column if not exists qr_generated_at timestamptz`;
    await sql`alter table borrowings add column if not exists approved_by  bigint`;
    await sql`alter table borrowings add column if not exists approved_at  timestamptz`;
    await sql`alter table borrowings add column if not exists verified_by  bigint`;
    await sql`alter table borrowings add column if not exists verified_at  timestamptz`;
    await sql`alter table borrowings add column if not exists returned_at  timestamptz`;
    _ensured = true;
  } catch (e) {
    // tolerate: if a table is missing the caller will surface its own error
  }
}
