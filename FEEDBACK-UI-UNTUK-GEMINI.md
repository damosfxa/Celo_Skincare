# Feedback UI/UX dari User Testing — untuk Gemini (Antigravity)

**Sumber:** 3 orang teman pemilik project yang diminta coba aplikasi dan kasih feedback jujur.
**Dikumpulkan:** 2026-08-04.
**Ditulis oleh:** Claude Code, setelah audit backend Phase 2 — bukan aku yang mengerjakan perbaikan ini (wilayah frontend bukan punyaku, lihat `CLAUDE.md`), jadi dokumen ini murni observasi + lokasi kode, bukan instruksi desain yang sudah final. Putuskan sendiri pendekatan visualnya.

Poin 1–5 di bawah soal **tampilan/kontras/kejelasan istilah**. Poin 0 (paling atas, ditambahkan 2026-08-05) berasal dari audit ulang terhadap brief, bukan dari tester — dan **prioritasnya paling tinggi**.

---

## 0. [PRIORITAS TERTINGGI] Halaman Ledger/Drilldown tidak menampilkan alasan & referensi campaign

**Sumber:** audit ulang terhadap brief, 2026-08-05 (bukan dari tester).

Ini gap nyata terhadap kriteria penilaian **nomor 1** di brief, bukan sekadar preferensi visual.

**Kenapa penting.** Brief menyebut bonus/promo/sampel sebagai *"sumber selisih terbesar"*, dan Sync Update Phase 2 menegaskan tujuannya: *"kebocoran terbesar bukan sekadar tercatat, tapi bisa dijelaskan ke siapa & kenapa."* Sistem sudah **mewajibkan** operator mengisi referensi campaign untuk bonus/promo/sample, dan API sudah mengirimkan datanya — tapi halaman yang seharusnya dipakai menelusuri selisih tidak pernah menampilkannya.

Akibatnya di tabel ledger, semua pengeluaran manual terlihat sama saja sebagai badge `OUT MANUAL`. Bonus, promo, sampel, penjualan offline, barang rusak, dan kedaluwarsa tidak bisa dibedakan sama sekali — padahal justru pembedaan itu inti dari "selisih bisa ditelusuri".

**Kondisi kode saat ini:**
- [`app/api/reconciliation/drilldown/route.ts:22`](app/api/reconciliation/drilldown/route.ts:22) — API **sudah** mengirim `reason`, `note`, `campaign_reference`. Backend tidak perlu diubah sama sekali.
- [`app/(dashboard)/ledger/page.tsx`](app/(dashboard)/ledger/page.tsx) — grep `reason` dan `campaign_reference`: **nol hasil**. Tidak pernah dirender.
- [`src/hooks/useLedger.ts:15-25`](src/hooks/useLedger.ts:15) — type `LedgerEntry` punya `reason?` (tidak pernah dipakai) dan **tidak punya** `campaign_reference`.
- [`app/(dashboard)/ledger/page.tsx:234`](app/(dashboard)/ledger/page.tsx:234) — filter cuma per `movement_type`, tidak bisa per `reason`.
- [`app/(dashboard)/ledger/page.tsx:149`](app/(dashboard)/ledger/page.tsx:149) — export CSV juga tidak menyertakan kedua kolom itu.

**Usulan (bentuk visualnya silakan kamu tentukan):**
1. Tambah `campaign_reference?: string` ke type `LedgerEntry`
2. Tampilkan kolom **Alasan** di tabel — untuk baris `OUT_MANUAL`, tampilkan reason-nya dalam bahasa manusia (Bonus / Promo / Sampel / Penjualan Offline / Barang Rusak / Kedaluwarsa)
3. Tampilkan **Referensi Campaign** untuk baris yang punya — kolom sendiri, tooltip, atau baris detail, bebas
4. Filter berdasarkan alasan, bukan cuma tipe mutasi
5. Sertakan keduanya di export CSV

