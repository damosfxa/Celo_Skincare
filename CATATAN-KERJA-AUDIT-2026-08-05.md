# Catatan Kerja — Audit Menyeluruh vs Brief (2026-08-05)

Dokumen ini dibuat supaya sesi kerja berikutnya (siapa pun, manusia atau AI) **tidak perlu mengulang audit dari nol**. Isinya: apa yang diperiksa, apa yang ditemukan, apa yang sudah dikerjakan, apa yang masih tersisa, dan keputusan desain mana yang **sengaja** diambil supaya tidak "diperbaiki" balik oleh sesi berikutnya.

Acuan yang dipakai: `../Brief Bounty/stok-management-system.pdf` (brief asli) dan `../Brief Bounty/stok-management-system brief 2.pdf` (Sync Update Phase 2, v2, 13 Juni 2026). Sync Update adalah yang mengikat kalau ada beda dengan brief awal.

---

## BAGIAN 1 — YANG PALING PENTING: URUTAN MENJALANKAN MIGRATION

Ada **3 file migration baru** yang belum dijalankan ke database. Urutannya tidak boleh dibalik.

| Urut | File | Database TES | Database ASLI |
|---|---|---|---|
| 1 | `migrations/0123_harden_ledger_write_path.sql` | ✅ Sudah | ✅ Sudah |
| 2 | `migrations/0124_lock_ledger_immutability.sql` | ✅ Sudah | ✅ Sudah |
| 3 | `migrations/0125_read_balance_from_cache.sql` | ✅ Sudah | ✅ Sudah |

**SEMUA MIGRATION TEMUAN A-D SUDAH SELESAI DIJALANKAN** (per 2026-08-05), di kedua database, dan tervalidasi 3 lapis:
1. Tes otomatis (`npm test`, 28/28, dijalankan berulang kali di database TES setelah tiap migration)
2. Validasi tangan langsung di aplikasi (`npm run dev` tersambung ke database ASLI) untuk 3 alur inti: Barang Masuk, Kirim Order, Keluar Manual -- semua lancar setelah `0124` mengunci
3. Pemeriksaan angka stok manual setelah `0125`: Total Stok & rincian per batch (`89+79+1=169`) terbukti tidak berubah walau sumber baca datanya sudah dialihkan ke cache

Pola kerja yang dipakai dan terbukti bagus: **jalankan dulu di database TES → `npm test` → baru ke database ASLI.** Cara ini yang menangkap dua kegagalan tes di langkah `0124` sebelum sempat menyentuh data sungguhan.

**Kenapa urutan 0123 → 0124 wajib:** 0123 memberi ketujuh fungsi penulis ledger hak akses khusus (`SECURITY DEFINER`). 0124 baru mencabut hak tulis langsung dari user biasa. Kalau 0124 jalan duluan, **semua fitur yang menulis stok akan mati** — barang masuk, kirim order, keluar manual, inspeksi retur, tutup opname, semuanya.

**Cara aman menjalankan** (satu per satu, jangan sekaligus):

1. Jalankan `0123` di Supabase SQL Editor.
2. **Tes aplikasi dulu**: coba barang masuk maklon, kirim 1 order simulasi, keluar manual. Pastikan semua masih normal.
3. Kalau normal, jalankan `0124`.
4. **Tes lagi hal yang sama.** Kalau ada yang error di langkah ini, artinya ada jalur tulis yang terlewat — laporkan errornya, jangan dipaksa.
5. Jalankan `0125`.
6. Tes: buka halaman Produk (angka stok harus sama seperti sebelumnya), buka halaman utama, buka Notifikasi, dan buka satu sesi Stok Opname baru (angka "system_qty"-nya harus benar).

Ketiga file aman dijalankan ulang kalau ragu (pakai `IF EXISTS` / `CREATE OR REPLACE`), tapi tetap **jangan lompati urutannya**.

Semua file di atas cuma ditampilkan sebagai file — sesuai aturan `CLAUDE.md`, tidak ada migration yang dieksekusi otomatis ke database.

---

## BAGIAN 2 — TEMUAN & PERBAIKANNYA

