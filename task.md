# TASK, Sisa Pekerjaan Menuju Submission

Dibuat 2026-08-05, setelah audit ulang menyeluruh terhadap **kedua brief dibaca utuh**: `stok-management-system.pdf` (brief asli, 3 halaman) dan `stok-management-system brief 2.pdf` (Sync Update Phase 2 v2, 13 Juni 2026).

Dokumen pendamping:
- `CATATAN-KERJA-AUDIT-2026-08-05.md`, detail apa yang sudah dikerjakan & kenapa (baca ini dulu kalau baru masuk ke project)
- `FEEDBACK-UI-UNTUK-GEMINI.md`, feedback UI dari 3 tester
- `migrations/README.md`, daftar lengkap migration `0100`–`0125`

---

## RINGKASAN: posisi sekarang

Audit ulang menyeluruh sudah dijalankan terhadap **seluruh isi kedua brief**, poin per poin, dengan bukti `file:baris`. Hasilnya:

**Semua tuntutan fungsional brief sudah terpenuhi.** Task A (gap fungsional satu-satunya) sudah dikerjakan Gemini dan diverifikasi independen 2026-08-05 (build sungguhan + 28/28 tes lulus, bukan cuma percaya laporan).

**Tapi ada 1 gap kualitas yang baru ketahuan 2026-08-05: `npm run lint` gagal dengan 84 error** (lihat Task D). Bukan gap fungsional, tapi menyentuh kriteria penilaian #4 brief ("kode rapi"). Ini lolos selama ini karena `next build` di Next.js 16 tidak menjalankan ESLint.

### Stack: sesuai tuntutan brief

Kedua brief menyebut hal yang sama persis:

> Brief 1, Bagian 4: *"**Stack wajib:** Next.js + TypeScript + Supabase (Postgres)."*
>
> Brief 2 (Sync Update), Arah Teknis: *"Stack: `Next.js + TypeScript + Supabase (Postgres)`."*

Diverifikasi 2026-08-05:

| Tuntutan | Terpasang | Bukti |
|---|---|---|
| Next.js | `next@16.2.10` | `package.json`, App Router dipakai penuh (`app/`) |
| TypeScript | `typescript@^5`, `strict: true` | `tsconfig.json:9`, **nol file `.js`/`.jsx`** di `app/`, `src/`, `lib/`, `components/`, `tests/` |
| Supabase (Postgres) | `@supabase/supabase-js@^2.109.0` + `@supabase/ssr@^0.12.0` | seluruh akses data lewat Supabase, logika inti sebagai RPC Postgres |

Catatan pendukung:
- Tidak ada satu pun `@ts-ignore` atau `@ts-expect-error` di seluruh kode. Tidak ada pengecekan tipe yang dibungkam.
- Brief 2 menyebut *"tulis lewat RPC / Server Action"*. Project ini konsisten memakai **jalur RPC** (bukan Server Action), yang memang salah satu dari dua opsi yang disebut. Nol pemakaian `"use server"` di seluruh kode, jadi tidak ada pola campuran yang membingungkan.
- File konfigurasi (`eslint.config.mjs`, `postcss.config.mjs`) memang berformat `.mjs`, itu konvensi standar perkakasnya, bukan kode aplikasi. `next.config.ts` sendiri sudah TypeScript.

Yang sudah diverifikasi ulang hari ini dan terbukti benar, tidak perlu diaudit lagi:

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
- Layar konfirmasi sebelum commit,**ada di kedua jalur** (Keluar Manual & Koreksi Entri), menampilkan produk, qty, alasan, dan dampak ke stok
- Opening balance bertanda belum-terverifikasi sampai opname pertama
- Dua ritme rekonsiliasi (harian + opname), drilldown ke entri ledger pembentuk selisih
- Notifikasi kedaluwarsa per batch, in-app only (tidak ada email/WA sama sekali)
- 1 role Admin, 1 gudang, reason code enum tetap
- Murni kuantitas, tidak ada satu pun kolom harga di seluruh skema
- Import CSV tersedia sebagai jalur masuk data terpisah, memakai service layer yang sama dengan tombol simulasi
- Tidak ada TODO/placeholder/tombol mati di seluruh `app/` dan `src/`
- Stack sesuai: Next.js 16.2.10 + TypeScript 5 + Supabase
- Aplikasi live & ter-deploy (commit `e6c2b01`, terverifikasi manual)

