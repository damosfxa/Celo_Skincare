"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Reset posisi scroll ke paling atas tiap pindah HALAMAN (pathname
 * berubah) di dashboard. Sengaja pakai usePathname (bukan searchParams)
 * supaya cuma bereaksi pas beneran pindah halaman -- klik badge produk di
 * Anomali Harian (yang cuma ganti query string di halaman Ledger yang sama)
 * TIDAK memicu ini, biar tidak bentrok sama scroll-ke-tabel-drilldown yang
 * sudah ada.
 *
 * Kenapa perlu ini secara manual: sejak sidebar dibikin nempel (h-screen +
 * #main-scroll-area jadi kotak scroll sendiri), window/body tidak lagi ikut
 * scroll -- jadi mekanisme scroll-restoration bawaan Next.js (yang cuma
 * reset window) tidak lagi berpengaruh. #main-scroll-area sendiri tetap
 * sama sepanjang navigasi (cuma isinya/{children} yang berganti), jadi
 * tanpa ini posisi scroll halaman lama kebawa ke halaman baru.
 */
export function ScrollResetOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    document.getElementById("main-scroll-area")?.scrollTo({ top: 0 });
  }, [pathname]);

  return null;
}
