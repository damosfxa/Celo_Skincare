-- ============================================================
-- 0130_block_duplicate_product_name.sql
--
-- Ketemu saat QA testing 2026-08-12: SKU produk sudah dijaga unik sejak
-- awal (products_sku_key), tapi NAMA produk sama sekali belum dijaga --
-- bisa ada 2 produk berbeda dengan nama persis sama, operator gampang
-- kebingungan / gak sadar bikin duplikat.
--
-- Unique index case-insensitive + trim (bukan cuma unique biasa), supaya
-- "Cushion", "cushion", dan " Cushion " dianggap sama-sama duplikat --
-- typo besar/kecil huruf atau spasi nyasar adalah penyebab paling wajar
-- operator gak sadar sudah ada produk dengan nama itu.
--
-- CATATAN: kalau ternyata SUDAH ada 2+ produk dengan nama yang secara
-- case-insensitive sama persis di database, migration ini akan GAGAL
-- (Postgres nolak bikin unique index di atas data yang sudah duplikat).
-- Itu aman -- migration batal, tidak ada yang rusak, tinggal cek dulu:
--
-- SELECT lower(trim(name)), array_agg(sku)
-- FROM products GROUP BY lower(trim(name)) HAVING count(*) > 1;
--
-- Kalau ada hasilnya, rapikan/rename dulu salah satunya (lihat
-- rename-test-products-for-demo-2026-08-11.sql untuk pola aman ubah
-- nama), baru jalankan migration ini lagi.
-- ============================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS products_name_unique_ci
  ON products (lower(trim(name)));

COMMIT;
