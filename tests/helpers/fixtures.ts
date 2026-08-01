import type { SupabaseClient } from "@supabase/supabase-js";

// Suffix unik per test run -- product_batches sekarang unik per (product_id,
// batch_code) (migration 0114), dan products.sku sebaiknya juga gak nabrak
// antar run test yang beda waktu di database test yang sama.
export function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function createTestProduct(
  supabase: SupabaseClient,
  overrides: { sku?: string; name?: string; is_bundle?: boolean } = {}
) {
  const suffix = uniqueSuffix();
  const { data, error } = await supabase
    .from("products")
    .insert({
      sku: overrides.sku ?? `TEST-SKU-${suffix}`,
      name: overrides.name ?? `Test Product ${suffix}`,
      is_bundle: overrides.is_bundle ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as { id: string; sku: string; name: string; is_bundle: boolean };
}

export async function addOpeningBalance(
  supabase: SupabaseClient,
  args: { productId: string; qty: number; expiryDate: string; userId: string; batchCode?: string }
) {
  const { data, error } = await supabase.rpc("fn_opening_balance_intake", {
    p_product_id: args.productId,
    p_batch_code: args.batchCode ?? `BATCH-${uniqueSuffix()}`,
    p_expiry_date: args.expiryDate,
    p_qty: args.qty,
    p_created_by: args.userId,
  });
  if (error) throw error;
  return data as string; // batch_id
}

export async function createOrder(
  supabase: SupabaseClient,
  args: { channel: "shopee" | "tiktok"; productId: string; qty: number }
) {
  const suffix = uniqueSuffix();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      channel: args.channel,
      external_order_id: `TEST-ORDER-${suffix}`,
      status: "PENDING",
      ordered_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (orderError) throw orderError;

  const { data: item, error: itemError } = await supabase
    .from("order_items")
    .insert({ order_id: order.id, product_id: args.productId, qty: args.qty })
    .select()
    .single();
  if (itemError) throw itemError;

  return { order, item } as { order: { id: string }; item: { id: string } };
}

export async function addMaklonIntake(
  supabase: SupabaseClient,
  args: { productId: string; qty: number; expiryDate: string; userId: string; batchCode?: string }
) {
  const { data, error } = await supabase.rpc("fn_maklon_intake", {
    p_product_id: args.productId,
    p_batch_code: args.batchCode ?? `MAKLON-${uniqueSuffix()}`,
    p_expiry_date: args.expiryDate,
    p_qty: args.qty,
    p_created_by: args.userId,
  });
  if (error) throw error;
  return data as string; // batch_id
}

export async function shipOrder(
  supabase: SupabaseClient,
  args: { orderId: string; itemId: string; userId: string; channel: "shopee" | "tiktok" }
) {
  const { error } = await supabase.rpc("fn_ship_order_item", {
    p_order_item_id: args.itemId,
    p_created_by: args.userId,
  });
  if (error) throw error;

  const newStatus = args.channel === "shopee" ? "SHIPPED" : "IN_TRANSIT";
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus, shipped_at: new Date().toISOString() })
    .eq("id", args.orderId);
  if (updateError) throw updateError;
}

export async function createReturnRow(
  supabase: SupabaseClient,
  args: { orderId: string; orderItemId: string; qty: number; type?: "RETURN" | "CANCELLATION" }
) {
  const { data, error } = await supabase
    .from("returns")
    .insert({
      order_id: args.orderId,
      order_item_id: args.orderItemId,
      qty: args.qty,
      condition: "PENDING_INSPECTION",
      type: args.type ?? "RETURN",
    })
    .select()
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function getProductBalance(supabase: SupabaseClient, productId: string) {
  const { data, error } = await supabase
    .from("product_stock_summary")
    .select("current_qty")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  return data?.current_qty ?? 0;
}
