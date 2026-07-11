# API Contract — Sistem Rekonsiliasi Stok

Step 4. Semua route di bawah `src/app/api/`. Semua endpoint butuh auth (Supabase session); role `admin` vs `gudang` dibedakan di middleware, bukan di tiap handler.

## 1. Produk & Batch

| Method | Route | Fungsi |
|---|---|---|
| GET | `/api/products` | List produk + stok saat ini (join `v_product_stock`) |
| POST | `/api/products` | Buat produk baru (sku, name, is_bundle) |
| GET | `/api/products/[id]` | Detail produk + semua batch-nya |
| POST | `/api/products/[id]/recipe` | Set resep bundle (array component_product_id + qty) — hanya kalau `is_bundle=true` |
| POST | `/api/batches/intake` | **Barang masuk maklon.** Body: `product_id, batch_code, expiry_date, qty`. Membuat baris `product_batches` (kalau belum ada) + 1 baris ledger `IN_MAKLON`. Dua operasi ini wajib satu transaksi. |
| GET | `/api/batches/[id]/qr` | Generate payload QR (isi = `batch_code`) buat dicetak/discan |

## 2. Stock Ledger & Rekonsiliasi (read + drill-down)

| Method | Route | Fungsi |
|---|---|---|
| GET | `/api/ledger?batch_id=&product_id=&movement_type=&from=&to=` | Query mentah ke ledger — dasar dari semua drill-down |
| GET | `/api/reconciliation/drilldown?product_id=` | Ledger lengkap 1 produk, dikelompokkan per batch, buat "kenapa selisih ini terjadi" |
| GET | `/api/reconciliation/daily` | Hasil `v_daily_anomalies` — kejanggalan self-consistency harian |
| GET | `/api/notifications/expiring` | Hasil `v_expiring_batches` |
| GET | `/api/notifications/tiktok-claims` | Hasil `v_pending_tiktok_claims` |

## 3. Keluar Manual (offline, bonus, promo, sample, rusak, kedaluwarsa)

| Method | Route | Fungsi |
|---|---|---|
| POST | `/api/ledger/manual-out` | Body: `product_id, qty, movement_type, reason`. **Alokasi batch FEFO otomatis** (operator tidak pilih batch) — bisa pecah ke beberapa batch kalau qty > stok batch terdekat. Tulis 1+ baris ledger sesuai jumlah batch yang kepakai. |

## 4. Simulasi Marketplace

Prinsip dari brief: tombol simulasi manggil **service internal yang sama** dengan yang nanti dipanggil webhook asli — supaya "tombol tinggal diganti API sungguhan tanpa ubah logika inti".

| Method | Route | Fungsi |
|---|---|---|
| POST | `/api/orders/simulate/new` | Generate N pesanan dummy (channel, qty acak). Bundle otomatis dipecah ke `order_items` per komponen lewat `bundle_recipes`. Status awal `PENDING` — **belum menyentuh ledger.** |
| POST | `/api/orders/simulate/ship` | Pilih order `PENDING` → jalankan FEFO alloc (tulis `order_item_batch_allocations`) → tulis ledger `OUT_SALE_MARKETPLACE` per alokasi → set status `SHIPPED`/`IN_TRANSIT` sesuai channel |
| POST | `/api/orders/simulate/cancel` | Order `PENDING` → status `CANCELLED`. **Tidak ada perubahan ledger** (reservasi ≠ movement, sesuai desain di PRD) |
| POST | `/api/orders/simulate/return` | Order `SHIPPED`/`DELIVERED` → buat baris `returns` (`PENDING_INSPECTION`), `claim_deadline` = `created_at + 40 hari` kalau channel tiktok |
| POST | `/api/orders/import` | Jalur impor file (CSV) — dipetakan ke service yang sama dengan `simulate/new`, bukan kode terpisah |

## 5. Retur

