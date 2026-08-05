# BUG URGENT: kamera tidak berhenti setelah QR berhasil dipindai

**Untuk:** Gemini (Antigravity)
**Dibuat:** 2026-08-05 oleh Claude Code
**Prioritas: TINGGI.** Sudah live di production (commit `4678ef7`), dan menyentuh fitur yang dipakai operator gudang sehari-hari.
**Lanjutan dari:** `TUGAS-LINT-UNTUK-GEMINI-LANJUTAN.md` bagian 2a

---

## Ini bukan dugaan, sudah dibuktikan di HP asli

Pemilik project menguji langsung di HP Android, di aplikasi live. Hasilnya:

1. **Kamera tetap menyala setelah dialog scanner tertutup.** Titik hijau indikator kamera di status bar Android tetap ada.
2. **Toast "QR Berhasil dipindai!" muncul berulang-ulang tanpa henti**, menumpuk di layar. Ini artinya scanner tidak pernah berhenti dan terus membaca ulang QR yang sama berkali-kali per detik.
3. Kolom "Batch ID" terus-menerus ditimpa hasil pembacaan berulang itu.

Efek ini lebih parah dari yang diperkirakan sebelumnya: bukan sekadar kamera lupa dimatikan, tapi callback sukses ikut terpanggil berulang kali, sehingga `onScan` (yang mengisi form Stok Opname) juga dieksekusi berkali-kali.

---

## Akar masalahnya

Ada di perubahan terakhir pada `src/components/opname/camera-scanner.tsx`, saat teardown dipindahkan dari `useEffect` ke `handleOpenChange`.

**Sebelum perubahan**, penghentian kamera ada di dalam `useEffect` yang mengawasi `isOpen`:

```tsx
useEffect(() => {
  if (!isOpen) {
    setZoomCapability(null);
    if (scannerRef.current && isScanning) {
      scannerRef.current.stop().then(() => {
        setIsScanning(false);
        scannerRef.current?.clear();
      }).catch(() => {});
    }
    return;
  }
  // ... start scanner
}, [isOpen]);
```

Dengan pola itu, **apa pun** yang membuat `isOpen` jadi `false` akan menghentikan kamera.

**Sesudah perubahan**, teardown hanya ada di `handleOpenChange` (baris 137-152). Masalahnya: `handleOpenChange` **hanya dipanggil oleh komponen Dialog** ketika pengguna menekan Escape, klik di luar, atau klik tombol tutup.

Tapi jalur sukses scan di baris 63-69 menutup dialog dengan cara lain:

```tsx
(decodedText) => {
  toast.success("QR Berhasil dipindai!");
  onScanRef.current(decodedText);
  setIsOpen(false);        // <-- ini TIDAK memicu onOpenChange
},
```

`setIsOpen(false)` mengubah state React secara langsung. Komponen Dialog tidak memanggil `onOpenChange` untuk perubahan yang datang dari luar dirinya (itu memang desainnya, kalau tidak akan terjadi loop tak berujung). Jadi `handleOpenChange` tidak pernah jalan, dan `scannerRef.current.stop()` tidak pernah dipanggil.

Karena scanner masih berjalan, callback sukses terus terpanggil setiap frame yang berhasil membaca QR, dan dari situlah spam toast berasal.

Cleanup pada `useEffect` di baris 32-42 tidak menolong, karena itu hanya jalan saat komponen benar-benar dilepas dari layar, sedangkan komponen `CameraScanner` tetap terpasang (tombol pemicunya masih ada di halaman).

---

## Perbaikan yang disarankan

Prinsipnya: **hentikan scanner di jalur sukses juga**, jangan mengandalkan `handleOpenChange` saja.

Cara paling bersih adalah membuat satu fungsi penghenti yang dipakai bersama, lalu memanggilnya di kedua jalur.

```tsx
// satu fungsi untuk semua jalur penutupan
const stopScanner = useCallback(async () => {
  setZoomCapability(null);
  const scanner = scannerRef.current;
  if (!scanner) return;
  try {
    await scanner.stop();
    scanner.clear();
  } catch {
    // scanner mungkin memang sudah berhenti, aman diabaikan
  } finally {
    setIsScanning(false);
  }
}, []);
```

