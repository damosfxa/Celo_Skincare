BEGIN;

-- Backfill koreksi opname yang HILANG akibat bug variance (ditemukan &
-- difix di migration 0115). 3 baris ini adalah selisih hasil hitung fisik
-- vs sistem yang beneran ditemukan operator tanggal 10 & 14 Juli 2026,
-- tapi gak pernah ketulis ke ledger karena fn_close_opname_session gak
-- pernah nemu baris dengan variance <> 0 (variance selalu NULL). Diaudit
-- manual dari opname_items production sebelum migration 0115 diterapkan.
-- Guard NOT EXISTS supaya aman kalau script ini gak sengaja kejalan 2x.
-- Ini SATU KALI backfill data historis, bukan bagian dari urutan
-- rebuild-dari-nol (makanya gak dinomori 011x kayak migration lain).

insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, note, created_by)
select '59746768-ff25-41a9-9a33-7b463cf7999e', 'ADJUSTMENT_OPNAME', -5, 'opname_session',
       'e2554e9a-68d1-427b-8b02-7cf9e8abd58f',
       'Backfill koreksi opname 2026-07-10 yang hilang akibat bug variance (migration 0115)',
       os.created_by
from opname_sessions os
where os.id = 'e2554e9a-68d1-427b-8b02-7cf9e8abd58f'
  and not exists (
    select 1 from stock_ledger sl
    where sl.batch_id = '59746768-ff25-41a9-9a33-7b463cf7999e'
      and sl.reference_id = 'e2554e9a-68d1-427b-8b02-7cf9e8abd58f'
      and sl.movement_type = 'ADJUSTMENT_OPNAME'
  );

insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, note, created_by)
select '4655f501-75c7-453f-a132-f67519457448', 'ADJUSTMENT_OPNAME', -2, 'opname_session',
       '37e75f28-2574-46ea-a7d9-3344375fbb43',
       'Backfill koreksi opname 2026-07-14 yang hilang akibat bug variance (migration 0115)',
       os.created_by
from opname_sessions os
where os.id = '37e75f28-2574-46ea-a7d9-3344375fbb43'
  and not exists (
    select 1 from stock_ledger sl
    where sl.batch_id = '4655f501-75c7-453f-a132-f67519457448'
      and sl.reference_id = '37e75f28-2574-46ea-a7d9-3344375fbb43'
      and sl.movement_type = 'ADJUSTMENT_OPNAME'
  );

insert into stock_ledger (batch_id, movement_type, qty_delta, reference_type, reference_id, note, created_by)
select '0394f863-ee03-4483-9d03-63ff8051b319', 'ADJUSTMENT_OPNAME', 5, 'opname_session',
       '37e75f28-2574-46ea-a7d9-3344375fbb43',
       'Backfill koreksi opname 2026-07-14 yang hilang akibat bug variance (migration 0115)',
       os.created_by
from opname_sessions os
where os.id = '37e75f28-2574-46ea-a7d9-3344375fbb43'
  and not exists (
    select 1 from stock_ledger sl
    where sl.batch_id = '0394f863-ee03-4483-9d03-63ff8051b319'
      and sl.reference_id = '37e75f28-2574-46ea-a7d9-3344375fbb43'
      and sl.movement_type = 'ADJUSTMENT_OPNAME'
  );

COMMIT;
