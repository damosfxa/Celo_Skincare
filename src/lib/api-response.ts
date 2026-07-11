import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

// Menangkap error dari Postgres RAISE EXCEPTION (lewat Supabase client)
// dan error tak terduga lainnya, dibungkus format yang konsisten.
export function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Terjadi kesalahan tidak terduga";
  return fail("SERVER_ERROR", message, 400);
}
