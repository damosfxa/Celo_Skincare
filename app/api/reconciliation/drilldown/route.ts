import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

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
      "id, batch_id, movement_type, qty_delta, channel, reference_type, reference_id, reason, note, campaign_reference, created_at"
    )
    .in("batch_id", batchIds.length ? batchIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });
  if (ledgerError) return handleError(ledgerError);

  // SENGAJA tetap membaca v_product_stock (hitung ulang asli dari
  // stock_ledger), bukan tabel cache seperti endpoint saldo lainnya.
  // Ini halaman penelusuran selisih -- justru di sini angka yang
  // dihitung ulang langsung dari ledger yang paling bisa dipercaya,
  // dan brief mensyaratkan saldo selalu bisa diverifikasi ulang dari
  // ledger. Bukan jalur panas, jadi biaya SUM-nya bisa diterima.
  const { data: stock } = await supabase
    .from("v_product_stock")
    .select("current_qty")
    .eq("product_id", productId)
    .maybeSingle();

  return ok({ product_id: productId, current_qty: stock?.current_qty ?? 0, ledger });
}