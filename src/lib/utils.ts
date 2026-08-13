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

/**
 * Bungkus 1 nilai jadi field CSV yang aman sesuai standar RFC 4180: kalau
 * isinya mengandung pemisah (;), tanda kutip ("), atau baris baru, nilainya
 * dibungkus tanda kutip dan tanda kutip di dalamnya digandakan.
 *
 * Kenapa ini penting: nilai seperti tanggal "10 Jul 2026, 14.32" (ada koma
 * di dalamnya) atau catatan bebas yang diketik operator, kalau ditulis
 * mentah tanpa pembungkus ini, bisa bikin Excel/WPS salah baca batas
 * kolomnya -- semua kolom geser. Ditemukan lewat feedback user: hasil
 * Export CSV kelihatan berantakan pas dibuka.
 */
function toCsvField(value: string | number): string {
  const str = String(value);
  return /[;"\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsvRow(values: (string | number)[]): string {
  return values.map(toCsvField).join(";");
}

/**
 * Bikin file CSV dari header + baris data, lalu langsung men-download-nya
 * lewat browser. Dipakai bareng oleh halaman Ledger, Retur, dan Opname,
 * supaya cara bikin CSV-nya konsisten dan sama-sama aman (lihat toCsvField).
 *
 * BOM di depan file SENGAJA ditambahkan: tanpa ini, Excel/WPS di
 * Windows kadang salah tebak encoding file-nya, bikin huruf tertentu
 * kelihatan aneh.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvString = [toCsvRow(headers), ...rows.map(toCsvRow)].join("\r\n");
  const blob = new Blob([String.fromCharCode(0xFEFF) + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}