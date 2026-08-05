-- ============================================================
-- diagnostic-verify-stock-summary-cache-2026-08-05.sql
--
-- READ-ONLY. Tidak mengubah apa pun. Aman dijalankan kapan saja.
--
-- Tujuan: memastikan tabel cache saldo (batch_stock_summary /
-- product_stock_summary) BENAR-BENAR identik dengan hasil SUM dari
-- stock_ledger, SEBELUM API dialihkan membaca dari cache itu.
--
-- Kenapa perlu: trigger yang mengisi cache (trg_update_stock_summary,
-- lihat 0107) cuma jalan AFTER INSERT. Baris ledger yang sudah ada
-- SEBELUM trigger itu dipasang tidak pernah ikut terhitung. Kalau
-- ada selisih dan API terlanjur dialihkan ke cache, angka stok yang
-- tampil ke operator jadi salah tanpa ada yang sadar -- persis
-- kegagalan yang brief bilang "satu angka salah = sistem gagal".
--
-- CATATAN BENTUK FILE: versi pertama file ini berisi 4 query terpisah,
-- tapi Supabase SQL Editor cuma menampilkan hasil query TERAKHIR kalau
-- dijalankan sekaligus -- 3 pemeriksaan pertama ketelan tanpa terlihat.
-- Versi ini menggabungkan keempatnya jadi SATU query (UNION ALL), jadi
-- sekali Run semua hasil muncul di satu tabel.
--
-- Cara baca hasil:
--   - Kolom "status" semuanya 'AMAN'  -> cache akurat, aman dipakai.
--   - Ada satu saja 'MASALAH'         -> JANGAN alihkan API ke cache,
--                                        laporkan dulu ke Claude.
-- ============================================================

WITH ledger_per_batch AS (
  SELECT batch_id, SUM(qty_delta) AS qty
  FROM stock_ledger
  GROUP BY batch_id
),
ledger_per_produk AS (
  SELECT pb.product_id, SUM(sl.qty_delta) AS qty
  FROM stock_ledger sl
  JOIN product_batches pb ON pb.id = sl.batch_id
  GROUP BY pb.product_id
),
-- Batch yang angka cache-nya BEDA dari hasil SUM ledger.
-- FULL OUTER JOIN dipakai supaya batch yang cuma ada di salah satu
-- sisi (mis. ada di ledger tapi belum pernah masuk cache) ikut ketahuan.
beda_batch AS (
  SELECT
    COALESCE(pb.batch_code, '(batch tidak dikenal)')
      || ' - ' || COALESCE(p.name, '(produk tidak dikenal)') AS detail,
    COALESCE(s.current_qty, 0) AS nilai_cache,
    COALESCE(l.qty, 0)         AS nilai_ledger
  FROM batch_stock_summary s
  FULL OUTER JOIN ledger_per_batch l ON l.batch_id = s.batch_id
  LEFT JOIN product_batches pb ON pb.id = COALESCE(s.batch_id, l.batch_id)
  LEFT JOIN products p         ON p.id  = pb.product_id
  WHERE COALESCE(s.current_qty, 0) <> COALESCE(l.qty, 0)
),
beda_produk AS (
  SELECT
    COALESCE(p.sku, '(sku ?)')
      || ' - ' || COALESCE(p.name, '(produk tidak dikenal)') AS detail,
    COALESCE(s.current_qty, 0) AS nilai_cache,
    COALESCE(l.qty, 0)         AS nilai_ledger
  FROM product_stock_summary s
  FULL OUTER JOIN ledger_per_produk l ON l.product_id = s.product_id
  LEFT JOIN products p ON p.id = COALESCE(s.product_id, l.product_id)
  WHERE COALESCE(s.current_qty, 0) <> COALESCE(l.qty, 0)
)

-- ---------- 1. SELISIH PER BATCH ----------
SELECT
  1                       AS urutan,
  '1. SELISIH PER BATCH'  AS pemeriksaan,
  detail                  AS detail,
  nilai_cache             AS nilai_cache,
  nilai_ledger            AS nilai_ledger,
  nilai_cache - nilai_ledger AS selisih,
  'MASALAH'               AS status
FROM beda_batch

UNION ALL
SELECT 1, '1. SELISIH PER BATCH',
       'Tidak ada selisih - cache per batch akurat',
       NULL::bigint, NULL::bigint, NULL::bigint, 'AMAN'
