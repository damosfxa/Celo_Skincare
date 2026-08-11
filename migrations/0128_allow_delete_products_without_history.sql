-- ============================================================
-- 0128_allow_delete_products_without_history.sql
--
-- Migration 0104 sengaja TIDAK memberi policy delete untuk products
-- ("produk tidak pernah dihapus"), demi konsisten dengan prinsip
-- append-only project ini. Tapi kenyataannya operator bisa salah input
-- produk baru (typo SKU/nama, atau produk yang ternyata tidak jadi
-- dipakai) sebelum produk itu pernah tersentuh sama sekali -- nol
-- batch, nol order. Untuk kasus SEMPIT itu saja, hapus aman dan tidak
-- melanggar prinsip apa pun -- belum ada riwayat yang hilang, karena
-- memang belum pernah ada riwayat.
--
-- Policy ini SENGAJA dibatasi ketat lewat klausa USING: cuma produk
-- yang BENAR-BENAR nol batch dan nol order_item yang boleh dihapus.
-- Begitu produk itu pernah punya batch/order sama sekali, policy ini
-- otomatis menolak selamanya -- bukan cuma dicegah di kode aplikasi
-- (app/api/products/[id]/route.ts, endpoint DELETE, yang mengecek hal
-- sama dan membalas pesan ramah SEBELUM sempat sampai ke database),
-- tapi juga ditegakkan ulang di level database sebagai lapis kedua,
-- yang tetap menahan walau ada bug di kode aplikasi.
--
-- Endpoint PATCH (ubah nama/SKU) di file yang sama TIDAK butuh migration
-- ini -- policy update_products dari 0104 sudah membolehkan itu untuk
-- produk apa pun (baru atau sudah punya riwayat), karena cuma ganti
-- label, bukan menghapus baris.
-- ============================================================

BEGIN;

CREATE POLICY delete_products_without_history ON products
  FOR DELETE
  TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM product_batches WHERE product_id = products.id)
    AND NOT EXISTS (SELECT 1 FROM order_items WHERE product_id = products.id)
  );

COMMIT;
