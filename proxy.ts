import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Jalan di semua path KECUALI:
     * - file statis Next.js (_next/static, _next/image)
     * - favicon.ico
     * - route API (/api/*) -- dikecualikan karena API tidak butuh redirect
     *   ke halaman Login (bukan halaman yang dilihat manusia), bukan karena
     *   semuanya sudah tervalidasi sendiri. KOREKSI (ditemukan lewat code
     *   review): sebagian besar endpoint GET di sini TIDAK punya pengecekan
     *   auth.getUser()/getSession() sendiri, murni mengandalkan RLS Postgres.
     *   Endpoint yang MENULIS data (koreksi ledger, intake batch, opname,
     *   dst) sudah eksplisit cek auth di kodenya masing-masing, tapi
     *   endpoint baca-saja belum tentu. Ini bukan celah yang dibuat sesi
     *   ini, tapi dicatat di sini biar tidak ada yang salah kira semua
     *   endpoint /api/ otomatis terlindungi.
     * - file aset publik (gambar, dll)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
