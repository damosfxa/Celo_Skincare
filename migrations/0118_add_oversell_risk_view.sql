BEGIN;

-- Oversell Risk (dikonfirmasi Richard/klien via channel bounty, 01 Agu 2026:
-- "yup, ini perlu di cover ya" -- sebelumnya di luar brief/sync update,
-- sekarang WAJIB masuk cakupan). Beda dari v_daily_anomalies: ini bukan
-- inkonsistensi yang UDAH kejadian, tapi RESIKO ke depan -- total qty dari
-- order yang masih PENDING (reservasi, belum shipped) ngelewatin stok yang
-- tersedia sekarang. Kalau semua order itu lanjut di-ship tanpa ada
-- penambahan stok, sebagian bakal gagal dialokasikan FEFO (fn_allocate_fefo
-- bakal raise "stok tidak cukup"). Berguna biar operator bisa antisipasi
-- (nambah stok/hubungi maklon) SEBELUM gagal kirim beneran, bukan cuma
-- ketauan pas udah telat.
CREATE VIEW v_oversell_risk AS
SELECT
  oi.product_id,
  p.sku,
  p.name,
  SUM(oi.qty) AS reserved_qty,
  COALESCE(pss.current_qty, 0) AS available_qty,
  SUM(oi.qty) - COALESCE(pss.current_qty, 0) AS shortfall
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
LEFT JOIN product_stock_summary pss ON pss.product_id = oi.product_id
WHERE o.status = 'PENDING'
GROUP BY oi.product_id, p.sku, p.name, pss.current_qty
HAVING SUM(oi.qty) > COALESCE(pss.current_qty, 0);

COMMIT;
