# TASK — Sisa Pekerjaan Menuju Submission

Dibuat 2026-08-05, setelah audit ulang menyeluruh terhadap **kedua brief dibaca utuh**: `stok-management-system.pdf` (brief asli, 3 halaman) dan `stok-management-system brief 2.pdf` (Sync Update Phase 2 v2, 13 Juni 2026).

Dokumen pendamping:
- `CATATAN-KERJA-AUDIT-2026-08-05.md` — detail apa yang sudah dikerjakan & kenapa (baca ini dulu kalau baru masuk ke project)
- `FEEDBACK-UI-UNTUK-GEMINI.md` — feedback UI dari 3 tester
- `migrations/README.md` — daftar lengkap migration `0100`–`0125`

---

## RINGKASAN: posisi sekarang

Audit ulang menyeluruh sudah dijalankan terhadap **seluruh isi kedua brief**, poin per poin, dengan bukti `file:baris`. Hasilnya:

**Semua tuntutan brief sudah terpenuhi.** Task A (satu-satunya gap yang ditemukan) sudah dikerjakan Gemini dan diverifikasi independen 2026-08-05 (build sungguhan + 28/28 tes lulus, bukan cuma percaya laporan).

Yang sudah diverifikasi ulang hari ini dan terbukti benar — tidak perlu diaudit lagi:

- Ledger append-only, dikunci di level DB (REVOKE + 2 trigger), semua tulisan wajib lewat 7 RPC `SECURITY DEFINER`
- Baca saldo O(1) dari tabel cache di semua jalur panas (FEFO, buka opname, notifikasi kedaluwarsa)
- Barang keluar saat SHIPPED (Shopee) / IN_TRANSIT (TikTok), sebelumnya cuma reservasi
- Batal sebelum shipped = lepas reservasi; sesudah shipped = entri reversal baru
- FEFO otomatis, tidak ada endpoint manapun yang menerima pilihan batch manual
- Bundle dipecah ke satuan lewat resep admin, resep di-versioning, order lama tidak berubah
- Channel & reason dua kolom terpisah, dua-duanya dikunci CHECK constraint
- Retur: kondisi diputuskan manual gudang; layak jual masuk batch baru; rusak/hilang tidak menulis movement kedua; parsial per item didukung
- Klaim TikTok 40 hari dihitung sejak retur diajukan
- Koreksi Entri terpisah dari Penyesuaian Opname, dua-duanya entri ledger baru
- Referensi campaign wajib untuk bonus/promo/sample (3 lapis: Zod, RPC, CHECK constraint)
- Layar konfirmasi sebelum commit — **ada di kedua jalur** (Keluar Manual & Koreksi Entri), menampilkan produk, qty, alasan, dan dampak ke stok
- Opening balance bertanda belum-terverifikasi sampai opname pertama
- Dua ritme rekonsiliasi (harian + opname), drilldown ke entri ledger pembentuk selisih
- Notifikasi kedaluwarsa per batch, in-app only (tidak ada email/WA sama sekali)
- 1 role Admin, 1 gudang, reason code enum tetap
- Murni kuantitas, tidak ada satu pun kolom harga di seluruh skema
- Import CSV tersedia sebagai jalur masuk data terpisah, memakai service layer yang sama dengan tombol simulasi
- Tidak ada TODO/placeholder/tombol mati di seluruh `app/` dan `src/`
- Stack sesuai: Next.js 16.2.10 + TypeScript 5 + Supabase
- Aplikasi live & ter-deploy (commit `e6c2b01`, terverifikasi manual)

Verifikasi migration hari ini (`0123`/`0124`/`0125`) dilakukan dengan **diff baris-per-baris** terhadap versi asal tiap fungsi — terbukti tidak ada satu baris logika bisnis pun yang berubah, hanya penambahan klausa keamanan dan penggantian sumber baca saldo.

---

