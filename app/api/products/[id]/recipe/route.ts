import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { bundleRecipeSchema } from "@/lib/validators/product";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = bundleRecipeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, is_bundle")
    .eq("id", id)
    .single();
  if (productError) return handleError(productError);
  if (!product) return fail("NOT_FOUND", "Produk tidak ditemukan", 404);
  if (!product.is_bundle) {
    return fail("INVALID_PRODUCT", "Produk ini bukan bundle, gak bisa diberi resep", 422);
  }

  const componentIds = parsed.data.map((c) => c.component_product_id);
  if (componentIds.includes(id)) {
    return fail(
      "VALIDATION_ERROR",
      "Bundle tidak boleh jadi komponen dari dirinya sendiri",
      422
    );
  }

  // Hapus + insert sekarang 1 operasi atomik lewat RPC -- aman dari race
  // kalau ada double-submit.
  const { error } = await supabase.rpc("fn_save_bundle_recipe", {
    p_bundle_id: id,
    p_components: parsed.data,
  });
  if (error) return handleError(error);

  return ok(parsed.data, 201);
}