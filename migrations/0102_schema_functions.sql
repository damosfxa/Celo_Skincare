-- ============================================================
-- 0102_schema_functions.sql
-- Semua RPC function. Semua write ke stock_ledger WAJIB lewat
-- function di sini (bukan insert() langsung dari API route) --
-- supaya baca-stok-lalu-tulis-ledger jadi 1 transaksi atomik.
-- ============================================================

-- Alokasi FEFO murni (read-only, tidak menulis ledger) -- dipakai
-- oleh fn_ship_order_item dan fn_manual_out sebagai building block.
create or replace function fn_allocate_fefo(p_product_id uuid, p_qty integer)
returns table(batch_id uuid, qty integer)
language plpgsql
as $function$
declare
  v_remaining integer := p_qty;
  v_batch record;
  v_take integer;
begin
  if p_qty <= 0 then
    raise exception 'qty harus lebih dari 0';
  end if;

  for v_batch in
    select pb.id, vbs.current_qty
    from product_batches pb
    join v_batch_stock vbs on vbs.batch_id = pb.id
    where pb.product_id = p_product_id and vbs.current_qty > 0
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

-- Ship 1 order_item: alokasi FEFO + catat ledger OUT_SALE_MARKETPLACE.
create or replace function fn_ship_order_item(p_order_item_id uuid, p_created_by uuid)
returns void
language plpgsql
as $function$
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

-- Keluar manual (bonus/promo/sample/rusak/expired/offline) --
-- alokasi FEFO otomatis, reason wajib diisi.
create or replace function fn_manual_out(
  p_product_id uuid, p_qty integer, p_movement_type text,
  p_reason text, p_created_by uuid
)
returns void
language plpgsql
as $function$
declare
  v_alloc record;
begin
  if p_movement_type not in (
    'OUT_SALE_OFFLINE','OUT_BONUS','OUT_PROMO','OUT_SAMPLE','OUT_DAMAGED','OUT_EXPIRED'
  ) then
    raise exception 'movement_type % tidak valid untuk keluar manual', p_movement_type;
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason wajib diisi untuk keluar manual';
  end if;

  for v_alloc in select * from fn_allocate_fefo(p_product_id, p_qty) loop
    insert into stock_ledger (batch_id, movement_type, qty_delta, channel, reason, created_by)
    values (v_alloc.batch_id, p_movement_type, -v_alloc.qty, 'internal', p_reason, p_created_by);
  end loop;
end;
$function$;

-- Inspeksi retur: SELLABLE -> tulis ledger IN_RETURN_SELLABLE ke
-- batch alokasi terbesar. DAMAGED/LOST -> sengaja TIDAK ada ledger
-- baru (stok sudah terpotong benar saat shipping; nulis lagi bikin
-- double-count). Wajib foto untuk kondisi DAMAGED/LOST.
--
-- CATATAN: versi lama function ini (3 parameter, tanpa p_photo_url)
-- masih ada di database sebagai sisa sebelum fitur foto ditambahkan.
-- Endpoint API sekarang selalu memanggil versi 4 parameter di bawah
-- ini. Versi lama aman untuk di-drop kalau mau beres-beres:
--   drop function if exists fn_inspect_return(uuid, text, uuid);
create or replace function fn_inspect_return(
  p_return_id uuid, p_condition text, p_inspected_by uuid,
  p_photo_url text default null
)
returns void
language plpgsql
as $function$
declare
  v_return record;
  v_batch_id uuid;
begin
  if p_condition not in ('SELLABLE','DAMAGED','LOST') then
    raise exception 'condition % tidak valid', p_condition;
  end if;

  if p_condition in ('DAMAGED','LOST') and (p_photo_url is null or length(trim(p_photo_url)) = 0) then
    raise exception 'Foto bukti wajib untuk kondisi rusak atau hilang';
  end if;

  select * into v_return from returns where id = p_return_id;
  if not found then
    raise exception 'return % tidak ditemukan', p_return_id;
  end if;

  if p_condition = 'SELLABLE' then
    -- Fase 1: kembalikan ke batch alokasi terbesar dari order_item
    -- asal. Kasus order_item yang FEFO-nya kepecah rata ke banyak
    -- batch belum ditangani granular per-batch -- item minor,
    -- dicatat sebagai batasan.
    select batch_id into v_batch_id
    from order_item_batch_allocations
    where order_item_id = v_return.order_item_id
    order by qty desc
    limit 1;

    insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, reason, created_by)
    values (v_batch_id, 'IN_RETURN_SELLABLE', v_return.qty, 'return', p_return_id,
            'Retur kondisi layak jual', p_inspected_by);
  end if;

  update returns
  set condition = p_condition, photo_url = p_photo_url, inspected_by = p_inspected_by, inspected_at = now()
  where id = p_return_id;
end;
$function$;

-- Simpan resep bundle: hapus semua baris lama, insert baru dari
-- payload JSON. SECURITY DEFINER wajib -- tabel bundle_recipes
-- sengaja tidak punya RLS policy UPDATE/DELETE untuk user biasa
-- (lihat 0104), jadi delete di sini butuh privilese pembuat function.
create or replace function fn_save_bundle_recipe(p_bundle_id uuid, p_components jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from bundle_recipes where bundle_product_id = p_bundle_id;

  insert into bundle_recipes (bundle_product_id, component_product_id, qty_per_bundle)
  select
    p_bundle_id,
    (c->>'component_product_id')::uuid,
    (c->>'qty_per_bundle')::integer
  from jsonb_array_elements(p_components) as c;
end;
$function$;

-- Buka sesi opname: snapshot system_qty semua batch yang masih
-- ada stok, ke opname_items dengan physical_qty kosong.
create or replace function fn_open_opname_session(p_created_by uuid)
returns uuid
language plpgsql
as $function$
declare
  v_session_id uuid;
begin
  insert into opname_sessions (session_date, created_by)
  values (current_date, p_created_by)
  returning id into v_session_id;

  insert into opname_items (session_id, batch_id, system_qty, physical_qty)
  select v_session_id, batch_id, current_qty, null
  from v_batch_stock
  where current_qty > 0;

  return v_session_id;
end;
$function$;

-- Tutup sesi opname: untuk tiap item dengan variance != 0, tulis
-- ledger ADJUSTMENT_OPNAME. Item yang tidak sempat dihitung
-- (physical_qty masih null) dibiarkan apa adanya, ditampilkan
-- terpisah oleh API sebagai "not_counted".
create or replace function fn_close_opname_session(p_session_id uuid, p_closed_by uuid)
returns void
language plpgsql
as $function$
declare
  v_item record;
begin
  for v_item in
    select * from opname_items where session_id = p_session_id and variance <> 0
  loop
    insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, reason, created_by)
    values (v_item.batch_id, 'ADJUSTMENT_OPNAME', v_item.variance, 'opname_session', p_session_id,
            'Koreksi hasil stok opname', p_closed_by);
  end loop;

  update opname_sessions set status = 'CLOSED', closed_at = now() where id = p_session_id;
end;
$function$;

-- Trigger function: auto-update kolom updated_at. Dipasang di
-- products dan orders (lihat 0103).
create or replace function set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- Trigger function: auto-insert baris profiles saat user baru
-- signup lewat Supabase Auth. SECURITY DEFINER wajib -- trigger
-- ini jalan di schema auth, butuh privilese untuk insert ke
-- public.profiles atas nama user yang baru dibuat.
create or replace function fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'admin')
  on conflict (id) do nothing;
  return new;
end;
$function$;
