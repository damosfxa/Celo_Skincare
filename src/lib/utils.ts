import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Scroll halus ke elemen dengan id tertentu, kalau ada. Dipakai bareng oleh
 * HashScrollHandler (scroll ke bagian Panduan) dan halaman Ledger (scroll
 * ke tabel Drilldown) -- dua-duanya cuma butuh 1 baris DOM call ini, cuma
 * beda soal KAPAN dianggap "siap" buat discroll (itu tetap logika masing-
 * masing pemanggil, bukan bagian dari fungsi ini).
 */
export function scrollElementIntoView(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}