Verifikasi migration hari ini (`0123`/`0124`/`0125`) dilakukan dengan **diff baris-per-baris** terhadap versi asal tiap fungsi, terbukti tidak ada satu baris logika bisnis pun yang berubah, hanya penambahan klausa keamanan dan penggantian sumber baca saldo.

---

## TASK A, Tampilkan alasan & referensi campaign di halaman penelusuran

**STATUS: SELESAI** (dikerjakan Gemini, diverifikasi independen 2026-08-05, lihat "Verifikasi" di bawah).

**Prioritas: TINGGI.** Ini satu-satunya gap nyata terhadap brief yang ditemukan di audit ulang.
**Pemilik: Gemini/Antigravity (frontend).** Backend sudah siap sejak awal, tidak ada yang diubah di sisi backend.

### Masalahnya

Brief menempatkan ini di posisi paling menentukan:

> Brief 1, penilaian #1: *"Logika stok benar & selisih bisa ditelusuri, angka yang salah membatalkan segalanya."*
>
> Brief 1, Bagian 1: *"Bonus, promo, dan sampel, barang keluar gudang tanpa terhubung ke pesanan mana pun... **Ini sumber selisih terbesar.**"*
>
> Sync Update: *"Karena kategori ini = sumber selisih terbesar, entri-nya idealnya mengisi referensi ringan (nama campaign / catatan approval)... Tujuan: kebocoran terbesar bukan sekadar tercatat, tapi **bisa dijelaskan ke siapa & kenapa**."*

Sistem **sudah mewajibkan** operator mengisi referensi campaign untuk bonus/promo/sample, dan API drilldown **sudah mengirimkan** datanya. Tapi halaman yang seharusnya dipakai untuk menelusuri selisih **tidak pernah menampilkannya**.

Akibatnya di halaman Ledger/Drilldown, semua pengeluaran manual terlihat sama saja sebagai `OUT_MANUAL`, bonus, promo, sampel, penjualan offline, barang rusak, dan kedaluwarsa tidak bisa dibedakan. Padahal justru pembedaan inilah inti dari "selisih bisa ditelusuri".

### Bukti

- `app/api/reconciliation/drilldown/route.ts:22`, API **sudah** mengirim `reason`, `note`, `campaign_reference`
- `app/(dashboard)/ledger/page.tsx`, grep `reason` dan `campaign_reference`: **nol hasil**, tidak pernah dirender
- `src/hooks/useLedger.ts:15-25`, type `LedgerEntry` punya `reason?` (tidak pernah dipakai) dan **tidak punya** `campaign_reference` sama sekali
- `app/(dashboard)/ledger/page.tsx:234-244`, filter cuma per `movement_type`, tidak bisa menyaring per `reason`
- `app/(dashboard)/ledger/page.tsx:149-182`, export CSV juga tidak menyertakan kedua kolom itu

### Yang perlu dikerjakan (usulan, silakan Gemini tentukan bentuk visualnya)

1. Tambahkan `campaign_reference?: string` ke type `LedgerEntry` di `src/hooks/useLedger.ts`
2. Tampilkan kolom **Alasan** di tabel ledger/drilldown, untuk baris `OUT_MANUAL`, tampilkan `reason`-nya (Bonus / Promo / Sampel / Penjualan Offline / Barang Rusak / Kedaluwarsa), bukan cuma badge `OUT MANUAL`
3. Tampilkan **Referensi Campaign** untuk baris yang punya (bonus/promo/sample), boleh sebagai kolom sendiri, tooltip, atau baris detail
4. Tambahkan filter berdasarkan **alasan**, bukan cuma tipe mutasi, supaya operator bisa bertanya "tunjukkan semua barang yang keluar sebagai bonus bulan ini"
5. Sertakan kedua kolom itu di export CSV

