BEGIN;

-- 1. Sinkronisasi dokumentasi: kolom returns.type (sudah live, IF NOT EXISTS
-- supaya aman/no-op kalau dijalankan di DB yang sudah punya kolom ini).
-- HARUS ada duluan sebelum view di bawah (view-nya makai kolom ini) --
-- urutan ini sempat kebalik dan bikin rebuild dari nol gagal (column
-- r.type does not exist), sudah dibetulin di sini.
ALTER TABLE returns ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'RETURN';

-- 2. FIX BUG: v_daily_anomalies salah menandai order CANCELLED pasca-shipped
-- yang sudah ditangani lewat alur resmi (retur/pembatalan terinspeksi) sebagai anomali.
-- Sekarang cuma dianggap anomali kalau order CANCELLED punya ledger keluar TAPI
-- TIDAK PUNYA catatan pembatalan (returns type=CANCELLATION) yang sudah diinspeksi
-- -- apa pun hasil inspeksinya (SELLABLE/DAMAGED/LOST), itu tandanya sudah ditangani benar.
CREATE OR REPLACE VIEW v_daily_anomalies AS
SELECT o.id AS order_id, 'CANCELLED_BUT_HAS_OUTBOUND_LEDGER'::text AS anomaly_type
FROM orders o
JOIN stock_ledger sl ON sl.reference_type = 'order' AND sl.reference_id = o.id
WHERE o.status = 'CANCELLED'
  AND sl.movement_type = 'OUT_SALE_MARKETPLACE'
  AND NOT EXISTS (
    SELECT 1 FROM returns r
    WHERE r.order_id = o.id
      AND r.type = 'CANCELLATION'
      AND r.condition IS NOT NULL
      AND r.condition <> 'PENDING_INSPECTION'
  );

-- 3. Sinkronisasi dokumentasi: fn_inspect_return versi final (5 parameter,
-- p_expiry_date + note bukan reason). Sudah live, ini cuma menulis ulang biar
-- file migration mencerminkan kondisi database yang sebenarnya.
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

  if v_return.type = 'RETURN' and p_condition in ('DAMAGED','LOST')
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

-- 4. Sinkronisasi dokumentasi: fn_close_opname_session versi final (note bukan
-- reason). Sudah live, ini cuma menulis ulang.
CREATE OR REPLACE FUNCTION public.fn_close_opname_session(p_session_id uuid, p_closed_by uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
declare
  v_item record;
begin
  for v_item in
    select * from opname_items where session_id = p_session_id and variance <> 0
  loop
    insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, note, created_by)
    values (v_item.batch_id, 'ADJUSTMENT_OPNAME', v_item.variance, 'opname_session', p_session_id,
            'Koreksi hasil stok opname', p_closed_by);
  end loop;

  update opname_sessions set status = 'CLOSED', closed_at = now() where id = p_session_id;
end;
$function$;

-- 5. Sinkronisasi dokumentasi: RLS UPDATE policy untuk product_batches (sudah
-- live, dibungkus DO block + cek EXISTS supaya aman/no-op kalau sudah ada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_batches' AND policyname = 'update_batches'
  ) THEN
    CREATE POLICY update_batches ON product_batches
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

COMMIT;