BEGIN;

-- Resep bundle di-versioning (Sync Update v2, arah teknis: "Resep di-
-- versioning -- order lama tak berubah saat resep diedit"). Sebelumnya
-- fn_save_bundle_recipe() HARD DELETE semua baris resep lama sebelum
-- insert yang baru -- begitu resep diedit, gak ada jejak sama sekali
-- komposisi yang dipakai order-order lama. Stok order lama tetap aman
-- (order_items sudah nyimpen hasil pecahan produk saat order dibuat),
-- tapi gak bisa diaudit "resep versi berapa yang berlaku saat order ini
-- masuk" -- lubang di prinsip "gak ada angka yang berubah tanpa jejak",
-- di tabel resep, bukan di ledger.

ALTER TABLE bundle_recipes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE bundle_recipes ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- fn_save_bundle_recipe: dari HARD DELETE + insert, jadi soft-version --
-- versi lama ditandai is_active=false (baris tetap ada, bisa ditelusuri),
-- versi baru masuk dengan version bertambah. Tetap SECURITY DEFINER + 1
-- RPC atomik seperti desain awal (lihat komentar RLS bundle_recipes di
-- 0104), cuma cara "ganti"-nya berubah dari destructive jadi append-only.
CREATE OR REPLACE FUNCTION fn_save_bundle_recipe(p_bundle_id uuid, p_components jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_next_version integer;
begin
  select coalesce(max(version), 0) + 1 into v_next_version
  from bundle_recipes where bundle_product_id = p_bundle_id;

  update bundle_recipes
  set is_active = false
  where bundle_product_id = p_bundle_id and is_active = true;

  insert into bundle_recipes (bundle_product_id, component_product_id, qty_per_bundle, version, is_active)
  select
    p_bundle_id,
    (c->>'component_product_id')::uuid,
    (c->>'qty_per_bundle')::integer,
    v_next_version,
    true
  from jsonb_array_elements(p_components) as c;
end;
$function$;

COMMIT;
