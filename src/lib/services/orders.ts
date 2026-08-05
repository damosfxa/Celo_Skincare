import { SupabaseClient } from "@supabase/supabase-js";

type OrderItemInput = { product_id: string; qty: number };

const TIKTOK_CLAIM_WINDOW_DAYS = 40;

// Dilempar oleh fungsi service di file ini untuk kegagalan yang punya kode
// & HTTP status spesifik (bukan error server generik). Route caller WAJIB
// cek `error instanceof ServiceError` dulu sebelum fallback ke handleError()
// biasa, supaya kode & status code asli (409/404/422) gak collapse jadi
// SERVER_ERROR/400 generik.
export class ServiceError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

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
  // Idempotency: kalau (channel, external_order_id) ini udah pernah dibuat,
  // JANGAN bikin duplikat -- balikin order yang lama. Ini penting buat
  // webhook asli nanti, yang wajar nge-retry kalau response sempat gagal/telat.
  // Retry itu harus dianggap "oh udah pernah diproses", bukan error.
  const { data: existing, error: existingError } = await supabase
    .from("orders")
    .select()
    .eq("channel", params.channel)
    .eq("external_order_id", params.externalOrderId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return { ...existing, already_exists: true as const };
  }

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

  if (orderError) {
    // Race condition: request lain kebetulan bikin order yang sama persis
    // di antara SELECT cek di atas dan INSERT ini. Constraint DB yang nolak --
    // bukan bug, cukup ambil lagi data yang barusan kebuat request lain itu.
    // `code` memang properti resmi PostgrestError, jadi gak perlu cast.
    if (orderError.code === "23505") {
      const { data: raceExisting, error: raceError } = await supabase
        .from("orders")
        .select()
        .eq("channel", params.channel)
        .eq("external_order_id", params.externalOrderId)
        .single();
      if (raceError) throw raceError;
      return { ...raceExisting, already_exists: true as const };
    }
    throw orderError;
  }

  for (const item of params.items) {
    const { error } = await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: item.product_id,
      qty: item.qty,
    });
    if (error) throw error;
  }

  return { ...order, already_exists: false as const };
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
    .eq("bundle_product_id", productId)
    .eq("is_active", true);
  if (error) throw error;

  type RecipeRow = { component_product_id: string; qty_per_bundle: number };
  return ((recipe as RecipeRow[]) ?? []).map((r) => ({
    product_id: r.component_product_id,
    qty: r.qty_per_bundle * qty,
  }));
}

// Ship semua order_items dari 1 order: alokasi FEFO + tulis ledger lewat
// RPC (fn_ship_order_item), lalu update status order (SHIPPED/IN_TRANSIT
// tergantung channel). Dipakai bareng oleh tombol simulasi DAN (nanti)
// webhook asli "pesanan dikirim" -- caller cukup kasih order_id, logika
// ini yang sama persis dipanggil dari sumber manapun.
export async function shipOrderItems(
  supabase: SupabaseClient,
  params: { orderId: string; createdBy: string }
) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, channel, status")
    .eq("id", params.orderId)
    .single();
  if (orderError) throw orderError;
  if (order.status !== "PENDING") {
    throw new ServiceError(
      "INVALID_STATUS",
      `Order berstatus ${order.status}, hanya PENDING yang bisa di-ship`,
      409
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", order.id);
  if (itemsError) throw itemsError;

  for (const item of items ?? []) {
    const { error: shipError } = await supabase.rpc("fn_ship_order_item", {
      p_order_item_id: item.id,
      p_created_by: params.createdBy,
    });
    if (shipError) {
      if (shipError.message.includes("Stok tidak cukup")) {
        throw new ServiceError("INSUFFICIENT_STOCK", shipError.message, 409);
      }
      throw shipError;
    }
  }

  const newStatus = order.channel === "shopee" ? "SHIPPED" : "IN_TRANSIT";
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus, shipped_at: new Date().toISOString() })
    .eq("id", order.id);
  if (updateError) throw updateError;

  const { data: allocations } = await supabase
    .from("order_item_batch_allocations")
    .select("order_item_id, batch_id, qty")
    .in("order_item_id", ((items as { id: string }[]) ?? []).map((i) => i.id));

  return { order_id: order.id, status: newStatus, allocations };
}

