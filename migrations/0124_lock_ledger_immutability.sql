-- ============================================================
-- 0124_lock_ledger_immutability.sql
--
-- BAGIAN 2 dari 2. JANGAN JALANKAN SEBELUM 0123 SUKSES dan
-- aplikasi sudah dites masih normal. File 0123 memberi ketujuh
-- RPC penulis ledger hak SECURITY DEFINER; file ini baru mencabut
-- hak tulis langsung dari role biasa. Kalau urutannya dibalik,
-- SEMUA fitur yang menulis stok akan mati.
--
-- Yang dituntut brief (Sync Update Phase 2, bagian "Arah Teknis"):
--   "Stock Ledger append-only = satu-satunya sumber kebenaran.
--    Immutability dikunci di level DB (cabut UPDATE/DELETE +
--    trigger), tulis lewat RPC / Server Action."
--
-- Kondisi sebelum file ini: immutability HANYA mengandalkan
-- ketiadaan policy RLS untuk UPDATE/DELETE (default-deny Postgres).
-- Tidak ada REVOKE, tidak ada trigger -- dua hal yang brief sebut
-- eksplisit. Selain itu policy insert_ledger (0104:62) memakai
-- `with check (true)`, artinya siapa pun yang punya sesi login bisa
-- menyuntik baris ledger langsung lewat REST API Supabase, melewati
-- seluruh validasi bisnis di RPC.
--
-- Setelah file ini, satu-satunya jalur tulis ke stock_ledger adalah
-- ketujuh RPC SECURITY DEFINER dari 0123. Tidak ada lagi jalur lain,
-- untuk role mana pun yang dipakai aplikasi.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Cabut hak tulis langsung ke stock_ledger
-- ------------------------------------------------------------
-- Supabase secara default memberi GRANT ALL ke role anon &
-- authenticated untuk tabel di schema public. Pencabutan ini yang
-- membuat aturan "tulis wajib lewat RPC" jadi aturan database,
-- bukan cuma konvensi kode aplikasi.
--
-- SELECT sengaja TIDAK dicabut -- membaca ledger memang harus tetap
-- bisa (halaman Ledger, drilldown rekonsiliasi, dashboard).
REVOKE INSERT, UPDATE, DELETE ON stock_ledger FROM anon, authenticated;

-- Policy insert_ledger jadi tidak ada gunanya setelah GRANT dicabut
-- (policy RLS hanya menyaring baris DI ANTARA hak akses yang sudah
-- diberikan -- tanpa GRANT INSERT, policy-nya tidak pernah dievaluasi).
-- Dihapus supaya tidak menyesatkan pembaca skema berikutnya, yang
-- bisa saja mengira jalur insert langsung masih terbuka.
DROP POLICY IF EXISTS insert_ledger ON stock_ledger;

-- ------------------------------------------------------------
-- 2. Trigger penolak UPDATE/DELETE (lapis kedua)
-- ------------------------------------------------------------
-- REVOKE di atas sudah cukup untuk role anon/authenticated yang
-- dipakai aplikasi. Trigger ini jaring pengaman untuk jalur yang
-- TIDAK tunduk pada GRANT maupun RLS: service_role, koneksi
-- langsung sebagai pemilik tabel, atau SQL Editor. Brief menyebut
-- keduanya ("cabut UPDATE/DELETE + trigger"), bukan salah satu.
--
-- Catatan penting: trigger ini juga berlaku untuk RPC SECURITY
-- DEFINER dari 0123 -- dan itu memang disengaja. Tidak ada satu pun
-- dari ketujuh RPC itu yang melakukan UPDATE/DELETE ke stock_ledger
-- (sudah dicek satu-satu); koreksi selalu berupa entri BARU
-- (ADJUSTMENT_CORRECTION / ADJUSTMENT_OPNAME), tidak pernah edit
-- baris lama. Jadi trigger ini tidak memutus jalur mana pun yang ada.
CREATE OR REPLACE FUNCTION public.fn_block_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  raise exception
    'stock_ledger bersifat append-only: baris yang sudah tercatat tidak boleh di-% . Untuk membetulkan kesalahan input, buat entri koreksi baru lewat fn_correct_ledger_entry (fitur "Koreksi Entri"), atau lewat sesi Stok Opname.',
    lower(tg_op);
end;
$function$;

DROP TRIGGER IF EXISTS trg_block_ledger_update ON stock_ledger;
CREATE TRIGGER trg_block_ledger_update
BEFORE UPDATE ON stock_ledger
FOR EACH ROW EXECUTE FUNCTION fn_block_ledger_mutation();

DROP TRIGGER IF EXISTS trg_block_ledger_delete ON stock_ledger;
CREATE TRIGGER trg_block_ledger_delete
BEFORE DELETE ON stock_ledger
FOR EACH ROW EXECUTE FUNCTION fn_block_ledger_mutation();

-- ------------------------------------------------------------
-- 3. Tutup celah bypass wajib-foto di tabel returns
-- ------------------------------------------------------------
-- Policy update_returns (0104:110-111) memakai `for update using (true)`
-- TANPA klausa with check -- artinya siapa pun yang login bisa
-- meng-UPDATE baris returns langsung lewat REST API, termasuk
-- menetapkan condition = 'DAMAGED'/'LOST' tanpa foto bukti. Itu
-- melewati validasi wajib-foto di fn_inspect_return (0119:35-38),
-- yang sengaja dibuat justru karena write-off tanpa bukti adalah
-- lubang akuntansi.
--
-- Aman dicabut: hasil grep di seluruh app/ dan src/ tidak menemukan
-- satu pun `.update()` ke tabel returns dari kode aplikasi. Satu-satunya
-- penulis kolom condition/photo_url/inspected_by/inspected_at adalah
-- fn_inspect_return, yang sejak 0123 sudah SECURITY DEFINER sehingga
-- tidak terpengaruh pencabutan ini.
--
-- INSERT tetap dibiarkan: pengajuan retur baru memang ditulis langsung
-- dari service layer (createReturnRequest & cancelOrder di
-- src/lib/services/orders.ts), dan pada tahap itu condition selalu
-- 'PENDING_INSPECTION' -- belum ada keputusan write-off yang perlu bukti.
REVOKE UPDATE ON returns FROM anon, authenticated;
DROP POLICY IF EXISTS update_returns ON returns;

COMMIT;