Poin 1–3 yang paling penting; 4–5 pelengkap.

---

Sisanya di bawah ini dari 3 tester, semuanya soal tampilan — tidak ada yang menyentuh logika stok.

---

## Konteks teknis singkat (biar gak perlu re-investigasi dari nol)

Tema warna diatur lewat CSS variable `oklch` di [`app/globals.css`](app/globals.css) — dua blok: `:root` (mode terang, baris 51-84) dan `.dark` (mode gelap, baris 86-118). Tidak ditemukan pemakaian `text-white` hardcoded di `app/` maupun `src/components/` — jadi kalau teks di mode gelap terasa "mencolok", sumbernya kemungkinan besar dari kontras `--foreground` vs `--background` di variable ini, bukan warna liar di komponen tertentu:

```
.dark {
  --background: oklch(0.18 0 0);   /* gelap */
  --foreground: oklch(0.85 0 0);   /* terang, tapi bukan putih murni */
  ...
}
```

---

## 1. Mode gelap terasa terlalu "mencolok"/menyilaukan

**Siapa bilang:** 2 dari 3 tester (Tester 1 & Tester 3 secara implisit — Tester 3 sendiri lebih nyaman di dark mode karena sudah terbiasa).

> Tester 1: *"buat mode gelap kurang nyaman sih kak jadi text yg warna putih itu mencolok bikin engga nyaman kalo ga pake kacamata... karna mata kan blur ya buat lihat"*

**Kemungkinan sumber:** kontras `--foreground: oklch(0.85 0 0)` terhadap `--background: oklch(0.18 0 0)` ([`app/globals.css:87-88`](app/globals.css:87)) itu kontras tinggi (bagus buat aksesibilitas standar, tapi bisa terasa "silau" buat mata minus/sensitif cahaya, apalagi dari layar HP di ruangan gelap).

**Catatan penting:** jangan main turunin kontras begitu saja — Tester 3 justru nyaman dengan versi sekarang karena terbiasa dark mode. Ini trade-off selera, bukan bug murni. Kalau mau dibenerin, pertimbangkan uji kontras (WCAG AA minimal 4.5:1 untuk teks normal) setelah diubah, jangan cuma "kelihatan lebih nyaman lalu commit".

## 2. Mode terang burem buat mata minus tanpa kacamata

**Siapa bilang:** Tester 1 (spesifik nyebut minus ~2).

> *"kalo semisal engga pake kacamata mungkin tergantung minus mereka berapa tapi untuk yg minus 2 itu burem pusing kalo ga pake kacamata"*

**Kemungkinan sumber:** bukan soal warna (mode terang dianggap 2/3 tester paling nyaman dari sisi warna), kemungkinan lebih ke **ukuran font** di elemen-elemen kecil. Contoh konkret yang ketemu saat aku baca kode: badge status di halaman Retur pakai `text-[10px]` — ini sangat kecil ([`app/(dashboard)/returns/page.tsx:196`](app/(dashboard)/returns/page.tsx:196)):
```tsx
className={item.type === 'CANCELLATION' ? 'text-blue-500 border-blue-500 text-[10px] px-1 py-0' : 'text-purple-500 border-purple-500 text-[10px] px-1 py-0'}
```
Worth dicek: apakah ada elemen teks lain berukuran serupa (di bawah ~12px) di halaman-halaman yang sering dipakai operator.

## 3. Badge "Retur" vs "Pembatalan" kurang kontras / warna nusuk mata

**Siapa bilang:** Tester 2.

> *"di bagian retur barang ada warna yg menurut gua nusuk mata bgt... bikin bacaan 'retur' sama 'pembatalan' nya kurang kelihatan"*