### Temuan A: Immutability ledger belum dikunci di level database

**Apa masalahnya.** Sync Update Phase 2 menulis eksplisit: *"Immutability dikunci di level DB (cabut UPDATE/DELETE + trigger), tulis lewat RPC / Server Action."* Kenyataannya sebelum perbaikan ini: tidak ada `REVOKE`, tidak ada trigger. Satu-satunya penahan adalah ketiadaan policy RLS untuk UPDATE/DELETE (default-deny Postgres). Itu memang menahan, tapi bukan dua hal yang brief sebut namanya.

Lebih parah: policy `insert_ledger` (`0104:62`) memakai `with check (true)`. Artinya siapa pun yang punya sesi login bisa menyuntik baris ledger langsung lewat REST API Supabase — **melewati seluruh validasi bisnis**: alokasi FEFO, wajib catatan, wajib referensi campaign, wajib foto write-off.

**Perbaikan:** `0124` — `REVOKE INSERT, UPDATE, DELETE ON stock_ledger FROM anon, authenticated`, hapus policy `insert_ledger`, plus dua trigger penolak (`trg_block_ledger_update`, `trg_block_ledger_delete`) sebagai lapis kedua untuk jalur yang tidak tunduk pada GRANT/RLS (service_role, SQL Editor, koneksi langsung).

`SELECT` sengaja **tidak** dicabut — halaman Ledger, drilldown, dan dashboard tetap harus bisa membaca.

### Temuan B: Ketujuh RPC penulis ledger tidak punya `SECURITY DEFINER`

**Apa masalahnya.** Komentar di `0104:7-9` mengklaim *"satu-satunya jalan mengubah/menghapus baris adalah lewat RPC function yang SECURITY DEFINER"*. Klaim itu **tidak benar**. Dicek satu per satu, nol dari tujuh fungsi punya klausa itu:

`fn_ship_order_item` (0102:45), `fn_manual_out` (0108:29), `fn_maklon_intake` (0116:15), `fn_opening_balance_intake` (0114:20), `fn_correct_ledger_entry` (0107:121), `fn_inspect_return` (0119:7), `fn_close_opname_session` (0110:14).

Ini juga yang membuat Temuan A tidak bisa langsung diperbaiki: mencabut izin tulis tanpa memberi RPC hak khusus lebih dulu = mematikan semua fitur.

**Perbaikan:** `0123` — tambahkan `SECURITY DEFINER` + `SET search_path TO 'public'` ke ketujuhnya, mengikuti pola yang sudah dipakai `fn_save_bundle_recipe` (0102:159) dan `fn_handle_new_user` (0102:238).

**Isi/logika ketujuh fungsi tidak diubah sama sekali** — disalin persis dari versi terakhir masing-masing, cuma ditambah dua baris klausa keamanan. Signature juga tidak berubah, jadi tidak terbentuk overload baru (pelajaran dari `0113`).

### Temuan C: Dua celah bypass validasi

**C-1. Kolom `channel` tidak punya CHECK constraint.** Sync Update menyebut channel sebagai enum tetap (`shopee`/`tiktok`/`offline`/`internal`), tapi kolomnya bebas diisi apa saja di level database — beda dengan kolom `reason` yang sudah dikunci sejak `0105:44-48`.
→ Diperbaiki di `0123`, lengkap dengan pengecekan data lama dulu (kalau ada nilai di luar daftar, migration berhenti dengan pesan jelas alih-alih error mentah).

**C-2. Wajib-foto write-off bisa dilewati.** Policy `update_returns` (`0104:110-111`) memakai `for update using (true)` **tanpa** klausa `with check`. Artinya siapa pun yang login bisa meng-UPDATE baris `returns` langsung lewat REST API — termasuk menetapkan `condition = 'DAMAGED'`/`'LOST'` tanpa foto bukti, melewati validasi di `fn_inspect_return` (`0119:35-38`) yang dibuat justru karena write-off tanpa bukti adalah lubang akuntansi.
→ Diperbaiki di `0124`: `REVOKE UPDATE ON returns` + hapus policy tersebut. Aman karena tidak ada satu pun `.update()` ke tabel `returns` di seluruh `app/` dan `src/` (sudah di-grep); satu-satunya penulis kolom itu adalah `fn_inspect_return`, yang sejak `0123` sudah `SECURITY DEFINER`. INSERT tetap dibiarkan karena pengajuan retur baru memang ditulis dari service layer, dan saat itu `condition` selalu `PENDING_INSPECTION`.

