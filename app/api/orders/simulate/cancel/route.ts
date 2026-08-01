import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { simulateCancelSchema } from "@/lib/validators/orders";
import { ServiceError, cancelOrder } from "@/lib/services/orders";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulateCancelSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();

  try {
    const result = await cancelOrder(supabase, {
      orderId: parsed.data.order_id,
      orderItemId: parsed.data.order_item_id,
      qty: parsed.data.qty,
    });
    const status = "needs_inspection" in result ? 201 : 200;
    return ok(result, status);
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}
