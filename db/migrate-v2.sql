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

-- 3. Audit Log table (DB-03)
CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  user_id    bigint REFERENCES users(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  bigint,
  detail     jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

-- 4. Constraint stock >= 0 (DB-04)
ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_stock_available;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_stock_borrowed;
ALTER TABLE assets ADD CONSTRAINT chk_stock_available CHECK (stock_available >= 0);
ALTER TABLE assets ADD CONSTRAINT chk_stock_borrowed CHECK (stock_borrowed >= 0);
