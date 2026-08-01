import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import { addOpeningBalance, createTestProduct, getProductBalance } from "./helpers/fixtures";

describe("Keluar Manual (fn_manual_out)", () => {
  let ctx: Awaited<ReturnType<typeof getTestClient>>;

  beforeAll(async () => {
    ctx = await getTestClient();
  });

  async function setupProductWithStock(qty: number) {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addOpeningBalance(supabase, { productId: product.id, qty, expiryDate: expiry, userId });
    return product;
  }

  it("reason=offline: channel='offline', campaign_reference gak wajib (dan tetap NULL walau reason offline)", async () => {
    const { supabase, userId } = ctx;
    const product = await setupProductWithStock(10);

    const { error } = await supabase.rpc("fn_manual_out", {
      p_product_id: product.id,
      p_qty: 3,
      p_reason: "offline",
      p_note: "Penjualan tunai di toko fisik",
      p_campaign_reference: null,
      p_created_by: userId,
    });
    expect(error).toBeNull();

    expect(await getProductBalance(supabase, product.id)).toBe(7);

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("movement_type, qty_delta, channel, reason, campaign_reference")
      .eq("movement_type", "OUT_MANUAL")
      .eq("reason", "offline")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(ledgerRows![0].channel).toBe("offline");
    expect(ledgerRows![0].qty_delta).toBe(-3);
    expect(ledgerRows![0].campaign_reference).toBeNull();
  });

  it("reason=bonus TANPA campaign_reference: DITOLAK (sumber selisih terbesar wajib ada referensi)", async () => {
    const { supabase, userId } = ctx;
    const product = await setupProductWithStock(10);

    const { error } = await supabase.rpc("fn_manual_out", {
      p_product_id: product.id,
      p_qty: 2,
      p_reason: "bonus",
      p_note: "Bonus pembelian",
      p_campaign_reference: null,
      p_created_by: userId,
    });
    expect(error).not.toBeNull();

    expect(await getProductBalance(supabase, product.id)).toBe(10); // gak kepotong, ditolak total
  });

  it("reason=promo DENGAN campaign_reference: diterima, channel='internal', campaign_reference tersimpan", async () => {
    const { supabase, userId } = ctx;
    const product = await setupProductWithStock(10);

    const { error } = await supabase.rpc("fn_manual_out", {
      p_product_id: product.id,
      p_qty: 4,
      p_reason: "promo",
      p_note: "Promo 12.12",
      p_campaign_reference: "PROMO-1212-SHOPEE",
      p_created_by: userId,
    });
    expect(error).toBeNull();

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("channel, campaign_reference")
      .eq("movement_type", "OUT_MANUAL")
      .eq("reason", "promo")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(ledgerRows![0].channel).toBe("internal");
    expect(ledgerRows![0].campaign_reference).toBe("PROMO-1212-SHOPEE");
  });

  it("reason gak valid: ditolak", async () => {
    const { supabase, userId } = ctx;
    const product = await setupProductWithStock(5);

    const { error } = await supabase.rpc("fn_manual_out", {
      p_product_id: product.id,
      p_qty: 1,
      p_reason: "ngasal",
      p_note: "test",
      p_campaign_reference: null,
      p_created_by: userId,
    });
    expect(error).not.toBeNull();
  });

  it("note kosong: ditolak (catatan wajib diisi)", async () => {
    const { supabase, userId } = ctx;
    const product = await setupProductWithStock(5);

    const { error } = await supabase.rpc("fn_manual_out", {
      p_product_id: product.id,
      p_qty: 1,
      p_reason: "damaged",
      p_note: "",
      p_campaign_reference: null,
      p_created_by: userId,
    });
    expect(error).not.toBeNull();
  });
});