### Temuan D: Baca saldo masih SUM full-scan, tabel cache tidak pernah dipakai

**Apa masalahnya.** Sync Update: *"baca saldo harus cepat — idealnya O(1) via summary/cache yang di-maintain dari ledger; jangan SUM full-scan tiap query (ledger akan tumbuh jutaan baris)."*

Tabel cache-nya **sudah ada** sejak `0107` (`batch_stock_summary`, `product_stock_summary`) dan sudah dijaga trigger `trg_update_stock_summary`. Tapi hampir tidak ada yang membacanya — jalur baca saldo yang benar-benar dipakai masih lewat view `v_batch_stock` / `v_product_stock`, yang isinya `sum(qty_delta) group by ...`, alias menjumlah ulang seluruh tabel ledger setiap kali dipanggil.

**Yang paling berbahaya ternyata bukan di kode aplikasi, tapi di dalam database** — ini baru ketahuan setelah menyisir isi migration, bukan dari daftar temuan awal:

- `fn_allocate_fefo` (`0102:26`) — dipanggil **setiap kali barang keluar** (kirim order + keluar manual). Jadi tiap pengiriman memicu full-scan ledger.
- `fn_open_opname_session` (`0102:192`) — full-scan untuk semua batch sekaligus saat sesi opname dibuka.
- View `v_expiring_batches` (`0101:39`) — ikut menyeret full-scan, dan view ini dibaca setiap kali halaman utama dan halaman Notifikasi dibuka.

**Verifikasi keamanan sebelum dialihkan.** Cache diisi trigger yang cuma jalan `AFTER INSERT` — baris ledger yang sudah ada *sebelum* trigger dipasang tidak akan terhitung. Kalau ada selisih dan API terlanjur dialihkan, angka stok yang tampil ke operator jadi salah tanpa ada yang sadar. Maka dibuat dulu `migrations/diagnostic-verify-stock-summary-cache-2026-08-05.sql` (read-only).

Hasil dijalankan 2026-08-05 — **semua AMAN**:

| Pemeriksaan | Hasil |
|---|---|
| Selisih saldo per batch (cache vs SUM ledger) | tidak ada |
| Selisih saldo per produk | tidak ada |
| Total qty cache vs ledger | 170 = 170 |
| Jumlah baris cache batch vs batch unik di ledger | 2 = 2 |
| Trigger `trg_update_stock_summary` | aktif |

(Total baris ledger saat itu: 23. Datanya kecil karena data uji QA sudah dibersihkan — jadi hasil "0 selisih" ini valid tapi belum teruji pada volume besar.)

**Perbaikan:**
- Sisi database → `0125`: `fn_allocate_fefo`, `fn_open_opname_session`, dan `v_expiring_batches` dialihkan ke `batch_stock_summary`.
- Sisi aplikasi → 3 file API dialihkan ke tabel cache:
  - `app/api/products/route.ts` → `product_stock_summary`
  - `app/api/products/[id]/route.ts` → `batch_stock_summary`
  - `app/api/batches/intake/route.ts` → `batch_stock_summary`

Nama kolom di tabel cache sama persis dengan di view, jadi bentuk data yang dikirim ke frontend **tidak berubah sama sekali** — tidak ada yang perlu disesuaikan di sisi Gemini.

---

## BAGIAN 3 — KEPUTUSAN YANG SENGAJA DIAMBIL (JANGAN DIBALIK TANPA ALASAN)

Bagian ini penting. Hal-hal di bawah ini **kelihatan seperti belum selesai, padahal disengaja.**

