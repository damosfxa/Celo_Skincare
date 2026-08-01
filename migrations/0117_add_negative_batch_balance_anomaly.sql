BEGIN;

-- Jenis anomali baru: NEGATIVE_BATCH_BALANCE. Kalau current_qty batch
-- pernah minus, itu tandanya ada inkonsistensi ledger nyata (secara desain
-- ini SEHARUSNYA gak pernah kejadian -- fn_allocate_fefo udah nolak alokasi
-- kalau stok gak cukup, fn_correct_ledger_entry udah ada guard saldo
-- negatif). Kalaupun kejadian (misal race condition 2 request nyaris
-- bersamaan lolos dari guard), ini WAJIB kelihatan sebagai anomali
-- prioritas HIGH -- justru karena "seharusnya mustahil", begitu kejadian
-- artinya ada yang bocor di logika inti (rubric #1: "logika benar & bisa
-- ditelusuri").
--
-- v_daily_anomalies di-widen jadi UNION 2 jenis anomali. Kolom baru:
-- - anomaly_id: pengganti order_id sebagai primary identifier yang SELALU
--   ada & unik (order_id null buat NEGATIVE_BATCH_BALANCE, dan React key
--   di frontend gak boleh lagi pakai order_id -- lihat catatan kirim ke
--   Antigravity).
-- - label: teks siap-tampil per anomali (biar frontend gak perlu tau
--   detail per anomaly_type buat nampilin sesuatu yang masuk akal).
-- CREATE OR REPLACE VIEW gak bisa dipakai di sini -- Postgres nolak ganti
-- urutan/nama kolom lewat REPLACE (anomaly_id sekarang jadi kolom pertama,
-- dulu order_id). Drop dulu, baru create ulang.
DROP VIEW IF EXISTS v_daily_anomalies;

CREATE VIEW v_daily_anomalies AS
SELECT
  o.id::text AS anomaly_id,
  o.id AS order_id,
  'CANCELLED_BUT_HAS_OUTBOUND_LEDGER'::text AS anomaly_type,
  o.channel,
  o.external_order_id,
  o.updated_at AS detected_at,
  array_agg(DISTINCT pb.product_id) AS affected_product_ids,
  abs(sum(sl.qty_delta)) AS leaked_qty,
  CASE
    WHEN abs(sum(sl.qty_delta)) >= 10 THEN 'HIGH'
    WHEN abs(sum(sl.qty_delta)) >= 3 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS priority_level,
  'Order ' || o.channel || ' #' || o.external_order_id || ' batal tapi stok masih keluar' AS label
FROM orders o
JOIN stock_ledger sl ON sl.reference_type = 'order' AND sl.reference_id = o.id
JOIN product_batches pb ON pb.id = sl.batch_id
WHERE o.status = 'CANCELLED'
  AND sl.movement_type = 'OUT_SALE_MARKETPLACE'
  AND NOT EXISTS (
    SELECT 1 FROM returns r
    WHERE r.order_id = o.id
      AND r.type = 'CANCELLATION'
      AND r.condition IS NOT NULL
      AND r.condition <> 'PENDING_INSPECTION'
  )
GROUP BY o.id, o.channel, o.external_order_id, o.updated_at

UNION ALL

SELECT
  bss.batch_id::text AS anomaly_id,
  NULL::uuid AS order_id,
  'NEGATIVE_BATCH_BALANCE'::text AS anomaly_type,
  NULL::text AS channel,
  NULL::text AS external_order_id,
  now() AS detected_at,
  ARRAY[bss.product_id] AS affected_product_ids,
  abs(bss.current_qty) AS leaked_qty,
  'HIGH'::text AS priority_level,
  'Batch ' || pb.batch_code || ' (' || p.sku || ') saldo minus: ' || bss.current_qty AS label
FROM batch_stock_summary bss
JOIN product_batches pb ON pb.id = bss.batch_id
JOIN products p ON p.id = bss.product_id
WHERE bss.current_qty < 0;

COMMIT;
