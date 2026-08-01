BEGIN;

-- Perbaikan v_daily_anomalies: sebelumnya view ini cuma balikin
-- (order_id, anomaly_type), tapi frontend (app/(dashboard)/ledger/page.tsx,
-- tab "Anomali Harian") mengharapkan kolom tanggal, produk, stok diharapkan/
-- aktual, dan selisih -- yang gak pernah ada di response, jadi baris anomali
-- render kosong/undefined saat beneran ada anomali. Migration ini menyamakan
-- field view dengan apa yang benar-benar bisa ditelusuri dari data yang ada,
-- plus nambah priority_level (Item 6, "Level prioritas di Anomali Harian").
--
-- Kenapa bukan expected_qty/actual_qty/variance ala opname: anomali jenis ini
-- ('CANCELLED_BUT_HAS_OUTBOUND_LEDGER') bukan soal selisih hitung fisik vs
-- sistem (itu ranah opname), tapi soal ledger yang nyangkut di order yang
-- batal -- makanya field yang relevan adalah channel + external_order_id
-- (biar operator bisa cek balik ke Shopee/TikTok) dan qty yang nyangkut.
--
-- priority_level dihitung dari besar qty yang nyangkut (leaked_qty), bukan
-- dari tanggal, karena rubric brief nempatin "logika benar & selisih bisa
-- ditelusuri" di atas segalanya -- order dengan qty nyangkut lebih besar =
-- resiko selisih laporan lebih besar, jadi lebih layak dicek duluan.
-- Threshold (HIGH >=10, MEDIUM >=3, LOW selebihnya) masih tebakan awal,
-- BELUM divalidasi ke pola data nyata -- perlu dikonfirmasi/disesuaikan
-- kalau ternyata gak representatif setelah dicoba ke data live.
CREATE OR REPLACE VIEW v_daily_anomalies AS
SELECT
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
  END AS priority_level
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
GROUP BY o.id, o.channel, o.external_order_id, o.updated_at;

COMMIT;