Poin 1–3 yang paling penting; 4–5 pelengkap.

### Verifikasi (2026-08-05, dilakukan sendiri, bukan percaya laporan Gemini)

- `src/hooks/useLedger.ts`,`campaign_reference` ditambahkan ke type `LedgerEntry`
- `app/(dashboard)/ledger/page.tsx`, kolom Alasan + Ref. Campaign tampil di tabel, filter "Alasan (Manual)" ditambahkan, CSV export menyertakan `Alasan` & `Ref. Campaign`
- `npm run build` dijalankan ulang secara independen: **berhasil**, TypeScript bersih, 30/30 halaman
- `npm test`: 28/28 lulus (1 kegagalan awal "JWT issued at future" terbukti kedipan jam sistem sesaat, hilang saat diulang -- bukan regresi)

---

## TASK B, Feedback UI dari 3 tester

**STATUS: SELESAI** (dikerjakan Gemini, diverifikasi independen 2026-08-05).

Isi lengkap tetap ada di `FEEDBACK-UI-UNTUK-GEMINI.md` untuk rujukan. Yang sudah dikerjakan:
- Badge "Retur"/"Pembatalan" diganti dari outline tipis (`text-[10px]`) jadi solid berwarna (`text-xs`) -- `app/(dashboard)/returns/page.tsx`
- Kontras dark mode diturunkan moderat: `--foreground` dari `oklch(0.85 0 0)` ke `oklch(0.75 0 0)` -- `app/globals.css`
- Spasi antar baris di Panduan (termasuk kotak "Tugas Hari Ini") direnggangkan -- `app/(dashboard)/panduan/page.tsx`
- Banner info kontekstual ditambahkan di halaman Simulasi & Stok Opname, menaut ke Panduan -- `app/(dashboard)/simulation/page.tsx`, `app/(dashboard)/opname/page.tsx`

**Saran:** setelah ini di-deploy, minta 3 tester yang sama coba lagi khusus bagian yang mereka keluhkan (terutama kontras dark mode -- itu soal selera, bukan cuma soal benar/salah teknis, jadi validasi manusia lebih penting daripada di poin lain).

---

## TASK C, Bersihkan jejak data tes (opsional)

**Prioritas: RENDAH.** **Pemilik: kamu.**

Sisa dari validasi manual hari ini di database asli, total dampak bersih **-1 pcs** pada Serum Vitamin C 30ml:
- Batch `TES-0124-001` (+1 pcs, `IN_MAKLON`)
- 1 order simulasi TikTok status `IN_TRANSIT` (-1 pcs, `OUT_SALE_MARKETPLACE`)
- 1 entri keluar manual, alasan offline, catatan "tes kunci ledger" (-1 pcs, `OUT_MANUAL`)

Semuanya tertandai jelas sebagai data tes dan tidak mengganggu. Kalau mau dirapikan, gunakan **Koreksi Entri** di halaman Ledger seperti operator biasa, bukan lewat SQL, karena ledger sekarang memang sudah tidak bisa diedit langsung (itu justru buktinya bekerja).

**Catatan:** order simulasi TikTok yang berstatus `IN_TRANSIT` itu kemungkinan akan muncul di daftar anomali/worklist kalau dibiarkan menggantung terlalu lama. Kalau muncul, itu **bukan bug**, itu sistem deteksi bekerja sebagaimana mestinya.

---

## TASK D, `npm run lint` gagal, SELESAI

**Ditemukan: 2026-08-05**, saat audit ulang khusus soal stack/bahasa pemrograman. **Selesai: 2026-08-05.**

### Status akhir

| | Awal | Akhir |
|---|---|---|
| Error | 84 | **0** |
| Warning | 21 | 6 (semuanya jenis yang sengaja dibiarkan) |

Live di commit `02ee866`. Semua terverifikasi: `npx tsc --noEmit` bersih, `npm run lint` 0 error, `npm run build` berhasil 30/30 halaman, `npm test` 28/28.

