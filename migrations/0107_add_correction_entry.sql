-- ============================================================
-- 0107_add_correction_entry.sql
-- Fitur "Koreksi Entri": operator bisa mengoreksi entri ledger
-- manual (IN_MAKLON/OUT_MANUAL) yang salah input, lewat entri
-- ADJUSTMENT_CORRECTION baru -- BUKAN edit/hapus entri asli,
-- append-only tetap dijaga.
--
-- File ini juga sekalian mendokumentasikan 2 tabel cache + 1
-- trigger yang SUDAH LIVE di database produksi sebelumnya (dibuat
-- manual untuk optimasi baca stok O(1)) tapi belum pernah tercatat
-- sebagai file migration: batch_stock_summary, product_stock_summary,
-- trg_update_stock_summary / fn_update_stock_summary. Bagian
-- dokumentasi ini aman dijalankan ulang di database yang sudah
-- punya objek-objek tsb (pakai IF NOT EXISTS / OR REPLACE).
-- ============================================================

BEGIN;

-- 1. Tambah movement_type baru: ADJUSTMENT_CORRECTION
ALTER TABLE stock_ledger DROP CONSTRAINT stock_ledger_movement_type_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_movement_type_check
CHECK (movement_type = ANY (ARRAY[
  'IN_MAKLON','OUT_SALE_MARKETPLACE','OUT_MANUAL','IN_RETURN_SELLABLE',
  'OUT_RETURN_WRITE_OFF','ADJUSTMENT_OPNAME','IN_CANCEL_REVERSAL','ADJUSTMENT_CORRECTION'
]));

ALTER TABLE stock_ledger DROP CONSTRAINT stock_ledger_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_check
CHECK (
  (movement_type = ANY (ARRAY['IN_MAKLON','IN_RETURN_SELLABLE','IN_CANCEL_REVERSAL']) AND qty_delta > 0)
  OR (movement_type = ANY (ARRAY['OUT_SALE_MARKETPLACE','OUT_MANUAL','OUT_RETURN_WRITE_OFF']) AND qty_delta < 0)
  OR (movement_type = ANY (ARRAY['ADJUSTMENT_OPNAME','ADJUSTMENT_CORRECTION']))
);

-- Tambah reference_type baru: 'ledger_correction' (dipakai fn_correct_ledger_entry
-- untuk mereferensikan id entri ledger asli yang dikoreksi). Ditemukan saat testing
-- manual: constraint ini sudah live sebelumnya (cuma izinkan 'order'/'return'/
-- 'opname_session') tapi versi lamanya tidak pernah tercatat di migration manapun
-- (termasuk 0100) -- pakai IF EXISTS supaya baris ini tetap aman dijalankan saat
-- rebuild dari database kosong (0100->0107 berurutan), bukan cuma di database
-- production yang sudah punya constraint versi lamanya.
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_reference_type_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_reference_type_check
CHECK (reference_type = ANY (ARRAY['order'::text, 'return'::text, 'opname_session'::text, 'ledger_correction'::text]));

-- 2. Dokumentasi: tabel cache stok O(1) (sudah live sebelumnya,
-- dikonfirmasi manual oleh user -- struktur: batch_id/product_id uuid,
-- current_qty bigint, batch_id/product_id masing-masing primary key).
CREATE TABLE IF NOT EXISTS batch_stock_summary (
  batch_id uuid PRIMARY KEY REFERENCES product_batches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  current_qty bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_stock_summary (
  product_id uuid PRIMARY KEY REFERENCES products(id),
  current_qty bigint NOT NULL DEFAULT 0
);

-- 3. Dokumentasi: RLS untuk 2 tabel cache di atas. Cuma perlu SELECT
-- untuk role biasa -- satu-satunya penulis kedua tabel ini adalah
-- trigger SECURITY DEFINER di bawah (fn_update_stock_summary), jadi
-- sengaja tidak ada policy INSERT/UPDATE untuk role biasa (prinsip
-- sama seperti stock_ledger: hanya berubah lewat jalur resmi).
ALTER TABLE batch_stock_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock_summary ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'batch_stock_summary' AND policyname = 'read_all_batch_stock_summary'
  ) THEN
    CREATE POLICY read_all_batch_stock_summary ON batch_stock_summary
    FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_stock_summary' AND policyname = 'read_all_product_stock_summary'
  ) THEN
    CREATE POLICY read_all_product_stock_summary ON product_stock_summary
    FOR SELECT USING (true);
  END IF;
END $$;

-- 4. Dokumentasi: trigger yang menjaga kedua tabel cache di atas
-- tetap sinkron setiap ada baris baru masuk ke stock_ledger.
CREATE OR REPLACE FUNCTION public.fn_update_stock_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_product_id uuid;
begin
  select product_id into v_product_id
  from product_batches where id = new.batch_id;

  insert into batch_stock_summary (batch_id, product_id, current_qty)
  values (new.batch_id, v_product_id, new.qty_delta)
  on conflict (batch_id)
  do update set current_qty = batch_stock_summary.current_qty + new.qty_delta;

  insert into product_stock_summary (product_id, current_qty)
  values (v_product_id, new.qty_delta)
  on conflict (product_id)
  do update set current_qty = product_stock_summary.current_qty + new.qty_delta;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_update_stock_summary ON stock_ledger;
CREATE TRIGGER trg_update_stock_summary
AFTER INSERT ON stock_ledger
FOR EACH ROW EXECUTE FUNCTION fn_update_stock_summary();

-- 5. Fitur baru: koreksi entri ledger manual (IN_MAKLON/OUT_MANUAL).
-- Tidak mengubah/menghapus entri asli -- cuma menambah entri
-- ADJUSTMENT_CORRECTION baru sebagai penyeimbang, tetap append-only.
CREATE OR REPLACE FUNCTION public.fn_correct_ledger_entry(
  p_ledger_entry_id uuid,
  p_qty_delta integer,
  p_note text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
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

COMMIT;
