# Tugas: Bereskan sisa error ESLint di wilayah frontend

**Untuk:** Gemini (Antigravity)
**Dibuat:** 2026-08-05 oleh Claude Code
**Konteks lengkap:** `task.md` bagian "TASK D"

---

## Ringkas

`npm run lint` di project ini gagal. Awalnya 105 masalah (84 error). Bagian backend, halaman Panduan, dan file tes sudah dibereskan Claude, sekarang tersisa **46 masalah (27 error, 19 warning)**, semuanya di wilayah frontend: `app/(dashboard)/**` (kecuali `panduan`), `src/components/**`, `src/hooks/**`, `app/login/**`.

**Kenapa ini perlu dikerjakan:** brief bounty menaruh *"Kualitas teknis, kode rapi, deploy stabil"* sebagai kriteria penilaian #4. Linter gagal adalah hal paling gampang dicek reviewer.

**Kenapa baru ketahuan sekarang:** di Next.js 16, `next build` **tidak menjalankan ESLint**. Jadi "build hijau" selama ini sama sekali bukan bukti kode lolos linter. Ini penting diingat: jangan pakai `npm run build` untuk memverifikasi pekerjaan ini.

**Cara verifikasi yang benar:**

```
npx eslint "app/(dashboard)" "src/components" "src/hooks" "app/login"
```

Target: keluaran kosong (nol error). Warning boleh disisakan kalau memang disengaja, tapi lebih baik nol juga.

---

## PENTING sebelum mulai

1. **Jangan sentuh file di luar wilayah frontend.** `app/api/**`, `src/lib/**`, `tests/**`, dan `app/(dashboard)/panduan/**` sudah nol error, jangan diubah lagi.
2. **Jangan bungkam linter.** Dilarang menambah `// eslint-disable`, `@ts-ignore`, atau `@ts-expect-error`. Saat ini seluruh project nol pemakaian ketiganya, jangan jadi yang pertama.
3. **Jangan ubah logika bisnis.** Ini pekerjaan kerapian tipe, bukan refactor perilaku. Kalau suatu perbaikan memaksa mengubah alur, berhenti dan laporkan dulu.
4. Setelah selesai, jalankan **ketiganya**: `npx eslint ...` (perintah di atas), `npm run build`, dan `npm test` (harus tetap 28/28).

---

## 1. `@typescript-eslint/no-explicit-any`, 22 error

Ini yang paling banyak. Sebagian besar pola yang sama persis: `catch (error: any)`.

### Pola A: `catch (error: any)` lalu baca `.message`

Lokasinya:

| File | Baris |
|---|---|
| `app/(dashboard)/simulation/page.tsx` | 64, 93, 138, 212, 229 |
| `app/(dashboard)/ledger/page.tsx` | 101 |
| `app/(dashboard)/opname/[id]/page.tsx` | 104, 134 |
| `app/(dashboard)/opname/page.tsx` | 26 |
| `app/(dashboard)/products/[id]/page.tsx` | 78 |
| `app/(dashboard)/returns/page.tsx` | 100, 126 |
| `src/components/products/bundle-recipe-modal.tsx` | 80 |
| `src/components/products/create-product-form.tsx` | 69 |
| `src/components/products/intake-batch-form.tsx` | 72 |
| `src/components/products/opening-balance-form.tsx` | 72 |
| `src/components/products/qr-generator-modal.tsx` | 55 |
| `src/components/opname/camera-scanner.tsx` | 135 |

**Cara memperbaiki:** ganti `any` jadi `unknown`, lalu persempit tipenya sebelum membaca `.message`. Contoh pola yang aman:

```ts
} catch (error: unknown) {
  const pesan = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga";
  toast.error(pesan);
}
```

Kalau pola `error instanceof Error ? ... : ...` ini muncul di banyak tempat, **boleh** dibuat satu helper kecil (misalnya `src/lib/error-message.ts`) lalu dipakai bersama. Itu lebih rapi daripada mengulang di 15 tempat.

### Pola B: `any` di tempat lain (bukan catch)

| File | Baris | Konteks |
|---|---|---|
| `app/(dashboard)/ledger/page.tsx` | 33 | perlu dilihat dulu, kemungkinan tipe state/data |
| `app/(dashboard)/simulation/page.tsx` | 41 | `useState<{created: number, failed: any[]}>` untuk hasil import CSV |
| `src/components/opname/camera-scanner.tsx` | 87, 90 | kemungkinan tipe dari library `html5-qrcode` |

Untuk baris 41 di `simulation/page.tsx`: bentuk `failed` sebenarnya sudah diketahui, datang dari respons `/api/orders/import`. Deklarasikan bentuk barisnya sebagai `type` lokal, jangan `any[]`.

Untuk `camera-scanner.tsx`: library `html5-qrcode` sudah membawa tipenya sendiri, cek apakah bisa dipakai langsung daripada `any`.

---

## 2. `react/no-unescaped-entities`, 2 error

**`src/components/products/opening-balance-form.tsx` baris 89** (kolom 135 dan 155).

Tanda kutip lurus (`"`) dipakai langsung di dalam teks JSX. Ganti jadi `&quot;`.

Catatan: pakai `&quot;`, **jangan** kutip tipografis (`" "`), supaya tampilan di layar tidak berubah dari yang sudah direview user. Ini pola yang sama yang sudah dipakai di halaman Panduan.

---

## 3. `react-hooks/set-state-in-effect`, 3 error, PERLU DICEK BENERAN

