import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { simulateShipSchema } from "@/lib/validators/orders";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulateShipSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, channel, status")
    .eq("id", parsed.data.order_id)
    .single();
  if (orderError) return handleError(orderError);
  if (order.status !== "PENDING") {
    return fail(
      "INVALID_STATUS",
      `Order berstatus ${order.status}, hanya PENDING yang bisa di-ship`,
      409
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", order.id);
  if (itemsError) return handleError(itemsError);

  for (const item of items ?? []) {
    const { error: shipError } = await supabase.rpc("fn_ship_order_item", {
      p_order_item_id: item.id,
      p_created_by: userData.user.id,
    });
    if (shipError) {
      if (shipError.message.includes("Stok tidak cukup")) {
        return fail("INSUFFICIENT_STOCK", shipError.message, 409);
      }
      return handleError(shipError);
    }
  }

  const newStatus = order.channel === "shopee" ? "SHIPPED" : "IN_TRANSIT";
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus, shipped_at: new Date().toISOString() })
    .eq("id", order.id);
  if (updateError) return handleError(updateError);

  const { data: allocations } = await supabase
    .from("order_item_batch_allocations")
    .select("order_item_id, batch_id, qty")
    .in("order_item_id", (items ?? []).map((i: any) => i.id));

  return ok({ order_id: order.id, status: newStatus, allocations });
}
