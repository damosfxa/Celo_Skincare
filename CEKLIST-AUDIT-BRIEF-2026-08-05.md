# Ceklist Audit Menyeluruh vs Brief

**Dibuat:** 2026-08-05 (setelah semua perbaikan hari ini: Task A, B, D, E selesai)
**Acuan:** `../Brief Bounty/stok-management-system.pdf` (Brief 1, 3 halaman) dan `../Brief Bounty/stok-management-system brief 2.pdf` (Sync Update Phase 2 v2, 13 Juni 2026)

Urutan mengikuti kedua dokumen brief persis, dari Brief 1 lalu Brief 2. Setiap baris sudah dicek langsung ke kode/database, bukan ditebak dari ingatan.

**Legenda:** ✅ sesuai · ⚠️ ada catatan (biasanya keputusan sadar, dijelaskan) · ❌ belum sesuai

---

## BRIEF 1: Brief Bounty Asli

### Bagian 2: Cakupan Fitur

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 1 | Data produk & batch, termasuk tanggal kedaluwarsa per batch | ✅ | `product_batches.expiry_date`, wajib diisi |
| 2 | Buku besar pergerakan stok, pusat dari segalanya | ✅ | `stock_ledger` append-only, satu-satunya sumber saldo |
| 3 | Pencatatan barang masuk dari maklon | ✅ | `fn_maklon_intake`, halaman Produk & Batch |
| 4 | Pencatatan keluar manual: offline, bonus, promo, sampel, rusak, kedaluwarsa | ✅ | `fn_manual_out`, 6 reason persis sesuai brief |
| 5 | Penerimaan data pesanan, pembatalan, retur dari Shopee & TikTok | ✅ | Tombol Simulasi + impor CSV, dua channel |
| 6 | Penanganan retur + pengingat klaim TikTok 40 hari | ✅ | `fn_inspect_return`, `v_pending_tiktok_claims`, dihitung sejak retur diajukan |
| 7 | Notifikasi barang mendekati kedaluwarsa, per batch | ✅ | `v_expiring_batches`, ambang 90 hari |
| 8 | Stok opname: input hitung fisik, banding catatan, koreksi | ✅ | Halaman Stok Opname, `ADJUSTMENT_OPNAME` |
| 9 | Rekonsiliasi: selisih + pergerakan pembentuknya, bisa di-drill | ✅ | Drilldown Produk, tampilkan alasan & referensi campaign (Task A, selesai hari ini) |

### Bagian 2: Dua Batasan Penting

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 10 | Tanpa integrasi API asli, diganti tombol simulasi, dirancang API tinggal gantikan tombol tanpa ubah logika inti | ✅ | Simulasi & impor CSV sama-sama panggil `createOrderWithItems`/service layer yang sama, bukan logika terpisah per tombol |
| 11 | Impor file tetap tersedia sebagai jalur masuk data | ✅ | Impor Pesanan Massal (CSV) di halaman Simulasi, `app/api/orders/import` |
| 12 | Tanpa pencatatan harga, murni jumlah barang | ✅ | Nol kolom harga/uang di seluruh skema |

### Bagian 3: Keputusan yang Sudah Disepakati Klien

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 13 | Barang dihitung keluar saat fisik keluar gudang: Shopee `SHIPPED`, TikTok `IN_TRANSIT` | ✅ | `fn_ship_order_item`, status dibedakan per channel |
| 14 | Alasan dan kanal dua hal terpisah | ✅ | Kolom `reason` dan `channel` terpisah, dua-duanya CHECK constraint |
| 15 | Alokasi batch otomatis FEFO, operator tidak pernah pilih batch | ✅ | `fn_allocate_fefo`, dicek: nol endpoint terima `batch_id` manual dari body |
| 16 | Bundle dihitung satuan, dipecah lewat resep admin | ✅ | `bundle_recipes`, di-versioning, order lama tidak berubah saat resep diedit |
| 17 | Dua ritme rekonsiliasi: harian (konsistensi sendiri) + opname (vs fisik) | ✅ | `v_daily_anomalies` (2 jenis) + Stok Opname |
| 18 | Kondisi retur diputuskan gudang manual, bukan otomatis dari marketplace | ✅ | `fn_inspect_return`, operator pilih Layak Jual/Rusak/Hilang sendiri |

### Bagian 4: Ketentuan & Penilaian

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 19 | Stack wajib: Next.js + TypeScript + Supabase (Postgres) | ✅ | `next@16.2.10`, `typescript@^5` strict, `@supabase/supabase-js`. Nol file `.js`/`.jsx` di kode aplikasi, nol `@ts-ignore` |
| 20 | Submission harus live, bukan mockup/video | ✅ | `https://stok-rekonsiliasi-skincare.vercel.app`, diverifikasi live berkali-kali hari ini sampai commit `082741c` |

