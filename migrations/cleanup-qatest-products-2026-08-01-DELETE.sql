-- Cleanup permanen produk QATEST-* dari production sebelum submission
-- (hasil QA round bundle + exhaustive dropdown testing, 2026-08-01).
-- JALANIN CUMA SETELAH review/backup dari
-- cleanup-qatest-products-2026-08-01-BACKUP-QUERIES.sql udah diambil.
-- Ini operasi DESTRUKTIF & GAK BISA DI-UNDO.
--
-- Urutan hapus: anak dulu baru induk, biar gak kena error foreign key
-- (pola sama persis kayak cleanup-test-products-2026-08-01, termasuk
-- cache O(1) batch_stock_summary/product_stock_summary dari migration 0107
-- yang kelupaan di draft pertama waktu itu).
-- orders itu sendiri SENGAJA TIDAK dihapus (biar aman, jadi wadah kosong
-- doang, gak ganggu apapun) -- termasuk order TikTok simulasi acak
-- (SIM-TIKTOK-...) yang kebetulan 0 item karena bug terpisah yang sudah
-- dilaporkan (produk bundle tanpa resep aktif kepilih random).

BEGIN;

-- 1. Ledger entries yang nempel di batch produk QATEST-*
DELETE FROM stock_ledger
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'QATEST-%'
);

-- 2. Opname items (baris item, bukan sesinya) yang batch-nya produk QATEST-*
DELETE FROM opname_items
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'QATEST-%'
);

-- 3. Alokasi FEFO ke batch produk QATEST-*
DELETE FROM order_item_batch_allocations
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'QATEST-%'
);

-- 4. Retur yang order_item-nya produk QATEST-*
DELETE FROM returns
WHERE order_item_id IN (
  SELECT oi.id FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.sku LIKE 'QATEST-%'
);

-- 5. Order items (baris item, bukan order-nya) yang produknya QATEST-*
DELETE FROM order_items
WHERE product_id IN (
  SELECT id FROM products WHERE sku LIKE 'QATEST-%'
);

-- 6. Cache saldo per-batch (tabel O(1) summary dari migration 0107)
DELETE FROM batch_stock_summary
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'QATEST-%'
);

-- 7. Batch fisik produk QATEST-*
DELETE FROM product_batches
WHERE product_id IN (
  SELECT id FROM products WHERE sku LIKE 'QATEST-%'
);

-- 8. Cache saldo per-produk (tabel O(1) summary dari migration 0107)
DELETE FROM product_stock_summary
WHERE product_id IN (
  SELECT id FROM products WHERE sku LIKE 'QATEST-%'
);

-- 9. Resep bundle yang nyangkut produk QATEST-* (sebagai bundle ATAU komponen)
DELETE FROM bundle_recipes
WHERE bundle_product_id IN (SELECT id FROM products WHERE sku LIKE 'QATEST-%')
   OR component_product_id IN (SELECT id FROM products WHERE sku LIKE 'QATEST-%');

-- 10. Produk QATEST-* itu sendiri
DELETE FROM products WHERE sku LIKE 'QATEST-%';

COMMIT;