## TASK A — Tampilkan alasan & referensi campaign di halaman penelusuran

**STATUS: SELESAI** (dikerjakan Gemini, diverifikasi independen 2026-08-05 — lihat "Verifikasi" di bawah).

**Prioritas: TINGGI.** Ini satu-satunya gap nyata terhadap brief yang ditemukan di audit ulang.
**Pemilik: Gemini/Antigravity (frontend).** Backend sudah siap sejak awal, tidak ada yang diubah di sisi backend.

### Masalahnya

Brief menempatkan ini di posisi paling menentukan:

> Brief 1, penilaian #1: *"Logika stok benar & selisih bisa ditelusuri — angka yang salah membatalkan segalanya."*
>
> Brief 1, Bagian 1: *"Bonus, promo, dan sampel — barang keluar gudang tanpa terhubung ke pesanan mana pun... **Ini sumber selisih terbesar.**"*
>
> Sync Update: *"Karena kategori ini = sumber selisih terbesar, entri-nya idealnya mengisi referensi ringan (nama campaign / catatan approval)... Tujuan: kebocoran terbesar bukan sekadar tercatat, tapi **bisa dijelaskan ke siapa & kenapa**."*

Sistem **sudah mewajibkan** operator mengisi referensi campaign untuk bonus/promo/sample, dan API drilldown **sudah mengirimkan** datanya. Tapi halaman yang seharusnya dipakai untuk menelusuri selisih **tidak pernah menampilkannya**.

Akibatnya di halaman Ledger/Drilldown, semua pengeluaran manual terlihat sama saja sebagai `OUT_MANUAL` — bonus, promo, sampel, penjualan offline, barang rusak, dan kedaluwarsa tidak bisa dibedakan. Padahal justru pembedaan inilah inti dari "selisih bisa ditelusuri".

### Bukti

- `app/api/reconciliation/drilldown/route.ts:22` — API **sudah** mengirim `reason`, `note`, `campaign_reference`
- `app/(dashboard)/ledger/page.tsx` — grep `reason` dan `campaign_reference`: **nol hasil**, tidak pernah dirender
- `src/hooks/useLedger.ts:15-25` — type `LedgerEntry` punya `reason?` (tidak pernah dipakai) dan **tidak punya** `campaign_reference` sama sekali
- `app/(dashboard)/ledger/page.tsx:234-244` — filter cuma per `movement_type`, tidak bisa menyaring per `reason`
- `app/(dashboard)/ledger/page.tsx:149-182` — export CSV juga tidak menyertakan kedua kolom itu

### Yang perlu dikerjakan (usulan, silakan Gemini tentukan bentuk visualnya)

1. Tambahkan `campaign_reference?: string` ke type `LedgerEntry` di `src/hooks/useLedger.ts`
2. Tampilkan kolom **Alasan** di tabel ledger/drilldown — untuk baris `OUT_MANUAL`, tampilkan `reason`-nya (Bonus / Promo / Sampel / Penjualan Offline / Barang Rusak / Kedaluwarsa), bukan cuma badge `OUT MANUAL`
3. Tampilkan **Referensi Campaign** untuk baris yang punya (bonus/promo/sample) — boleh sebagai kolom sendiri, tooltip, atau baris detail
4. Tambahkan filter berdasarkan **alasan**, bukan cuma tipe mutasi — supaya operator bisa bertanya "tunjukkan semua barang yang keluar sebagai bonus bulan ini"
5. Sertakan kedua kolom itu di export CSV

Poin 1–3 yang paling penting; 4–5 pelengkap.

### Verifikasi (2026-08-05, dilakukan sendiri, bukan percaya laporan Gemini)

