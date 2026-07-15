-- ============================================================
-- 0100_schema_tables.sql
-- Snapshot skema tabel produksi, direkonstruksi dari database
-- Supabase yang sudah berjalan (bukan urutan pembuatan asli).
-- Tujuan: reproducibility -- supaya database bisa dibangun ulang
-- dari nol persis sesuai kondisi final project ini.
-- ============================================================

-- profiles: 1 baris per user auth Supabase, diisi otomatis lewat
-- trigger fn_handle_new_user() saat signup (lihat 0102).
create table if not exists profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  is_bundle boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  batch_code text not null,
  expiry_date date not null,
  created_at timestamptz not null default now()
);

-- Resep bundle: 1 baris per komponen. Bundle tidak punya stok
-- sendiri -- dipecah ke produk satuan lewat tabel ini saat order
-- masuk (lihat resolveItemsForProduct di src/lib/services/orders.ts).
create table if not exists bundle_recipes (
  id uuid primary key default gen_random_uuid(),
  bundle_product_id uuid not null references products(id),
  component_product_id uuid not null references products(id),
  qty_per_bundle integer not null
);

-- Stock ledger: satu-satunya sumber kebenaran stok. Append-only --
-- lihat 0104 untuk policy RLS yang sengaja tidak mengizinkan
-- UPDATE/DELETE dari sisi user biasa.
create table if not exists stock_ledger (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references product_batches(id),
  movement_type text not null,
  qty_delta integer not null,
  channel text,
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  external_order_id text not null,
  status text not null,
  ordered_at timestamptz not null,
  shipped_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  product_id uuid not null references products(id),
  qty integer not null
);

-- Alokasi FEFO per order_item -- bisa lebih dari 1 baris per
-- order_item kalau qty-nya kepecah ke beberapa batch.
create table if not exists order_item_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id),
  batch_id uuid not null references product_batches(id),
  qty integer not null
);

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  order_item_id uuid references order_items(id),
  qty integer not null,
  condition text not null default 'PENDING_INSPECTION',
  claim_deadline date,
  inspected_by uuid references profiles(id),
  inspected_at timestamptz,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists opname_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  status text not null default 'OPEN',
  created_by uuid not null references profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists opname_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references opname_sessions(id),
  batch_id uuid not null references product_batches(id),
  system_qty integer not null,
  physical_qty integer,
  variance integer,
  note text
);
