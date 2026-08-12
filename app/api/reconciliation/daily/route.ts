import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

// Klien Supabase di project ini sengaja tidak diberi tipe skema hasil-generate.
type AnomalyRow = {
  anomaly_id: string;
  affected_product_ids: string[] | null;
  [key: string]: unknown;
};
type ProductRow = { id: string; sku: string; name: string };

// Rekonsiliasi harian -- cek konsistensi sistem sendiri (bukan vs fisik).
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_daily_anomalies").select("*");
  if (error) return handleError(error);

  // Ketemu saat QA testing: v_daily_anomalies sudah punya affected_product_ids
  // (array UUID), tapi gak pernah di-resolve jadi sku/nama -- operator gak
  // bisa tahu anomali itu punya produk apa tanpa cari manual. Resolve di
  // sini sekali jalan (1 query tambahan), bukan N+1 per baris.
  const rows = (data as AnomalyRow[]) ?? [];
  const allProductIds = Array.from(
    new Set(rows.flatMap((r) => r.affected_product_ids ?? []))
  );

  let productMap = new Map<string, ProductRow>();
  if (allProductIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, sku, name")
      .in("id", allProductIds);
    if (productsError) return handleError(productsError);
    productMap = new Map(((products as ProductRow[]) ?? []).map((p) => [p.id, p]));
  }

  const enriched = rows.map((r) => ({
    ...r,
    affected_products: (r.affected_product_ids ?? [])
      .map((id) => productMap.get(id))
      .filter((p): p is ProductRow => Boolean(p)),
  }));

  return ok(enriched);
}