**Urutan penilaian** (bukan checklist biner, tapi bobot prioritas review):
1. Logika stok benar & selisih bisa ditelusuri, **ini yang paling banyak disentuh hari ini** (ledger dikunci di DB, cache dipastikan akurat, alasan/referensi campaign ditampilkan)
2. Kelengkapan fitur sesuai Bagian 2, semua ✅ di atas
3. Kemudahan dipakai operator gudang, feedback 3 tester sudah ditindaklanjuti + Panduan diperluas + Modul 11 (daftar istilah)
4. Kualitas teknis, `npm run lint` sekarang 0 error (dari 84), lihat Task D di `task.md`

---

## BRIEF 2: Sync Update Phase 2

### Standar Hasil Akhir

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 21 | Fully working, zero-bug, tidak ada placeholder/TODO/tombol mati | ✅ | Nol `TODO`/placeholder ditemukan di audit; 1 bug nyata (kamera scanner) ditemukan & diperbaiki hari ini, terverifikasi di HP asli |
| 22 | Siap integrasi API asli, import layer sebagai adapter di belakang interface event | ✅ | Simulasi & impor CSV keduanya lewat service layer yang sama, logika inti (ledger, FEFO, order state machine) tidak tahu-menahu soal sumber datanya |

### Jawaban Pertanyaan Penting (6 poin)

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 23 | Countdown klaim TikTok 40 hari sejak retur diajukan, bukan sejak IN_TRANSIT/diterima | ✅ | `v_pending_tiktok_claims` pakai `returns.created_at` |
| 24 | Retur layak jual masuk batch baru bertanda "retur", bukan batch asal | ✅ | Prefix `RETUR-`/`BATAL-`, batch baru terpisah |
| 25 | Retur rusak/hilang tidak menulis movement stok kedua, tapi tetap tercatat untuk audit, status dipisah | ✅ | `IN_RETURN_SELLABLE` cuma untuk SELLABLE, DAMAGED/LOST tidak nulis ledger baru tapi status + foto tersimpan |
| 26 | Pembatalan & retur parsial per item didukung, bundle dihitung per satuan | ✅ | `order_item_id` di level retur, bundle sudah satuan sejak order dibuat |
| 27 | Stok awal perkiraan ditandai "belum terverifikasi" sampai opname pertama | ✅ | Opening balance, hilang dari daftar begitu batch itu pernah dihitung opname manapun |
| 28 | Sample stok record cuma contoh data, bukan skema wajib | ✅ | Skema dirancang sendiri, tidak meniru struktur spreadsheet sampel |

### Penambahan dari Review Aplikasi (3 poin)

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 29 | Sumber selisih ke-5 (salah input admin): "Koreksi Entri" terpisah dari "Penyesuaian Opname", dua-duanya entri ledger baru | ✅ | `fn_correct_ledger_entry` vs `ADJUSTMENT_OPNAME`, dicek: Koreksi Entri cuma bisa untuk `IN_MAKLON`/`OUT_MANUAL`, tidak bisa mengoreksi hasil opname |
| 30 | Layar konfirmasi sebelum commit untuk penulisan manual permanen | ✅ | Dicek ulang hari ini: dialog "Konfirmasi Mutasi Manual" (`simulation/page.tsx:607`) dan "Koreksi Entri Ledger" (`ledger/page.tsx:502`) masih ada setelah semua perubahan Gemini |
| 31 | Bonus/promo/sampel wajib referensi ringan (campaign/approval) | ✅ | `campaign_reference` wajib untuk 3 reason itu, 3 lapis (Zod, RPC, CHECK constraint), **dan sekarang tampil di halaman Ledger** (Task A, selesai hari ini) |