| Method | Route | Fungsi |
|---|---|---|
| GET | `/api/returns?condition=&channel=` | List retur, termasuk yang mendekati batas klaim |
| PATCH | `/api/returns/[id]/inspect` | Body: `condition (SELLABLE/DAMAGED/LOST), photo_url`. **Wajib foto** untuk `DAMAGED`/`LOST`. Tulis ledger `IN_RETURN_SELLABLE` (balik ke batch asal) atau `OUT_RETURN_WRITE_OFF`. Update `returns.condition`, `inspected_by`, `inspected_at` |

## 6. Stok Opname

| Method | Route | Fungsi |
|---|---|---|
| POST | `/api/opname/sessions` | Buka sesi baru — snapshot `system_qty` tiap batch dari `v_batch_stock` ke `opname_items` |
| PATCH | `/api/opname/sessions/[id]/items/[batchId]` | Input `physical_qty` hasil hitung fisik (via scan QR batch) |
| POST | `/api/opname/sessions/[id]/close` | Untuk tiap `opname_items` dengan `variance != 0`, tulis ledger `ADJUSTMENT_OPNAME`. Set sesi `CLOSED` |

## Aturan lintas-endpoint

- Semua write ke `stock_ledger` **hanya lewat Postgres RPC function** (bukan `insert()` langsung dari API route) — supaya baca-stok-lalu-tulis-ledger jadi 1 transaksi atomik, aman dari race condition kalau simulasi jalan cepat/bersamaan. Function ini yang jadi fokus Step 5.
- Semua endpoint yang menulis ledger wajib isi `created_by` dari session user yang login (audit trail).
- Setiap manual movement (`manual-out`, `opname/close`, `returns/inspect`) wajib `reason` terisi — tidak boleh kosong.

---

## Step 5 — Sample JSON Response

### GET /api/products
```json
{
  "success": true,
  "data": [
    { "id": "b3f1c2...", "sku": "SRM-VITC-30ML", "name": "Serum Vitamin C 30ml", "is_bundle": false, "current_qty": 128 }
  ]
}
```

### POST /api/batches/intake
Request:
```json
{ "product_id": "b3f1c2...", "batch_code": "MK-2026-0091", "expiry_date": "2027-05-01", "qty": 500 }
```
Response:
```json
{ "success": true, "data": { "batch_id": "9a2c...", "ledger_id": "77e0...", "current_qty": 500 } }
```

### POST /api/orders/simulate/ship
Request:
```json
{ "order_id": "d41a..." }
```
Response (contoh FEFO kepecah ke 2 batch):
```json
{
  "success": true,
  "data": {
    "order_id": "d41a...",
    "status": "SHIPPED",
    "allocations": [
      { "order_item_id": "f0c2...", "batch_id": "9a2c...", "qty": 3 },
      { "order_item_id": "f0c2...", "batch_id": "7b11...", "qty": 2 }
    ]
  }
}
```

### GET /api/reconciliation/drilldown?product_id=
```json
{
  "success": true,
  "data": {
    "product_id": "b3f1c2...",
    "current_qty": 128,
    "ledger": [
      { "batch_id": "9a2c...", "movement_type": "IN_MAKLON", "qty_delta": 500, "created_at": "2026-06-01T03:00:00Z" },
      { "batch_id": "9a2c...", "movement_type": "OUT_SALE_MARKETPLACE", "qty_delta": -3, "reference_type": "order", "reference_id": "d41a...", "created_at": "2026-06-10T08:12:00Z" }
    ]
  }
}
```

### PATCH /api/returns/[id]/inspect
Request:
```json
{ "condition": "DAMAGED", "photo_url": "https://.../retur-9f2.jpg" }
```
Response (`ledger_written: false` -- sengaja, lihat catatan RPC soal double-count):
```json
{ "success": true, "data": { "return_id": "c88e...", "condition": "DAMAGED", "ledger_written": false } }
```

### Bentuk error (konsisten di semua endpoint)
```json
{
  "success": false,
  "error": { "code": "INSUFFICIENT_STOCK", "message": "Stok tidak cukup untuk produk b3f1c2...: kurang 2 unit" }
}
```
