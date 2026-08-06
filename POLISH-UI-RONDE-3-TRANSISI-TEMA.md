# Polish UI ronde 3: transisi tema masih glitch, ganti pendekatannya

**Untuk:** Gemini (Antigravity)
**Dibuat:** 2026-08-06 oleh Claude Code, setelah pemilik project menguji langsung.

Jangan ubah logika bisnis apa pun. Murni CSS + sedikit JS di komponen toggle.

---

## Masalahnya (sudah didiagnosa, jangan ditebak ulang)

Pemilik project melaporkan perpindahan mode gelap/terang masih **kurang mulus**: teks nge-glitch, dan sebagian warna berubah telat (tidak barengan).

Akar masalahnya **bukan** kurang transisi, tapi transisi yang saling bertabrakan. Pendekatan ronde 2 menaruh transisi global di selektor universal:

```css
/* app/globals.css, @layer base, INI YANG BERMASALAH */
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-timing-function: ease;
  transition-duration: 300ms;
}
```

Kenapa ini glitch, dicek langsung ke kode:

1. **Durasi bertabrakan.** 9 komponen di `src/components/ui/` punya durasi transisinya sendiri lewat utility Tailwind (`duration-100` di 5 tempat, `duration-150`, `duration-200`, bahkan `transition-all` di 3 tempat). Utility per-elemen ini **menimpa** aturan global `*`. Jadi saat tema diganti: kartu berubah 300ms, tombol 150ms, input 100ms, dropdown 200ms. Berubahnya jadi tidak barengan, itu yang terlihat sebagai "ada yang telat".

2. **Teks nge-glitch.** Warna teks (`color`) ada di elemen anak, warna latar (`background-color`) di elemen induk. Kalau keduanya transisi di kecepatan berbeda (karena poin 1), ada jendela ~100-200ms di mana teks gelap sempat berada di atas latar yang juga masih gelap, kontrasnya rusak sekejap, itulah "glitch"-nya.

3. **Efek samping ke hover.** Selektor `*` global juga membebani transisi hover/focus semua elemen sepanjang waktu, bukan cuma saat ganti tema.

Menambal durasi satu per satu di 9 komponen itu rapuh dan tetap tidak akan seragam. Pendekatan `*` global ini memang cara yang salah untuk transisi tema.

---

## Solusi: transisi yang aktif HANYA selama perpindahan tema, dipaksa seragam

Ini teknik standar yang dipakai aplikasi dengan transisi tema yang benar-benar mulus. Idenya: transisi warna **tidak** menempel permanen di semua elemen. Dia cuma "dinyalakan" sepersekian detik tepat saat tombol tema diklik, dipaksa seragam `!important` supaya semua elemen berubah di kecepatan yang sama persis, lalu dimatikan lagi. Karena cuma aktif saat ganti tema, dia tidak mengganggu animasi hover di waktu lain.

### Langkah 1: HAPUS transisi global di `app/globals.css`

Balikan `@layer base` ke kondisi sebelum ronde 2 (hapus 3 baris transisi yang ditambahkan):

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

### Langkah 2: TAMBAHKAN blok transisi ber-scope di `app/globals.css`

Taruh di luar `@layer base` (di bagian bawah file saja). Perhatikan `!important`, itu yang memaksa SEMUA elemen (termasuk yang punya `duration-150` dsb) berubah di 300ms yang sama persis, jadi tidak ada lagi yang telat:

```css
/* Transisi warna yang HANYA aktif selama perpindahan tema.
   Class .theme-transition ditambahkan ke <html> sesaat oleh tombol
   toggle (lihat theme-toggle.tsx), lalu dilepas lagi setelah 300ms.
   !important sengaja dipakai supaya menimpa durasi bawaan tiap
   komponen shadcn (duration-100/150/200), jadi semua elemen berubah
   warna seragam, tidak ada yang telat. Karena cuma aktif saat ganti
   tema, ini tidak mengganggu animasi hover/focus di waktu lain. */
.theme-transition,
.theme-transition *,
.theme-transition *::before,
.theme-transition *::after {
  transition-property: background-color, border-color, color, fill, stroke !important;
  transition-duration: 300ms !important;
  transition-timing-function: ease !important;
  transition-delay: 0ms !important;
}

/* Hormati pengguna yang mematikan animasi di setelan perangkatnya. */
@media (prefers-reduced-motion: reduce) {
  .theme-transition,
  .theme-transition *,
  .theme-transition *::before,
  .theme-transition *::after {
    transition-duration: 0ms !important;
  }
}
```

### Langkah 3: Ubah `src/components/layout/theme-toggle.tsx`

Bungkus pergantian tema supaya menambah/melepas class `theme-transition` di `<html>`. Isi file lengkapnya jadi begini (logika mount yang sudah ada dipertahankan):

```tsx
"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  const isDark = theme === "dark";

  const handleToggle = () => {
    const root = document.documentElement;
    // Nyalakan transisi warna tepat sebelum tema diganti...
    root.classList.add("theme-transition");
    setTheme(isDark ? "light" : "dark");
    // ...lalu matikan lagi setelah transisi selesai (sedikit lebih
    // lama dari 300ms supaya animasi benar-benar tuntas dulu).
    window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 320);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      title={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

---

## Kenapa pendekatan ini menyelesaikan ketiga gejala

- **"Ada yang telat berubah"** hilang: `!important` memaksa 300ms seragam ke semua elemen, durasi bawaan komponen (`duration-100/150/200`) ditimpa hanya selama perpindahan.
- **"Teks nge-glitch"** hilang: karena teks dan latarnya sekarang transisi di durasi yang sama persis, kontras terjaga sepanjang 300ms, tidak ada jendela di mana teks tak terbaca.
- **Hover tidak ikut melambat**: class `theme-transition` cuma ada ~320ms saat klik tombol, sisanya animasi hover/focus kembali dikontrol utility bawaan komponen seperti semula.

---

## WAJIB dicek manual setelah dipasang (ini inti masalahnya, jangan cuma andalkan build hijau)

Buka aplikasi, lalu:

1. Klik tombol ganti tema **beberapa kali berturut-turut, agak cepat**. Transisinya harus mulus dan konsisten setiap kali, tidak ada teks yang berkedip/hilang sekejap, tidak ada warna yang "menyusul" belakangan.
2. Cek di **halaman yang ramai elemen** (misal Ledger atau Tugas Hari Ini), bukan cuma halaman kosong, karena glitch paling kelihatan di halaman padat.
3. Setelah transisi selesai, **hover cepat ke beberapa tombol/link** berturut-turut, pastikan responnya tetap instan/ringan (tidak ikut melambat 300ms). Kalau hover terasa berat, berarti class `theme-transition` tidak terlepas dengan benar.
4. Cek di **kedua arah**: terang ke gelap DAN gelap ke terang.

Kalau salah satu masih terasa kurang, laporkan gejala persisnya (elemen apa, di halaman mana), jangan cuma "masih kurang", supaya bisa didiagnosa lebih lanjut.

## Setelah selesai

```
npm run lint
```

```
npm run build
```

```
npm test
```

Ketiganya seperti biasa, laporkan hasil sebenarnya. Tapi ingat: untuk masalah ini, **build hijau bukan bukti berhasil**, yang menentukan adalah pengecekan manual di poin di atas.