### Arah Teknis: Recap (11 poin)

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 32 | Stack: Next.js + TypeScript + Supabase (Postgres) | ✅ | Sama seperti #19 |
| 33 | Ledger append-only, saldo hasil agregasi, immutability dikunci di level DB (cabut UPDATE/DELETE + trigger), tulis lewat RPC | ✅ | `0123`+`0124`: REVOKE + 2 trigger penolak + 7 RPC `SECURITY DEFINER`, terverifikasi tes eksplisit menolak insert langsung (`code 42501`) |
| 34 | Performa: baca saldo O(1) via cache, bukan SUM full-scan tiap query | ✅ | `0125`: jalur panas (FEFO, buka opname, notifikasi kedaluwarsa) baca dari `batch_stock_summary`/`product_stock_summary`. Diverifikasi 0 selisih vs SUM asli sebelum dialihkan |
| 35 | Barang dihitung keluar saat SHIPPED/IN_TRANSIT, sebelum itu reservasi | ✅ | Sama seperti #13 |
| 36 | FEFO otomatis, operator tidak pernah pilih batch | ✅ | Sama seperti #15 |
| 37 | Bundle dipecah satuan lewat resep admin, di-versioning, order lama tidak berubah | ✅ | Sama seperti #16 |
| 38 | Channel dan reason dua kolom terpisah, enum sesuai daftar | ✅ | `channel`: shopee/tiktok/offline/internal; `reason`: offline/bonus/promo/sample/damaged/expired, dua-duanya CHECK constraint |
| 39 | Retur: kondisi diputuskan manual gudang | ✅ | Sama seperti #18 |
| 40 | Dua ritme rekonsiliasi (harian + opname) | ✅ | Sama seperti #17 |
| 41 | Reminder klaim TikTok 40 hari + notifikasi kedaluwarsa per batch | ✅ | Sama seperti #6, #7 |
| 42 | Tanpa harga/uang, murni kuantitas | ✅ | Sama seperti #12 |
| 43 | 1 role Admin, tidak ada sub-role, koreksi tidak butuh approval | ✅ | `profiles.role` selalu `'admin'`, nol logika approval di kode |
| 44 | Aplikasi live/deployed | ✅ | Sama seperti #20 |
| 45 | Idempotency + append-only di level DB penting | ✅ | Unique constraint `orders(channel, external_order_id)` + `products.sku`, ditangkap eksplisit di `createOrderWithItems` (kode 23505) |

### Scope & Default (5 poin)

| # | Tuntutan | Status | Bukti |
|---|---|---|---|
| 46 | Notifikasi in-app only, belum perlu email/WA | ✅ | Nol integrasi email/WA di seluruh kode |
| 47 | Reason code enum tetap, belum perlu admin-editable | ✅ | CHECK constraint tetap, tidak ada CRUD reason code |
| 48 | 1 gudang, skema boleh terbuka untuk multi-warehouse nanti tapi jangan dibangun sekarang | ✅ | Nol kolom `warehouse_id` di skema |
| 49 | Barcode scanner & cetak label batch = di luar scope | ⚠️ | **Sengaja dibangun** (scan QR kamera + cetak label). Keputusan sadar pemilik project untuk kemudahan operator gudang (penilaian #3 brief), bukan kelalaian. Dicatat di `task.md` "Keputusan Sadar" |
| 50 | Export CSV worklist/laporan boleh, nice-to-have, bukan penentu nilai | ✅ | Ada di halaman Ledger (sekarang termasuk kolom alasan & referensi campaign), tidak wajib ada di halaman lain |

---

## Ringkasan Angka

| Status | Jumlah |
|---|---|
| ✅ Sesuai | 49 dari 50 |
| ⚠️ Ada catatan (keputusan sadar, bukan kelalaian) | 1 dari 50 |
| ❌ Belum sesuai | 0 dari 50 |

**Tidak ada satu pun poin yang berstatus ❌.** Satu-satunya ⚠️ (poin 49, fitur QR) adalah penyimpangan yang disengaja dan beralasan, bukan gap yang belum dikerjakan, brief sendiri juga bilang "Ini arah yang disepakati, bukan harga mati, kalau kamu punya pendekatan yang menurutmu lebih baik, usulkan di aplikasimu beserta alasannya" (Brief 1, Bagian 3).

## Yang Perlu Dicek Manusia (di luar cakupan audit kode)

Ini bukan soal kode, jadi tidak bisa diverifikasi dari sini:

- **Kredensial testing untuk reviewer** sudah disiapkan terpisah dari repo publik (`README.md` menyebutnya, isinya sendiri tidak bisa kucek karena memang tidak boleh ada di repo)
- **Data uji coba di database asli** (batch `TES-0124-001`, dll) masih ada, kecil dan aman tapi tetap data buatan, bukan data asli toko

## Dokumen Terkait

- `task.md`, status tugas aktif & keputusan sadar lengkap dengan alasannya
- `CATATAN-KERJA-AUDIT-2026-08-05.md`, narasi lengkap proses audit pertama (Temuan A-D, migration `0123`-`0125`)
- `migrations/README.md`, urutan lengkap 26 file migration & apa yang ditegakkan di level database
- `database-schema.md`, skema database terkini (diperbarui hari ini)
