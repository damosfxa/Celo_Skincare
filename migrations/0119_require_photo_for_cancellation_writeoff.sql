-- Perbaikan temuan QA: fn_inspect_return sebelumnya cuma mewajibkan foto
-- bukti untuk kondisi DAMAGED/LOST kalau type='RETURN'. Untuk pembatalan
-- pasca-shipped (type='CANCELLATION') syarat foto ini tidak berlaku sama
-- sekali -- padahal keduanya sama-sama menghapus nilai stok (write-off)
-- tanpa balik ke ledger, jadi risiko akuntansinya identik. User memutuskan
-- foto wajib untuk keduanya, bukan cuma retur biasa.
CREATE OR REPLACE FUNCTION public.fn_inspect_return(
  p_return_id uuid,
  p_condition text,
  p_inspected_by uuid,
  p_photo_url text DEFAULT NULL::text,
  p_expiry_date date DEFAULT NULL::date
)
RETURNS void
LANGUAGE plpgsql
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
