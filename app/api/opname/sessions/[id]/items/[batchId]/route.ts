import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { opnameItemUpdateSchema } from "@/lib/validators/opname";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  const { id, batchId: scannedValue } = await params;
  const body = await request.json();
  const parsed = opnameItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();

  // Terima batch_code (hasil scan QR fisik) ATAU UUID batch_id langsung --
  // operator gudang scan label, hasilnya batch_code, bukan UUID.
  let batchId = scannedValue;
  if (!UUID_RE.test(scannedValue)) {
    const { data: batch, error: batchError } = await supabase
      .from("product_batches")
      .select("id")
      .eq("batch_code", scannedValue)
      .single();
    if (batchError || !batch) {
      return fail(
        "NOT_FOUND",
        `Batch dengan kode "${scannedValue}" tidak ditemukan`,
        404
      );
    }
    batchId = batch.id;
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("opname_items")
    .select("system_qty")
    .eq("session_id", id)
    .eq("batch_id", batchId)
    .single();
  if (existingError || !existingRow) {
    return fail(
      "NOT_FOUND",
      "Batch ini tidak ada di daftar opname sesi ini (kemungkinan stoknya 0 saat sesi dibuka)",
      404
    );
  }

  if (
    parsed.data.physical_qty !== existingRow.system_qty &&
    !parsed.data.discrepancy_reason
  ) {
    return fail(
      "VALIDATION_ERROR",
      "Alasan selisih wajib diisi kalau hasil hitung fisik berbeda dari stok sistem",
      422
    );
  }

  const { data, error } = await supabase
    .from("opname_items")
    .update({
      physical_qty: parsed.data.physical_qty,
      note: parsed.data.note,
      discrepancy_reason: parsed.data.discrepancy_reason ?? null,
    })
    .eq("session_id", id)
    .eq("batch_id", batchId)
    .select()
    .single();
  if (error) return handleError(error);
  if (!data) {
    return fail(
      "NOT_FOUND",
      "Batch ini tidak ada di daftar opname sesi ini (kemungkinan stoknya 0 saat sesi dibuka)",
      404
    );
  }

  return ok(data);
}