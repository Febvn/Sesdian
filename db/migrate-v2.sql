-- Phase 2 Migrations for SESDIAN Asset Management

-- 1. Add Indexes for performance (DB-01)
CREATE INDEX IF NOT EXISTS idx_users_nip ON users(nip);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_room ON assets(room_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_user ON borrowings(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_asset ON borrowings(asset_id);

-- 2. Add updated_at columns (DB-02)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. (dihapus) Tabel audit_log tidak pernah dipakai kode aplikasi dan tidak
--    pernah dibuat di database produksi. DROP di bawah sekadar berjaga-jaga
--    bila tabelnya pernah dibuat manual dari berkas versi lama.
DROP TABLE IF EXISTS audit_log;

-- 4. Constraint stock >= 0 (DB-04)
ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_stock_available;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_stock_borrowed;
ALTER TABLE assets ADD CONSTRAINT chk_stock_available CHECK (stock_available >= 0);
ALTER TABLE assets ADD CONSTRAINT chk_stock_borrowed CHECK (stock_borrowed >= 0);
