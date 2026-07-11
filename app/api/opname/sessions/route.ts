import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { data: sessionId, error } = await supabase.rpc("fn_open_opname_session", {
    p_created_by: userData.user.id,
  });
  if (error) return handleError(error);

  return ok({ session_id: sessionId }, 201);
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opname_sessions")
    .select("id, session_date, created_at, status, created_by, closed_at")
    .order("created_at", { ascending: false });
  if (error) return handleError(error);
  return ok(data);
}