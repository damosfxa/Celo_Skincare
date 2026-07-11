import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { simulateNewOrdersSchema } from "@/lib/validators/orders";
import { createOrderWithItems, resolveItemsForProduct } from "@/lib/services/orders";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulateNewOrdersSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, is_bundle");
  if (productsError) return handleError(productsError);
  if (!products || products.length === 0) {
    return fail(
      "NO_PRODUCTS",
      "Belum ada produk. Buat produk dulu sebelum simulasi order.",
      409
    );
  }

  try {
    const orderIds: string[] = [];
    for (let i = 0; i < parsed.data.count; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const items = await resolveItemsForProduct(
        supabase,
        product.id,
        qty,
        product.is_bundle
      );

      const order = await createOrderWithItems(supabase, {
        channel: parsed.data.channel,
        externalOrderId: `SIM-${parsed.data.channel.toUpperCase()}-${Date.now()}-${i}`,
        orderedAt: new Date().toISOString(),
        items,
      });
      orderIds.push(order.id);
    }
    return ok({ created: orderIds.length, order_ids: orderIds }, 201);
  } catch (error) {
    return handleError(error);
  }
}