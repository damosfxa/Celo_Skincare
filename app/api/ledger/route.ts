import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

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
      "id, batch_id, movement_type, qty_delta, channel, reference_type, reference_id, reason, created_by, created_at, product_batches(product_id)"
    )
    .order("created_at", { ascending: false });

  if (batchId) query = query.eq("batch_id", batchId);
  if (movementType) query = query.eq("movement_type", movementType);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return handleError(error);

  // Filter product_id di sini karena relasi product_batches -> product_id
  // butuh join yang lebih rumit lewat query builder Supabase untuk di-filter di server.
  const filtered = productId
    ? (data ?? []).filter(
        (row: any) => row.product_batches?.product_id === productId
      )
    : data;

  return ok(filtered);
}