Lalu di callback sukses (baris 63-69), hentikan dulu baru tutup dialog:

```tsx
(decodedText) => {
  // hentikan SEBELUM apa pun, supaya callback ini tidak terpanggil berulang
  void stopScanner();
  toast.success("QR Berhasil dipindai!");
  onScanRef.current(decodedText);
  setIsOpen(false);
},
```

Dan di `handleOpenChange`:

```tsx
const handleOpenChange = (open: boolean) => {
  setIsOpen(open);
  if (!open) {
    void stopScanner();
  }
};
```

Sebagai jaring pengaman, `useEffect` cleanup di baris 32-42 juga sebaiknya memakai `stopScanner` yang sama, supaya semua jalur benar-benar seragam.

**Catatan penting soal spam toast:** memanggil `stopScanner()` di baris paling awal callback sukses itu bukan sekadar kerapian. Kalau `toast.success` dan `onScanRef.current` dipanggil lebih dulu, tetap ada kemungkinan beberapa frame terlanjur terbaca sebelum `stop()` selesai, dan toast tetap muncul beberapa kali. Menghentikan lebih dulu memperkecil jendela itu.

Kalau ternyata masih ada toast ganda, tambahkan penjaga sederhana dengan `useRef` (misalnya `hasScannedRef`) yang diset `true` begitu satu scan sukses, dan dicek di awal callback supaya isi callback hanya jalan sekali per sesi buka dialog. Jangan pakai `useState` untuk penjaga ini, karena perubahannya tidak langsung terlihat oleh callback yang sedang berjalan.

---

## WAJIB: cara memverifikasi

Keempat perintah otomatis (`tsc`, `lint`, `build`, `test`) **tidak akan menangkap bug ini**, karena ini soal perilaku runtime dengan perangkat keras kamera. Semuanya sudah lulus hijau ketika bug ini ada dan aktif di production.

Jadi verifikasinya **wajib manual di perangkat berkamera**:

1. Buka Stok Opname, masuk sesi yang aktif, klik ikon kamera
2. Scan satu QR sampai muncul toast "QR Berhasil dipindai!"
3. **Toast harus muncul TEPAT SATU KALI**, tidak menumpuk
4. Setelah dialog tertutup, **indikator kamera perangkat harus MATI** (di Android: titik hijau di status bar hilang; di iPhone: titik oranye/hijau hilang)
5. Klik ikon kamera lagi, pastikan kamera **menyala normal** dan bisa scan lagi tanpa error "Gagal mengakses kamera"
6. Ulangi langkah 2 sampai 5 sekali lagi, untuk memastikan buka-tutup berkali-kali tetap sehat

Kalau tidak punya perangkat berkamera untuk diuji, **katakan terus terang**, jangan laporkan selesai hanya berdasarkan build hijau. Nanti pemilik project yang mengujinya.

Setelah itu tetap jalankan juga yang otomatis, supaya tidak ada yang rusak:

```
npx tsc --noEmit
```

```
npm run lint
```

```
npm run build
```

```
npm test
```

---

## Konteks tambahan

Perubahan yang memicu bug ini sebenarnya berangkat dari niat baik, yaitu menghilangkan tambalan `setTimeout` di jalur penutupan kamera, dan itu memang permintaan yang sah. Arah pemindahan ke event handler juga masuk akal secara umum. Yang terlewat cuma satu: ada jalur penutupan **kedua** (scan sukses) yang tidak melewati event handler itu.

Bug ini juga menegaskan sesuatu yang berlaku untuk kita semua: linter hijau, TypeScript bersih, dan 28 tes lulus sama sekali bukan jaminan fiturnya benar-benar jalan. Untuk apa pun yang menyentuh perangkat keras, siklus hidup komponen, atau interaksi pengguna, pengujian tangan tetap tidak tergantikan.