- `src/hooks/useLedger.ts` — `campaign_reference` ditambahkan ke type `LedgerEntry`
- `app/(dashboard)/ledger/page.tsx` — kolom Alasan + Ref. Campaign tampil di tabel, filter "Alasan (Manual)" ditambahkan, CSV export menyertakan `Alasan` & `Ref. Campaign`
- `npm run build` dijalankan ulang secara independen: **berhasil**, TypeScript bersih, 30/30 halaman
- `npm test`: 28/28 lulus (1 kegagalan awal "JWT issued at future" terbukti kedipan jam sistem sesaat, hilang saat diulang -- bukan regresi)

---

## TASK B — Feedback UI dari 3 tester

**STATUS: SELESAI** (dikerjakan Gemini, diverifikasi independen 2026-08-05).

Isi lengkap tetap ada di `FEEDBACK-UI-UNTUK-GEMINI.md` untuk rujukan. Yang sudah dikerjakan:
- Badge "Retur"/"Pembatalan" diganti dari outline tipis (`text-[10px]`) jadi solid berwarna (`text-xs`) -- `app/(dashboard)/returns/page.tsx`
- Kontras dark mode diturunkan moderat: `--foreground` dari `oklch(0.85 0 0)` ke `oklch(0.75 0 0)` -- `app/globals.css`
- Spasi antar baris di Panduan (termasuk kotak "Tugas Hari Ini") direnggangkan -- `app/(dashboard)/panduan/page.tsx`
- Banner info kontekstual ditambahkan di halaman Simulasi & Stok Opname, menaut ke Panduan -- `app/(dashboard)/simulation/page.tsx`, `app/(dashboard)/opname/page.tsx`

**Saran:** setelah ini di-deploy, minta 3 tester yang sama coba lagi khusus bagian yang mereka keluhkan (terutama kontras dark mode -- itu soal selera, bukan cuma soal benar/salah teknis, jadi validasi manusia lebih penting daripada di poin lain).

---

## TASK C — Bersihkan jejak data tes (opsional)

**Prioritas: RENDAH.** **Pemilik: kamu.**

Sisa dari validasi manual hari ini di database asli, total dampak bersih **-1 pcs** pada Serum Vitamin C 30ml:
- Batch `TES-0124-001` (+1 pcs, `IN_MAKLON`)
- 1 order simulasi TikTok status `IN_TRANSIT` (-1 pcs, `OUT_SALE_MARKETPLACE`)
- 1 entri keluar manual, alasan offline, catatan "tes kunci ledger" (-1 pcs, `OUT_MANUAL`)

Semuanya tertandai jelas sebagai data tes dan tidak mengganggu. Kalau mau dirapikan, gunakan **Koreksi Entri** di halaman Ledger seperti operator biasa — bukan lewat SQL, karena ledger sekarang memang sudah tidak bisa diedit langsung (itu justru buktinya bekerja).

**Catatan:** order simulasi TikTok yang berstatus `IN_TRANSIT` itu kemungkinan akan muncul di daftar anomali/worklist kalau dibiarkan menggantung terlalu lama. Kalau muncul, itu **bukan bug** — itu sistem deteksi bekerja sebagaimana mestinya.

---

## KEPUTUSAN SADAR — jangan "diperbaiki" tanpa membaca ini dulu

Hal-hal berikut **kelihatan seperti kekurangan, padahal disengaja.** Sudah ditimbang terhadap brief.

### 1. Foto bukti tidak diwajibkan untuk Keluar Manual alasan rusak/kedaluwarsa

Foto wajib untuk retur/pembatalan kondisi Rusak/Hilang (`fn_inspect_return`), tapi **tidak** untuk Keluar Manual alasan `damaged`/`expired` (`fn_manual_out`). Terlihat tidak konsisten, tapi ini keputusan sadar (2026-08-05):

