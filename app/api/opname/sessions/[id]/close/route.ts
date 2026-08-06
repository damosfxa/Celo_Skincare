import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { error } = await supabase.rpc("fn_close_opname_session", {
    p_session_id: id,
    p_closed_by: userData.user.id,
  });
  if (error) return handleError(error);

  const { data: corrections } = await supabase
    .from("opname_items")
    .select("batch_id, system_qty, physical_qty, variance")
    .eq("session_id", id)
    .neq("variance", 0);

  // Batch yang gak sempat dihitung sama sekali -- perlu ditunjukin ke
  // operator. Ambil KODE BATCH-nya (bukan objek/UUID mentah) supaya
  // notifikasi di frontend bisa langsung menampilkan kode yang terbaca
  // (mis. "MK-2026-0001"), bukan "[object Object]".
  const { data: notCounted } = await supabase
    .from("opname_items")
    .select("product_batches(batch_code)")
    .eq("session_id", id)
    .is("physical_qty", null);

  // opname_items -> product_batches many-to-one: PostgREST mengembalikan
  // objek tunggal, tapi klien tanpa tipe skema menebaknya array, jadi
  // bentuknya ditimpa manual (pola yang sama dipakai di dashboard/today).
  type NotCountedRow = { product_batches: { batch_code: string } | null };
  const notCountedCodes = ((notCounted as unknown as NotCountedRow[]) ?? [])
    .map((row) => row.product_batches?.batch_code)
    .filter((code): code is string => Boolean(code));

  return ok({ session_id: id, status: "CLOSED", corrections, not_counted: notCountedCodes });
}