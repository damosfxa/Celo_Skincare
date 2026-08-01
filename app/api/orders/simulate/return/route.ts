import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { simulateReturnSchema } from "@/lib/validators/orders";
import { ServiceError, createReturnRequest } from "@/lib/services/orders";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulateReturnSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();

  try {
    const returnRow = await createReturnRequest(supabase, {
      orderId: parsed.data.order_id,
      orderItemId: parsed.data.order_item_id,
      qty: parsed.data.qty,
    });
    return ok(returnRow, 201);
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}
