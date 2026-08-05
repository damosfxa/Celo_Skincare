-- ============================================================
-- 0123_harden_ledger_write_path.sql
--
-- BAGIAN 1 dari 2 (pasangannya: 0124). File ini SENGAJA tidak
-- mencabut izin apa pun -- tujuannya menyiapkan jalur resmi dulu
-- supaya 0124 (yang mengunci pintunya) tidak memutus fitur apa pun.
-- JALANKAN FILE INI DULU, tes aplikasi masih normal, BARU 0124.
--
-- Masalah yang diperbaiki:
--
-- 1. Komentar di 0104 (baris 7-9) mengklaim "satu-satunya jalan
--    mengubah/menghapus baris [stock_ledger] adalah lewat RPC
--    function yang SECURITY DEFINER". Klaim itu TIDAK BENAR: dari
--    7 RPC yang menulis ke stock_ledger, NOL yang punya SECURITY
--    DEFINER (dicek satu-satu: fn_ship_order_item 0102:45,
--    fn_manual_out 0108:29, fn_maklon_intake 0116:15,
--    fn_opening_balance_intake 0114:20, fn_correct_ledger_entry
--    0107:121, fn_inspect_return 0119:7, fn_close_opname_session
--    0110:14). Semuanya jalan pakai hak akses pemanggil.
--
--    Akibatnya aturan inti project ("semua tulisan ke stock_ledger
--    WAJIB lewat RPC", lihat CLAUDE.md & komentar 0102) selama ini
--    cuma dijaga oleh disiplin kode aplikasi, bukan oleh database.
--    Siapa pun yang punya sesi login bisa insert baris ledger
--    sembarangan langsung lewat REST API Supabase, melewati SELURUH
--    validasi bisnis: alokasi FEFO, wajib catatan, wajib referensi
--    campaign untuk bonus/promo/sample, wajib foto untuk write-off.
--
--    Fix: tambahkan SECURITY DEFINER + SET search_path ke ketujuh
--    function tsb, mengikuti pola yang sudah dipakai
--    fn_save_bundle_recipe (0102:159-175) dan fn_handle_new_user
--    (0102:238-250). Dengan begitu RPC tetap bisa menulis ledger
--    setelah izin insert langsung dicabut di 0124.
--
--    Isi/logika ketujuh function TIDAK diubah sama sekali di file
--    ini -- disalin persis dari versi terakhirnya masing-masing,
--    cuma ditambahi 2 baris klausa keamanan. Signature juga tidak
--    berubah, jadi tidak ada overload baru yang terbentuk (pelajaran
--    dari 0113).
--
-- 2. Kolom stock_ledger.channel belum punya CHECK constraint,
--    padahal sync update Phase 2 menyebut channel sebagai enum
--    tetap: shopee/tiktok/offline/internal. Bandingkan dengan
--    kolom reason yang sudah dikunci sejak 0105:44-48.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. CHECK constraint untuk kolom channel
-- ------------------------------------------------------------
-- NULL tetap diizinkan: 3 dari 7 jalur tulis memang sengaja tidak
-- mengisi channel karena pergerakannya bukan lewat kanal penjualan
-- mana pun (fn_inspect_return, fn_close_opname_session,
-- fn_correct_ledger_entry).

-- Berhenti dengan pesan jelas kalau ternyata ada data lama yang
-- nilainya di luar daftar -- lebih informatif daripada error
-- constraint violation polos dari Postgres.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(DISTINCT quote_literal(channel), ', ')
  INTO v_bad
  FROM stock_ledger
  WHERE channel IS NOT NULL
    AND channel NOT IN ('shopee', 'tiktok', 'offline', 'internal');

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'Ada nilai channel di luar daftar resmi: %. Perbaiki data itu dulu sebelum menjalankan migration ini.', v_bad;
  END IF;
END $$;

ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_channel_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_channel_check
CHECK (
  channel IS NULL
  OR channel = ANY (ARRAY['shopee', 'tiktok', 'offline', 'internal'])
);

-- ------------------------------------------------------------
-- 2. SECURITY DEFINER untuk ketujuh RPC penulis ledger
-- ------------------------------------------------------------

-- 2.1 fn_ship_order_item -- sumber: 0102:45-69 (tidak pernah diubah lagi setelahnya)
CREATE OR REPLACE FUNCTION public.fn_ship_order_item(p_order_item_id uuid, p_created_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_item record;
  v_order record;
  v_alloc record;
begin
  select * into v_item from order_items where id = p_order_item_id;
  if not found then
    raise exception 'order_item % tidak ditemukan', p_order_item_id;
  end if;

  select * into v_order from orders where id = v_item.order_id;

  for v_alloc in select * from fn_allocate_fefo(v_item.product_id, v_item.qty) loop
    insert into order_item_batch_allocations (order_item_id, batch_id, qty)
    values (p_order_item_id, v_alloc.batch_id, v_alloc.qty);

    insert into stock_ledger (batch_id, movement_type, qty_delta, channel, reference_type, reference_id, created_by)
    values (v_alloc.batch_id, 'OUT_SALE_MARKETPLACE', -v_alloc.qty, v_order.channel, 'order', v_order.id, p_created_by);
  end loop;
end;
$function$;

-- 2.2 fn_manual_out -- sumber: 0108:29-63
CREATE OR REPLACE FUNCTION public.fn_manual_out(
  p_product_id uuid,
  p_qty integer,
  p_reason text,
  p_note text,
  p_campaign_reference text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_alloc record;
  v_channel text;
begin
  if p_reason not in ('offline','bonus','promo','sample','damaged','expired') then
    raise exception 'reason % tidak valid untuk keluar manual', p_reason;
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'catatan wajib diisi untuk keluar manual';
  end if;
  if p_reason in ('bonus','promo','sample') and (p_campaign_reference is null or length(trim(p_campaign_reference)) = 0) then
    raise exception 'referensi campaign/approval wajib diisi untuk reason bonus, promo, atau sample';
  end if;

  v_channel := case when p_reason = 'offline' then 'offline' else 'internal' end;

  for v_alloc in select * from fn_allocate_fefo(p_product_id, p_qty) loop
    insert into stock_ledger (batch_id, movement_type, qty_delta, channel, reason, note, campaign_reference, created_by)
    values (v_alloc.batch_id, 'OUT_MANUAL', -v_alloc.qty, v_channel, p_reason, p_note,
            case when p_reason in ('bonus','promo','sample') then p_campaign_reference else null end,
            p_created_by);
  end loop;
end;
$function$;

-- 2.3 fn_maklon_intake -- sumber: 0116:15-42
CREATE OR REPLACE FUNCTION public.fn_maklon_intake(
  p_product_id uuid,
  p_batch_code text,
  p_expiry_date date,
  p_qty integer,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_batch_id uuid;
begin
  if p_qty <= 0 then
    raise exception 'qty barang masuk maklon harus lebih dari 0';
  end if;

  insert into product_batches (product_id, batch_code, expiry_date)
  values (p_product_id, p_batch_code, p_expiry_date)
  on conflict (product_id, batch_code) do update set expiry_date = excluded.expiry_date
  returning id into v_batch_id;

  insert into stock_ledger (batch_id, movement_type, qty_delta, channel, created_by)
  values (v_batch_id, 'IN_MAKLON', p_qty, 'internal', p_created_by);

  return v_batch_id;
end;
$function$;

-- 2.4 fn_opening_balance_intake -- sumber: 0114:20-43
CREATE OR REPLACE FUNCTION public.fn_opening_balance_intake(
  p_product_id uuid,
  p_batch_code text,
  p_expiry_date date,
  p_qty integer,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_batch_id uuid;
begin
  insert into product_batches (product_id, batch_code, expiry_date)
  values (p_product_id, p_batch_code, p_expiry_date)
  on conflict (product_id, batch_code) do update set expiry_date = excluded.expiry_date
  returning id into v_batch_id;

  insert into stock_ledger (batch_id, movement_type, qty_delta, channel, note, created_by)
  values (v_batch_id, 'IN_OPENING_BALANCE', p_qty, 'internal', 'Opening balance - stok awal perkiraan', p_created_by);

  return v_batch_id;
end;
$function$;

-- 2.5 fn_correct_ledger_entry -- sumber: 0107:121-158
CREATE OR REPLACE FUNCTION public.fn_correct_ledger_entry(
  p_ledger_entry_id uuid,
  p_qty_delta integer,
  p_note text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_original record;
  v_current_qty integer;
begin
  if p_qty_delta = 0 then
    raise exception 'Selisih koreksi tidak boleh 0';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'Catatan alasan wajib diisi untuk koreksi entri';
  end if;

  select * into v_original from stock_ledger where id = p_ledger_entry_id;
  if not found then
    raise exception 'Entri ledger % tidak ditemukan', p_ledger_entry_id;
  end if;

  if v_original.movement_type not in ('IN_MAKLON', 'OUT_MANUAL') then
    raise exception 'Entri dengan movement_type % tidak bisa dikoreksi -- hanya entri input manual (IN_MAKLON atau OUT_MANUAL) yang boleh dikoreksi', v_original.movement_type;
  end if;

  select current_qty into v_current_qty from batch_stock_summary where batch_id = v_original.batch_id;
  if coalesce(v_current_qty, 0) + p_qty_delta < 0 then
    raise exception 'Stok tidak cukup: koreksi ini akan membuat saldo batch menjadi negatif (saldo sekarang %, penyesuaian %)', v_current_qty, p_qty_delta;
  end if;

  insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, note, created_by)
  values (v_original.batch_id, 'ADJUSTMENT_CORRECTION', p_qty_delta, 'ledger_correction', p_ledger_entry_id, p_note, p_created_by);
end;
$function$;

-- 2.6 fn_inspect_return -- sumber: 0119:7-73
CREATE OR REPLACE FUNCTION public.fn_inspect_return(
  p_return_id uuid,
  p_condition text,
  p_inspected_by uuid,
  p_photo_url text DEFAULT NULL::text,
  p_expiry_date date DEFAULT NULL::date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_return record;
  v_product_id uuid;
  v_new_batch_id uuid;
  v_batch_code text;
  v_batch_prefix text;
  v_movement_type text;
  v_ledger_note text;
begin
  if p_condition not in ('SELLABLE','DAMAGED','LOST') then
    raise exception 'condition % tidak valid', p_condition;
  end if;

  select * into v_return from returns where id = p_return_id;
  if not found then
    raise exception 'return % tidak ditemukan', p_return_id;
  end if;

  if p_condition in ('DAMAGED','LOST')
     and (p_photo_url is null or length(trim(p_photo_url)) = 0) then
    raise exception 'Foto bukti wajib untuk kondisi rusak atau hilang';
  end if;

  if p_condition = 'SELLABLE' and p_expiry_date is null then
    raise exception 'Tanggal kedaluwarsa wajib diisi untuk kondisi layak jual';
  end if;

  if v_return.type = 'CANCELLATION' then
    v_batch_prefix := 'BATAL-';
    v_movement_type := 'IN_CANCEL_REVERSAL';
    v_ledger_note := 'Pembatalan pasca-shipped - batch baru';
  else
    v_batch_prefix := 'RETUR-';
    v_movement_type := 'IN_RETURN_SELLABLE';
    v_ledger_note := 'Retur kondisi layak jual - batch baru';
  end if;

  if p_condition = 'SELLABLE' then
    select product_id into v_product_id
    from order_items where id = v_return.order_item_id;

    v_batch_code := v_batch_prefix || substr(p_return_id::text, 1, 8);

    insert into product_batches (product_id, batch_code, expiry_date)
    values (v_product_id, v_batch_code, p_expiry_date)
    returning id into v_new_batch_id;

    insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, note, created_by)
    values (v_new_batch_id, v_movement_type, v_return.qty, 'return', p_return_id,
            v_ledger_note, p_inspected_by);
  end if;

  update returns
  set condition = p_condition, photo_url = p_photo_url, inspected_by = p_inspected_by, inspected_at = now()
  where id = p_return_id;
end;
$function$;

-- 2.7 fn_close_opname_session -- sumber: 0110:14-41
CREATE OR REPLACE FUNCTION public.fn_close_opname_session(p_session_id uuid, p_closed_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_item record;
  v_reason_label text;
begin
  for v_item in
    select * from opname_items where session_id = p_session_id and variance <> 0
  loop
    v_reason_label := case v_item.discrepancy_reason
      when 'damaged' then 'Barang rusak'
      when 'lost' then 'Barang hilang'
      when 'found_extra' then 'Ditemukan lebih'
      when 'miscount_previous' then 'Salah hitung sebelumnya'
      when 'other' then 'Lainnya'
      else 'Tidak ada alasan tercatat'
    end;

    insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, note, created_by)
    values (v_item.batch_id, 'ADJUSTMENT_OPNAME', v_item.variance, 'opname_session', p_session_id,
            'Koreksi hasil stok opname - ' || v_reason_label || coalesce(' - ' || v_item.note, ''), p_closed_by);
  end loop;

  update opname_sessions set status = 'CLOSED', closed_at = now() where id = p_session_id;
end;
$function$;

COMMIT;
