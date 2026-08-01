import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

// Dipakai frontend buat nampilin pilihan item kalau mau ajukan retur untuk
// order yang punya lebih dari 1 order_item (kasus paling umum: order bundle,
// karena bundle otomatis dipecah jadi beberapa order_items per komponen
// waktu order dibuat -- lihat resolveItemsForProduct di lib/services/orders.ts).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .single();
  if (orderError) return handleError(orderError);
  if (!order) return fail("NOT_FOUND", "Order tidak ditemukan", 404);

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_id, qty, products(sku, name)")
    .eq("order_id", id);
  if (itemsError) return handleError(itemsError);

  return ok({ order_id: id, items: items ?? [] });
}
