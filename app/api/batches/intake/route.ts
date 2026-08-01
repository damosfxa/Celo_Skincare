import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { batchIntakeSchema } from "@/lib/validators/product";

// Barang masuk maklon -- lewat fn_maklon_intake (RPC), atomik: upsert
// batch + insert ledger dalam 1 transaksi, konsisten sama seluruh jalur
// tulis ledger lainnya di sistem ini.
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = batchIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }
  const { product_id, batch_code, expiry_date, qty } = parsed.data;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { data: batchId, error } = await supabase.rpc("fn_maklon_intake", {
    p_product_id: product_id,
    p_batch_code: batch_code,
    p_expiry_date: expiry_date,
    p_qty: qty,
    p_created_by: userData.user.id,
  });
  if (error) return handleError(error);

  const { data: stock } = await supabase
    .from("v_batch_stock")
    .select("current_qty")
    .eq("batch_id", batchId)
    .single();

  return ok(
    {
      batch_id: batchId,
      current_qty: stock?.current_qty ?? qty,
    },
    201
  );
}