1. **`v_batch_stock` dan `v_product_stock` sengaja dibiarkan tetap SUM murni dari ledger.**
   Keduanya sekarang berfungsi sebagai alat pembanding independen untuk membuktikan angka cache masih benar — persis syarat brief *"asalkan saldo selalu bisa diverifikasi ulang dari ledger"*. Kalau keduanya ikut dialihkan ke cache, tidak ada lagi sumber pembanding, dan cache yang melenceng tidak akan pernah ketahuan.

2. **`app/api/reconciliation/drilldown/route.ts` sengaja tetap membaca `v_product_stock`, bukan cache.**
   Itu halaman penelusuran selisih. Justru di situ angka yang dihitung ulang langsung dari ledger yang paling bisa dipercaya. Bukan jalur panas (dibuka sesekali saat investigasi), jadi biaya SUM-nya bisa diterima.

3. **Fitur QR / cetak label batch sengaja dipertahankan** walau Sync Update menyebut "barcode scanner & cetak label batch = di luar scope".
   Ini keputusan sadar pemilik project: fitur itu dibuat untuk kemudahan operator gudang saat Stok Opname, dan brief menempatkan *"kemudahan pakai untuk operator gudang"* sebagai kriteria penilaian nomor dua. Sudah dibangun penuh dan dipakai, bukan setengah jadi. **Jangan dihapus.**

4. **Trigger penolak di `0124` juga berlaku untuk RPC `SECURITY DEFINER` — dan itu disengaja.**
   Sudah dicek satu per satu: tidak ada satu pun dari ketujuh RPC yang melakukan UPDATE/DELETE ke `stock_ledger`. Koreksi selalu berupa entri **baru** (`ADJUSTMENT_CORRECTION` / `ADJUSTMENT_OPNAME`). Jadi trigger ini tidak memutus jalur mana pun yang ada.

---

## BAGIAN 4 — HASIL AUDIT YANG SUDAH SESUAI BRIEF (tidak perlu diaudit ulang)

Diperiksa dengan bukti `file:baris`, semuanya **sudah benar**:

- Barang dihitung keluar tepat saat `SHIPPED` (Shopee) / `IN_TRANSIT` (TikTok); sebelum itu murni reservasi, tidak menyentuh ledger.
- Batal sebelum shipped = lepas reservasi tanpa entri ledger; batal sesudah shipped = entri reversal baru (`IN_CANCEL_REVERSAL`), bukan edit/hapus.
- FEFO otomatis, `order by expiry_date asc`. Tidak ada satu pun endpoint stock-out yang menerima `batch_id` pilihan manual.
- Bundle dipecah ke satuan lewat resep saat order dibuat; komposisi dibekukan di `order_items`, jadi order lama tidak berubah saat resep diedit.
- `channel` dan `reason` dua kolom terpisah, enum sesuai daftar brief.
- Lapisan simulasi/import benar-benar satu adapter di belakang service layer bersama (`src/lib/services/orders.ts`) — kelima entrypoint memanggil fungsi yang sama, tidak ada logika bisnis yang diduplikasi per tombol. Ini yang dituntut Sync Update sebagai "kesiapan nyata di arsitektur, bukan sekadar klaim".
- Murni kuantitas, tidak ada satu pun kolom harga/uang di seluruh skema.
- Retur layak jual → batch baru bertanda `RETUR-`/`BATAL-`, bukan batch asal.
- Retur rusak/hilang → tidak ada movement stok kedua (hindari double-count), tetap tercatat untuk audit, dan `LOST` terpisah dari `DAMAGED`.
- Retur parsial per item didukung; bundle sudah dalam bentuk satuan sejak order dibuat.
- Countdown klaim TikTok 40 hari dihitung sejak retur diajukan (`created_at`), bukan sejak IN_TRANSIT.
- "Koreksi Entri" = entri ledger baru, dan sengaja tidak bisa dipakai mengoreksi `ADJUSTMENT_OPNAME` — pemisahan dari "Penyesuaian Opname" terjaga.
- Referensi campaign wajib untuk `bonus`/`promo`/`sample`, ditegakkan di tiga lapis (Zod, RPC, CHECK constraint DB).
- Koreksi opname = entri ledger baru bertaut `session_id`.
- Opening balance bertanda "belum terverifikasi", otomatis hilang dari daftar setelah batch itu dihitung fisik di opname mana pun.
- Notifikasi kedaluwarsa benar per batch, ambang 90 hari.
- Notifikasi in-app saja — tidak ada email/WA sama sekali di seluruh codebase.
- 1 role Admin, tanpa approval workflow. 1 gudang (tidak ada kolom warehouse sama sekali).
- Reason code enum tetap, tidak ada CRUD admin-editable.
- Layar konfirmasi sebelum commit untuk stock-out manual — dialog "Konfirmasi Mutasi Manual" di frontend menampilkan produk, qty, alasan, dan dampak ke stok sebelum tombol final. Dikonfirmasi lewat pengujian langsung 2026-08-05 (lihat Bagian "Validasi manual" di atas).

