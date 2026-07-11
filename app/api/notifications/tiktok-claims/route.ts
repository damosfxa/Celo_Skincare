import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_pending_tiktok_claims")
    .select("*")
    .order("claim_deadline", { ascending: true });
  if (error) return handleError(error);
  return ok(data);
}
