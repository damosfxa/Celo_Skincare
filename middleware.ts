import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Jalan di semua path KECUALI:
     * - file statis Next.js (_next/static, _next/image)
     * - favicon.ico
     * - route API (/api/*) -- endpoint ini sudah cek auth sendiri lewat
     *   Supabase client masing-masing, tidak perlu redirect ke halaman login
     * - file aset publik (gambar, dll)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
