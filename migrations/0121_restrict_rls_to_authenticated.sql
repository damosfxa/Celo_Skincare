-- PERBAIKAN KEAMANAN KRITIKAL: semua RLS policy di 0104 pakai
-- "using (true)" tanpa klausa "TO authenticated" -- di Postgres, itu
-- artinya policy berlaku untuk SEMUA role termasuk `anon` (publik, belum
-- login). Niat aslinya (lihat komentar di 0104) adalah "terbuka untuk
-- siapa pun yang SUDAH authenticated", tapi implementasinya lupa
-- membatasi ke role tersebut -- akibatnya seluruh data (produk, stok,
-- ledger, order, retur) bisa dibaca DAN ditulis siapa saja tanpa login,
-- langsung lewat REST API Supabase (bypass aplikasi & validasi RPC
-- sepenuhnya).
--
-- Fix: batasi tiap policy cuma untuk role `authenticated`, tanpa ubah
-- logika USING/WITH CHECK sama sekali (tetap "true" -- karena sistem ini
-- cuma 1 role Admin, siapa pun yang sudah login tetap akses penuh sesuai
-- desain aslinya). Anonymous/publik sekarang ditolak total.

ALTER POLICY read_own_profile ON profiles TO authenticated;

ALTER POLICY insert_products ON products TO authenticated;
ALTER POLICY read_all_products ON products TO authenticated;
ALTER POLICY update_products ON products TO authenticated;

ALTER POLICY insert_batches ON product_batches TO authenticated;
ALTER POLICY read_all_batches ON product_batches TO authenticated;

ALTER POLICY insert_recipes ON bundle_recipes TO authenticated;
ALTER POLICY read_all_recipes ON bundle_recipes TO authenticated;

ALTER POLICY insert_ledger ON stock_ledger TO authenticated;
ALTER POLICY read_all_ledger ON stock_ledger TO authenticated;

ALTER POLICY insert_orders ON orders TO authenticated;
ALTER POLICY read_all_orders ON orders TO authenticated;
ALTER POLICY update_orders ON orders TO authenticated;

ALTER POLICY insert_order_items ON order_items TO authenticated;
ALTER POLICY read_all_order_items ON order_items TO authenticated;

ALTER POLICY insert_allocations ON order_item_batch_allocations TO authenticated;
ALTER POLICY read_all_allocations ON order_item_batch_allocations TO authenticated;

ALTER POLICY insert_opname_sessions ON opname_sessions TO authenticated;
ALTER POLICY read_all_opname_sessions ON opname_sessions TO authenticated;
ALTER POLICY update_opname_sessions ON opname_sessions TO authenticated;

ALTER POLICY insert_opname_items ON opname_items TO authenticated;
ALTER POLICY read_all_opname_items ON opname_items TO authenticated;
ALTER POLICY update_opname_items ON opname_items TO authenticated;

ALTER POLICY insert_returns ON returns TO authenticated;
ALTER POLICY read_all_returns ON returns TO authenticated;
ALTER POLICY update_returns ON returns TO authenticated;

-- 2 policy tambahan dari migration 0107 (tabel cache O(1) saldo) yang
-- kena lubang sama -- baru ketauan pas nyisir ulang semua migration
-- yang bikin policy. (update_batches dari migration 0106 SUDAH benar,
-- sudah pakai TO authenticated sejak awal, jadi gak perlu disentuh.)
ALTER POLICY read_all_batch_stock_summary ON batch_stock_summary TO authenticated;
ALTER POLICY read_all_product_stock_summary ON product_stock_summary TO authenticated;
