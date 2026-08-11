import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { createOrderWithItems, resolveItemsForProduct } from "@/lib/services/orders";

// Format CSV (header wajib persis ini, urutan kolom bebas):
// channel,external_order_id,sku,qty,ordered_at
//
// - Satu order banyak produk = beberapa baris dengan external_order_id sama
// - sku boleh sku bundle -- otomatis dipecah lewat bundle_recipes
// - ordered_at format ISO 8601, contoh: 2026-07-01T10:00:00Z
//
// Contoh:
// channel,external_order_id,sku,qty,ordered_at
// shopee,SP-88213,SRM-VITC-30ML,2,2026-07-01T10:00:00Z
// shopee,SP-88213,TONER-100ML,1,2026-07-01T10:00:00Z

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return fail("VALIDATION_ERROR", "File CSV wajib dikirim lewat field 'file'", 422);
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return fail("VALIDATION_ERROR", "File CSV kosong", 422);
  }

  const requiredHeaders = ["channel", "external_order_id", "sku", "qty", "ordered_at"];
  const missing = requiredHeaders.filter((h) => !(h in rows[0]));
  if (missing.length > 0) {
    return fail("VALIDATION_ERROR", `Header CSV kurang: ${missing.join(", ")}`, 422);
  }

  const supabase = await createClient();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, sku, is_bundle");
  if (productsError) return handleError(productsError);
  type ProductLookupRow = { id: string; sku: string; is_bundle: boolean };
  const productBySku = new Map(
    ((products as ProductLookupRow[]) ?? []).map((p) => [p.sku, p])
  );

  const grouped = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const key = row.external_order_id;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const created: string[] = [];
  // Detail lengkap tiap order yang BENERAN baru dibuat (bukan skipped/error) --
  // dipakai frontend buat nampilin order hasil impor di tabel "Daftar Pesanan
  // Simulasi" (sebelum ini gak ada, jadi order hasil impor CSV gak pernah
  // muncul di UI sama sekali walau udah kesimpen di database -- lihat catatan
  // di app/(dashboard)/simulation/page.tsx). Dibikin array terpisah (bukan
  // ganti bentuk `order_ids` yang udah ada) supaya nol resiko ke konsumen lain.
  const createdOrders: { id: string; channel: string; external_order_id: string; ordered_at: string }[] = [];
  const skipped: { external_order_id: string }[] = [];
  const errors: { external_order_id: string; message: string }[] = [];

  // Diproses per-gelombang (paralel di dalam gelombang, bukan satu-satu
  // murni) -- CSV "ratusan baris" kalau diproses murni sekuensial bisa
  // makan puluhan detik (tiap baris = beberapa kali bolak-balik ke DB),
  // gampang kelewat batas timeout serverless function di production.
  // Tetap aman: tiap external_order_id unik per grup (gak ada duplikat
  // di dalam satu gelombang), dan createOrderWithItems masih tangani
  // race condition antar-gelombang lewat cek 23505 yang sudah ada.
  const IMPORT_CONCURRENCY = 20;
  const groupedEntries = Array.from(grouped.entries());

  async function processOrderGroup(
    externalOrderId: string,
    orderRows: Record<string, string>[]
  ) {
    try {
      const first = orderRows[0];
      const items = [];
      for (const row of orderRows) {
        const product = productBySku.get(row.sku);
        if (!product) throw new Error(`SKU tidak ditemukan: ${row.sku}`);
        const resolved = await resolveItemsForProduct(
          supabase,
          product.id,
          parseInt(row.qty, 10),
          product.is_bundle
        );
        items.push(...resolved);
      }

      const order = await createOrderWithItems(supabase, {
        channel: first.channel as "shopee" | "tiktok",
        externalOrderId,
        orderedAt: first.ordered_at,
        items,
      });

      // Idempotency: kalau order ini udah pernah diimpor sebelumnya (external_order_id
      // sama), jangan hitung sebagai "baru" -- catat sebagai skipped biar user tau
      // itu bukan duplikat data, cuma diam-diam gak diproses ulang.
      if (order.already_exists) {
        skipped.push({ external_order_id: externalOrderId });
      } else {
        created.push(order.id);
        createdOrders.push({
          id: order.id,
          channel: first.channel,
          external_order_id: externalOrderId,
          ordered_at: first.ordered_at,
        });
      }
    } catch (error) {
      errors.push({
        external_order_id: externalOrderId,
        message: error instanceof Error ? error.message : "Gagal impor",
      });
    }
  }

  for (let i = 0; i < groupedEntries.length; i += IMPORT_CONCURRENCY) {
    const batch = groupedEntries.slice(i, i + IMPORT_CONCURRENCY);
    await Promise.all(batch.map(([externalOrderId, orderRows]) => processOrderGroup(externalOrderId, orderRows)));
  }

  return ok(
    { created: created.length, order_ids: created, created_orders: createdOrders, skipped, failed: errors },
    201
  );
}