import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

// Inti dari "selisih bisa ditelusuri" -- kembalikan seluruh riwayat ledger
// satu produk, urut waktu, biar kelihatan persis pergerakan apa aja yang
// membentuk angka stok saat ini.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");
  if (!productId) return fail("VALIDATION_ERROR", "product_id wajib diisi", 422);

  const supabase = await createClient();

  const { data: batches, error: batchError } = await supabase
    .from("product_batches")
    .select("id")
    .eq("product_id", productId);
  if (batchError) return handleError(batchError);

  const batchIds = (batches ?? []).map((b: any) => b.id);

  const { data: ledger, error: ledgerError } = await supabase
    .from("stock_ledger")
    .select(
      "batch_id, movement_type, qty_delta, reference_type, reference_id, reason, created_at"
    )
    .in("batch_id", batchIds.length ? batchIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });
  if (ledgerError) return handleError(ledgerError);

  const { data: stock } = await supabase
    .from("v_product_stock")
    .select("current_qty")
    .eq("product_id", productId)
    .maybeSingle();

  return ok({ product_id: productId, current_qty: stock?.current_qty ?? 0, ledger });
}
