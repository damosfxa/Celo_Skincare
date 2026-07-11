import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

// Rekonsiliasi harian -- cek konsistensi sistem sendiri (bukan vs fisik).
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_daily_anomalies").select("*");
  if (error) return handleError(error);
  return ok(data);
}
