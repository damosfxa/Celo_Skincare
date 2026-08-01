-- Cleanup produk percobaan tunggal (QATEST-BIGQTY), dibuat khusus buat
-- verifikasi sistem sanggup nampung angka stok besar (60.769 pcs, sesuai
-- contoh data client). Urutan hapus: anak dulu baru induk.

BEGIN;

DELETE FROM stock_ledger
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku = 'QATEST-BIGQTY'
);

DELETE FROM batch_stock_summary
WHERE batch_id IN (
  SELECT pb.id FROM product_batches pb
  JOIN products p ON p.id = pb.product_id
  WHERE p.sku = 'QATEST-BIGQTY'
);

DELETE FROM product_batches
WHERE product_id IN (SELECT id FROM products WHERE sku = 'QATEST-BIGQTY');

DELETE FROM product_stock_summary
WHERE product_id IN (SELECT id FROM products WHERE sku = 'QATEST-BIGQTY');

DELETE FROM products WHERE sku = 'QATEST-BIGQTY';

COMMIT;