**Ini satu-satunya bagian yang bukan sekadar kerapian.** Pola ini bisa memicu render berulang, jadi jangan asal dibungkam atau ditambal supaya linter diam. Pahami dulu kasusnya baru putuskan.

### 3a. `src/components/layout/theme-toggle.tsx:12`

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <div className="h-9 w-9" />;
```

Ini pola klasik "tunggu sampai ter-mount" untuk menghindari mismatch hydration pada `next-themes`. Secara perilaku memang benar dan aman, tapi ESLint versi baru menandainya.

Cek apakah versi `next-themes` yang dipakai sudah menyediakan cara lain yang lebih bersih untuk ini. Kalau memang tidak ada, dan pola ini terpaksa dipertahankan, **laporkan ke user dengan alasannya** daripada memaksakan perbaikan yang justru memunculkan kedipan tema saat halaman dimuat.

### 3b. `src/components/products/qr-generator-modal.tsx:65`

```tsx
useEffect(() => {
  if (isOpen) {
    fetchQrData();
  } else {
    setQrData(null);
  }
}, [isOpen]);
```

Di sini pemicunya jelas: buka modal. Umumnya ini lebih cocok dijalankan dari event handler yang membuka modal, bukan dari `useEffect` yang mengamati `isOpen`.

Ada juga warning menyertai di baris 69: dependency `fetchQrData` kurang.

### 3c. `src/components/opname/camera-scanner.tsx:45`

Terkait siklus hidup kamera. **Paling hati-hati di sini**, karena menyangkut membuka dan menutup perangkat kamera. Kalau diubah, wajib diuji manual: buka halaman Stok Opname, klik ikon kamera, pastikan kamera benar-benar menyala, lalu tutup dan pastikan kamera benar-benar mati (lampu indikator kamera padam).

---

## 4. `react-hooks/incompatible-library`, 2 warning

`app/(dashboard)/opname/[id]/page.tsx:48` dan `app/(dashboard)/returns/page.tsx:69`.

Keduanya dari `form.watch(...)` milik React Hook Form, yang tidak bisa di-memoize oleh React Compiler. Ini keterbatasan library, bukan kesalahan penulisan kode.

**Boleh dibiarkan** kalau tidak ada cara bersih menghindarinya. Kalau dibiarkan, cukup catat alasannya, jangan dibungkam dengan komentar `eslint-disable`.

---

## 5. `@typescript-eslint/no-unused-vars`, 12 warning

Impor dan variabel sisa yang tidak terpakai. Aman dan cepat dihapus.

| File | Baris | Yang tidak terpakai |
|---|---|---|
| `app/(dashboard)/ledger/page.tsx` | 17 | `FileDigit` |
| `app/(dashboard)/ledger/page.tsx` | 41 | `isLoadingProducts` |
| `app/(dashboard)/notifications/page.tsx` | 7 | `AlertTriangle` |
| `app/(dashboard)/opname/[id]/page.tsx` | 10 | `CardFooter` |
| `app/(dashboard)/products/page.tsx` | 3 | `useState` |
| `app/login/page.tsx` | 18 | `CardFooter` |
| `src/hooks/useOrders.ts` | 1 | `toast` |
| `src/components/opname/camera-scanner.tsx` | 35, 53, 114 | parameter `e` di blok catch |
| `src/components/opname/camera-scanner.tsx` | 81 | `errorMessage` |
| `src/components/opname/camera-scanner.tsx` | 136 | `err` |

Untuk parameter catch yang memang sengaja diabaikan, TypeScript modern mengizinkan `catch { ... }` tanpa parameter sama sekali. Itu lebih bersih daripada menamainya `_e`.

**Hati-hati di `ledger/page.tsx:41`:** `isLoadingProducts` tidak terpakai, tapi cek dulu, mungkin memang seharusnya dipakai untuk menampilkan status memuat dan itu terlewat. Kalau iya, lebih baik dipakai daripada dihapus.

---

## 6. `@next/next/no-img-element`, 2 warning

`app/(dashboard)/returns/page.tsx` baris 326 dan 363. Saran mengganti `<img>` dengan `<Image />` dari `next/image`.

Keduanya menampilkan **foto bukti retur** yang di-upload operator ke Supabase Storage. `next/image` butuh konfigurasi domain yang diizinkan di `next.config.ts`, dan untuk gambar dari storage eksternal seringkali tidak sepadan usahanya.

**Boleh diabaikan** kalau memang keputusan sadar. Kalau diabaikan, catat alasannya, jangan pakai `eslint-disable`.

---

## Prioritas kalau waktu terbatas

1. **Nomor 1 (22 error `any`)** dan **nomor 2 (2 error kutip)**, ini yang membuat jumlah error turun paling banyak dan risikonya paling rendah
2. **Nomor 5 (12 warning unused)**, cepat dan aman
3. **Nomor 3 (3 error hooks)**, perlu dipikir, jangan diburu-buru
4. **Nomor 4 dan 6 (4 warning)**, boleh dibiarkan dengan catatan alasan

Selesai nomor 1, 2, dan 5 saja sudah membuat error tinggal 3, semuanya dari nomor 3.

---

## Setelah selesai

Jalankan ketiganya dan laporkan hasil sebenarnya, bukan ringkasan:

```
npx eslint "app/(dashboard)" "src/components" "src/hooks" "app/login"
```

```
npm run build
```

```
npm test
```

Yang terakhir harus tetap **28/28 lulus**. Kalau ada satu tes gagal dengan pesan `JWT issued at future`, itu masalah jam sistem yang sudah pernah terjadi, bukan kesalahan kode. Jalankan ulang sekali untuk memastikan.
