import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

// Endpoint yang sebelumnya cuma ada di dokumentasi, belum ada kodenya.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, sku, name, is_bundle")
    .eq("id", id)
    .single();
  if (productError) return handleError(productError);
  if (!product) return fail("NOT_FOUND", "Produk tidak ditemukan", 404);

  const { data: batches, error: batchesError } = await supabase
    .from("product_batches")
    .select("id, batch_code, expiry_date")
    .eq("product_id", id);
  if (batchesError) return handleError(batchesError);

  // Saldo per batch dari tabel cache, bukan view v_batch_stock (SUM
  // full-scan seluruh ledger tiap panggil). Lihat 0125.
  const batchIds = (batches ?? []).map((b: any) => b.id);
  const { data: stock } = await supabase
    .from("batch_stock_summary")
    .select("batch_id, current_qty")
    .in("batch_id", batchIds.length ? batchIds : ["00000000-0000-0000-0000-000000000000"]);

  const stockMap = new Map((stock ?? []).map((s: any) => [s.batch_id, s.current_qty]));
  const batchesWithStock = (batches ?? []).map((b: any) => ({
    ...b,
    current_qty: stockMap.get(b.id) ?? 0,
  }));

  // Resep bundle -- kalau produk ini bundle, kembalikan resep yang sudah
  // tersimpan (kalau ada) supaya frontend bisa isi form otomatis saat
  // dibuka lagi untuk diedit.
  let recipe: any[] = [];
  if (product.is_bundle) {
    const { data: recipeRows, error: recipeError } = await supabase
      .from("bundle_recipes")
      .select("component_product_id, qty_per_bundle")
      .eq("bundle_product_id", id);
    if (recipeError) return handleError(recipeError);

    const componentIds = (recipeRows ?? []).map((r: any) => r.component_product_id);
    const { data: components } = await supabase
      .from("products")
      .select("id, sku, name")
      .in("id", componentIds.length ? componentIds : ["00000000-0000-0000-0000-000000000000"]);
    const componentMap = new Map((components ?? []).map((c: any) => [c.id, c]));

    recipe = (recipeRows ?? []).map((r: any) => ({
      component_product_id: r.component_product_id,
      qty_per_bundle: r.qty_per_bundle,
      component: componentMap.get(r.component_product_id) ?? null,
    }));
  }

  return ok({ ...product, batches: batchesWithStock, recipe });
}