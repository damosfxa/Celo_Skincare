-- ============================================================
-- 0104_schema_rls_policies.sql
-- Prinsip inti sistem: "tidak ada angka stok yang berubah tanpa
-- jejak". Diterapkan di level RLS, bukan cuma konvensi kode --
-- tabel-tabel pergerakan stok (stock_ledger, bundle_recipes)
-- SENGAJA tidak diberi policy UPDATE/DELETE untuk role biasa.
-- Satu-satunya jalan mengubah/menghapus baris di tabel itu adalah
-- lewat RPC function yang SECURITY DEFINER (lihat 0102), yang
-- masing-masing punya validasi bisnisnya sendiri.
--
-- Catatan: hanya 1 user role (Admin) di sistem ini (lihat update
-- brief "Hanya ada 1 user role: Admin"), jadi semua policy di sini
-- terbuka untuk siapa pun yang sudah authenticated, tanpa pembedaan
-- role granular.
-- ============================================================

alter table profiles enable row level security;
alter table products enable row level security;
alter table product_batches enable row level security;
alter table bundle_recipes enable row level security;
alter table stock_ledger enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_batch_allocations enable row level security;
alter table opname_sessions enable row level security;
alter table opname_items enable row level security;
alter table returns enable row level security;

-- profiles: read-only, tidak ada insert/update manual dari user --
-- baris dibuat otomatis lewat trigger fn_handle_new_user().
create policy read_own_profile on profiles
  for select using (true);

-- products: insert & update boleh (user bisa ubah nama/sku/tipe),
-- tapi TIDAK ADA policy delete -- produk tidak pernah dihapus.
create policy insert_products on products
  for insert with check (true);
create policy read_all_products on products
  for select using (true);
create policy update_products on products
  for update using (true);

-- product_batches: insert & read saja. Tidak ada update/delete --
-- data batch (kode, tanggal expired) dianggap final begitu dicatat.
create policy insert_batches on product_batches
  for insert with check (true);
create policy read_all_batches on product_batches
  for select using (true);

-- bundle_recipes: SENGAJA cuma insert & read. Update/delete resep
-- HANYA lewat fn_save_bundle_recipe() (SECURITY DEFINER) supaya
-- ganti resep selalu tercatat sebagai satu operasi atomik
-- (hapus semua + insert ulang), bukan edit baris sembarangan.
create policy insert_recipes on bundle_recipes
  for insert with check (true);
create policy read_all_recipes on bundle_recipes
  for select using (true);

-- stock_ledger: INTI immutability sistem. Cuma insert & read.
-- TIDAK ADA update, TIDAK ADA delete, untuk role mana pun,
-- termasuk lewat RPC function. Sekali tercatat, permanen.
create policy insert_ledger on stock_ledger
  for insert with check (true);
create policy read_all_ledger on stock_ledger
  for select using (true);

-- orders: insert & update boleh (status berubah PENDING -> SHIPPED
-- -> dst), tidak ada delete -- order tidak pernah dihapus dari
-- histori, cuma berubah status (termasuk CANCELLED).
create policy insert_orders on orders
  for insert with check (true);
create policy read_all_orders on orders
  for select using (true);
create policy update_orders on orders
  for update using (true);

create policy insert_order_items on order_items
  for insert with check (true);
create policy read_all_order_items on order_items
  for select using (true);

create policy insert_allocations on order_item_batch_allocations
  for insert with check (true);
create policy read_all_allocations on order_item_batch_allocations
  for select using (true);

-- opname_sessions: insert & update (status OPEN -> CLOSED).
create policy insert_opname_sessions on opname_sessions
  for insert with check (true);
create policy read_all_opname_sessions on opname_sessions
  for select using (true);
create policy update_opname_sessions on opname_sessions
  for update using (true);

-- opname_items: insert (snapshot awal) & update (isi physical_qty
-- pas scan). Tidak ada delete -- baris opname permanen sebagai
-- jejak sesi itu, walau physical_qty-nya null (belum dihitung).
create policy insert_opname_items on opname_items
  for insert with check (true);
create policy read_all_opname_items on opname_items
  for select using (true);
create policy update_opname_items on opname_items
  for update using (true);

-- returns: insert (ajuan retur) & update (hasil inspeksi kondisi).
create policy insert_returns on returns
  for insert with check (true);
create policy read_all_returns on returns
  for select using (true);
create policy update_returns on returns
  for update using (true);
