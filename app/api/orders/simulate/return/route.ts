import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { simulateReturnSchema } from "@/lib/validators/orders";

const TIKTOK_CLAIM_WINDOW_DAYS = 40;

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulateReturnSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, channel, status")
    .eq("id", parsed.data.order_id)
    .single();
  if (orderError) return handleError(orderError);

  if (!["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(order.status)) {
    return fail("INVALID_STATUS", "Order harus sudah shipped sebelum bisa diretur", 409);
  }

  let orderItemId = parsed.data.order_item_id;
  let qty: number;

  if (orderItemId) {
    // Caller tau persis item mana -- qty dari body dipakai kalau ada,
    // default ke qty penuh item itu kalau gak dikirim.
    const { data: item, error: itemError } = await supabase
      .from("order_items")
      .select("qty")
      .eq("id", orderItemId)
      .single();
    if (itemError || !item) return fail("NOT_FOUND", "order_item tidak ditemukan", 404);
    qty = parsed.data.qty ?? item.qty;
  } else {
    // Mode auto-resolve (tombol "Simulate Return"). qty dari body DIABAIKAN
    // di sini -- selalu pakai qty penuh item asli, karena frontend gak
    // pernah punya cara tau qty sebenarnya (simulate/new tidak expose itu),
    // jadi angka apapun yang dia kirim cuma tebakan, bukan fakta.
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id, qty")
      .eq("order_id", order.id);
    if (itemsError) return handleError(itemsError);

    if (!items || items.length === 0) {
      return fail("NOT_FOUND", "Order ini tidak punya item apa pun", 404);
    }
    if (items.length > 1) {
      return fail(
        "AMBIGUOUS_ITEM",
        "Order ini punya lebih dari 1 item -- sertakan order_item_id secara eksplisit",
        422
      );
    }
    orderItemId = items[0].id;
    qty = items[0].qty;
  }

  const claimDeadline =
    order.channel === "tiktok"
      ? new Date(Date.now() + TIKTOK_CLAIM_WINDOW_DAYS * 86400000)
          .toISOString()
          .slice(0, 10)
      : null;

  const { data: returnRow, error } = await supabase
    .from("returns")
    .insert({
      order_id: order.id,
      order_item_id: orderItemId,
      qty,
      condition: "PENDING_INSPECTION",
      claim_deadline: claimDeadline,
    })
    .select()
    .single();
  if (error) return handleError(error);

  await supabase.from("orders").update({ status: "RETURNED" }).eq("id", order.id);

  return ok(returnRow, 201);
}