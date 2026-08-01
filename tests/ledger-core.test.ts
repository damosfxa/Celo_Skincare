import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import { addOpeningBalance, createOrder, createTestProduct, getProductBalance } from "./helpers/fixtures";

describe("Logika inti ledger & FEFO", () => {
  let ctx: Awaited<ReturnType<typeof getTestClient>>;

  beforeAll(async () => {
    ctx = await getTestClient();
  });

  it("FEFO: alokasi dari batch expiry terdekat dulu, split ke batch berikutnya kalau kurang", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);

    // Batch A kadaluwarsa lebih dulu (30 hari), stok 3.
    // Batch B kadaluwarsa belakangan (90 hari), stok 10.
    const nearExpiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const farExpiry = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const batchA = await addOpeningBalance(supabase, {
      productId: product.id,
      qty: 3,
      expiryDate: nearExpiry,
      userId,
    });
    const batchB = await addOpeningBalance(supabase, {
      productId: product.id,
      qty: 10,
      expiryDate: farExpiry,
      userId,
    });

    // Order minta 5 -- harus kepecah: 3 dari batch A (habis), 2 dari batch B.
    const { data: alloc, error } = await supabase.rpc("fn_allocate_fefo", {
      p_product_id: product.id,
      p_qty: 5,
    });
    expect(error).toBeNull();

    const byBatch = new Map((alloc as { batch_id: string; qty: number }[]).map((r) => [r.batch_id, r.qty]));
    expect(byBatch.get(batchA)).toBe(3);
    expect(byBatch.get(batchB)).toBe(2);
  });

  it("Order shipped: stok kepotong sesuai qty, ledger tercatat OUT_SALE_MARKETPLACE", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);

    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addOpeningBalance(supabase, { productId: product.id, qty: 20, expiryDate: expiry, userId });

    const balanceBefore = await getProductBalance(supabase, product.id);
    expect(balanceBefore).toBe(20);

    const { order, item } = await createOrder(supabase, { channel: "shopee", productId: product.id, qty: 7 });

    const { error: shipError } = await supabase.rpc("fn_ship_order_item", {
      p_order_item_id: item.id,
      p_created_by: userId,
    });
    expect(shipError).toBeNull();

    const balanceAfter = await getProductBalance(supabase, product.id);
    expect(balanceAfter).toBe(13); // 20 - 7

    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("stock_ledger")
      .select("movement_type, qty_delta, reference_id")
      .eq("reference_type", "order")
      .eq("reference_id", order.id);
    expect(ledgerError).toBeNull();
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows![0].movement_type).toBe("OUT_SALE_MARKETPLACE");
    expect(ledgerRows![0].qty_delta).toBe(-7);
  });

  it("Order batal SEBELUM shipped: gak ada ledger sama sekali (masih reservasi murni)", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);

    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addOpeningBalance(supabase, { productId: product.id, qty: 10, expiryDate: expiry, userId });

    const { order } = await createOrder(supabase, { channel: "shopee", productId: product.id, qty: 4 });

    await supabase.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("reference_type", "order")
      .eq("reference_id", order.id);
    expect(ledgerRows).toHaveLength(0);

    const balanceAfter = await getProductBalance(supabase, product.id);
    expect(balanceAfter).toBe(10); // gak kepotong sama sekali
  });
});
