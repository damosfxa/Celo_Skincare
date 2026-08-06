# Polish UI ronde 4: ganti transisi tema ke View Transitions API

**Untuk:** Gemini (Antigravity)
**Dibuat:** 2026-08-06 oleh Claude Code.

Jangan ubah logika bisnis apa pun. Cuma `theme-toggle.tsx` + `globals.css`.

---

## Kenapa pendekatan ronde 3 diganti total (bukan ditambal)

Ronde 3 sudah memaksa semua elemen transisi 300ms seragam, dan itu terbukti benar secara pengukuran di halaman sepi (login). TAPI di halaman dalam yang padat (Ledger, Tugas Hari Ini, Retur), pemilik project masih melaporkan **delay + glitch di setiap perpindahan tema, terutama saat pertama kali di halaman baru**.

Diagnosa penyebabnya (sudah dipastikan, bukan tebakan):

1. **Delay**: `setTheme` dari next-themes memicu render ulang React dulu, baru class `.dark` di-flip. Jeda render itu terasa sebagai delay sebelum warna mulai berubah. Paling terasa di halaman yang baru dibuka (React masih sibuk fetch/render data).

2. **Glitch/patah-patah**: pendekatan CSS transition menganimasikan `background-color` di **ratusan elemen sekaligus** (tiap sel tabel, tiap kartu). Di HP, itu membebani main thread/GPU, jadi frame drop. Halaman sepi tidak menunjukkan ini; halaman padat menunjukkannya.

Menambal CSS transition tidak akan menyelesaikan ini, karena masalahnya justru cara kerjanya (per-elemen). Solusinya: pindah ke **View Transitions API**, yang meng-crossfade seluruh halaman sebagai **satu lapisan komposit** (bukan ratusan elemen). Snapshot-nya instan (hilangkan delay), animasinya tunggal (hilangkan frame drop).

---

## Langkah 1: HAPUS blok `.theme-transition` dari `app/globals.css`

Blok yang ditambahkan ronde 3 harus dihapus seluruhnya (View Transitions menggantikannya, kalau dibiarkan malah dobel dan bentrok). Hapus dua blok ini dari `globals.css`:

```css
/* HAPUS blok ini */
.theme-transition,
.theme-transition *,
.theme-transition *::before,
.theme-transition *::after {
  transition-property: background-color, border-color, color, fill, stroke !important;
  transition-duration: 300ms !important;
  transition-timing-function: ease !important;
  transition-delay: 0ms !important;
}

/* HAPUS juga blok reduced-motion yang menyertainya */
@media (prefers-reduced-motion: reduce) {
  .theme-transition,
  .theme-transition *,
  .theme-transition *::before,
  .theme-transition *::after {
    transition-duration: 0ms !important;
  }
}
```

Pastikan `@layer base` tetap seperti aslinya (tanpa transisi di selektor `*`), yaitu:

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

## Langkah 2: TAMBAHKAN CSS View Transitions di `app/globals.css`

Taruh di bagian bawah file:

```css
/* ===== Transisi tema pakai View Transitions API =====
   Browser mengambil snapshot tampilan lama & baru, lalu meng-crossfade
   keduanya sebagai satu lapisan komposit. Jauh lebih ringan & mulus di
   halaman padat dibanding menganimasikan background-color tiap elemen. */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 300ms;
  animation-timing-function: ease;
}

/* Hormati pengguna yang mematikan animasi. */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none !important;
  }
}
```

## Langkah 3: Ganti isi `src/components/layout/theme-toggle.tsx`

Ganti seluruh file jadi begini. Perhatikan 2 hal penting:
- `flushSync` memaksa React menerapkan `setTheme` **secara sinkron di dalam callback** `startViewTransition`, supaya browser menangkap snapshot "sesudah" dengan benar. Tanpa ini, View Transitions tidak akan menangkap perubahan tema (React-nya async).
- Ada fallback `if (!document.startViewTransition)` untuk browser lama yang belum mendukung API ini, dia cuma ganti tema tanpa animasi (degradasi yang aman, bukan error).

```tsx
"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  const isDark = theme === "dark";

  const handleToggle = () => {
    const next = isDark ? "light" : "dark";

    // Browser tanpa dukungan View Transitions: ganti biasa, tanpa animasi.
    if (
      typeof document === "undefined" ||
      !("startViewTransition" in document)
    ) {
      setTheme(next);
      return;
    }

    // Snapshot instan + crossfade satu lapisan. flushSync wajib supaya
    // perubahan tema benar-benar diterapkan ke DOM di dalam callback ini,
    // jadi browser menangkap state "sesudah" dengan tepat.
    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(next);
      });
    });
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

Catatan: `setTimeout(() => setMounted(true), 0)` yang lama diganti jadi `setMounted(true)` biasa di dalam `useEffect`. Delay `setTimeout(0)` itu tidak perlu dan justru menambah sedikit jeda saat komponen baru mount di halaman baru (salah satu keluhan pemilik project soal "pertama kali di halaman baru terasa delay"). `useEffect` sendiri sudah jalan setelah mount, cukup untuk mencegah hydration mismatch.

---

## Kenapa ini menyelesaikan ketiga keluhan

- **"Pertama kali di halaman baru delay + glitch"**: snapshot View Transitions instan, tidak menunggu React selesai render. Plus `setMounted(true)` langsung (tanpa `setTimeout(0)`) menghilangkan jeda mount.
- **"Setiap ganti mode glitch"**: crossfade satu lapisan komposit, bukan ratusan elemen dianimasikan, jadi tidak ada frame drop walau di halaman padat.
- **"Delay sebelum warna berubah"**: `flushSync` + snapshot instan bikin perubahan terlihat seketika diklik.

---

## WAJIB dicek manual (ini inti masalahnya, build hijau bukan bukti)

Setelah dipasang, deploy lalu tes di HP **langsung di halaman dalam yang padat** (Ledger, Tugas Hari Ini, Retur):

1. Klik ganti tema di **halaman yang baru saja dibuka** (mis. baru pindah ke Retur, langsung klik toggle). Harus langsung mulus, tanpa delay, tanpa patah.
2. Klik **berulang cepat** beberapa kali. Konsisten mulus tiap kali?
3. Coba **dua arah** (terang ke gelap dan sebaliknya).
4. Cek di beberapa halaman berbeda.

Kalau masih ada yang kurang, sebutkan halaman + gejala persisnya.

Catatan dukungan browser: View Transitions API didukung Chrome/Edge/Android Chrome (versi 2023+) dan Safari 18+. Pemilik project pakai Android Chrome, jadi aman. Browser lama otomatis pakai fallback (ganti tema tanpa animasi, tidak error).

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

Laporkan hasil sebenarnya. Tapi ingat: untuk masalah ini, **yang menentukan adalah tes manual di HP pada halaman padat**, bukan build hijau.
