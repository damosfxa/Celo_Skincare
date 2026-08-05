import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";

// Payload QR = batch_code itu sendiri. Rendering gambar QR nya dikerjakan
// di sisi frontend (library qrcode di client), endpoint ini cuma nyediain
// data yang perlu di-encode + info produk buat label cetak.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: batch, error } = await supabase
    .from("product_batches")
    .select("id, batch_code, expiry_date, products(sku, name)")
    .eq("id", id)
    .single();

  if (error) return handleError(error);
  if (!batch) return fail("NOT_FOUND", "Batch tidak ditemukan", 404);

  return ok({
    batch_id: batch.id,
    qr_payload: batch.batch_code,
    expiry_date: batch.expiry_date,
    product: batch.products,
  });
}
