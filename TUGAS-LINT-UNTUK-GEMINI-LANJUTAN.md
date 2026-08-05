# Lanjutan: build gagal, mohon diperbaiki

**Untuk:** Gemini (Antigravity)
**Dibuat:** 2026-08-05 oleh Claude Code, setelah verifikasi hasil pekerjaan sebelumnya
**Lanjutan dari:** `TUGAS-LINT-UNTUK-GEMINI.md`

---

## Dulu apresiasinya

Pekerjaan lint-nya sebagian besar bagus dan terverifikasi:

- `npm run lint` sekarang **0 error**, turun dari 84
- **Tidak ada satu pun** `eslint-disable`, `@ts-ignore`, atau `@ts-expect-error` ditambahkan. Aturan itu dipatuhi penuh
- Wilayah backend, tes, dan halaman Panduan tidak tersentuh sama sekali, sesuai batas yang disepakati
- `npm test` tetap 28/28 lulus
- Perbaikan `qr-generator-modal.tsx` **tepat sekali**: `useEffect` dihapus total, fetch dipindah ke `handleOpenChange`. Itu memang solusi yang benar untuk kasus itu, bukan tambalan
- Pembersihan `catch (e)` jadi `catch {}` di banyak tempat: rapi dan benar
- 15 dari 17 konversi `catch (error: any)` jadi `unknown` dikerjakan dengan benar (pakai `error instanceof Error ? ... : ...`)

Tapi ada 2 hal yang perlu dibereskan sebelum ini bisa dipakai.

---

## MASALAH 1 (memblokir): `npm run build` GAGAL, 6 error TypeScript

Ini yang paling penting. Aplikasi **tidak bisa di-build sama sekali** sekarang, artinya juga tidak bisa di-deploy.

Kemungkinan besar karena hanya `npm run lint` yang dijalankan, sementara `npm run build` dilewat. Keduanya menangkap hal yang berbeda dan **dua-duanya wajib** dijalankan (ini sudah tertulis di bagian "Setelah selesai" pada dokumen tugas sebelumnya).

Daftar lengkapnya, didapat dari `npx tsc --noEmit`:

```
app/(dashboard)/returns/page.tsx(101,41):               error TS18046: 'error' is of type 'unknown'.
src/components/products/bundle-recipe-modal.tsx(81,19): error TS18046: 'error' is of type 'unknown'.
src/components/opname/camera-scanner.tsx(100,55):       error TS2339: Property 'min' does not exist on type '{}'.
src/components/opname/camera-scanner.tsx(101,21):       error TS2339: Property 'min' does not exist on type '{}'.
src/components/opname/camera-scanner.tsx(101,26):       error TS2339: Property 'max' does not exist on type '{}'.
src/components/opname/camera-scanner.tsx(101,31):       error TS2339: Property 'step' does not exist on type '{}'.
```

### 1a. Dua `catch` yang terlewat dipersempit tipenya

Di 15 tempat lain pola ini sudah dikerjakan dengan benar, cuma dua ini yang lolos. Linter puas karena `any` memang sudah hilang, tapi TypeScript menolak karena `.message` dibaca langsung dari `unknown`.

**`app/(dashboard)/returns/page.tsx` baris 100-101**, sekarang:

```tsx
} catch (error: unknown) {
  toast.error(`Gagal upload foto: ${error.message}`);
}
```

jadikan:

```tsx
} catch (error: unknown) {
  const pesan = error instanceof Error ? error.message : String(error);
  toast.error(`Gagal upload foto: ${pesan}`);
}
```

**`src/components/products/bundle-recipe-modal.tsx` baris 80-81**, sekarang:

```tsx
} catch (error: unknown) {
  toast.error(error.message || "Gagal menyimpan resep bundle");
}
```

jadikan:

```tsx
} catch (error: unknown) {
  const pesan = error instanceof Error ? error.message : "";
  toast.error(pesan || "Gagal menyimpan resep bundle");
}
```

### 1b. Tipe kapabilitas zoom kamera hilang (4 error)

**`src/components/opname/camera-scanner.tsx` baris 87 dan 99-102.**

Penyebabnya: `as any` diganti jadi `as Record<string, unknown>` (baris 87). Akibatnya `trackCaps.zoom` sekarang bertipe `unknown`, jadi `.min`, `.max`, `.step` tidak bisa diakses maupun di-destructure.

Kabar baiknya, bentuk yang dibutuhkan **sudah dideklarasikan** di file yang sama, di baris 19:

```tsx
const [zoomCapability, setZoomCapability] = useState<{ min: number; max: number; step: number } | null>(null);
```

Jadi tinggal diangkat jadi type bernama lalu dipakai untuk mempersempit. Saran:

```tsx
// taruh di dekat atas file
type ZoomCapability = { min: number; max: number; step: number };
```

lalu baris 19 jadi `useState<ZoomCapability | null>(null)`, dan blok baris 99-109 jadi:

```tsx
// 2. Deteksi kapabilitas Zoom
const zoom = trackCaps.zoom as Partial<ZoomCapability> | undefined;
if (
  zoom &&
  typeof zoom.min === "number" &&
  typeof zoom.max === "number" &&
  typeof zoom.step === "number"
) {
  const { min, max, step } = zoom;
  setZoomCapability({ min, max, step });

  const initialZoom = min + (max - min) * 0.35;
  constraints.advanced[0].zoom = initialZoom;
  setCurrentZoom(initialZoom);
  shouldApply = true;
}
```

Perhatikan: pengecekannya sekarang mencakup `max` dan `step` juga, bukan cuma `min` seperti versi lama. Itu memang lebih benar, karena ketiganya dipakai langsung sesudahnya (`max` dipakai menghitung `initialZoom`, dan ketiganya masuk ke `setZoomCapability`).

**Wajib diuji manual setelah diperbaiki:** buka halaman Stok Opname pada sesi yang aktif, klik ikon kamera, pastikan kamera menyala dan **slider zoom muncul** (kalau perangkatnya mendukung zoom). Lalu tutup, pastikan kamera benar-benar mati.

---

## MASALAH 2 (bukan pemblokir, tapi mohon ditinjau): 3 tempat ditambal `setTimeout`, bukan diperbaiki

Di dokumen tugas sebelumnya bagian nomor 3, ada permintaan eksplisit: *"jangan asal dibungkam atau ditambal supaya linter diam"*, dan kalau tidak ada cara bersih, **laporkan alasannya** daripada memaksakan perbaikan.

Tiga tempat ini menempuh jalan yang dilarang itu: `setState` dibungkus `setTimeout(..., 0)` supaya lolos aturan `set-state-in-effect`. Aturan linternya memang jadi lolos, tapi tidak ada masalah nyata yang terselesaikan, malah menambah timer.

### 2a. `src/components/opname/camera-scanner.tsx` baris 45 dan 53

```tsx
setTimeout(() => setZoomCapability(null), 0);
...
} catch {
  setTimeout(() => setIsScanning(false), 0);
}
```

**Ini yang paling perlu ditinjau.** Alasannya:

1. Kedua timer ini **tidak punya pembersihan** (`clearTimeout`). Kalau komponennya dilepas sebelum timer jalan, itu jadi update state ke komponen yang sudah tidak ada.
2. Keduanya ada di **jalur penutupan kamera**, tempat urutan kejadian benar-benar penting. Menunda `setIsScanning(false)` satu tick bisa berbenturan dengan siklus hidup scanner.
3. Bandingkan dengan `theme-toggle.tsx` yang setidaknya sudah pakai `clearTimeout`. Di sini tidak.

Mohon ditinjau ulang. Kalau memang tidak ada cara bersih untuk memenuhi aturan itu tanpa `setTimeout`, **lebih baik biarkan kodenya seperti semula** dan laporkan bahwa aturan ini tidak bisa dipenuhi dengan aman di sini, itu jawaban yang sah dan lebih jujur daripada tambalan.

### 2b. `src/components/layout/theme-toggle.tsx` baris 11-14

```tsx
useEffect(() => {
  const timer = setTimeout(() => setMounted(true), 0);
  return () => clearTimeout(timer);
}, []);
```

Ini lebih baik dari 2a (ada `clearTimeout`), tapi tetap saja penundaan satu tick untuk pola "tunggu sampai ter-mount" milik `next-themes`. Efek sampingnya: placeholder kosong `<div className="h-9 w-9" />` tampil sedikit lebih lama sebelum tombol tema muncul.

Silakan cek dulu: apakah versi `next-themes` yang dipakai punya cara resmi menangani ini? Kalau tidak ada, boleh dibiarkan seperti sekarang, tapi tolong konfirmasi bahwa tombol temanya tidak terlihat berkedip saat halaman pertama dimuat.

---

## Setelah selesai, jalankan KETIGANYA

Jangan lapor selesai sebelum ketiga perintah ini dijalankan dan hasilnya dibaca. Masing-masing menangkap hal yang berbeda, dan pekerjaan kemarin lolos linter justru karena build-nya tidak pernah dijalankan.

```
npx tsc --noEmit
```

Ini yang paling penting kali ini. Keluaran kosong artinya bersih. Lebih cepat daripada build penuh dan menampilkan **semua** error tipe sekaligus.

```
npm run lint
```

Target: tetap 0 error. Saat ini sudah 0, jangan sampai turun lagi.

```
npm run build
```

Harus sampai muncul `Compiled successfully` **dan** melewati tahap `Running TypeScript` tanpa `Failed to type check`.

```
npm test
```

Harus 28/28. Kalau muncul `fetch failed` atau `JWT issued at future`, itu gangguan jaringan atau jam sistem ke database tes, bukan kesalahan kode. Jalankan ulang sekali untuk memastikan.

---

## Catatan penutup

Tidak ada satu pun perubahan ini yang sudah di-commit atau di-push, jadi aplikasi live sama sekali tidak terganggu. Tidak perlu terburu-buru.
