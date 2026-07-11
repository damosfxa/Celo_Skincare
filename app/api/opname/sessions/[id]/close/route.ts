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
  // operator, bukan didiemin kayak sebelumnya.
  const { data: notCounted } = await supabase
    .from("opname_items")
    .select("batch_id")
    .eq("session_id", id)
    .is("physical_qty", null);

  return ok({ session_id: id, status: "CLOSED", corrections, not_counted: notCounted });
}