# Polish UI ronde 2: logo asli, konsistensi loading, transisi tema

**Untuk:** Gemini (Antigravity)
**Dibuat:** 2026-08-06 oleh Claude Code, setelah pemilik project cek langsung di HP/browser dan kasih 3 temuan.

Jangan ubah logika bisnis apa pun. Murni polish visual, sama seperti ronde sebelumnya.

---

## 1. Ganti badge "CB" dengan logo asli

**Sudah disiapkan:** file logo asli sudah ada di `public/logo-celo-beaute.jpg` (1080x1080, monogram lingkaran + tulisan "CELO", latar pink). Ini bukan file baru, sebelumnya cuma salah tempat, tersimpan sebagai `app/favicon.ico` (isinya JPEG, cuma namanya `.ico`). File itu dibiarkan apa adanya karena Next.js masih memakainya sebagai favicon tab browser, jangan dihapus.

**Yang perlu diubah:** di `app/(dashboard)/layout.tsx`, ada 3 tempat kotak "CB" (`bg-primary text-primary-foreground`, isi teks "CB") ditambahkan ronde sebelumnya, di topbar mobile, sheet mobile, dan sidebar desktop. Ganti ketiganya jadi gambar logo, pakai komponen `Image` dari `next/image` (bukan tag `<img>` biasa, supaya tidak kena warning `no-img-element` dari linter):

```tsx
import Image from "next/image";

<Image
  src="/logo-celo-beaute.jpg"
  alt="Celo Beaute"
  width={32}
  height={32}
  className="rounded-md object-cover"
/>
```

**Catatan desain, tolong dicek langsung setelah dipasang:** logo aslinya berlatar belakang pink solid (bukan transparan), jadi begitu ditaruh dalam kotak kecil `rounded-md` di sidebar, warnanya akan beda dari kotak "CB" yang sebelumnya pakai warna aksen biru (`bg-primary`). Ini kemungkinan besar tetap terlihat bagus (pink lembut cocok untuk brand skincare), tapi tolong dilihat dulu di kedua mode (terang & gelap) sebelum dianggap selesai, pink solid di background gelap bisa kelihatan mencolok. Kalau memang terasa mengganggu, opsi amannya: bungkus logo dalam kotak putih kecil (`bg-white p-1 rounded-md`) supaya warna pink logo tidak langsung bertabrakan dengan warna latar sidebar.

---

## 2. Konsistensi loading: ganti spinner jadi skeleton, tapi HANYA yang tepat

**Penting, baca dulu sebelum mulai:** jangan ganti SEMUA pemakaian `Loader2` yang ketemu lewat grep. Ada dua jenis pemakaian yang beda kegunaannya:

- **Loading level halaman/section** (nunggu data datang sebelum konten muncul), ini yang dikeluhkan pemilik project ("beberapa tab yang loadingnya muter"), **ini yang harus diganti jadi Skeleton**.
- **Loading di dalam tombol** (nunggu aksi selesai setelah user klik submit, misalnya "Simpan...", "Mengirim...", ikon `Loader2` kecil `h-4 w-4` di sebelah teks tombol), **ini JANGAN diganti**. Skeleton tidak masuk akal di dalam tombol, spinner kecil di situ sudah pola yang benar dan sudah dipakai konsisten di seluruh aplikasi.

### Yang PERLU diganti jadi Skeleton (loading level halaman/section)

| File | Baris | Konteks |
|---|---|---|
| `app/(dashboard)/notifications/page.tsx` | 79, 140, 202 | 3 section terpisah (Barang Kedaluwarsa, Klaim TikTok, Stok Awal Belum Terverifikasi) |
| `app/(dashboard)/opname/page.tsx` | 85 | Daftar riwayat sesi opname |
| `app/(dashboard)/opname/[id]/page.tsx` | 143, 267 | 143 = loading halaman detail sesi; 267 = loading sub-bagian (cek konteksnya dulu sebelum ganti, pastikan memang bukan di dalam tombol) |
| `app/(dashboard)/products/[id]/page.tsx` | 90 | Loading halaman detail produk |
| `app/(dashboard)/returns/page.tsx` | 164 | Daftar antrean retur |

Polanya sama seperti yang sudah dikerjakan di `ledger/page.tsx` dan `products/page.tsx` ronde sebelumnya: bikin bentuk skeleton yang kira-kira menyerupai layout konten aslinya (baris tabel, kartu, dsb), bukan satu kotak besar generik.

### Yang JANGAN diganti (loading di dalam tombol, sudah benar apa adanya)

Semua ini biarkan seperti sekarang: `opname/page.tsx:54`, `opname/[id]/page.tsx:177`, `products/[id]/page.tsx:290`, `returns/page.tsx:320` & `345`, seluruh `simulation/page.tsx` (semua pemakaian `Loader2` di file itu ada di dalam tombol), `login/page.tsx:125`, dan semua pemakaian di form/modal (`create-product-form.tsx`, `intake-batch-form.tsx`, `opening-balance-form.tsx`, `camera-scanner.tsx`).

### Dua kasus modal, opsional (prioritas rendah)

`src/components/products/bundle-recipe-modal.tsx:102` dan `src/components/products/qr-generator-modal.tsx:92`, keduanya loading isi modal (bukan tombol), tapi ukurannya kecil dan cepat selesai. Boleh diganti Skeleton kalau sempat, boleh juga dibiarkan, dampaknya kecil karena bukan "tab" yang dikeluhkan.

---

## 3. Transisi mode gelap/terang yang smooth

**Lokasi:** `app/globals.css`, bagian `@layer base`.

**Cara paling aman:** tambahkan `transition-property` yang **dibatasi cuma ke properti warna** (bukan `transition: all`), supaya animasinya smooth pas ganti tema tapi tidak bikin elemen lain (hover tombol, dropdown, dsb) jadi terasa lambat/ketunda gara-gara ikut ke-transition semua propertinya.

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
    transition-property: background-color, border-color, color, fill, stroke;
    transition-timing-function: ease;
    transition-duration: 300ms;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

**Kenapa dibatasi ke properti warna saja (bukan pakai `transition: all` di selector `*`):** `transition: all` ikut menganimasikan properti lain seperti `transform` dan `width`, itu bisa bikin efek hover/klik tombol yang sebelumnya instan jadi terasa "nge-lag" 300ms, padahal user tidak lagi ganti tema, cuma hover biasa. Membatasi ke `background-color, border-color, color, fill, stroke` menghindari itu sepenuhnya.

**Wajib dicek setelah dipasang:** klik tombol ganti tema beberapa kali berturut-turut, pastikan transisinya konsisten smooth setiap kali (bukan cuma smooth di klik pertama), dan pastikan tidak ada elemen yang jadi terasa "berat"/telat merespons hover gara-gara transisi ini (coba hover cepat ke beberapa tombol/link berturut-turut).

---

## Setelah selesai

Jalankan seperti biasa dan laporkan hasil sebenarnya:

```
npm run lint
```

```
npm run build
```

```
npm test
```

Untuk poin 1 dan 3, tolong screenshot atau jelaskan hasilnya di kedua mode (terang & gelap) di laporan akhir, supaya pemilik project bisa langsung menilai tanpa harus buka aplikasi dulu.
