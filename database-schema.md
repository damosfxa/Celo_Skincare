# Database Schema

Skema database Postgres (Supabase) untuk sistem rekonsiliasi stok. File SQL lengkap dan siap dijalankan ada di folder `migrations/`, urutan & penjelasan tiap file ada di `migrations/README.md`, itu sumber paling akurat kalau dokumen ini pernah terasa ketinggalan lagi.

## ER Diagram

```mermaid
erDiagram
    products ||--o{ product_batches : "punya"
    products ||--o{ bundle_recipes : "sebagai bundle"
    products ||--o{ bundle_recipes : "sebagai komponen"
    products ||--o{ order_items : "dipesan sebagai"
    products ||--o| product_stock_summary : "saldo cache"
    product_batches ||--o{ stock_ledger : "dicatat di"
    product_batches ||--o{ order_item_batch_allocations : "dialokasikan ke"
    product_batches ||--o{ opname_items : "dihitung di"
    product_batches ||--o| batch_stock_summary : "saldo cache"
    orders ||--o{ order_items : "berisi"
    orders ||--o{ returns : "diretur sebagai"
    order_items ||--o{ order_item_batch_allocations : "dialokasikan dari"
    order_items ||--o{ returns : "item yang diretur"
    opname_sessions ||--o{ opname_items : "berisi"
    profiles ||--o{ stock_ledger : "mencatat"
    profiles ||--o{ opname_sessions : "membuka"
    profiles ||--o{ returns : "menginspeksi"

    products {
        uuid id PK
        text sku "unik"
        text name
        boolean is_bundle
    }
    product_batches {
        uuid id PK
        uuid product_id FK
        text batch_code "unik per product_id"
        date expiry_date
    }
    bundle_recipes {
        uuid id PK
        uuid bundle_product_id FK
        uuid component_product_id FK
        integer qty_per_bundle
        integer version
        boolean is_active
    }
    stock_ledger {
        uuid id PK
        uuid batch_id FK
        text movement_type
        integer qty_delta
        text channel "nullable"
        text reason "nullable"
        text note "nullable"
        text campaign_reference "nullable"
        text reference_type
        uuid reference_id
        uuid created_by FK
        timestamptz created_at
    }
    batch_stock_summary {
        uuid batch_id PK_FK "cache, bukan sumber kebenaran"
        uuid product_id FK
        bigint current_qty
    }
    product_stock_summary {
        uuid product_id PK_FK "cache, bukan sumber kebenaran"
        bigint current_qty
    }
    orders {
        uuid id PK
        text channel
        text external_order_id "unik per channel"
        text status
        timestamptz shipped_at
    }
    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        integer qty
    }
    order_item_batch_allocations {
        uuid id PK
        uuid order_item_id FK
        uuid batch_id FK
        integer qty
    }
    returns {
        uuid id PK
        uuid order_id FK
        uuid order_item_id FK
        integer qty
        text condition
        text type "RETURN atau CANCELLATION"
        date claim_deadline
        uuid inspected_by FK
        timestamptz inspected_at
        text photo_url
        timestamptz created_at
    }
    opname_sessions {
        uuid id PK
        date session_date
        text status
        uuid created_by FK
        timestamptz closed_at
    }
    opname_items {
        uuid id PK
        uuid session_id FK
        uuid batch_id FK
        integer system_qty
        integer physical_qty
        integer variance "GENERATED, physical_qty - system_qty"
        text discrepancy_reason "nullable"
        text note
    }
    profiles {
        uuid id PK
        text full_name
        text role
    }
```

*(`profiles.id` juga mereferensikan `auth.users.id` milik Supabase Auth, tidak digambar di atas karena tabel itu ada di schema `auth`, bukan `public`.)*

## Tabel Inti

