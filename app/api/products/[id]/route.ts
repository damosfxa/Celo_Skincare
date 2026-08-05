import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

// Klien Supabase di project ini sengaja tidak diberi tipe skema hasil-generate,
// jadi hasil query datang longgar. Bentuk baris yang benar-benar di-select
// dideklarasikan di sini supaya batas datanya tetap terperiksa TypeScript.
type BatchRow = { id: string; batch_code: string; expiry_date: string };
type BatchStockRow = { batch_id: string; current_qty: number };
type RecipeRow = { component_product_id: string; qty_per_bundle: number };
type ComponentRow = { id: string; sku: string; name: string };

type RecipeWithComponent = RecipeRow & { component: ComponentRow | null };

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
  const batchRows = (batches as BatchRow[]) ?? [];
  const batchIds = batchRows.map((b) => b.id);
  const { data: stock } = await supabase
    .from("batch_stock_summary")
    .select("batch_id, current_qty")
    .in("batch_id", batchIds.length ? batchIds : ["00000000-0000-0000-0000-000000000000"]);

  const stockMap = new Map(
    ((stock as BatchStockRow[]) ?? []).map((s) => [s.batch_id, s.current_qty])
  );
  const batchesWithStock = batchRows.map((b) => ({
    ...b,
    current_qty: stockMap.get(b.id) ?? 0,
  }));

  // Resep bundle -- kalau produk ini bundle, kembalikan resep yang sudah
  // tersimpan (kalau ada) supaya frontend bisa isi form otomatis saat
  // dibuka lagi untuk diedit.
  let recipe: RecipeWithComponent[] = [];
  if (product.is_bundle) {
    const { data: recipeRows, error: recipeError } = await supabase
      .from("bundle_recipes")
      .select("component_product_id, qty_per_bundle")
      .eq("bundle_product_id", id);
    if (recipeError) return handleError(recipeError);

    const recipeList = (recipeRows as RecipeRow[]) ?? [];
    const componentIds = recipeList.map((r) => r.component_product_id);
    const { data: components } = await supabase
      .from("products")
      .select("id, sku, name")
      .in("id", componentIds.length ? componentIds : ["00000000-0000-0000-0000-000000000000"]);
    const componentMap = new Map(
      ((components as ComponentRow[]) ?? []).map((c) => [c.id, c])
    );

    recipe = recipeList.map((r) => ({
      component_product_id: r.component_product_id,
      qty_per_bundle: r.qty_per_bundle,
      component: componentMap.get(r.component_product_id) ?? null,
    }));
  }

  return ok({ ...product, batches: batchesWithStock, recipe });
}