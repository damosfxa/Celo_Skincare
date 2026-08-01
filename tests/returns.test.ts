import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import {
  addOpeningBalance,
  createOrder,
  createReturnRow,
  createTestProduct,
  getProductBalance,
  shipOrder,
} from "./helpers/fixtures";

describe("Retur -- kondisi barang", () => {
  let ctx: Awaited<ReturnType<typeof getTestClient>>;

  beforeAll(async () => {
    ctx = await getTestClient();
  });

  async function setupShippedOrder(qty: number) {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addOpeningBalance(supabase, { productId: product.id, qty: 20, expiryDate: expiry, userId });

    const { order, item } = await createOrder(supabase, { channel: "shopee", productId: product.id, qty });
    await shipOrder(supabase, { orderId: order.id, itemId: item.id, userId, channel: "shopee" });

    return { product, order, item };
  }

  it("SELLABLE: stok balik ke BATCH BARU (bukan batch asal), qty nambah lagi", async () => {
    const { supabase, userId } = ctx;
    const { product, order, item } = await setupShippedOrder(5);

    const balanceAfterShip = await getProductBalance(supabase, product.id);
    expect(balanceAfterShip).toBe(15); // 20 - 5

    const ret = await createReturnRow(supabase, { orderId: order.id, orderItemId: item.id, qty: 5 });

    const { error } = await supabase.rpc("fn_inspect_return", {
      p_return_id: ret.id,
      p_condition: "SELLABLE",
      p_inspected_by: userId,
      p_photo_url: null,
      p_expiry_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    });
    expect(error).toBeNull();

    const balanceAfterReturn = await getProductBalance(supabase, product.id);
    expect(balanceAfterReturn).toBe(20); // balik penuh

    const { data: newBatches } = await supabase
      .from("product_batches")
      .select("id, batch_code")
      .eq("product_id", product.id)
      .like("batch_code", "RETUR-%");
    expect(newBatches).toHaveLength(1); // batch baru, bukan nambah ke batch asal

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("movement_type, qty_delta, batch_id")
      .eq("reference_type", "return")
      .eq("reference_id", ret.id);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows![0].movement_type).toBe("IN_RETURN_SELLABLE");
    expect(ledgerRows![0].qty_delta).toBe(5);
    expect(ledgerRows![0].batch_id).toBe(newBatches![0].id);
  });

  it("DAMAGED: WAJIB foto, dan TIDAK ADA ledger kedua (hindari double-count)", async () => {
    const { supabase, userId } = ctx;
    const { product, order, item } = await setupShippedOrder(3);

    const balanceAfterShip = await getProductBalance(supabase, product.id);

    const ret = await createReturnRow(supabase, { orderId: order.id, orderItemId: item.id, qty: 3 });

    // Tanpa foto -- harus ditolak.
    const noPhoto = await supabase.rpc("fn_inspect_return", {
      p_return_id: ret.id,
      p_condition: "DAMAGED",
      p_inspected_by: userId,
      p_photo_url: null,
    });
    expect(noPhoto.error).not.toBeNull();

    // Dengan foto -- diterima, tapi stok TIDAK berubah (sudah terpotong saat shipped).
    const withPhoto = await supabase.rpc("fn_inspect_return", {
      p_return_id: ret.id,
      p_condition: "DAMAGED",
      p_inspected_by: userId,
      p_photo_url: "https://example.com/bukti-rusak.jpg",
    });
    expect(withPhoto.error).toBeNull();

    const balanceAfterInspect = await getProductBalance(supabase, product.id);
    expect(balanceAfterInspect).toBe(balanceAfterShip); // gak berubah

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("reference_type", "return")
      .eq("reference_id", ret.id);
    expect(ledgerRows).toHaveLength(0); // tidak ada movement kedua

    const { data: returnRow } = await supabase
      .from("returns")
      .select("condition, photo_url")
      .eq("id", ret.id)
      .single();
    expect(returnRow!.condition).toBe("DAMAGED"); // tetap tercatat sebagai record audit
  });

  it("LOST: sama seperti DAMAGED -- gak ada ledger kedua, tapi status beda buat proses klaim", async () => {
    const { supabase, userId } = ctx;
    const { product, order, item } = await setupShippedOrder(2);
    const balanceAfterShip = await getProductBalance(supabase, product.id);

    const ret = await createReturnRow(supabase, { orderId: order.id, orderItemId: item.id, qty: 2 });

    const { error } = await supabase.rpc("fn_inspect_return", {
      p_return_id: ret.id,
      p_condition: "LOST",
      p_inspected_by: userId,
      p_photo_url: "https://example.com/bukti-hilang.jpg",
    });
    expect(error).toBeNull();

    expect(await getProductBalance(supabase, product.id)).toBe(balanceAfterShip);

    const { data: returnRow } = await supabase
      .from("returns")
      .select("condition")
      .eq("id", ret.id)
      .single();
    expect(returnRow!.condition).toBe("LOST"); // status terpisah dari DAMAGED
  });
});
