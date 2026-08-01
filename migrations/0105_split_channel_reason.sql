BEGIN;

-- 1. Lepas dulu constraint lama yang bakal berubah (IF EXISTS -- constraint
-- ini bagian dari histori production asli yang gak sempat ke-capture di
-- 0100_schema_tables.sql, jadi rebuild dari nol perlu ini aman/no-op)
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_check;
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_movement_type_check;

-- 2. Kolom "reason" lama (catatan bebas operator) diubah namanya jadi "note"
ALTER TABLE stock_ledger RENAME COLUMN reason TO note;

-- 3. Tambah kolom "reason" baru -- kategori tetap sesuai brief
ALTER TABLE stock_ledger ADD COLUMN reason text;

-- 4. Migrasi data lama: movement_type lama dipecah jadi movement_type generik + reason kategori
UPDATE stock_ledger
SET movement_type = 'OUT_MANUAL',
    reason = CASE movement_type
      WHEN 'OUT_SALE_OFFLINE' THEN 'offline'
      WHEN 'OUT_BONUS' THEN 'bonus'
      WHEN 'OUT_PROMO' THEN 'promo'
      WHEN 'OUT_SAMPLE' THEN 'sample'
      WHEN 'OUT_DAMAGED' THEN 'damaged'
      WHEN 'OUT_EXPIRED' THEN 'expired'
    END
WHERE movement_type IN ('OUT_SALE_OFFLINE','OUT_BONUS','OUT_PROMO','OUT_SAMPLE','OUT_DAMAGED','OUT_EXPIRED');

-- 5. Constraint baru: movement_type disederhanakan (6 varian jadi 1: OUT_MANUAL)
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_movement_type_check
CHECK (movement_type = ANY (ARRAY[
  'IN_MAKLON','OUT_SALE_MARKETPLACE','OUT_MANUAL','IN_RETURN_SELLABLE',
  'OUT_RETURN_WRITE_OFF','ADJUSTMENT_OPNAME','IN_CANCEL_REVERSAL'
]));

-- 6. Constraint baru: tanda +/- qty_delta sesuai arah movement_type
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_check
CHECK (
  (movement_type = ANY (ARRAY['IN_MAKLON','IN_RETURN_SELLABLE','IN_CANCEL_REVERSAL']) AND qty_delta > 0)
  OR (movement_type = ANY (ARRAY['OUT_SALE_MARKETPLACE','OUT_MANUAL','OUT_RETURN_WRITE_OFF']) AND qty_delta < 0)
  OR (movement_type = 'ADJUSTMENT_OPNAME')
);

-- 7. Constraint baru: "reason" cuma boleh keisi untuk OUT_MANUAL, dan wajib salah satu kategori tetap
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_reason_check
CHECK (
  (movement_type = 'OUT_MANUAL' AND reason = ANY (ARRAY['offline','bonus','promo','sample','damaged','expired']))
  OR (movement_type <> 'OUT_MANUAL' AND reason IS NULL)
);

-- 8. Drop fungsi lama dulu (parameter berubah nama, gak bisa cuma REPLACE)
DROP FUNCTION fn_manual_out(uuid,integer,text,text,uuid);

-- 9. Buat ulang fungsi dengan parameter baru: reason (kategori) + note (catatan bebas) terpisah
CREATE FUNCTION public.fn_manual_out(
  p_product_id uuid,
  p_qty integer,
  p_reason text,
  p_note text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
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

  v_channel := case when p_reason = 'offline' then 'offline' else 'internal' end;

  for v_alloc in select * from fn_allocate_fefo(p_product_id, p_qty) loop
    insert into stock_ledger (batch_id, movement_type, qty_delta, channel, reason, note, created_by)
    values (v_alloc.batch_id, 'OUT_MANUAL', -v_alloc.qty, v_channel, p_reason, p_note, p_created_by);
  end loop;
end;
$function$;

COMMIT;