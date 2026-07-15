-- ============================================================
-- 0101_schema_views.sql
-- Semua view turunan dari stock_ledger dan tabel terkait.
-- ============================================================

-- Stok per batch: agregasi murni dari ledger, tidak pernah
-- disimpan sebagai angka statis di mana pun.
create or replace view v_batch_stock as
select
  batch_id,
  sum(qty_delta) as current_qty
from stock_ledger
group by batch_id;

-- Stok per produk: jumlah semua batch milik produk itu.
create or replace view v_product_stock as
select
  pb.product_id,
  sum(sl.qty_delta) as current_qty
from stock_ledger sl
join product_batches pb on pb.id = sl.batch_id
group by pb.product_id;

-- Batch yang mendekati/sudah kedaluwarsa (<= 90 hari), hanya yang
-- masih ada stoknya. Disertai sku/name produk untuk ditampilkan
-- langsung di UI Notifikasi.
create or replace view v_expiring_batches as
select
  pb.id as batch_id,
  pb.product_id,
  p.sku,
  p.name,
  pb.batch_code,
  pb.expiry_date,
  coalesce(vbs.current_qty, 0) as current_qty,
  (pb.expiry_date - current_date) as days_remaining
from product_batches pb
join products p on p.id = pb.product_id
left join v_batch_stock vbs on vbs.batch_id = pb.id
where (pb.expiry_date - current_date) <= 90
  and coalesce(vbs.current_qty, 0) > 0;

-- Retur TikTok yang belum diklaim (kondisi masih pending/damaged/
-- lost), diurutkan berdasarkan batas klaim terdekat. Sengaja tidak
-- dibatasi jendela hari tertentu -- brief minta "pengingat sebelum
-- batas 40 hari", jadi semua yang masih terbuka wajib terlihat
-- dari awal, bukan cuma menjelang hangus.
create or replace view v_pending_tiktok_claims as
select
  r.id,
  r.order_id,
  o.external_order_id,
  r.order_item_id,
  p.sku,
  p.name,
  r.qty,
  r.condition,
  r.claim_deadline,
  r.inspected_by,
  r.inspected_at,
  r.created_at,
  (r.claim_deadline - current_date) as days_remaining
from returns r
join orders o on o.id = r.order_id
left join order_items oi on oi.id = r.order_item_id
left join products p on p.id = oi.product_id
where o.channel = 'tiktok'
  and r.condition = any (array['PENDING_INSPECTION', 'DAMAGED', 'LOST'])
  and r.claim_deadline is not null
order by r.claim_deadline;

-- Anomali harian: order yang statusnya CANCELLED tapi ternyata
-- masih punya ledger keluar (OUT_SALE_MARKETPLACE) -- indikasi
-- pembatalan yang tidak konsisten dengan pergerakan stoknya sendiri.
create or replace view v_daily_anomalies as
select
  o.id as order_id,
  'CANCELLED_BUT_HAS_OUTBOUND_LEDGER' as anomaly_type
from orders o
join stock_ledger sl
  on sl.reference_type = 'order' and sl.reference_id = o.id
where o.status = 'CANCELLED'
  and sl.movement_type = 'OUT_SALE_MARKETPLACE';
