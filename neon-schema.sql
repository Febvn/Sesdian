-- ============================================================
--  SESDIAN — Neon (Postgres) schema + seed data
--  Run once in the Neon SQL Editor (or `psql $DATABASE_URL -f neon-schema.sql`).
--  Auth is handled by the API layer (/api), so this is plain Postgres:
--  a users table with a password hash, plus the domain tables.
-- ============================================================

drop table if exists borrowings cascade;
drop table if exists assets      cascade;
drop table if exists rooms       cascade;
drop table if exists categories  cascade;
drop table if exists users       cascade;

create table users (
  id            bigserial primary key,
  nip           text unique not null,
  name          text not null,
  role          text not null default 'user',   -- 'user' | 'admin'; the FIRST account to register becomes admin (see /api/register)
  password_hash text not null,            -- scrypt: "<saltHex>:<hashHex>" (set by /api/register)
  created_at    timestamptz not null default now()
);

create table categories (
  id   bigserial primary key,
  name text not null,
  icon text default '📦'
);

create table rooms (
  id   bigserial primary key,
  name text not null,
  code text,
  pic  text                       -- penanggung jawab
);

create table assets (
  id              bigserial primary key,
  code            text not null,
  name            text not null,
  category_id     bigint references categories(id) on delete set null,
  brand           text,
  room_id         bigint references rooms(id) on delete set null,
  year            int,
  condition       text default 'Baik',
  type            text default 'BMN',           -- 'BMN' | 'Non-BMN'
  asset_type      text default 'Fixed Asset',
  stock_total     int not null default 1,
  stock_available int not null default 1,
  stock_borrowed  int not null default 0,
  image           text,
  created_at      timestamptz not null default now()
);

create table borrowings (
  id            bigserial primary key,
  asset_id      bigint references assets(id) on delete cascade,
  user_id       bigint references users(id) on delete set null,
  borrower_name text,
  qty           int not null default 1,
  status        text not null default 'pending',  -- pending|approved|borrowed|returned
  due_date      date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index on assets (code);
create index on borrowings (status);
create index on borrowings (created_at desc);

-- ============================================================
--  SEED DATA (mirrors the original SESDIAN demo content)
-- ============================================================
insert into categories (name, icon) values
  ('Elektronik','💻'), ('Furnitur','🪑'), ('Kendaraan','🚗'),
  ('Peralatan','🔧'), ('Dokumen','📄'), ('Lain-lain','📦');

insert into rooms (name, code, pic) values
  ('Ruang Kepala','RK-01',null),
  ('Ruang Tata Usaha','TU-01',null),
  ('Ruang Rapat','RR-01',null),
  ('Ruang Pelayanan','RP-01',null),
  ('Gudang','GD-01',null),
  ('Laboratorium','LB-01',null);

insert into assets (code, name, category_id, brand, room_id, year, condition, type, asset_type, stock_total, stock_available, stock_borrowed)
select '123','Laptop',
       (select id from categories where name='Elektronik'),
       'Acer',
       (select id from rooms where name='Ruang Tata Usaha'),
       2024,'Baik','BMN','Fixed Asset',14,9,5;

insert into borrowings (asset_id, user_id, borrower_name, qty, status, due_date)
select id, null, 'Adi Septriansyah', 1, 'pending', date '2026-06-18'
from assets where code='123';
