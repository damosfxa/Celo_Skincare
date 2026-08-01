import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import { addMaklonIntake, createOrder, createTestProduct, shipOrder } from "./helpers/fixtures";

describe("Oversell Risk (v_oversell_risk)", () => {
  let ctx: Awaited<ReturnType<typeof getTestClient>>;

  beforeAll(async () => {
    ctx = await getTestClient();
  });

  it("Total order PENDING melebihi stok tersedia -- muncul dengan shortfall yang benar", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addMaklonIntake(supabase, { productId: product.id, qty: 5, expiryDate: expiry, userId });

    // 2 order PENDING, total reservasi 8 -- lebih dari stok tersedia (5).
    await createOrder(supabase, { channel: "shopee", productId: product.id, qty: 5 });
    await createOrder(supabase, { channel: "tiktok", productId: product.id, qty: 3 });

    const { data: risk } = await supabase
      .from("v_oversell_risk")
      .select("reserved_qty, available_qty, shortfall")
      .eq("product_id", product.id)
      .single();

    expect(risk!.reserved_qty).toBe(8);
    expect(risk!.available_qty).toBe(5);
    expect(risk!.shortfall).toBe(3);
  });

  it("Total order PENDING TIDAK melebihi stok -- gak muncul (gak ada false positive)", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addMaklonIntake(supabase, { productId: product.id, qty: 10, expiryDate: expiry, userId });

    await createOrder(supabase, { channel: "shopee", productId: product.id, qty: 5 });

    const { data: risk } = await supabase
      .from("v_oversell_risk")
      .select("product_id")
      .eq("product_id", product.id);
    expect(risk).toHaveLength(0);
  });

  it("Order yang udah di-ship gak lagi dihitung sebagai reservasi PENDING", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addMaklonIntake(supabase, { productId: product.id, qty: 5, expiryDate: expiry, userId });

    const { order: order1, item: item1 } = await createOrder(supabase, {
      channel: "shopee",
      productId: product.id,
      qty: 5,
    });
    await createOrder(supabase, { channel: "shopee", productId: product.id, qty: 4 });
    // Sebelum shipped: reserved 5+4=9 > stok 5 -- ada resiko.
    const { data: beforeShip } = await supabase
      .from("v_oversell_risk")
      .select("reserved_qty")
      .eq("product_id", product.id)
      .single();
    expect(beforeShip!.reserved_qty).toBe(9);

    // order1 di-ship -- stok terpotong jadi 0, tapi reservasi PENDING yang
    // dihitung cuma order2 (4), bukan lagi 9. Order1 udah bukan PENDING.
    await shipOrder(supabase, { orderId: order1.id, itemId: item1.id, userId, channel: "shopee" });

    const { data: afterShip } = await supabase
      .from("v_oversell_risk")
      .select("reserved_qty, available_qty")
      .eq("product_id", product.id)
      .single();
    expect(afterShip!.reserved_qty).toBe(4); // cuma order2 yang masih PENDING
    expect(afterShip!.available_qty).toBe(0); // stok abis kepake order1
  });
});
