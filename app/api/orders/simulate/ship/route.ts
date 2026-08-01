import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { simulateShipSchema } from "@/lib/validators/orders";
import { ServiceError, shipOrderItems } from "@/lib/services/orders";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulateShipSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  try {
    const result = await shipOrderItems(supabase, {
      orderId: parsed.data.order_id,
      createdBy: userData.user.id,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}