Pembagiannya: Claude mengerjakan backend + halaman Panduan + tes (59 masalah), Gemini mengerjakan frontend (46 masalah).

### Sisa 6 warning yang sengaja dibiarkan

- 2 `no-img-element` di `returns/page.tsx` (foto bukti retur dari Supabase Storage, `next/image` butuh konfigurasi domain, tidak sepadan)
- 2 `incompatible-library` dari `form.watch()` React Hook Form, keterbatasan library
- 1 `exhaustive-deps` di `products/[id]/page.tsx`
- 1 `exhaustive-deps` di `camera-scanner.tsx:134`, `stopScanner` tidak dicantumkan di daftar dependensi. **Aman**, karena `stopScanner` dibuat dengan `useCallback(..., [])` sehingga acuannya tidak pernah berubah. Perbaikannya sepele kalau mau dirapikan nanti.

---

## TASK E, bug kamera scanner tidak berhenti, SELESAI

**Ditemukan: 2026-08-05** saat verifikasi hasil Task D. **Selesai & terverifikasi di HP asli: 2026-08-05.**

### Apa yang terjadi

Saat membereskan lint, teardown kamera dipindahkan dari `useEffect([isOpen])` ke event handler `handleOpenChange`. Yang terlewat: ada **dua** jalur penutupan dialog, dan hanya satu yang lewat handler itu.

Jalur sukses scan menutup dialog dengan `setIsOpen(false)` langsung (baris 81). Komponen Dialog tidak memanggil `onOpenChange` untuk perubahan state yang datang dari luar dirinya, itu memang desainnya supaya tidak terjadi loop. Akibatnya `stopScanner` tidak pernah jalan di jalur yang justru paling sering dipakai.

Efeknya di HP asli: kamera tetap menyala setelah dialog tertutup, dan karena scanner tidak berhenti, callback sukses terpanggil berulang setiap frame, sehingga toast "QR Berhasil dipindai!" menumpuk tanpa henti dan kolom Batch ID terus ditimpa.

### Perbaikannya

Satu fungsi `stopScanner` (useCallback) dipakai bersama oleh **ketiga** jalur: sukses scan (baris 76), penutupan manual (baris 154), dan pelepasan komponen (baris 49). Ditambah penjaga `hasScannedRef` yang di-reset tiap kamera dinyalakan dan dikunci secara sinkron di awal callback sukses, supaya toast tetap sekali walau beberapa frame terlanjur terbaca sebelum `stop()` selesai.

### Terverifikasi manual di HP Android (bukan cuma build hijau)

| Yang dicek | Hasil |
|---|---|
| Toast "QR Berhasil dipindai!" | Muncul tepat 1 kali |
| Titik hijau indikator kamera setelah dialog tertutup | Hilang |
| Buka kamera untuk kedua kalinya | Menyala normal, tanpa error |

### Pelajaran penting

**Keempat perintah otomatis semuanya hijau ketika bug ini aktif di production.** `tsc`, `lint`, `build`, dan 28 tes tidak menangkap apa pun. Untuk apa pun yang menyentuh perangkat keras (kamera), siklus hidup komponen, atau interaksi pengguna, pengujian tangan di perangkat asli tidak tergantikan.

### Kenapa ini baru ketahuan sekarang

Selama ini verifikasi selalu pakai `npm run build` dan `npm test`, dan keduanya **selalu hijau**. Ternyata itu tidak cukup: di Next.js 16, `next build` **tidak menjalankan ESLint**. Jadi build sukses sama sekali bukan bukti kode lolos linter. Baru ketahuan setelah `npm run lint` dijalankan terpisah.

Ini relevan langsung ke penilaian brief:

> Brief 1, penilaian #4: *"Kualitas teknis, kode rapi, deploy stabil."*

Bukan gap fungsional (tidak ada logika stok yang salah), tapi "kode rapi" itu kriteria tertulis, dan linter gagal adalah sinyal paling gampang dicek reviewer.