- **Kedua brief sama sekali tidak pernah menyebut foto.** Syarat foto yang ada sekarang adalah tambahan atas inisiatif sendiri (lihat komentar `migrations/0119`), bukan tuntutan brief. Jadi tidak ada gap kepatuhan brief ke arah manapun.
- Sync Update menyebut layar konfirmasi sebagai *"satu-satunya titik yang sengaja diberi friksi"*. Menambah wajib-upload-foto berarti menambah titik friksi kedua — berlawanan dengan arah brief.
- Penilaian #3 brief adalah *"kemudahan dipakai operator gudang"*. Keluar Manual dipakai sehari-hari; memaksa foto tiap buang barang kedaluwarsa memperberat pekerjaan rutin.
- Perbedaannya punya dasar: barang retur datang dari luar (pembeli, ekspedisi) sehingga rantai buktinya lemah dan perlu foto; Keluar Manual menyangkut barang yang sejak awal ada di gudang sendiri.

### 2. `v_batch_stock` & `v_product_stock` sengaja tetap SUM murni dari ledger

Keduanya jadi alat pembanding independen untuk membuktikan angka cache masih benar — syarat brief *"asalkan saldo selalu bisa diverifikasi ulang dari ledger"*. Kalau ikut dialihkan ke cache, cache yang melenceng tidak akan pernah ketahuan. Query pembandingnya: `migrations/diagnostic-verify-stock-summary-cache-2026-08-05.sql`.

### 3. `/api/reconciliation/drilldown` sengaja tetap membaca SUM asli, bukan cache

Itu halaman penelusuran selisih — justru di situ angka hasil hitung ulang langsung dari ledger yang paling bisa dipercaya. Bukan jalur panas, jadi biayanya bisa diterima.

### 4. Fitur QR / cetak label batch sengaja dipertahankan

Sync Update menyebutnya "di luar scope", tapi ini keputusan sadar pemilik project: dibuat untuk kemudahan operator gudang saat Stok Opname, dan brief menempatkan kemudahan pakai operator sebagai penilaian #3. Sudah dibangun penuh dan dipakai. **Jangan dihapus.**

### 5. Trigger penolak UPDATE/DELETE juga berlaku untuk RPC `SECURITY DEFINER`

Disengaja. Tidak ada satu pun dari 7 RPC yang melakukan UPDATE/DELETE ke `stock_ledger` — koreksi selalu entri baru. Jadi trigger ini tidak memutus jalur manapun yang ada.

### 6. Export CSV hanya ada di halaman Ledger

Sync Update: *"Export CSV worklist/laporan = boleh, nice-to-have, bukan penentu nilai."* Tidak ada kewajiban melengkapinya di halaman lain.

---

## SEBELUM SUBMISSION — daftar periksa terakhir

- [x] Task A & Task B selesai dikerjakan Gemini, `npm test` (28/28) dan `npm run build` sudah diverifikasi ulang independen 2026-08-05
- [ ] **Commit & push perubahan Gemini ini**, lalu pastikan Vercel status **Ready**, lalu buka URL live-nya dan cek angka stok masih benar, DAN cek halaman Ledger sekarang menampilkan alasan/referensi campaign — jangan percaya "deploy sukses" tanpa melihat sendiri
- [ ] Baca ulang `CATATAN-KERJA-AUDIT-2026-08-05.md` bagian "Keputusan yang sengaja diambil", pastikan tidak ada yang tidak sengaja terbalik saat Gemini mengerjakan Task A
- [ ] Kredensial testing untuk reviewer sudah disiapkan terpisah (bukan di repo publik) — lihat `README.md:31`

### Cara aman kalau ada migration baru lagi

Pola ini terbukti bagus hari ini dan menangkap 2 masalah sebelum menyentuh data sungguhan:

**Tempel ke database TES → `npm test` → baru ke database ASLI → tes manual di aplikasi.**

Kalau tes gagal setelah migration, **jalankan file tes itu sendirian dulu** (`npx vitest run tests/nama-file.test.ts`) sebelum menyimpulkan migration-nya bermasalah. Beda hasil antara "jalan sendirian" dan "jalan barengan" menunjuk ke masalah isolasi tes, bukan ke kode produksi.
