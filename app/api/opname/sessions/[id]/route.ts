import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("opname_sessions")
    .select("id, session_date, created_at, status, created_by, closed_at")
    .eq("id", id)
    .single();
  if (sessionError) return handleError(sessionError);
  if (!session) return fail("NOT_FOUND", "Sesi opname tidak ditemukan", 404);

  const { data: items, error: itemsError } = await supabase
    .from("opname_items")
    .select(
      "batch_id, system_qty, physical_qty, variance, note, product_batches(batch_code, product_id, products(sku, name))"
    )
    .eq("session_id", id);
  if (itemsError) return handleError(itemsError);

  return ok({ ...session, items });
}