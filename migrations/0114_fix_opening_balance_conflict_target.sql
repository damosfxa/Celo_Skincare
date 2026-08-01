BEGIN;

-- Bug: fn_opening_balance_intake() (0109) pakai `ON CONFLICT (batch_code)`
-- buat insert ke product_batches, tapi batch_code gak pernah dikasih UNIQUE
-- constraint di manapun -- Postgres bakal error "no unique or exclusion
-- constraint matching ON CONFLICT specification" begitu fungsi ini beneran
-- dipanggil (fitur "Input Stok Awal" di halaman Produk & Batch).
--
-- Scope unik: per-produk, bukan global. Kode batch dari maklon bisa aja
-- kebetulan sama di 2 produk berbeda (keduanya diproduksi tanggal yang
-- sama, misal) -- unik global bakal nge-block admin input batch produk
-- kedua cuma gara-gara nabrak kode produk lain, padahal itu bukan
-- kesalahan input beneran. Unik per-produk tetap nangkep kesalahan asli
-- (re-input batch yang sama buat produk yang SAMA) tanpa friksi itu.
ALTER TABLE product_batches
  ADD CONSTRAINT product_batches_product_batch_code_key UNIQUE (product_id, batch_code);

-- Sesuaikan ON CONFLICT target di fn_opening_balance_intake supaya cocok
-- sama constraint barunya (composite, bukan cuma batch_code sendirian).
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
  on conflict (product_id, batch_code) do update set expiry_date = excluded.expiry_date
  returning id into v_batch_id;

  insert into stock_ledger (batch_id, movement_type, qty_delta, channel, note, created_by)
  values (v_batch_id, 'IN_OPENING_BALANCE', p_qty, 'internal', 'Opening balance - stok awal perkiraan', p_created_by);

  return v_batch_id;
end;
$function$;

COMMIT;
