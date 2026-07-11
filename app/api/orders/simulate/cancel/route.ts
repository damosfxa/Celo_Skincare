import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { simulateCancelSchema } from "@/lib/validators/orders";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulateCancelSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", parsed.data.order_id)
    .single();
  if (orderError) return handleError(orderError);

  if (order.status !== "PENDING") {
    return fail(
      "INVALID_STATUS",
      `Order berstatus ${order.status}. Cuma order PENDING yang bisa dibatalkan -- order yang sudah shipped harus lewat jalur retur.`,
      409
    );
  }

  // Sengaja TIDAK ada perubahan ledger di sini -- order PENDING belum
  // pernah menyentuh ledger sama sekali (reservasi != movement).
  const { error } = await supabase
    .from("orders")
    .update({ status: "CANCELLED" })
    .eq("id", order.id);
  if (error) return handleError(error);

  return ok({ order_id: order.id, status: "CANCELLED", ledger_written: false });
}