WHERE NOT EXISTS (SELECT 1 FROM beda_batch)

-- ---------- 2. SELISIH PER PRODUK ----------
UNION ALL
SELECT 2, '2. SELISIH PER PRODUK', detail, nilai_cache, nilai_ledger,
       nilai_cache - nilai_ledger, 'MASALAH'
FROM beda_produk

UNION ALL
SELECT 2, '2. SELISIH PER PRODUK',
       'Tidak ada selisih - cache per produk akurat',
       NULL::bigint, NULL::bigint, NULL::bigint, 'AMAN'
WHERE NOT EXISTS (SELECT 1 FROM beda_produk)

-- ---------- 3. RINGKASAN ANGKA BESAR ----------
UNION ALL
SELECT 3, '3. RINGKASAN',
       'Total qty: cache batch vs SUM ledger',
       (SELECT COALESCE(SUM(current_qty), 0) FROM batch_stock_summary),
       (SELECT COALESCE(SUM(qty_delta), 0)   FROM stock_ledger),
       (SELECT COALESCE(SUM(current_qty), 0) FROM batch_stock_summary)
         - (SELECT COALESCE(SUM(qty_delta), 0) FROM stock_ledger),
       CASE WHEN (SELECT COALESCE(SUM(current_qty), 0) FROM batch_stock_summary)
                 = (SELECT COALESCE(SUM(qty_delta), 0) FROM stock_ledger)
            THEN 'AMAN' ELSE 'MASALAH' END

UNION ALL
SELECT 3, '3. RINGKASAN',
       'Total qty: cache produk vs SUM ledger',
       (SELECT COALESCE(SUM(current_qty), 0) FROM product_stock_summary),
       (SELECT COALESCE(SUM(qty_delta), 0)   FROM stock_ledger),
       (SELECT COALESCE(SUM(current_qty), 0) FROM product_stock_summary)
         - (SELECT COALESCE(SUM(qty_delta), 0) FROM stock_ledger),
       CASE WHEN (SELECT COALESCE(SUM(current_qty), 0) FROM product_stock_summary)
                 = (SELECT COALESCE(SUM(qty_delta), 0) FROM stock_ledger)
            THEN 'AMAN' ELSE 'MASALAH' END

UNION ALL
SELECT 3, '3. RINGKASAN',
       'Jumlah baris: cache batch vs batch unik di ledger',
       (SELECT COUNT(*) FROM batch_stock_summary),
       (SELECT COUNT(DISTINCT batch_id) FROM stock_ledger),
       (SELECT COUNT(*) FROM batch_stock_summary)
         - (SELECT COUNT(DISTINCT batch_id) FROM stock_ledger),
       CASE WHEN (SELECT COUNT(*) FROM batch_stock_summary)
                 = (SELECT COUNT(DISTINCT batch_id) FROM stock_ledger)
            THEN 'AMAN' ELSE 'MASALAH' END

UNION ALL
SELECT 3, '3. RINGKASAN',
       'Jumlah total baris di stock_ledger (info saja)',
       (SELECT COUNT(*) FROM stock_ledger),
       NULL::bigint, NULL::bigint, 'AMAN'

-- ---------- 4. STATUS TRIGGER CACHE ----------
-- tgenabled bertipe "char" internal Postgres, bukan text -- wajib
-- di-cast eksplisit, kalau tidak operator || jadi ambigu
-- (ERROR 42725: operator is not unique).
UNION ALL
SELECT 4, '4. STATUS TRIGGER',
       t.tgname || ' pada ' || c.relname || ' - ' ||
       CASE t.tgenabled::text
         WHEN 'O' THEN 'AKTIF'
         WHEN 'D' THEN 'DINONAKTIFKAN'
         ELSE 'LAINNYA: ' || t.tgenabled::text
       END,
       NULL::bigint, NULL::bigint, NULL::bigint,
       CASE WHEN t.tgenabled::text = 'O' THEN 'AMAN' ELSE 'MASALAH' END
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'stock_ledger'
  AND NOT t.tgisinternal

UNION ALL
SELECT 4, '4. STATUS TRIGGER',
       'TIDAK ADA trigger sama sekali di stock_ledger',
       NULL::bigint, NULL::bigint, NULL::bigint, 'MASALAH'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'stock_ledger' AND NOT t.tgisinternal
)

ORDER BY urutan, status DESC, detail;
