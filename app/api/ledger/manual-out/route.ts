import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { manualOutSchema } from "@/lib/validators/ledger";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = manualOutSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { error } = await supabase.rpc("fn_manual_out", {
    p_product_id: parsed.data.product_id,
    p_qty: parsed.data.qty,
    p_movement_type: parsed.data.movement_type,
    p_reason: parsed.data.reason,
    p_created_by: userData.user.id,
  });

  if (error) {
    if (error.message.includes("Stok tidak cukup")) {
      return fail("INSUFFICIENT_STOCK", error.message, 409);
    }
    return handleError(error);
  }

  return ok({
    product_id: parsed.data.product_id,
    movement_type: parsed.data.movement_type,
    qty: parsed.data.qty,
  });
}
