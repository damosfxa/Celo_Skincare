-- ============================================================
-- 0127_add_performance_indexes.sql
--
-- Menambah index performa untuk kolom yang dipakai MENYARING,
-- MENGURUTKAN, dan MENGGABUNG (join) data. Sampai migration ini,
-- database TIDAK punya satu pun index eksplisit -- Postgres cuma
-- otomatis meng-index kolom PRIMARY KEY (id) dan UNIQUE constraint
-- (orders(channel, external_order_id) dari 0120). Kolom foreign key,
-- created_at, dan status TIDAK terindeks (Postgres tidak meng-index
-- FK otomatis).
--
-- KENAPA ini aman (beda total dari perubahan lain):
-- CREATE INDEX HANYA mempercepat query. Tidak menyentuh data, tidak
-- mengubah logika, tidak mengubah hak akses. Mustahil membuat angka
-- stok jadi salah. Jadi ini nol risiko ke kebenaran, murni performa.
--
-- KENAPA ini perlu (kesiapan skala):
-- Baca saldo stok memang sudah O(1) lewat tabel cache (0125), jadi
-- navigasi umum tetap cepat berapa pun data. TAPI query yang menyaring
-- lewat batch_id / created_at / status / FK (drilldown ledger,
-- pergerakan terbaru, view anomali & oversell, alokasi FEFO) tanpa
-- index akan MEMINDAI SELURUH TABEL (sequential scan) dan makin lambat
-- saat ledger tumbuh ke ratusan ribu / jutaan baris. Index ini yang
-- membuat sistem tetap cepat di skala besar.
--
-- CATATAN menjalankan:
-- Saat database masih kecil, CREATE INDEX biasa (di dalam transaksi)
-- selesai seketika dan aman. Kalau suatu saat file ini dijalankan pada
-- tabel yang SUDAH sangat besar, jalankan tiap baris sebagai
-- `CREATE INDEX CONCURRENTLY ...` DI LUAR blok transaksi (tanpa
-- BEGIN/COMMIT) supaya tidak mengunci penulisan selama index dibangun.
-- Semua pakai IF NOT EXISTS, jadi aman dijalankan ulang.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- stock_ledger (tabel terbesar, tumbuh tiap ada pergerakan stok)
-- ------------------------------------------------------------
-- Drilldown ledger per produk: WHERE batch_id IN (...) ORDER BY created_at.
-- Juga dipakai v_batch_stock / v_product_stock (agregasi per batch).
CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch_created
  ON stock_ledger (batch_id, created_at);

-- Dashboard "Pergerakan Terbaru": ORDER BY created_at DESC LIMIT 8.
CREATE INDEX IF NOT EXISTS idx_stock_ledger_created_at
  ON stock_ledger (created_at);

-- v_daily_anomalies: join sl.reference_type='order' AND sl.reference_id=o.id.
-- Juga membantu penelusuran ledger yang tertaut ke sebuah order/retur/opname.
CREATE INDEX IF NOT EXISTS idx_stock_ledger_reference
  ON stock_ledger (reference_type, reference_id);

-- ------------------------------------------------------------
-- product_batches
-- ------------------------------------------------------------
-- Drilldown langkah 1 (ambil semua batch milik 1 produk), alokasi FEFO,
-- dan join di v_expiring_batches.
CREATE INDEX IF NOT EXISTS idx_product_batches_product
  ON product_batches (product_id);

-- ------------------------------------------------------------
-- order_items
-- ------------------------------------------------------------
-- Join per order (ambil item sebuah order, alokasi, retur).
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items (order_id);

-- v_oversell_risk: GROUP BY product_id + join produk.
CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON order_items (product_id);

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
-- v_oversell_risk (status='PENDING') dan v_daily_anomalies (status='CANCELLED').
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status);

-- ------------------------------------------------------------
-- order_item_batch_allocations
-- ------------------------------------------------------------
-- Reversal saat pembatalan/retur: cari alokasi batch milik sebuah order_item.
CREATE INDEX IF NOT EXISTS idx_oiba_order_item
  ON order_item_batch_allocations (order_item_id);

-- ------------------------------------------------------------
-- returns
-- ------------------------------------------------------------
-- Join per order (v_pending_tiktok_claims, subquery NOT EXISTS di anomali).
CREATE INDEX IF NOT EXISTS idx_returns_order
  ON returns (order_id);

-- Filter retur yang belum diinspeksi (dashboard + halaman Retur).
CREATE INDEX IF NOT EXISTS idx_returns_condition
  ON returns (condition);

-- ------------------------------------------------------------
-- opname_items
-- ------------------------------------------------------------
-- Ambil semua item hitung fisik milik satu sesi opname.
CREATE INDEX IF NOT EXISTS idx_opname_items_session
  ON opname_items (session_id);

-- ------------------------------------------------------------
-- bundle_recipes
-- ------------------------------------------------------------
-- Pecah bundle ke komponen satuan saat order bundle masuk.
CREATE INDEX IF NOT EXISTS idx_bundle_recipes_bundle
  ON bundle_recipes (bundle_product_id);

COMMIT;