---

## BAGIAN 5 — YANG MASIH TERSISA

Status per 2026-08-05, setelah `0123`/`0124`/`0125` selesai di kedua database dan divalidasi 3 lapis (lihat Bagian 1 & "Validasi manual" di bawah).

### Selesai (dulu di daftar ini, sekarang sudah tidak)

- ~~Jalankan `0123`→`0124`→`0125`~~ — **selesai**, kedua database.
- ~~Validasi fungsional langsung di aplikasi~~ — **selesai**, 3 alur inti dicoba tangan sendiri di aplikasi asli (lihat "Validasi manual" di bawah).
- ~~`migrations/README.md` basi~~ — **selesai**, sudah ditulis ulang, sekarang mendata seluruh `0100`–`0125` plus daftar apa saja yang sudah ditegakkan di level database.

### Selesai (lanjutan)

- ~~Cek ulang deploy~~ -- **selesai**. Commit `e6c2b01` di-push ke `origin/main`, Vercel deploy status `Ready`, diverifikasi live di `https://stok-rekonsiliasi-skincare.vercel.app`: stok Serum Vitamin C 30ml tetap 169, breakdown per batch normal. Kode yang baru (termasuk 3 file API pembaca cache dari Temuan D) sudah benar-benar live, bukan cuma ter-push.

### Masih perlu dilakukan user (opsional, tidak mendesak)

1. **Bersihkan (atau biarkan) jejak data tes** yang tercipta di database ASLI selama validasi manual:
   - Batch `TES-0124-001` (Serum Vitamin C 30ml, +1 pcs, IN_MAKLON)
   - 1 order simulasi TikTok berstatus IN_TRANSIT (-1 pcs, OUT_SALE_MARKETPLACE)
   - 1 entri keluar manual reason "offline", catatan "tes kunci ledger" (-1 pcs, OUT_MANUAL)

   Semuanya kecil (total net -1 pcs) dan tertandai jelas sebagai data tes, jadi aman dibiarkan. Kalau mau rapi, bisa dihapus jejaknya lewat **Koreksi Entri** di halaman Ledger (cari 3 entri itu, koreksi masing-masing supaya net effect-nya nol) -- bukan migration, cukup lewat UI seperti operator biasa.
2. **Kasih `FEEDBACK-UI-UNTUK-GEMINI.md` ke Gemini/Antigravity.** Sudah selesai ditulis di sesi ini, tinggal langkah kamu meneruskannya -- di luar wilayah kerja backend.

---

## Perbaikan file tes saat menjalankan `0124` (2026-08-05)

Saat `0124` diuji di database TES, 2 dari 28 tes gagal. **Keduanya masalah di file tesnya, bukan di sistem** — sudah diperbaiki, sekarang 28/28 lulus (dikonfirmasi 3 kali berturut-turut supaya bukan kebetulan timing).

**1. `tests/cancellation-and-anomaly.test.ts` — "Batch dengan saldo minus"**
Tes ini sengaja menulis langsung ke `stock_ledger` (di luar RPC) untuk memalsukan kondisi rusak, supaya bisa menguji deteksi anomali. `0124` membuat jalan pintas itu tertutup — error `42501 permission denied`. Jadi tesnya gagal justru karena penguncian berhasil.

