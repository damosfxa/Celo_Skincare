import { SupabaseClient } from "@supabase/supabase-js";

type OrderItemInput = { product_id: string; qty: number };

// Dipakai bareng oleh /api/orders/simulate/new DAN /api/orders/import --
// sesuai prinsip brief: tombol simulasi & jalur impor harus manggil logika
// yang sama, cuma sumber datanya beda. Nanti kalau API asli dipasang,
// cukup ganti "siapa yang manggil", bukan fungsi ini.
export async function createOrderWithItems(
  supabase: SupabaseClient,
  params: {
    channel: "shopee" | "tiktok";
    externalOrderId: string;
    orderedAt: string;
    items: OrderItemInput[]; // sudah bentuk produk satuan (bundle udah dipecah)
  }
) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      channel: params.channel,
      external_order_id: params.externalOrderId,
      status: "PENDING",
      ordered_at: params.orderedAt,
    })
    .select()
    .single();
  if (orderError) throw orderError;

  for (const item of params.items) {
    const { error } = await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: item.product_id,
      qty: item.qty,
    });
    if (error) throw error;
  }

  return order;
}

// Pecah bundle jadi produk satuan lewat bundle_recipes. Produk biasa
// dibalikin apa adanya.
export async function resolveItemsForProduct(
  supabase: SupabaseClient,
  productId: string,
  qty: number,
  isBundle: boolean
): Promise<OrderItemInput[]> {
  if (!isBundle) return [{ product_id: productId, qty }];

  const { data: recipe, error } = await supabase
    .from("bundle_recipes")
    .select("component_product_id, qty_per_bundle")
    .eq("bundle_product_id", productId);
  if (error) throw error;

  // Bundle tanpa resep gak boleh sampai kebentuk jadi order kosong --
  // itu bikin order "berhasil" dibuat tapi gak punya item sama sekali,
  // baru ketahuan gagalnya belakangan (misal pas mau ship atau retur).
  // Gagalkan dari sini biar penyebabnya jelas dari awal.
  if (!recipe || recipe.length === 0) {
    throw new Error(
      `Produk bundle ini belum punya resep komponen -- atur resepnya dulu sebelum bisa dipakai di order`
    );
  }

  return recipe.map((r: any) => ({
    product_id: r.component_product_id,
    qty: r.qty_per_bundle * qty,
  }));
}