### Rincian awal: 105 masalah (84 error, 21 warning)

| Jumlah | Aturan | Sifat | Status |
|---|---|---|---|
| 41 | `@typescript-eslint/no-explicit-any` | error | 19 selesai (backend), 22 sisa (frontend) |
| 40 | `react/no-unescaped-entities` | error | 38 selesai (Panduan), 2 sisa |
| 14 | `@typescript-eslint/no-unused-vars` | warning | 2 selesai (tes), 12 sisa |
| 3 | `react-hooks/set-state-in-effect` | error | sisa, frontend |
| 3 | `react-hooks/exhaustive-deps` | warning | sisa, frontend |
| 2 | `react-hooks/incompatible-library` | error | sisa, frontend |
| 2 | `@next/next/no-img-element` | warning | sisa, frontend |

### D-1. `react/no-unescaped-entities` (SELESAI untuk Panduan)

**38 dari 40 ada di `app/(dashboard)/panduan/page.tsx`**, sisanya 2 di `src/components/products/opening-balance-form.tsx` (masih sisa, wilayah Gemini).

Penyebabnya sepele: tanda kutip lurus (`"`) yang dipakai langsung di dalam teks JSX, misalnya `"buku besar"`. Diperbaiki dengan mengganti jadi `&quot;`, sengaja **bukan** kutip tipografis, supaya tampilan di layar tetap sama persis dengan yang sudah direview user.

**Catatan jujur soal asal-usulnya:** masalah ini **sudah ada sebelumnya** (versi Panduan lama punya 20 error yang sama), tapi **jumlahnya nyaris dua kali lipat gara-gara aku menulis ulang halaman Panduan** (20 jadi 38) tanpa menjalankan linter setelahnya, cuma mengandalkan `npm run build` yang hijau. Diverifikasi dengan me-lint versi lama (commit `73e6623`) dan versi baru secara terpisah.

### D-2. `@typescript-eslint/no-explicit-any` (SELESAI untuk backend, 19 error)

Akar masalahnya satu: klien Supabase di project ini **sengaja tidak diberi tipe skema hasil-generate** (lihat `src/lib/supabase/server.ts`), jadi semua hasil query datang longgar dan sebelumnya ditambal `as any` di titik pemakaian.

Perbaikannya: mendeklarasikan bentuk baris yang benar-benar di-`select` sebagai `type` lokal di tiap file, tepat di batas datanya. Ini memberi pemeriksaan tipe sungguhan, bukan sekadar membuat linter diam.

**Temuan sampingan yang penting.** Setelah `as any` dilepas, TypeScript langsung menangkap sesuatu yang selama ini tersembunyi: tanpa tipe skema, Supabase menebak **semua relasi bersarang sebagai array**, padahal untuk relasi many-to-one (`returns` -> `orders`, `stock_ledger` -> `product_batches`) PostgREST sebenarnya mengembalikan **objek tunggal**. Kode yang ada sudah memperlakukannya sebagai objek dan memang benar secara runtime (terbukti: halaman Retur menampilkan channel Shopee/Tiktok dengan benar), jadi tebakan Supabase itu yang perlu ditimpa lewat `as unknown as X`, disertai komentar penjelas di tiap lokasinya. Selama masih pakai `as any`, ketidakcocokan ini tidak akan pernah kelihatan.

Satu perbaikan bonus: `(orderError as any).code` di `src/lib/services/orders.ts` ternyata **tidak butuh cast sama sekali**, karena `code` memang properti resmi `PostgrestError`. Cast-nya dihapus.

### D-4. `no-unused-vars` di tes (SELESAI)

`tests/cancellation-and-anomaly.test.ts:81-82`, variabel `userId` dan `product` sisa dari perbaikan tes hari ini. Destructuring-nya dirapikan jadi hanya mengambil yang dipakai.

### Sisa untuk Gemini (46 masalah: 27 error, 19 warning)

Semuanya di `app/(dashboard)/**` (selain panduan), `src/components/**`, `src/hooks/**`:

