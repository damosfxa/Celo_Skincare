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

  // Match PERSIS "/login", bukan sekadar diawali "/login" -- kalau nanti ada
  // halaman lain namanya diawali "login" (misal /login-help), itu harus
  // dianggap BUKAN halaman login untuk logika di bawah.
  const isLoginPage = request.nextUrl.pathname === "/login";

  // Dipakai di kedua cabang redirect di bawah -- lihat komentar di
  // redirectTo kenapa ini penting.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    // Buang query string asli: kalau tidak, ID produk/state internal dari
    // URL yang diminta ikut terbawa ke URL halaman Login (nyangkut di riwayat
    // browser), padahal halaman Login tidak butuh itu sama sekali.
    url.search = "";
    const response = NextResponse.redirect(url);
    // PENTING: salin cookie yang baru disegarkan (lihat setAll di atas) ke
    // response redirect ini. NextResponse.redirect() bikin objek response
    // BARU dari nol -- kalau cookie yang sudah disegarkan di supabaseResponse
    // tidak disalin ke sini, browser tidak akan pernah menerima token
    // sesi/refresh yang baru itu. Baru ketauan lewat code review: efeknya
    // user bisa ke-logout sendiri tanpa sebab jelas, karena refresh token
    // lama sudah dianggap habis oleh server tapi browser masih pegang yang
    // lama (refresh token bersifat sekali pakai).
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  if (!user && !isLoginPage) {
    return redirectTo("/login");
  }

  // Kalau sudah login tapi masih coba buka halaman Login, langsung
  // arahkan ke dashboard -- tidak perlu lihat form login lagi.
  if (user && isLoginPage) {
    return redirectTo("/");
  }

  // PENTING: kembalikan supabaseResponse apa adanya (bukan bikin response
  // baru), supaya cookie yang baru disegarkan di atas beneran ikut terkirim.
  return supabaseResponse;
}
