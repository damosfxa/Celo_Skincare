BEGIN;

ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_movement_type_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_movement_type_check
CHECK (movement_type = ANY (ARRAY[
  'IN_MAKLON','OUT_SALE_MARKETPLACE','OUT_MANUAL','IN_RETURN_SELLABLE',
  'OUT_RETURN_WRITE_OFF','ADJUSTMENT_OPNAME','IN_CANCEL_REVERSAL',
  'ADJUSTMENT_CORRECTION','IN_OPENING_BALANCE'
]));

ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_check
CHECK (
  (movement_type = ANY (ARRAY['IN_MAKLON','IN_RETURN_SELLABLE','IN_CANCEL_REVERSAL','IN_OPENING_BALANCE']) AND qty_delta > 0)
  OR (movement_type = ANY (ARRAY['OUT_SALE_MARKETPLACE','OUT_MANUAL','OUT_RETURN_WRITE_OFF']) AND qty_delta < 0)
  OR (movement_type = ANY (ARRAY['ADJUSTMENT_OPNAME','ADJUSTMENT_CORRECTION']))
);

CREATE OR REPLACE FUNCTION public.fn_opening_balance_intake(
  p_product_id uuid,
  p_batch_code text,
  p_expiry_date date,
  p_qty integer,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
declare
  v_batch_id uuid;
begin
  insert into product_batches (product_id, batch_code, expiry_date)
  values (p_product_id, p_batch_code, p_expiry_date)
  on conflict (batch_code) do update set expiry_date = excluded.expiry_date
  returning id into v_batch_id;

  insert into stock_ledger (batch_id, movement_type, qty_delta, channel, note, created_by)
  values (v_batch_id, 'IN_OPENING_BALANCE', p_qty, 'internal', 'Opening balance - stok awal perkiraan', p_created_by);

  return v_batch_id;
end;
$function$;

-- Status "belum terverifikasi" dihitung LIVE (bukan kolom yang di-update):
-- batch dianggap belum verified kalau belum pernah punya baris opname_items
-- dengan physical_qty terisi di sesi mana pun. Ini menjaga stock_ledger
-- tetap append-only murni -- tidak ada UPDATE yang pernah menyentuhnya
-- untuk fitur ini, konsisten dengan seluruh sistem yang lain.
CREATE OR REPLACE VIEW v_unverified_opening_balances AS
SELECT sl.id AS ledger_id, sl.batch_id, pb.batch_code, pb.product_id, p.sku, p.name,
       sl.qty_delta, sl.created_at
FROM stock_ledger sl
JOIN product_batches pb ON pb.id = sl.batch_id
JOIN products p ON p.id = pb.product_id
WHERE sl.movement_type = 'IN_OPENING_BALANCE'
  AND NOT EXISTS (
    SELECT 1 FROM opname_items oi
    WHERE oi.batch_id = sl.batch_id AND oi.physical_qty IS NOT NULL
  );

COMMIT;
