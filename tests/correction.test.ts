import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import { addMaklonIntake, createTestProduct, getProductBalance } from "./helpers/fixtures";

describe("Koreksi Entri (fn_correct_ledger_entry)", () => {
  let ctx: Awaited<ReturnType<typeof getTestClient>>;

  beforeAll(async () => {
    ctx = await getTestClient();
  });

  it("Koreksi entri IN_MAKLON yang salah input (kelebihan input, dikurangi)", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addMaklonIntake(supabase, { productId: product.id, qty: 50, expiryDate: expiry, userId });

    expect(await getProductBalance(supabase, product.id)).toBe(50);

    const { data: original } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("movement_type", "IN_MAKLON")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Ternyata admin salah input, harusnya cuma 40, bukan 50 -- koreksi -10.
    const { error } = await supabase.rpc("fn_correct_ledger_entry", {
      p_ledger_entry_id: original!.id,
      p_qty_delta: -10,
      p_note: "Salah input, seharusnya 40 bukan 50",
      p_created_by: userId,
    });
    expect(error).toBeNull();

    expect(await getProductBalance(supabase, product.id)).toBe(40);

    const { data: correctionRows } = await supabase
      .from("stock_ledger")
      .select("movement_type, qty_delta, reference_type, reference_id")
      .eq("reference_type", "ledger_correction")
      .eq("reference_id", original!.id);
    expect(correctionRows).toHaveLength(1);
    expect(correctionRows![0].movement_type).toBe("ADJUSTMENT_CORRECTION");
    expect(correctionRows![0].qty_delta).toBe(-10);

    // Entri ASLI gak diubah/dihapus -- cuma nambah entri baru (append-only).
    const { data: originalStillThere } = await supabase
      .from("stock_ledger")
      .select("qty_delta")
      .eq("id", original!.id)
      .single();
    expect(originalStillThere!.qty_delta).toBe(50);
  });

  it("Koreksi entri OUT_SALE_MARKETPLACE (bukan input manual): DITOLAK", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addMaklonIntake(supabase, { productId: product.id, qty: 20, expiryDate: expiry, userId });

    const { data: orderRow } = await supabase
      .from("orders")
      .insert({ channel: "shopee", external_order_id: `TEST-CORR-${Date.now()}`, status: "PENDING", ordered_at: new Date().toISOString() })
      .select()
      .single();
    const { data: itemRow } = await supabase
      .from("order_items")
      .insert({ order_id: orderRow!.id, product_id: product.id, qty: 5 })
      .select()
      .single();
    await supabase.rpc("fn_ship_order_item", { p_order_item_id: itemRow!.id, p_created_by: userId });

    const { data: shipmentEntry } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("movement_type", "OUT_SALE_MARKETPLACE")
      .eq("reference_id", orderRow!.id)
      .single();

    const { error } = await supabase.rpc("fn_correct_ledger_entry", {
      p_ledger_entry_id: shipmentEntry!.id,
      p_qty_delta: -1,
      p_note: "coba koreksi entri penjualan",
      p_created_by: userId,
    });
    expect(error).not.toBeNull(); // hanya IN_MAKLON/OUT_MANUAL yang boleh dikoreksi
  });

  it("Koreksi yang bikin saldo negatif: DITOLAK (guard)", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addMaklonIntake(supabase, { productId: product.id, qty: 5, expiryDate: expiry, userId });

    const { data: original } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("movement_type", "IN_MAKLON")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Saldo cuma 5, coba koreksi -20 -- harus ditolak, bukan bikin stok minus.
    const { error } = await supabase.rpc("fn_correct_ledger_entry", {
      p_ledger_entry_id: original!.id,
      p_qty_delta: -20,
      p_note: "coba paksa saldo negatif",
      p_created_by: userId,
    });
    expect(error).not.toBeNull();

    expect(await getProductBalance(supabase, product.id)).toBe(5); // gak berubah
  });

  it("qty_delta = 0 atau note kosong: DITOLAK", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await addMaklonIntake(supabase, { productId: product.id, qty: 10, expiryDate: expiry, userId });

    const { data: original } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("movement_type", "IN_MAKLON")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const zeroDelta = await supabase.rpc("fn_correct_ledger_entry", {
      p_ledger_entry_id: original!.id,
      p_qty_delta: 0,
      p_note: "test",
      p_created_by: userId,
    });
    expect(zeroDelta.error).not.toBeNull();

    const emptyNote = await supabase.rpc("fn_correct_ledger_entry", {
      p_ledger_entry_id: original!.id,
      p_qty_delta: 2,
      p_note: "",
      p_created_by: userId,
    });
    expect(emptyNote.error).not.toBeNull();
  });
});
