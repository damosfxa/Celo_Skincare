-- Cleanup produk percobaan buat verifikasi retur parsial bundle
-- (QATEST-PR-*). Urutan hapus: anak dulu baru induk.

BEGIN;

DELETE FROM returns
WHERE order_item_id IN (
  SELECT oi.id FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.sku LIKE 'QATEST-PR-%'
);

DELETE FROM order_item_batch_allocations
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'QATEST-PR-%'
);

DELETE FROM order_items
WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QATEST-PR-%');

DELETE FROM stock_ledger
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'QATEST-PR-%'
);

DELETE FROM batch_stock_summary
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku LIKE 'QATEST-PR-%'
);

DELETE FROM product_batches
WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QATEST-PR-%');

DELETE FROM product_stock_summary
WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QATEST-PR-%');

DELETE FROM bundle_recipes
WHERE bundle_product_id IN (SELECT id FROM products WHERE sku LIKE 'QATEST-PR-%')
   OR component_product_id IN (SELECT id FROM products WHERE sku LIKE 'QATEST-PR-%');

DELETE FROM products WHERE sku LIKE 'QATEST-PR-%';

COMMIT;
