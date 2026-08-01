-- Backup export SEBELUM cleanup produk TEST-*. Jalanin tiap query di bawah
-- satu-satu, export hasilnya ke CSV (tombol Export di Supabase SQL Editor)
-- sebelum lanjut ke script DELETE. Ini query SELECT doang, aman, gak ngubah apapun.

-- 1. Produk test itu sendiri
select * from products where sku like 'TEST-%';

-- 2. Batch fisik dari produk test
select pb.* from product_batches pb
join products p on p.id = pb.product_id
where p.sku like 'TEST-%';

-- 3. Ledger entries yang nempel di batch produk test
select sl.* from stock_ledger sl
join product_batches pb on pb.id = sl.batch_id
join products p on p.id = pb.product_id
where p.sku like 'TEST-%';

-- 4. Order items yang produknya test
select oi.* from order_items oi
join products p on p.id = oi.product_id
where p.sku like 'TEST-%';

-- 5. Opname items yang batch-nya produk test
select oit.* from opname_items oit
join product_batches pb on pb.id = oit.batch_id
join products p on p.id = pb.product_id
where p.sku like 'TEST-%';

-- 6. Bundle recipes yang nyangkut produk test (sebagai bundle atau komponen)
select br.* from bundle_recipes br
join products p1 on p1.id = br.bundle_product_id
join products p2 on p2.id = br.component_product_id
where p1.sku like 'TEST-%' or p2.sku like 'TEST-%';
