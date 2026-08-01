BEGIN;

-- Bug kritis: opname_items.variance gak pernah diisi siapa pun (bukan API,
-- bukan trigger) -- selalu NULL. fn_close_opname_session filter pakai
-- `WHERE variance <> 0`, dan `NULL <> 0` = NULL (bukan TRUE) di SQL, jadi
-- baris manapun gak pernah kena syarat itu. Akibatnya: menutup sesi opname
-- TIDAK PERNAH menulis koreksi ke ledger, berapa pun besar selisihnya --
-- fitur "dua ritme rekonsiliasi" (brief/sync update) diam-diam gak jalan.
--
-- Fix: jadikan variance kolom GENERATED (dihitung otomatis oleh database
-- dari physical_qty - system_qty), bukan kolom yang harus diisi manual
-- oleh API/RPC. Ini nutup celahnya permanen -- gak ada jalur kode sekarang
-- ATAU nanti yang bisa lupa ngisi ini lagi. Aman buat frontend/API: kedua
-- endpoint yang nyentuh opname_items (fn_open_opname_session, PATCH item)
-- emang gak pernah nulis ke kolom ini secara eksplisit.
ALTER TABLE opname_items DROP COLUMN variance;
ALTER TABLE opname_items ADD COLUMN variance integer
  GENERATED ALWAYS AS (physical_qty - system_qty) STORED;

COMMIT;