// Helper internal: tentuin order_item + qty mana yang dimaksud caller.
// Kalau order_item_id dikasih eksplisit, pakai itu (qty dari body kalau
// ada, default qty penuh item itu). Kalau enggak, auto-resolve -- cuma
// valid kalau order itu punya PERSIS 1 item (order multi-item WAJIB
// sertakan order_item_id eksplisit, gak bisa ditebak).
async function resolveOrderItemAndQty(
  supabase: SupabaseClient,
  orderId: string,
  orderItemId: string | undefined,
  requestedQty: number | undefined
): Promise<{ orderItemId: string; qty: number }> {
  if (orderItemId) {
    const { data: item, error } = await supabase
      .from("order_items")
      .select("qty")
      .eq("id", orderItemId)
      .single();
    if (error || !item) {
      throw new ServiceError("NOT_FOUND", "order_item tidak ditemukan", 404);
    }
    return { orderItemId, qty: requestedQty ?? item.qty };
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, qty")
    .eq("order_id", orderId);
  if (itemsError) throw itemsError;

  if (!items || items.length === 0) {
    throw new ServiceError("NOT_FOUND", "Order ini tidak punya item apa pun", 404);
  }
  if (items.length > 1) {
    throw new ServiceError(
      "AMBIGUOUS_ITEM",
      "Order ini punya lebih dari 1 item, sertakan order_item_id secara eksplisit",
      422
    );
  }
  return { orderItemId: items[0].id, qty: items[0].qty };
}

// Batalkan order. 2 kasus beda sama sekali secara stok:
// - PENDING: reservasi belum pernah sentuh ledger, tinggal ubah status.
// - SHIPPED/IN_TRANSIT: barang fisik udah keluar gudang tapi belum
//   sampai pembeli -- dicatat sebagai returns type=CANCELLATION, dipakai
//   mekanisme inspeksi yang sama kayak retur biasa (fn_inspect_return
//   sudah bisa bedakan keduanya lewat kolom type).
// Dipakai bareng oleh tombol simulasi DAN (nanti) webhook asli
// "pesanan dibatalkan".
export async function cancelOrder(
  supabase: SupabaseClient,
  params: { orderId: string; orderItemId?: string; qty?: number }
) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", params.orderId)
    .single();
  if (orderError) throw orderError;

  if (order.status === "PENDING") {
    const { error } = await supabase
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", order.id);
    if (error) throw error;

    return { order_id: order.id, status: "CANCELLED", ledger_written: false };
  }

  if (["SHIPPED", "IN_TRANSIT"].includes(order.status)) {
    const { orderItemId, qty } = await resolveOrderItemAndQty(
      supabase,
      order.id,
      params.orderItemId,
      params.qty
    );

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
    if (error) throw error;

    await supabase.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);

    return { ...returnRow, ledger_written: false, needs_inspection: true };
  }

  throw new ServiceError(
    "INVALID_STATUS",
    `Order berstatus ${order.status}, tidak bisa dibatalkan dari status ini`,
    409
  );
}

// Ajukan retur buat order yang udah shipped/in_transit/delivered. Cuma
// bikin PENGAJUAN (condition PENDING_INSPECTION) -- kondisi fisik
// (SELLABLE/DAMAGED/LOST) baru diputuskan gudang lewat inspeksi
// terpisah. Dipakai bareng oleh tombol simulasi DAN (nanti) webhook
// asli "retur diajukan".
export async function createReturnRequest(
  supabase: SupabaseClient,
  params: { orderId: string; orderItemId?: string; qty?: number }
) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, channel, status")
    .eq("id", params.orderId)
    .single();
  if (orderError) throw orderError;

  if (!["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(order.status)) {
    throw new ServiceError("INVALID_STATUS", "Order harus sudah shipped sebelum bisa diretur", 409);
  }

  const { orderItemId, qty } = await resolveOrderItemAndQty(
    supabase,
    order.id,
    params.orderItemId,
    params.qty
  );

  const claimDeadline =
    order.channel === "tiktok"
      ? new Date(Date.now() + TIKTOK_CLAIM_WINDOW_DAYS * 86400000).toISOString().slice(0, 10)
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
  if (error) throw error;

  await supabase.from("orders").update({ status: "RETURNED" }).eq("id", order.id);

  return returnRow;
}
