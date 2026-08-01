-- Sinkronisasi dokumentasi (bukan perubahan) -- kedua constraint di bawah
-- ini SUDAH LIVE di production (dikonfirmasi via query pg_constraint),
-- tapi gak pernah tercatat di file migration manapun. Kalau database
-- direbuild dari nol cuma pakai folder migrations/ ini, 2 constraint
-- penting ini bakal HILANG diam-diam:
--
-- 1. products.sku harus unik -- tanpa ini, 2 produk bisa punya SKU
--    identik tanpa peringatan, bikin resolusi SKU (impor CSV, intake
--    maklon, opening balance) bisa salah sasaran.
-- 2. orders(channel, external_order_id) harus unik -- ini yang jadi
--    dasar mekanisme idempotency order (lihat createOrderWithItems di
--    src/lib/services/orders.ts, yang secara eksplisit menangkap error
--    kode 23505 buat menangani race condition webhook/impor).
--
-- IF NOT EXISTS di kedua ADD CONSTRAINT supaya file ini aman dijalankan
-- baik di production (constraint udah ada, jadi no-op) maupun di
-- database baru yang benar-benar dari nol (constraint akan dibuat).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_key'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_sku_key UNIQUE (sku);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_channel_external_order_id_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_channel_external_order_id_key UNIQUE (channel, external_order_id);
  END IF;
END $$;
