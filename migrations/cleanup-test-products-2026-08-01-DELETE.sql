-- Cleanup permanen produk TEST-* dari production sebelum submission.
-- JALANIN CUMA SETELAH backup CSV dari cleanup-test-products-2026-08-01-BACKUP-QUERIES.sql
-- udah diambil. Ini operasi DESTRUKTIF & GAK BISA DI-UNDO.
--
-- Urutan hapus: anak dulu baru induk, biar gak kena error foreign key.
-- orders & opname_sessions itu sendiri SENGAJA TIDAK dihapus (biar aman,
-- jadi wadah kosong doang, gak ganggu apapun).

BEGIN;

-- 1. Ledger entries yang nempel di batch produk test
DELETE FROM stock_ledger
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'TEST-%'
);

-- 2. Opname items (baris item, bukan sesinya) yang batch-nya produk test
DELETE FROM opname_items
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'TEST-%'
);

-- 3. Alokasi FEFO ke batch produk test
DELETE FROM order_item_batch_allocations
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'TEST-%'
);

-- 4. Retur yang order_item-nya produk test
DELETE FROM returns
WHERE order_item_id IN (
  SELECT oi.id FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.sku LIKE 'TEST-%'
);

-- 5. Order items (baris item, bukan order-nya) yang produknya test
DELETE FROM order_items
WHERE product_id IN (
  SELECT id FROM products WHERE sku LIKE 'TEST-%'
);

-- 6. Cache saldo per-batch (tabel O(1) summary dari migration 0107) --
-- kelewat di draft pertama, ini yang bikin error kemarin.
DELETE FROM batch_stock_summary
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'TEST-%'
);

-- 7. Batch fisik produk test
DELETE FROM product_batches
WHERE product_id IN (
  SELECT id FROM products WHERE sku LIKE 'TEST-%'
);

-- 8. Cache saldo per-produk (tabel O(1) summary dari migration 0107)
DELETE FROM product_stock_summary
WHERE product_id IN (
  SELECT id FROM products WHERE sku LIKE 'TEST-%'
);

-- 9. Resep bundle yang nyangkut produk test (sebagai bundle ATAU komponen)
DELETE FROM bundle_recipes
WHERE bundle_product_id IN (SELECT id FROM products WHERE sku LIKE 'TEST-%')
   OR component_product_id IN (SELECT id FROM products WHERE sku LIKE 'TEST-%');

-- 10. Produk test itu sendiri
DELETE FROM products WHERE sku LIKE 'TEST-%';

COMMIT;
