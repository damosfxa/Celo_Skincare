-- Diagnostik SAJA (cuma baca) -- hitung berapa order dari 2 test volume
-- CSV import tadi (sebelum & sesudah fix paralelisasi) yang benar-benar
-- masuk ke database.
SELECT
  count(*) FILTER (WHERE external_order_id LIKE 'QATEST-VOLUME-%') AS versi_sekuensial_lama,
  count(*) FILTER (WHERE external_order_id LIKE 'QATEST-VOLUME2-%') AS versi_paralel_baru
FROM orders;
