"use client";

import { useEffect } from "react";
import { scrollElementIntoView } from "@/lib/utils";

/**
 * Scroll manual & pasti ke elemen yang id-nya cocok dengan hash URL
 * (contoh: /panduan#opname -> elemen id="opname").
 *
 * Kenapa tidak pakai bawaan Next.js (Link ke url ber-#)? Di halaman yang
 * panjang seperti Panduan, perilaku bawaannya kadang berhenti di tengah
 * jalan sebelum sampai ke bagian yang dituju. Komponen ini ambil alih
 * sepenuhnya: tunggu layout selesai kegambar, baru scroll halus ke id yang
 * dituju. Pasangkan dengan `scroll={false}` di <Link> yang mengarah ke sini
 * supaya tidak ada 2 mekanisme scroll yang rebutan.
 */
export function HashScrollHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const id = decodeURIComponent(hash.slice(1));
    const scrollToTarget = () => scrollElementIntoView(id);

    // Tunggu 1 tarikan napas biar font/ikon/layout selesai menetap dulu,
    // supaya posisi yang dituju sudah final (tidak berubah lagi) pas discroll.
    const timer = window.setTimeout(scrollToTarget, 150);
    // Jaga-jaga kalau ada aset yang masih nyusul (gambar, dll) dan geser
    // ulang tata letak setelah timer di atas selesai.
    window.addEventListener("load", scrollToTarget);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", scrollToTarget);
    };
  }, []);

  return null;
}