- **22 `no-explicit-any`**, mayoritas pola `catch (error: any)` di handler tombol. Perbaikan yang benar: `catch (error: unknown)` lalu persempit tipenya sebelum membaca `.message`.
- **2 `no-unescaped-entities`** di `src/components/products/opening-balance-form.tsx`, tinggal ganti `"` jadi `&quot;`.
- **12 `no-unused-vars`**, impor/variabel sisa, termasuk `toast` di `src/hooks/useOrders.ts:1`.
- **3 `set-state-in-effect` + 2 `incompatible-library`** di `qr-generator-modal.tsx`, `camera-scanner.tsx`, `theme-toggle.tsx`. **Perlu dicek benaran**, bukan sekadar dibungkam: pola ini bisa memicu render berulang. Cek dulu apakah bermasalah saat dipakai.
- **3 `exhaustive-deps`** (warning), dependency `useEffect` yang kurang.
- **2 `no-img-element`**, saran memakai `next/image` alih-alih `<img>`. Boleh diabaikan kalau memang disengaja.

### Pembagian pekerjaan

| Bagian | Pemilik | Status |
|---|---|---|
| D-1 Panduan (38 error) | Claude | **Selesai** |
| D-1 `opening-balance-form` (2 error) | Gemini | Sisa |
| D-2 di `app/api/**`, `src/lib/**` (19 error) | Claude | **Selesai** |
| D-2 di frontend (22 error) | Gemini | Sisa |
| D-3 pola React hooks (5 error) | Gemini | Sisa |
| D-4 di `tests/**` (2 warning) | Claude | **Selesai** |
| D-4 di frontend (12 warning) | Gemini | Sisa |

### Cara memverifikasi setelah diperbaiki

```
npm run lint
```

Untuk mengecek satu wilayah saja tanpa terganggu sisa milik pihak lain:

```
npx eslint "app/api" "src/lib" "tests" "app/(dashboard)/panduan"
```

Keluaran kosong artinya bersih. Per 2026-08-05 keempat wilayah itu memang sudah kosong.

Target realistis sebelum submission: **nol error** (warning boleh disisakan kalau memang disengaja). Jangan cuma percaya `npm run build`, itu terbukti tidak menangkap satu pun dari 105 masalah ini.

---

## KEPUTUSAN SADAR, jangan "diperbaiki" tanpa membaca ini dulu

Hal-hal berikut **kelihatan seperti kekurangan, padahal disengaja.** Sudah ditimbang terhadap brief.

### 1. Foto bukti tidak diwajibkan untuk Keluar Manual alasan rusak/kedaluwarsa

Foto wajib untuk retur/pembatalan kondisi Rusak/Hilang (`fn_inspect_return`), tapi **tidak** untuk Keluar Manual alasan `damaged`/`expired` (`fn_manual_out`). Terlihat tidak konsisten, tapi ini keputusan sadar (2026-08-05):

- **Kedua brief sama sekali tidak pernah menyebut foto.** Syarat foto yang ada sekarang adalah tambahan atas inisiatif sendiri (lihat komentar `migrations/0119`), bukan tuntutan brief. Jadi tidak ada gap kepatuhan brief ke arah manapun.
- Sync Update menyebut layar konfirmasi sebagai *"satu-satunya titik yang sengaja diberi friksi"*. Menambah wajib-upload-foto berarti menambah titik friksi kedua, berlawanan dengan arah brief.
- Penilaian #3 brief adalah *"kemudahan dipakai operator gudang"*. Keluar Manual dipakai sehari-hari; memaksa foto tiap buang barang kedaluwarsa memperberat pekerjaan rutin.
- Perbedaannya punya dasar: barang retur datang dari luar (pembeli, ekspedisi) sehingga rantai buktinya lemah dan perlu foto; Keluar Manual menyangkut barang yang sejak awal ada di gudang sendiri.

### 2. `v_batch_stock` & `v_product_stock` sengaja tetap SUM murni dari ledger

