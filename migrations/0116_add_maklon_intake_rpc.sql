BEGIN;

-- Fix 2 masalah di app/api/batches/intake/route.ts (Barang Masuk Maklon):
-- 1. Route itu insert LANGSUNG ke stock_ledger dari kode API -- melanggar
--    prinsip "semua tulisan ledger WAJIB lewat RPC" yang dipegang di
--    seluruh bagian sistem lain (lihat komentar 0102).
-- 2. Route itu pakai `.upsert(..., { onConflict: 'batch_code' })` -- asumsi
--    batch_code unik sendirian. Migration 0114 udah ganti constraint jadi
--    gabungan (product_id, batch_code), jadi asumsi lama itu udah gak
--    valid lagi.
--
-- RPC ini niru pola fn_opening_balance_intake (0109) persis -- upsert batch
-- + insert ledger jadi 1 transaksi atomik, conflict target udah disesuaikan
-- ke (product_id, batch_code).
CREATE OR REPLACE FUNCTION public.fn_maklon_intake(
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

COMMIT;
