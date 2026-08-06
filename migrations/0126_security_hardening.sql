-- ============================================================
-- 0126_security_hardening.sql
--
-- Hasil audit keamanan menyeluruh 2026-08-06 (lihat
-- diagnostic-security-audit-2026-08-06.sql). Menutup temuan:
--
-- 1. CELAH NYATA: 2 policy "siluman" di tabel cache saldo yang
--    mengizinkan role `public` (anon, tanpa login) membaca angka
--    stok. Kedua policy ini TIDAK ADA di migration manapun --
--    ditambahkan manual di luar alur migration (drift), dan lolos
--    dari perbaikan 0121 yang mengira cuma ada policy `read_all_*`.
--    Akibatnya saldo stok per batch & per produk bisa diintip siapa
--    saja lewat REST API Supabase tanpa autentikasi.
--
-- 2. WARNING (risiko rendah): 4 fungsi tanpa SET search_path. Semua
--    BUKAN SECURITY DEFINER, jadi tidak berbahaya secara langsung,
--    tapi muncul sebagai peringatan "function_search_path_mutable" di
--    advisor Supabase. Ditambal supaya advisor bersih & sebagai
--    praktik baik (mencegah pembajakan search_path seandainya salah
--    satunya kelak diubah jadi SECURITY DEFINER).
--
-- CATATAN: bucket Storage `return-photos` SENGAJA dibiarkan apa
-- adanya. Hasil audit: upload sudah dibatasi ke `authenticated`,
-- tidak ada policy UPDATE/DELETE (foto tak bisa dihapus/ditimpa
-- lewat API), dan baca-publik-nya memakai URL ber-UUID acak yang
-- tak bisa ditebak. Untuk foto bukti retur, ini tradeoff yang wajar.
-- Mengubahnya jadi privat akan memutus tampilan foto di aplikasi
-- (butuh signed URL + perubahan frontend), jadi tidak dilakukan di
-- sini.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Hapus 2 policy publik siluman di tabel cache saldo
-- ------------------------------------------------------------
-- IF EXISTS supaya aman dijalankan ulang & aman kalau di database
-- lain (mis. rebuild dari nol) policy ini memang tidak pernah ada.
-- Akses sah aplikasi TETAP jalan lewat policy authenticated yang
-- sudah ada (read_all_batch_stock_summary / read_all_product_stock_summary,
-- lihat 0107 + 0121). Jadi menghapus versi publik ini hanya menutup
-- akses anon, tanpa memutus apa pun di aplikasi.
DROP POLICY IF EXISTS read_batch_summary ON batch_stock_summary;
DROP POLICY IF EXISTS read_product_summary ON product_stock_summary;

-- Jaring pengaman: kalau ternyata ADA policy publik lain yang
-- terlewat di kedua tabel ini, baris di bawah TIDAK menghapusnya
-- otomatis (DROP butuh nama pasti). Setelah menjalankan file ini,
-- jalankan ulang diagnostic-security-audit untuk memastikan kolom
-- "2. Role policy" sudah tidak ada lagi yang 'public'.

-- ------------------------------------------------------------
-- 2. Tambah SET search_path ke 4 fungsi tanpa search_path
-- ------------------------------------------------------------
-- Pakai ALTER FUNCTION (bukan CREATE OR REPLACE) supaya cukup
-- menambah klausa keamanannya tanpa menyentuh isi/logika fungsi
-- sama sekali -- nol risiko mengubah perilaku.
ALTER FUNCTION public.fn_allocate_fefo(uuid, integer) SET search_path TO 'public';
ALTER FUNCTION public.fn_open_opname_session(uuid)     SET search_path TO 'public';
ALTER FUNCTION public.set_updated_at()                 SET search_path TO 'public';
ALTER FUNCTION public.fn_block_ledger_mutation()       SET search_path TO 'public';

COMMIT;