**Lokasi persis:** [`app/(dashboard)/returns/page.tsx:194-199`](app/(dashboard)/returns/page.tsx:194) — badge outline tipis, warna `purple-500` (Retur) dan `blue-500` (Pembatalan), ukuran `text-[10px]`. Kombinasi warna medium-saturation + border tipis + font sangat kecil kemungkinan besar penyebabnya. Pertimbangkan varian warna lebih pekat (600/700) atau ganti jadi badge solid (background warna, teks putih/gelap kontras) alih-alih outline tipis.

## 4. Halaman Panduan — bagian "1. Tugas Hari Ini" kurang tegas dibaca

**Siapa bilang:** Tester 3.

> *"bagian TUGAS.. jujur di kedua mode kurang readable yah karna warna teks sama latar belakangnya yang kurang tegas dari kotak pertama.. jadi kyk pas baca reflek deketin hp ke mata"*

**Lokasi:** Modul 1 "Tugas Hari Ini (Halaman Utama)" di [`app/(dashboard)/panduan/page.tsx:47-79`](app/(dashboard)/panduan/page.tsx:47).

**PENTING — ini belum aku bisa pastikan akar masalahnya:** aku cek, styling list di kotak ini (`className="text-muted-foreground"`, baris 57) **sama persis** dengan kotak Modul 2 (baris 91) dan Modul 3 (baris 121) yang menurut Tester 2 justru aman-aman saja. Jadi bukan soal warna kotak pertama beda dari kotak lain secara kode. Kemungkinan lain: kotak ini paling padat isinya (nested list dengan istilah teknis seperti "Resiko Oversell", "Anomali Stok"), jadi yang terasa "kurang tegas" mungkin sebenarnya soal kepadatan teks/panjang baris, bukan warnanya. **Sarankan verifikasi ulang ke tester (tanya "kotak mana persisnya, screenshot?") sebelum mengubah apa pun di sini** — jangan asumsi sepihak.

## 5. Halaman Simulasi & Stok Opname membingungkan untuk user awam

**Siapa bilang:** Tester 3.

> *"paling bingung pas buka simulasi sama stock opname (karna gue gapaham kali yak itu apa, mana kyk codingan gue waktu SMA)"*

Ini bukan soal visual — soal user baru yang belum baca halaman Panduan dulu, langsung bingung begitu buka dua halaman ini. Menariknya, Tester 3 sendiri bilang isi halaman Panduan "detail banget... jadi bisa paham maksudnya harus ngapain" — artinya penjelasannya sudah ada, tapi **hanya sampai ke user yang sempat buka halaman Panduan duluan**.

**Ide arah (bukan keputusan final):** tambahkan bantuan kontekstual langsung di dalam halaman Simulasi dan Stok Opname itu sendiri — misalnya banner/tooltip singkat "Apa ini?" dengan link ke bagian relevan di Panduan — supaya user tidak harus menemukan halaman Panduan lebih dulu secara mandiri.

---

## Yang TIDAK bermasalah (biar gak ke-refactor gak perlu)

- Navigasi/pencarian fitur: dianggap efisien oleh Tester 2.
- Scroll & warna di halaman Panduan (di luar poin 4 di atas): aman di kedua mode (Tester 2).
- Drilldown rekonsiliasi: tidak ada masalah visual (Tester 2).
- Teks Panduan secara keseluruhan: dianggap detail dan mudah dipahami oleh 2 dari 3 tester.

---

## Ringkasan prioritas (usulan, bukan mutlak)

1. **Badge Retur/Pembatalan** (poin 3) — paling konkret lokasinya, paling gampang dieksekusi.
2. **Kontras dark mode** (poin 1) — dampak paling luas (seluruh app), tapi butuh hati-hati karena ada tester yang justru suka kondisi sekarang.
3. **Ukuran font kecil** (poin 2) — perlu sweep lebih luas dulu, bukan cuma 1 lokasi.
4. **Kotak Tugas Hari Ini** (poin 4) — perlu klarifikasi ulang ke tester dulu sebelum diubah.
5. **Bantuan kontekstual Simulasi/Opname** (poin 5) — fitur baru kecil, bukan perbaikan bug.
