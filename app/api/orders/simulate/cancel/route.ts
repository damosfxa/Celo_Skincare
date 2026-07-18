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

  // Kasus 1: order masih PENDING -- reservasi belum pernah menyentuh
  // ledger sama sekali, jadi cukup ubah status, tanpa tulis apa pun.
  if (order.status === "PENDING") {
    const { error } = await supabase
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", order.id);
    if (error) return handleError(error);

    return ok({ order_id: order.id, status: "CANCELLED", ledger_written: false });
  }

  // Kasus 2: order sudah SHIPPED/IN_TRANSIT -- barang fisik sudah
  // keluar gudang tapi belum sempat sampai ke pembeli. Beda dari
  // Retur biasa (barang sempat beredar), jadi ditandai
  // type=CANCELLATION di tabel returns, memakai mekanisme inspeksi
  // yang sama (fn_inspect_return sudah bisa bedakan keduanya).
  if (["SHIPPED", "IN_TRANSIT"].includes(order.status)) {
    let orderItemId = parsed.data.order_item_id;
    let qty: number;

    if (orderItemId) {
      const { data: item, error: itemError } = await supabase
        .from("order_items")
        .select("qty")
        .eq("id", orderItemId)
        .single();
      if (itemError || !item) return fail("NOT_FOUND", "order_item tidak ditemukan", 404);
      qty = parsed.data.qty ?? item.qty;
    } else {
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

    const { data: returnRow, error } = await supabase
      .from("returns")
      .insert({
        order_id: order.id,
        order_item_id: orderItemId,
        qty,
        condition: "PENDING_INSPECTION",
        type: "CANCELLATION",
      })
      .select()
      .single();
    if (error) return handleError(error);

    await supabase.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);

    return ok({ ...returnRow, ledger_written: false, needs_inspection: true }, 201);
  }

  return fail(
    "INVALID_STATUS",
    `Order berstatus ${order.status}, tidak bisa dibatalkan dari status ini`,
    409
  );
}