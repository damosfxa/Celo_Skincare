# PRD, Sistem Rekonsiliasi Stok (Celo Beaute)

Dokumen ini memetakan kebutuhan dari brief ke implementasi. Ringkas dan berjejak: tiap requirement jelas asalnya (Brief 1 / Sync Update Phase 2). Untuk desain teknis lihat `architecture.md`, struktur data `database-schema.md`, alur `workflow.md`.

## Masalah

Brand skincare (~70 produk maklon) berjualan di Shopee & TikTok Shop dengan ratusan paket keluar/hari dan retur tinggi. Pencatatan stok berbasis spreadsheet manual, dan angka di catatan hampir tidak pernah cocok dengan fisik gudang. Yang lebih parah: tidak ada yang bisa menjawab selisihnya bocor di mana. Sumber kebocoran: pesanan batal yang stoknya tak dikembalikan, retur dengan berbagai nasib, bonus/promo/sampel yang keluar tanpa terhubung ke pesanan (sumber selisih terbesar), dan stok awal yang masih perkiraan.

## Tujuan (diturunkan dari urutan penilaian brief)

1. Logika stok benar dan setiap selisih bisa ditelusuri sampai penyebabnya (prioritas tertinggi, "satu angka salah = sistem gagal").
2. Kelengkapan fitur sesuai cakupan brief Bagian 2.
3. Mudah dipakai operator gudang non-teknis.
4. Kualitas teknis: kode rapi, deploy stabil, aman.

## Target pengguna

1 role: Admin (operator gudang / pemilik). Tidak ada sub-role, tidak ada approval berlapis. Yang memakai bukan developer.

## Functional Requirements (berjejak ke brief)

| Kode | Requirement | Asal | Status |
|---|---|---|---|
| FR-1 | Data produk & batch, termasuk kedaluwarsa per batch | Brief 1 Bagian 2 | Selesai |
| FR-2 | Ledger pergerakan stok append-only sebagai pusat | Brief 1 Bagian 2 | Selesai |
| FR-3 | Barang masuk maklon | Brief 1 Bagian 2 | Selesai |
| FR-4 | Keluar manual: offline/bonus/promo/sampel/rusak/kedaluwarsa | Brief 1 Bagian 2 | Selesai |
| FR-5 | Terima pesanan/pembatalan/retur Shopee & TikTok (simulasi + CSV) | Brief 1 Bagian 2 | Selesai |
| FR-6 | Penanganan retur + kondisi + pengingat klaim TikTok 40 hari | Brief 1 Bagian 2 | Selesai |
| FR-7 | Notifikasi kedaluwarsa per batch | Brief 1 Bagian 2 | Selesai |
| FR-8 | Stok opname: input fisik, banding catatan, koreksi | Brief 1 Bagian 2 | Selesai |
| FR-9 | Rekonsiliasi: tampilkan selisih + drilldown ke pergerakan pembentuk | Brief 1 Bagian 2 | Selesai |
| FR-10 | Barang keluar saat SHIPPED (Shopee) / IN_TRANSIT (TikTok), sebelumnya reservasi | Brief 1 Bagian 3 | Selesai |
| FR-11 | Reason dan channel dua kolom terpisah | Brief 1 Bagian 3 | Selesai |
| FR-12 | Alokasi batch otomatis FEFO, operator tak pilih batch | Brief 1 Bagian 3 | Selesai |
| FR-13 | Bundle dipecah satuan lewat resep admin (versioning) | Brief 1 Bagian 3 | Selesai |
| FR-14 | Dua ritme rekonsiliasi: harian (anomali) + opname | Brief 1 Bagian 3 | Selesai |
| FR-15 | Kondisi retur diputuskan gudang manual | Brief 1 Bagian 3 | Selesai |
| FR-16 | Klaim TikTok 40 hari dihitung sejak retur diajukan | Sync Update #1 | Selesai |
| FR-17 | Retur layak jual masuk batch baru bertanda RETUR/BATAL | Sync Update #2 | Selesai |
| FR-18 | Retur rusak/hilang tanpa movement kedua, status dipisah, wajib foto | Sync Update #3 | Selesai |
| FR-19 | Pembatalan & retur parsial per item, bundle per satuan | Sync Update #4 | Selesai |
| FR-20 | Opening balance bertanda "belum terverifikasi" sampai opname | Sync Update #5 | Selesai |
| FR-21 | Koreksi Entri (salah input admin) terpisah dari opname, entri baru | Sync Update review | Selesai |
| FR-22 | Layar konfirmasi sebelum commit penulisan manual permanen | Sync Update review | Selesai |
| FR-23 | Bonus/promo/sampel wajib referensi campaign/approval | Sync Update review | Selesai |

## Non-Functional Requirements

| Kode | Requirement | Asal |
|---|---|---|
| NFR-1 | Fully working, zero-bug, tanpa placeholder/TODO/tombol mati | Sync Update, Standar Hasil Akhir |
| NFR-2 | Immutability ledger dikunci di level DB (cabut UPDATE/DELETE + trigger), tulis lewat RPC | Sync Update, Arah Teknis |
| NFR-3 | Baca saldo O(1) via cache, tetap bisa diverifikasi ulang dari ledger | Sync Update, Arah Teknis |
| NFR-4 | Idempotency di level DB (unique constraint), aman untuk retry webhook | Sync Update, Arah Teknis |
| NFR-5 | Arsitektur siap disambung webhook asli tanpa ubah logika inti | Sync Update, Standar Hasil Akhir |
| NFR-6 | Keamanan: RLS authenticated-only, tanpa jalur akses tanpa login | Stack Supabase + audit sendiri |
| NFR-7 | Stack: Next.js + TypeScript + Supabase, live/ter-deploy | Brief 1 Bagian 4 |
| NFR-8 | Mudah dipakai operator non-teknis, responsif semua device | Brief 1 Bagian 4 #3 |
| NFR-9 | Automated test untuk logika inti | Turunan dari "satu angka salah = gagal" |

## Di luar scope (sesuai brief)

- Integrasi API/webhook marketplace asli (diganti simulasi + CSV; arsitektur disiapkan siap sambung).
- Pencatatan harga/nilai uang (murni kuantitas).
- Multi-warehouse (skema dibiarkan terbuka, tidak dibangun sekarang).
- Notifikasi email/WA (in-app only).
- Reason code admin-editable (enum tetap).

## Catatan penyimpangan sadar

- Scan QR & cetak label batch disebut brief "di luar scope", tapi sengaja dibangun untuk kemudahan operator saat Stok Opname (menguatkan penilaian #3). Bukan kelalaian; brief membolehkan usul pendekatan sendiri beserta alasannya.
- Export CSV disediakan di halaman Ledger sebagai nice-to-have (brief menyebutnya boleh, bukan penentu nilai).
