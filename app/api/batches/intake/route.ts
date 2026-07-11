import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { batchIntakeSchema } from "@/lib/validators/product";

// Barang masuk maklon. Ini satu-satunya jalur "IN" yang tidak lewat RPC
// allocator karena tidak butuh FEFO (barang masuk, bukan keluar) --
// tapi tetap 2 langkah (buat batch + tulis ledger) yang harus konsisten.
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

  const { data: batch, error: batchError } = await supabase
    .from("product_batches")
    .upsert({ product_id, batch_code, expiry_date }, { onConflict: "batch_code" })
    .select()
    .single();
  if (batchError) return handleError(batchError);

  const { data: ledgerRow, error: ledgerError } = await supabase
    .from("stock_ledger")
    .insert({
      batch_id: batch.id,
      movement_type: "IN_MAKLON",
      qty_delta: qty,
      channel: "internal",
      created_by: userData.user.id,
    })
    .select()
    .single();
  if (ledgerError) return handleError(ledgerError);

  const { data: stock } = await supabase
    .from("v_batch_stock")
    .select("current_qty")
    .eq("batch_id", batch.id)
    .single();

  return ok(
    {
      batch_id: batch.id,
      ledger_id: ledgerRow.id,
      current_qty: stock?.current_qty ?? qty,
    },
    201
  );
}
