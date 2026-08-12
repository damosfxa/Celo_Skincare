import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { createProductSchema } from "@/lib/validators/product";

// Klien Supabase di project ini sengaja tidak diberi tipe skema hasil-generate,
// jadi hasil query datang longgar. Bentuk baris yang benar-benar di-select
// dideklarasikan di sini supaya batas datanya tetap terperiksa TypeScript.
type ProductRow = { id: string; sku: string; name: string; is_bundle: boolean };
type ProductStockRow = { product_id: string; current_qty: number };

export async function GET() {
  const supabase = await createClient();

  // Saldo dibaca dari tabel cache (product_stock_summary), bukan dari
  // view v_product_stock -- view itu menjumlah ulang SELURUH stock_ledger
  // setiap dipanggil. Lihat 0125. Nama kolomnya sengaja sama persis, jadi
  // bentuk datanya tidak berubah sama sekali untuk pemanggil endpoint ini.
  const [productsResult, stockResult] = await Promise.all([
    supabase.from("products").select("id, sku, name, is_bundle"),
    supabase.from("product_stock_summary").select("product_id, current_qty"),
  ]);

  if (productsResult.error) return handleError(productsResult.error);
  if (stockResult.error) return handleError(stockResult.error);

  const stockMap = new Map(
    (stockResult.data as ProductStockRow[] ?? []).map((s) => [s.product_id, s.current_qty])
  );
  const result = (productsResult.data as ProductRow[] ?? []).map((p) => ({
    ...p,
    current_qty: stockMap.get(p.id) ?? 0,
  }));

  return ok(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    // 23505 = unique constraint. Ada 2 kemungkinan (SKU atau nama, lihat
    // 0100 & 0130) -- bedakan dari nama constraint-nya di pesan error
    // Postgres, supaya operator dikasih tahu persis mana yang bentrok,
    // bukan pesan mentah "duplicate key value violates...".
    if (error.code === "23505") {
      if (error.message.includes("products_name_unique_ci")) {
        return fail("DUPLICATE_NAME", `Nama produk "${parsed.data.name}" sudah dipakai produk lain`, 409);
      }
      return fail("DUPLICATE_SKU", `SKU "${parsed.data.sku}" sudah dipakai produk lain`, 409);
    }
    return handleError(error);
  }
  return ok(data, 201);
}