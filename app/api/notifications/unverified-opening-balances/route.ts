import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_unverified_opening_balances")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return handleError(error);
  return ok(data);
}
