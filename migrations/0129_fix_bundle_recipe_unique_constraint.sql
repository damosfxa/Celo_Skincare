-- ============================================================
-- 0129_fix_bundle_recipe_unique_constraint.sql
--
-- DRIFT: tabel bundle_recipes punya unique constraint
-- `bundle_recipes_bundle_product_id_component_product_id_key`
-- (bundle_product_id, component_product_id) yang TIDAK PERNAH tercatat
-- di migration manapun -- ditambahkan manual di luar alur migration,
-- sama kategorinya dengan drift yang ditutup di 0126.
--
-- BUG NYATA: constraint ini dipasang SEBELUM fitur versioning resep ada
-- (0112). Migration 0112 mengubah fn_save_bundle_recipe dari hard-delete
-- jadi soft-version (baris lama ditandai is_active=false, tetap ada di
-- tabel, versi baru di-insert dengan version+1) -- tapi constraint unik
-- lamanya lupa ikut diperbarui. Akibatnya: baris LAMA yang sudah
-- is_active=false tetap dihitung "menempati" pasangan (bundle,
-- komponen) itu selamanya, jadi kalau resep diedit dan MASIH memakai
-- komponen yang sama dari versi sebelumnya (kasus paling umum -- edit
-- resep biasanya nambah/kurang beberapa komponen, bukan ganti semua),
-- insert versi baru gagal dengan "duplicate key value violates unique
-- constraint", walau baris lama itu sudah nonaktif.
--
-- FIX: ganti jadi partial unique index yang cuma berlaku untuk baris
-- AKTIF (is_active = true). Aturan yang sebenarnya diinginkan --
-- "1 komponen gak boleh dobel dalam SATU versi resep yang sedang
-- berlaku" -- tetap ditegakkan. Riwayat versi lama boleh mengulang
-- komponen yang sama tanpa bentrok.
-- ============================================================

BEGIN;

ALTER TABLE bundle_recipes
  DROP CONSTRAINT IF EXISTS bundle_recipes_bundle_product_id_component_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS bundle_recipes_active_component_uidx
  ON bundle_recipes (bundle_product_id, component_product_id)
  WHERE is_active = true;

COMMIT;
