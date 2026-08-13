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

  const batchIds = ((batches as { id: string }[]) ?? []).map((b) => b.id);

  const { data: ledgerRaw, error: ledgerError } = await supabase
    .from("stock_ledger")
    .select(
      "id, batch_id, movement_type, qty_delta, channel, reference_type, reference_id, reason, note, campaign_reference, created_at, product_batches(batch_code)"
    )
    .in("batch_id", batchIds.length ? batchIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });
  if (ledgerError) return handleError(ledgerError);

  // Ratakan product_batches(batch_code) jadi batch_code langsung di tiap
  // baris -- ditemukan lewat feedback user: kolom Batch ID di tabel &
  // Export CSV Drilldown selama ini nampilin batch_id MENTAH (UUID dari
  // database, misal "59746768-f2e1-..."), bukan kode batch yang gampang
  // dibaca (misal "OB-2026-001") yang tertera di label QR fisik. batch_id
  // mentah tetap disertakan (dipakai QrGeneratorModal buat cari data QR-nya).
  const ledger = (ledgerRaw ?? []).map((row) => {
    const { product_batches, ...rest } = row;
    // Supabase bisa balikin relasi ini sebagai objek tunggal ATAU array
    // tergantung cara PostgREST menyimpulkan hubungannya -- ambil dulu
    // elemen pertama kalau array, baru baca batch_code-nya. any di sini
    // sengaja, TypeScript sering salah nyimpulkan tipe gabungan begini
    // jadi `never` walau datanya valid saat runtime.
    const pb = (Array.isArray(product_batches) ? product_batches[0] : product_batches) as
      | { batch_code: string }
      | null
      | undefined;
    return { ...rest, batch_code: pb?.batch_code ?? null };
  });

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