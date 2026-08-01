-- Backup/review SEBELUM hapus data QATEST-* (hasil QA round bundle +
-- exhaustive dropdown testing). Jalankan tiap query ini satu-satu di
-- Supabase SQL Editor, export hasilnya ke CSV kalau mau disimpan, BARU
-- lanjut ke cleanup-qatest-products-2026-08-01-DELETE.sql.

-- 1. Produk QATEST-* yang bakal terhapus
SELECT id, sku, name, is_bundle, created_at
FROM products
WHERE sku LIKE 'QATEST-%'
ORDER BY sku;

-- 2. Batch fisik produk QATEST-*
SELECT pb.id, pb.batch_code, p.sku, pb.expiry_date, pb.created_at
FROM product_batches pb
JOIN products p ON p.id = pb.product_id
WHERE p.sku LIKE 'QATEST-%'
ORDER BY p.sku, pb.batch_code;

-- 3. Ledger entries yang nempel di batch produk QATEST-*
SELECT sl.id, p.sku, sl.movement_type, sl.qty_delta, sl.reason, sl.created_at
FROM stock_ledger sl
JOIN product_batches pb ON pb.id = sl.batch_id
JOIN products p ON p.id = pb.product_id
WHERE p.sku LIKE 'QATEST-%'
ORDER BY sl.created_at;

-- 4. Order items & order induk yang produknya QATEST-* (order INDUK
-- sengaja tidak dihapus, cuma jadi wadah kosong -- lihat catatan di file DELETE)
SELECT o.id AS order_id, o.channel, o.external_order_id, o.status, p.sku, oi.qty
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o ON o.id = oi.order_id
WHERE p.sku LIKE 'QATEST-%'
ORDER BY o.ordered_at;

-- 5. Retur yang order_item-nya produk QATEST-*
SELECT r.id, r.order_id, r.type, r.condition, r.qty, r.photo_url
FROM returns r
JOIN order_items oi ON oi.id = r.order_item_id
JOIN products p ON p.id = oi.product_id
WHERE p.sku LIKE 'QATEST-%';

-- 6. Resep bundle yang menyangkut produk QATEST-* (sebagai bundle ATAU komponen)
SELECT br.id, bp.sku AS bundle_sku, cp.sku AS component_sku, br.qty_per_bundle, br.is_active
FROM bundle_recipes br
JOIN products bp ON bp.id = br.bundle_product_id
LEFT JOIN products cp ON cp.id = br.component_product_id
WHERE bp.sku LIKE 'QATEST-%' OR cp.sku LIKE 'QATEST-%';
