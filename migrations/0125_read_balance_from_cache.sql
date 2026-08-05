-- ============================================================
-- 0125_read_balance_from_cache.sql
--
-- Yang dituntut brief (Sync Update Phase 2, bagian "Arah Teknis"):
--   "Performa: baca saldo harus cepat -- idealnya O(1) via
--    summary/cache yang di-maintain dari ledger; jangan SUM
--    full-scan tiap query (ledger akan tumbuh jutaan baris).
--    Cara bebas, asalkan saldo selalu bisa diverifikasi ulang
--    dari ledger."
--
-- Kondisi sebelum file ini: tabel cache (batch_stock_summary /
-- product_stock_summary, lihat 0107) SUDAH ADA dan sudah dijaga
-- trigger, tapi hampir tidak ada yang membacanya. Jalur baca saldo
-- yang benar-benar dipakai masih lewat view v_batch_stock, yang isinya
-- `sum(qty_delta) ... group by batch_id` -- artinya SELURUH tabel
-- stock_ledger dijumlah ulang dari nol setiap kali dipanggil.
--
-- Yang paling berbahaya bukan yang di kode aplikasi, tapi yang di
-- dalam database ini: fn_allocate_fefo dipanggil SETIAP KALI barang
-- keluar (fn_ship_order_item + fn_manual_out). Jadi setiap pengiriman
-- order memicu full-scan ledger. Dengan ledger jutaan baris, ini
-- pelan-pelan membuat proses kirim barang makin lambat, lalu gagal.
--
-- YANG SENGAJA TIDAK DIUBAH: definisi v_batch_stock & v_product_stock
-- itu sendiri (0101:8-22) tetap SUM murni dari ledger. Keduanya justru
-- jadi alat pembanding untuk membuktikan angka cache masih benar --
-- persis syarat brief "saldo selalu bisa diverifikasi ulang dari
-- ledger". Kalau keduanya ikut dialihkan ke cache, tidak ada lagi
-- sumber pembanding independen, dan cache yang melenceng tidak akan
-- pernah ketahuan. Query pembanding: lihat file
-- diagnostic-verify-stock-summary-cache-2026-08-05.sql
-- (dijalankan 2026-08-05: 0 selisih, cache terbukti akurat).
--
-- Endpoint /api/reconciliation/drilldown juga sengaja DIBIARKAN
-- membaca v_product_stock (SUM asli), bukan cache -- itu halaman
-- penelusuran selisih, bukan jalur panas, dan justru di situ angka
-- hasil hitung ulang dari ledger yang paling dipercaya.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. fn_allocate_fefo -- HOT PATH
-- ------------------------------------------------------------
-- Sumber: 0102:10-42. Satu-satunya perubahan: sumber angka saldo
-- (v_batch_stock -> batch_stock_summary). Urutan FEFO
-- (order by expiry_date asc), syarat qty > 0, penanganan stok
-- kurang, dan pesan error dibiarkan persis sama.
--
-- Hasilnya identik karena batch_stock_summary.current_qty memang
-- diisi trigger dari nilai qty_delta yang sama. Trigger jalan
-- AFTER INSERT FOR EACH ROW di transaksi yang sama, jadi saat
-- fn_ship_order_item mengalokasi beberapa batch berturut-turut,
-- angka yang dibaca sudah termasuk potongan dari baris sebelumnya
-- -- sama seperti perilaku lama lewat view.
CREATE OR REPLACE FUNCTION public.fn_allocate_fefo(p_product_id uuid, p_qty integer)
RETURNS TABLE(batch_id uuid, qty integer)
LANGUAGE plpgsql
AS $function$
declare
  v_remaining integer := p_qty;
  v_batch record;
  v_take integer;
begin
  if p_qty <= 0 then
    raise exception 'qty harus lebih dari 0';
  end if;

  for v_batch in
    select pb.id, bss.current_qty
    from product_batches pb
    join batch_stock_summary bss on bss.batch_id = pb.id
    where pb.product_id = p_product_id and bss.current_qty > 0
    order by pb.expiry_date asc
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_batch.current_qty);
    batch_id := v_batch.id;
    qty := v_take;
    return next;
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Stok tidak cukup untuk produk %: kurang % unit', p_product_id, v_remaining;
  end if;
end;
$function$;

-- ------------------------------------------------------------
-- 2. fn_open_opname_session
-- ------------------------------------------------------------
-- Sumber: 0102:179-197. Snapshot system_qty seluruh batch bersaldo
-- saat sesi opname dibuka -- sebelumnya membaca v_batch_stock, yang
-- berarti satu full-scan ledger untuk SEMUA batch sekaligus.
--
-- Catatan: angka inilah yang nanti dibandingkan dengan hitung fisik
-- gudang, jadi harus tetap tepat. Aman dialihkan karena cache sudah
-- dibuktikan identik dengan ledger (lihat file diagnostic di atas),
-- dan sejak 0124 tidak ada lagi jalur tulis ledger yang bisa
-- melewati trigger pengisi cache.
CREATE OR REPLACE FUNCTION public.fn_open_opname_session(p_created_by uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
declare
  v_session_id uuid;
begin
  insert into opname_sessions (session_date, created_by)
  values (current_date, p_created_by)
  returning id into v_session_id;

  insert into opname_items (session_id, batch_id, system_qty, physical_qty)
  select v_session_id, batch_id, current_qty, null
  from batch_stock_summary
  where current_qty > 0;

  return v_session_id;
end;
$function$;

-- ------------------------------------------------------------
-- 3. v_expiring_batches
-- ------------------------------------------------------------
-- Sumber: 0101:27-41. View ini dibaca 2 tempat sekaligus setiap kali
-- halaman utama dibuka (/api/dashboard/today) dan di halaman
-- Notifikasi (/api/notifications/expiring) -- keduanya ikut menyeret
-- full-scan ledger lewat v_batch_stock.
--
-- security_invoker sengaja ikut diset ulang: CREATE OR REPLACE VIEW
-- tidak selalu mempertahankan opsi ini, dan tanpa itu view kembali
-- bypass RLS -- persis lubang keamanan yang sudah ditutup di 0122.
-- Tabel batch_stock_summary punya policy SELECT untuk role
-- authenticated (0107:73-74, dibatasi di 0121:57), jadi akses
-- normal aplikasi tidak terpengaruh.
CREATE OR REPLACE VIEW v_expiring_batches AS
SELECT
  pb.id AS batch_id,
  pb.product_id,
  p.sku,
  p.name,
  pb.batch_code,
  pb.expiry_date,
  COALESCE(bss.current_qty, 0) AS current_qty,
  (pb.expiry_date - current_date) AS days_remaining
FROM product_batches pb
JOIN products p ON p.id = pb.product_id
LEFT JOIN batch_stock_summary bss ON bss.batch_id = pb.id
WHERE (pb.expiry_date - current_date) <= 90
  AND COALESCE(bss.current_qty, 0) > 0;

ALTER VIEW v_expiring_batches SET (security_invoker = true);

COMMIT;
