import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Cek status login SEKALI di sini (tiap pindah halaman), sebelum request
 * sampai ke halaman/layout manapun -- bukan lagi diulang-ulang di tiap
 * layout. Ini juga yang menyegarkan (refresh) cookie sesi login supaya
 * tidak keburu kedaluwarsa. Pola ini dari dokumentasi resmi Supabase untuk
 * Next.js App Router.
 *
 * PENTING: jangan taruh logika apa pun di antara createServerClient() dan
 * supabase.auth.getUser() di bawah -- gampang bikin bug halus (user keluar
 * sendiri secara acak) kalau urutannya diubah.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Kalau sudah login tapi masih coba buka halaman Login, langsung
  // arahkan ke dashboard -- tidak perlu lihat form login lagi.
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // PENTING: kembalikan supabaseResponse apa adanya (bukan bikin response
  // baru), supaya cookie yang baru disegarkan di atas beneran ikut terkirim.
  return supabaseResponse;
}
