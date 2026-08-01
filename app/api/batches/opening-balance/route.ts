import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { batchIntakeSchema } from "@/lib/validators/product";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = batchIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { data: batchId, error } = await supabase.rpc("fn_opening_balance_intake", {
    p_product_id: parsed.data.product_id,
    p_batch_code: parsed.data.batch_code,
    p_expiry_date: parsed.data.expiry_date,
    p_qty: parsed.data.qty,
    p_created_by: userData.user.id,
  });
  if (error) return handleError(error);

  return ok({ batch_id: batchId, verified: false }, 201);
}
