import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

// Cuma bagian yang dipakai untuk menyaring per produk. Kolom lain memang
// ikut di-select tapi diteruskan apa adanya ke pemanggil, jadi tidak perlu
// dideklarasikan di sini.
type LedgerRowForFilter = { product_batches: { product_id: string } | null };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch_id");
  const productId = searchParams.get("product_id");
  const movementType = searchParams.get("movement_type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = await createClient();
  let query = supabase
    .from("stock_ledger")
    .select(
      "id, batch_id, movement_type, qty_delta, channel, reference_type, reference_id, reason, note, campaign_reference, created_by, created_at, product_batches(product_id)"
    )
    .order("created_at", { ascending: false });

  if (batchId) query = query.eq("batch_id", batchId);
  if (movementType) query = query.eq("movement_type", movementType);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return handleError(error);

  const filtered = productId
    ? (data ?? []).filter(
        (row) =>
          (row as unknown as LedgerRowForFilter).product_batches?.product_id === productId
      )
    : data;

  return ok(filtered);
}