| Tabel | Fungsi |
|---|---|
| `products` | Master data produk. `is_bundle` menentukan apakah produk ini paket gabungan. |
| `product_batches` | Batch fisik per produk, punya tanggal kedaluwarsa sendiri-sendiri. |
| `bundle_recipes` | Resep komposisi bundle, 1 baris per komponen. Di-versioning (`version`/`is_active`), resep lama tetap ada tapi tidak aktif saat diedit, supaya order lama yang sudah terjadi tidak ikut berubah. |
| `stock_ledger` | **Satu-satunya sumber kebenaran stok.** Append-only, tidak bisa di-UPDATE/DELETE oleh siapa pun (termasuk lewat REST API langsung), ditegakkan di level database lewat REVOKE + trigger. Satu-satunya jalur tulis: 7 RPC function `SECURITY DEFINER`. Detail lengkap di `migrations/README.md` bagian "Yang sudah ditegakkan di level database". |
| `batch_stock_summary` / `product_stock_summary` | **Cache saldo, bukan sumber kebenaran.** Diisi otomatis oleh trigger setiap ada baris baru masuk ke `stock_ledger`, dipakai jalur baca yang sering dipanggil (alokasi FEFO, buka sesi opname, notifikasi kedaluwarsa) supaya tidak perlu menjumlah ulang seluruh ledger tiap kali. Selalu bisa diverifikasi ulang lewat view `v_batch_stock`/`v_product_stock` yang menghitung langsung dari `stock_ledger`. |
| `orders` / `order_items` | Pesanan dari marketplace (lewat tombol simulasi atau impor CSV, keduanya lewat satu service layer yang sama). |
| `order_item_batch_allocations` | Hasil alokasi FEFO, 1 order_item bisa kepecah ke beberapa batch. |
| `returns` | Pengajuan retur/pembatalan dan hasil inspeksi kondisinya. `type` membedakan retur biasa dari pembatalan pasca-kirim. |
| `opname_sessions` / `opname_items` | Sesi hitung stok fisik dan hasil per batch. `variance` kolom `GENERATED` (dihitung otomatis, tidak pernah bisa lupa diisi). |
| `profiles` | Profil user, dibuat otomatis saat signup lewat Supabase Auth. |

## Views (Turunan, Bukan Tabel Fisik)

Semua view ini menghitung langsung dari `stock_ledger` tiap kali di-query, tidak menyimpan angka statis. Bedanya dengan tabel cache di atas: view ini **lebih lambat tapi selalu benar-benar akurat**, dipakai di jalur yang jarang dipanggil (drilldown rekonsiliasi) atau sebagai alat verifikasi independen untuk membuktikan angka di tabel cache tidak melenceng.

| View | Fungsi |
|---|---|
| `v_batch_stock` | Stok saat ini per batch (`sum(qty_delta)` dari `stock_ledger`). Dipakai buat verifikasi ulang `batch_stock_summary`. |
| `v_product_stock` | Stok saat ini per produk. Sengaja tetap dipakai langsung di halaman drilldown rekonsiliasi (bukan cache), karena di situ justru angka hasil hitung ulang dari ledger yang paling bisa dipercaya. |
| `v_expiring_batches` | Batch dengan sisa waktu ≤ 90 hari sebelum kedaluwarsa dan masih ada stok. |
| `v_pending_tiktok_claims` | Retur TikTok yang klaim ke platform-nya belum diajukan, dihitung 40 hari sejak retur diajukan. |
| `v_daily_anomalies` | Deteksi 2 jenis kejanggalan: order `CANCELLED` yang ternyata masih punya ledger keluar, dan saldo batch yang jadi negatif. |
| `v_oversell_risk` | Produk dengan total pesanan `PENDING` melebihi stok yang benar-benar tersedia. |

## Alasan Desain Kunci

- **UUID sebagai primary key di semua tabel**, supaya ID bisa digenerate di sisi manapun (client atau server) tanpa perlu roundtrip ke database dulu, dan tidak menebak-nebak urutan data (beda dari auto-increment integer).
- **`stock_ledger.reference_type` + `reference_id` generik** (bukan foreign key literal ke banyak tabel), satu baris ledger bisa merujuk ke `order`, `return`, `opname_session`, atau `ledger_correction` tanpa perlu kolom FK terpisah untuk tiap kemungkinan sumber.
- **`stock_ledger.reason` dan `channel` dua kolom terpisah**, penjualan offline dan bonus sama-sama `channel=internal` atau `offline`, tapi `reason`-nya beda, supaya tidak tercampur maknanya walau sama-sama input manual.
- **Tidak ada kolom "current_qty" tersimpan di tabel `products` atau `product_batches`**, sengaja dihindari, supaya tidak ada kemungkinan angka itu "lupa disinkronkan" dengan ledger aslinya. `batch_stock_summary`/`product_stock_summary` memang menyimpan angka, tapi keduanya cuma cache yang dijaga trigger, bukan sumber kebenaran, dan selalu bisa dibuktikan ulang lewat view.
- **RLS dibatasi ke role `authenticated`** di seluruh tabel dan view (termasuk `security_invoker` di level view, supaya view tidak diam-diam bypass RLS tabel dasarnya).
