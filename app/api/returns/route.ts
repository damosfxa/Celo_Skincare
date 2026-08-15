import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

// Klien Supabase di project ini sengaja tidak diberi tipe skema hasil-generate,
// jadi hasil query datang longgar. Bentuk baris yang benar-benar di-select
// dideklarasikan di sini supaya batas datanya tetap terperiksa TypeScript.
// `orders` datang dari join dan dibuang setelah channel-nya diangkat ke atas.
// Tanpa tipe skema, Supabase menebak relasi bersarang sebagai array; untuk
// relasi many-to-one seperti returns -> orders, PostgREST sebenarnya
// mengembalikan objek tunggal, jadi tebakannya perlu ditimpa lewat `unknown`.
type ReturnRow = {
  id: string;
  order_id: string;
  order_item_id: string | null;
  qty: number;
  condition: string;
  type: string;
  photo_url: string | null;
  claim_deadline: string | null;
  inspected_by: string | null;
  inspected_at: string | null;
  created_at: string;
  orders: { channel: string } | null;
  order_items: { products: { sku: string; name: string } | null } | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const condition = searchParams.get("condition");
  const channel = searchParams.get("channel");

  const supabase = await createClient();
  let query = supabase
    .from("returns")
    .select(
      "id, order_id, order_item_id, qty, condition, type, photo_url, claim_deadline, inspected_by, inspected_at, created_at, orders(channel), order_items(products(sku, name))"
    )
    .order("created_at", { ascending: false });

  // Terima juga daftar kondisi dipisah koma (mis. "SELLABLE,DAMAGED,LOST")
  // supaya tab Riwayat di client bisa minta semua kondisi selain
  // PENDING_INSPECTION dalam 1 kali panggilan, tanpa perlu tarik semua baris
  // lalu saring di client (itu sumber masalah "ambil semua data" yang mau
  // diperbaiki).
  if (condition) {
    const conditions = condition.split(",").map((c) => c.trim()).filter(Boolean);
    query = conditions.length > 1 ? query.in("condition", conditions) : query.eq("condition", conditions[0]);
  }

  const { data, error } = await query;
  if (error) return handleError(error);

  const flattened = ((data as unknown as ReturnRow[]) ?? []).map((r) => {
    const { orders, order_items, ...rest } = r;
    return {
      ...rest,
      channel: orders?.channel ?? null,
      product_sku: order_items?.products?.sku ?? null,
      product_name: order_items?.products?.name ?? null,
    };
  });

  const filtered = channel
    ? flattened.filter((r) => r.channel === channel)
    : flattened;

  return ok(filtered);
}