Perbaikan: kondisi rusaknya sekarang dibuat lewat `getAdminClient()` (service-role, helper baru di `tests/helpers/client.ts`). **Ditambah assertion baru** yang membuktikan role `authenticated` memang ditolak (`code 42501`) — jadi kalau suatu hari ada yang tidak sengaja mengembalikan GRANT-nya, tes ini langsung gagal. Penguncian `0124` sekarang dijaga oleh tes, bukan cuma oleh niat baik.

**2. `tests/correction.test.ts` — "Koreksi entri IN_MAKLON"**
Sama sekali tidak berhubungan dengan `0124` — lulus 4/4 kalau dijalankan sendirian. Cacat lama: query mencari "entri `IN_MAKLON` paling baru" **secara global tanpa menyaring produk**. File tes jalan paralel, jadi bisa salah ambil milik tes lain. Selama ini tertutup keberuntungan timing; perubahan kecepatan gagal-nya insert di `0124` yang membuatnya muncul.

Perbaikan: 3 query di file itu disaring `.eq("batch_id", batchId)`. Satu batch cuma punya satu entri `IN_MAKLON`, jadi deterministik.

**Pelajaran untuk sesi berikutnya:** kalau tes gagal setelah migration, **jalankan file tesnya sendirian dulu** sebelum menyimpulkan migration-nya bermasalah. Beda hasil antara "jalan sendirian" vs "jalan barengan" langsung menunjuk ke masalah isolasi tes, bukan ke kode produksi.

## Validasi manual di aplikasi ASLI setelah `0124` (2026-08-05)

Selain 28 tes otomatis (jalan di database TES), user juga mencoba 3 alur inti langsung di aplikasi lokal (`npm run dev`, tersambung ke database ASLI) setelah `0124` diterapkan ke sana. Ketiganya **berhasil**:

1. **Barang Masuk (Maklon)** — stok Serum Vitamin C 30ml bertambah dari 171 (sebelumnya sempat 170) — konsisten, tidak ada penolakan dari kunci `0124`.
2. **Kirim Order (Simulasi, channel TikTok)** — status order berubah jadi `IN_TRANSIT` (benar, sesuai aturan: Shopee->SHIPPED, TikTok->IN_TRANSIT), notifikasi "Alokasi FEFO berjalan".
3. **Keluar Manual (Penjualan Offline)** — lewat layar konfirmasi dulu (lihat temuan di bawah), berhasil tercatat.

**Temuan tambahan, menjawab pertanyaan terbuka di Bagian 5 poin 4:** brief minta layar konfirmasi/preview sebelum commit untuk stock-out manual (menampilkan produk, qty, reason, dan dampak ke stok). **Sudah ada di frontend** — terkonfirmasi lewat dialog "Konfirmasi Mutasi Manual" yang muncul sebelum submit, isinya persis sesuai brief: Produk, Kuantitas ("Keluar 1 pcs"), Alasan/Catatan, dan Dampak Stok ("170 → 169"). Backend memang tidak punya endpoint `dry_run` terpisah (seperti dicatat sebelumnya), tapi ternyata **tidak perlu** — frontend menghitung preview-nya sendiri dari data yang sudah dimuat, baru memanggil API sekalinya user konfirmasi. **Poin 4 di Bagian 5 (Belum Dikerjakan) di bawah sudah tidak berlaku, dipindah ke daftar "sudah sesuai brief".**

## Verifikasi yang sudah dilakukan di sesi ini

- `npm run build` — **berhasil**, tanpa error TypeScript:
  ```
  ✓ Compiled successfully in 11.5s
    Running TypeScript ...
    Finished TypeScript in 15.6s ...
  ✓ Generating static pages using 7 workers (30/30) in 991ms
  ```
- Query diagnostic konsistensi cache — semua `AMAN` (detail di Temuan D).
- Grep menyeluruh memastikan tidak ada lagi jalur baca saldo lewat view di jalur panas, dan tidak ada `.update()` langsung ke tabel `returns` di seluruh `app/` dan `src/`.

**Yang belum diverifikasi:** perilaku aplikasi setelah ketiga migration benar-benar dijalankan. Build sukses hanya membuktikan kodenya sah secara TypeScript, bukan bahwa alur stoknya masih benar.
