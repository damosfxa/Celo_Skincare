-- Diagnostik SAJA (cuma baca, gak ubah apapun) -- buat pastikan apakah
-- constraint UNIQUE di orders(channel, external_order_id) beneran ada di
-- production atau enggak, sebelum kita putuskan perlu migration baru atau
-- tidak.

SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass;

-- Sekalian cek products.sku juga -- perlu tau apakah ada UNIQUE di sana.
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.products'::regclass;
