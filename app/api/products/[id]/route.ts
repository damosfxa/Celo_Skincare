import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { updateProductSchema } from "@/lib/validators/product";

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
    // Cuma ambil versi yang lagi AKTIF -- resep di-versioning (0112),
    // versi lama ditandai is_active=false tapi barisnya tetap ada di
    // tabel (biar order lama tetap bisa ditelusuri pakai resep versi
    // saat itu). Tanpa filter ini, form edit numpuk SEMUA versi lama
    // tiap kali resep disimpan ulang -- baris makin banyak tiap edit,
    // padahal jalur yang beneran motong stok (src/lib/services/orders.ts)
    // dari awal sudah benar cuma baca versi aktif.
    const { data: recipeRows, error: recipeError } = await supabase
      .from("bundle_recipes")
      .select("component_product_id, qty_per_bundle")
      .eq("bundle_product_id", id)
      .eq("is_active", true);
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

// Betulkan salah ketik nama/SKU. Aman untuk produk APA PUN (baru atau
// sudah punya riwayat) -- ini cuma ganti label, tidak menyentuh
// product_batches/stock_ledger sama sekali. Beda dari DELETE di bawah,
// yang cuma boleh untuk produk tanpa riwayat.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // 23505 = unique constraint. Bedakan SKU (products_sku_key) vs nama
    // (products_name_unique_ci, 0130) dari nama constraint di pesan error.
    if (error.code === "23505") {
      if (error.message.includes("products_name_unique_ci")) {
        return fail("DUPLICATE_NAME", `Nama produk "${parsed.data.name}" sudah dipakai produk lain`, 409);
      }
      return fail("DUPLICATE_SKU", `SKU "${parsed.data.sku}" sudah dipakai produk lain`, 409);
    }
    return handleError(error);
  }
  if (!data) return fail("NOT_FOUND", "Produk tidak ditemukan", 404);

  return ok(data);
}

// Hapus produk -- HANYA kalau belum punya riwayat sama sekali (nol batch,
// nol order_items). Begitu ada satu saja riwayat, penghapusan ditolak di
// sini SEBELUM sempat menyentuh database sungguhan -- lapis kedua yang
// selalu menahan walau ada bug di pengecekan ini: batch dengan baris
// stock_ledger tidak akan pernah bisa dihapus (FK dari stock_ledger.batch_id),
// dan stock_ledger sendiri dikunci total sejak migration 0124. Jadi
// endpoint ini murni kemudahan operator untuk kasus "baru salah input,
// belum kejadian apa-apa" -- bukan jalan pintas menghapus riwayat.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { count: batchCount, error: batchError } = await supabase
    .from("product_batches")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  if (batchError) return handleError(batchError);

  const { count: orderItemCount, error: orderItemError } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  if (orderItemError) return handleError(orderItemError);

  if ((batchCount ?? 0) > 0 || (orderItemCount ?? 0) > 0) {
    return fail(
      "HAS_HISTORY",
      "Produk ini sudah punya riwayat stok/pesanan, tidak bisa dihapus. Anda bisa ubah nama/SKU-nya lewat tombol Edit.",
      409
    );
  }

  // Bersihkan resep bundle yang nyangkut produk ini (sebagai bundle ATAU
  // komponen) sebelum hapus produknya sendiri -- pola sama seperti
  // migrations/cleanup-*-DELETE.sql.
  const { error: recipeError } = await supabase
    .from("bundle_recipes")
    .delete()
    .or(`bundle_product_id.eq.${id},component_product_id.eq.${id}`);
  if (recipeError) return handleError(recipeError);

  const { error: deleteError } = await supabase.from("products").delete().eq("id", id);
  if (deleteError) return handleError(deleteError);

  return ok({ id, deleted: true });
}