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
//
// PENTING: error dari Supabase client (PostgrestError, StorageError, dll)
// itu OBJECT BIASA berbentuk {message, code, details, hint} -- BUKAN
// instance dari class Error bawaan JS. Sebelumnya kode ini cuma cek
// `error instanceof Error`, jadi setiap error dari Supabase selalu jatuh
// ke pesan generik "Terjadi kesalahan tidak terduga", pesan aslinya
// kebuang. Sekarang dicek juga bentuk object dengan properti `message`.
export function handleError(error: unknown) {
  let message = "Terjadi kesalahan tidak terduga";

  if (error instanceof Error) {
    message = error.message;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    message = (error as { message: string }).message;
  }

  return fail("SERVER_ERROR", message, 400);
}