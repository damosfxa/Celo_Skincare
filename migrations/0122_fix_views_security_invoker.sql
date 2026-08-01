-- Lanjutan perbaikan keamanan dari 0121. VIEW di Postgres, secara
-- default, jalan pakai hak akses SIAPA YANG MEMBUAT view itu (biasanya
-- role admin/postgres saat migration dijalankan) -- BUKAN hak akses
-- siapa yang lagi query. Ini artinya semua 7 view di bawah ini
-- BYPASS TOTAL RLS yang baru dibenerin di 0121, walau tabel dasarnya
-- sudah dikunci ke role authenticated.
--
-- Dikonfirmasi nyata: /api/dashboard/today masih balikin data asli ke
-- request TANPA LOGIN sama sekali, bahkan SETELAH migration 0121
-- dijalankan -- karena endpoint itu baca dari view-view ini.
--
-- Fix: security_invoker=true bikin view re-evaluate RLS pakai role
-- yang benar-benar query, bukan pemilik view. Butuh Postgres 15+
-- (Supabase sudah pakai versi ini).

ALTER VIEW v_batch_stock SET (security_invoker = true);
ALTER VIEW v_product_stock SET (security_invoker = true);
ALTER VIEW v_expiring_batches SET (security_invoker = true);
ALTER VIEW v_pending_tiktok_claims SET (security_invoker = true);
ALTER VIEW v_daily_anomalies SET (security_invoker = true);
ALTER VIEW v_unverified_opening_balances SET (security_invoker = true);
ALTER VIEW v_oversell_risk SET (security_invoker = true);
