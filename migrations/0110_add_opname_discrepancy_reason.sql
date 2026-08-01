BEGIN;

ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS discrepancy_reason text;

ALTER TABLE opname_items DROP CONSTRAINT IF EXISTS opname_items_discrepancy_reason_check;
ALTER TABLE opname_items ADD CONSTRAINT opname_items_discrepancy_reason_check
CHECK (
  discrepancy_reason IS NULL
  OR discrepancy_reason = ANY (ARRAY['damaged','lost','found_extra','miscount_previous','other'])
);

-- Update fn_close_opname_session: sisipkan discrepancy_reason ke dalam note
-- ledger ADJUSTMENT_OPNAME, biar alasannya ikut tercatat dan tertelusuri.
CREATE OR REPLACE FUNCTION public.fn_close_opname_session(p_session_id uuid, p_closed_by uuid)
RETURNS void
LANGUAGE plpgsql
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
