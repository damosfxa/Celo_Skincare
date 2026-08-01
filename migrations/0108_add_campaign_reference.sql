-- ============================================================
-- 0108_add_campaign_reference.sql
-- Fitur "Referensi Bonus/Promo/Sampel": wajib isi referensi
-- campaign/approval (nomor promo, kode approval, dll) untuk mutasi
-- keluar manual (fn_manual_out) dengan reason bonus/promo/sample.
-- ============================================================

BEGIN;

ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS campaign_reference text;

ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_campaign_reference_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_campaign_reference_check
CHECK (
  (reason = ANY (ARRAY['bonus','promo','sample']) AND campaign_reference IS NOT NULL AND length(trim(campaign_reference)) > 0)
  OR (NOT (reason = ANY (ARRAY['bonus','promo','sample'])) AND campaign_reference IS NULL)
);

-- fn_manual_out ganti signature: p_campaign_reference disisipkan di
-- TENGAH parameter list (sebelum p_created_by), bukan di akhir -- ini
-- mengubah jumlah & urutan tipe argumen dari (uuid,integer,text,text,uuid)
-- jadi (uuid,integer,text,text,text,uuid). CREATE OR REPLACE FUNCTION
-- tidak cukup untuk perubahan ini -- Postgres akan menganggapnya fungsi
-- overload baru, bukan pengganti yang lama, dan versi lama akan tetap
-- nyangkut. Drop dulu versi lama (signature dari migration 0105), pakai
-- IF EXISTS supaya aman juga kalau dijalankan saat rebuild dari nol.
DROP FUNCTION IF EXISTS fn_manual_out(uuid, integer, text, text, uuid);

CREATE OR REPLACE FUNCTION public.fn_manual_out(
  p_product_id uuid,
  p_qty integer,
  p_reason text,
  p_note text,
  p_campaign_reference text,
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
  if p_reason in ('bonus','promo','sample') and (p_campaign_reference is null or length(trim(p_campaign_reference)) = 0) then
    raise exception 'referensi campaign/approval wajib diisi untuk reason bonus, promo, atau sample';
  end if;

  v_channel := case when p_reason = 'offline' then 'offline' else 'internal' end;

  for v_alloc in select * from fn_allocate_fefo(p_product_id, p_qty) loop
    insert into stock_ledger (batch_id, movement_type, qty_delta, channel, reason, note, campaign_reference, created_by)
    values (v_alloc.batch_id, 'OUT_MANUAL', -v_alloc.qty, v_channel, p_reason, p_note,
            case when p_reason in ('bonus','promo','sample') then p_campaign_reference else null end,
            p_created_by);
  end loop;
end;
$function$;

COMMIT;