Keduanya jadi alat pembanding independen untuk membuktikan angka cache masih benar, syarat brief *"asalkan saldo selalu bisa diverifikasi ulang dari ledger"*. Kalau ikut dialihkan ke cache, cache yang melenceng tidak akan pernah ketahuan. Query pembandingnya: `migrations/diagnostic-verify-stock-summary-cache-2026-08-05.sql`.

### 3. `/api/reconciliation/drilldown` sengaja tetap membaca SUM asli, bukan cache

Itu halaman penelusuran selisih, justru di situ angka hasil hitung ulang langsung dari ledger yang paling bisa dipercaya. Bukan jalur panas, jadi biayanya bisa diterima.

### 4. Fitur QR / cetak label batch sengaja dipertahankan

Sync Update menyebutnya "di luar scope", tapi ini keputusan sadar pemilik project: dibuat untuk kemudahan operator gudang saat Stok Opname, dan brief menempatkan kemudahan pakai operator sebagai penilaian #3. Sudah dibangun penuh dan dipakai. **Jangan dihapus.**

### 5. Trigger penolak UPDATE/DELETE juga berlaku untuk RPC `SECURITY DEFINER`

Disengaja. Tidak ada satu pun dari 7 RPC yang melakukan UPDATE/DELETE ke `stock_ledger`, koreksi selalu entri baru. Jadi trigger ini tidak memutus jalur manapun yang ada.

### 6. Export CSV hanya ada di halaman Ledger

Sync Update: *"Export CSV worklist/laporan = boleh, nice-to-have, bukan penentu nilai."* Tidak ada kewajiban melengkapinya di halaman lain.

---

## SEBELUM SUBMISSION, daftar periksa terakhir

- [x] Task A & Task B selesai dikerjakan Gemini, `npm test` (28/28) dan `npm run build` sudah diverifikasi ulang independen 2026-08-05
- [x] Commit `73e6623` di-push, dan **kelima perubahan diverifikasi satu-satu langsung di aplikasi live** (bukan cuma percaya status deploy): alasan+referensi campaign muncul di Ledger, badge Retur/Pembatalan solid & jelas, kontras dark mode terasa lebih adem, spasi Panduan lebih lega, banner info muncul di Simulasi & Opname
- [ ] **Task D: `npm run lint` harus nol error.** Turun dari 84 jadi **27 error**, semua sisanya wilayah frontend Gemini. Bagian backend, Panduan, dan tes sudah nol. Ini kriteria penilaian #4 brief ("kode rapi"), dan `npm run build` tidak menangkapnya sama sekali
- [ ] Baca ulang `CATATAN-KERJA-AUDIT-2026-08-05.md` bagian "Keputusan yang sengaja diambil", pastikan tidak ada yang tidak sengaja terbalik saat Gemini mengerjakan Task A
- [ ] Kredensial testing untuk reviewer sudah disiapkan terpisah (bukan di repo publik), lihat `README.md:31`

### Perintah verifikasi lengkap sebelum submission

Ketiganya harus dijalankan, jangan cuma salah satu, karena masing-masing menangkap hal berbeda:

| Perintah | Menangkap | Status per 2026-08-05 |
|---|---|---|
| `npm run build` | Error TypeScript & kegagalan kompilasi | Hijau |
| `npm test` | Kebenaran logika stok (28 skenario) | Hijau, 28/28 |
| `npm run lint` | Kerapian kode & pola berisiko | **27 error tersisa** (dari 84), semua di frontend |

### Cara aman kalau ada migration baru lagi

Pola ini terbukti bagus hari ini dan menangkap 2 masalah sebelum menyentuh data sungguhan:

**Tempel ke database TES → `npm test` → baru ke database ASLI → tes manual di aplikasi.**

Kalau tes gagal setelah migration, **jalankan file tes itu sendirian dulu** (`npx vitest run tests/nama-file.test.ts`) sebelum menyimpulkan migration-nya bermasalah. Beda hasil antara "jalan sendirian" dan "jalan barengan" menunjuk ke masalah isolasi tes, bukan ke kode produksi.
