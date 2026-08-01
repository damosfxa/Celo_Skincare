import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import { addOpeningBalance, createTestProduct, getProductBalance } from "./helpers/fixtures";

describe("Stok Opname", () => {
  let ctx: Awaited<ReturnType<typeof getTestClient>>;

  beforeAll(async () => {
    ctx = await getTestClient();
  });

  it("Tutup sesi dengan selisih: nulis ADJUSTMENT_OPNAME, stok akhir = hasil hitung fisik", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const batchId = await addOpeningBalance(supabase, {
      productId: product.id,
      qty: 20,
      expiryDate: expiry,
      userId,
    });

    const { data: sessionId, error: openError } = await supabase.rpc("fn_open_opname_session", {
      p_created_by: userId,
    });
    expect(openError).toBeNull();

    const { data: itemBefore } = await supabase
      .from("opname_items")
      .select("id, system_qty, variance")
      .eq("session_id", sessionId)
      .eq("batch_id", batchId)
      .single();
    expect(itemBefore!.system_qty).toBe(20); // snapshot bener nangkep stok saat ini

    // Hitung fisik ketemu 17 (selisih -3, kayak ada yang hilang). variance
    // GENERATED otomatis (migration 0115) -- gak boleh/gak perlu diisi manual.
    const { error: updateError } = await supabase
      .from("opname_items")
      .update({ physical_qty: 17, discrepancy_reason: "lost" })
      .eq("id", itemBefore!.id);
    expect(updateError).toBeNull();

    const { error: closeError } = await supabase.rpc("fn_close_opname_session", {
      p_session_id: sessionId,
      p_closed_by: userId,
    });
    expect(closeError).toBeNull();

    const balanceAfter = await getProductBalance(supabase, product.id);
    expect(balanceAfter).toBe(17); // stok akhir ngikutin hasil hitung fisik

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("movement_type, qty_delta")
      .eq("reference_type", "opname_session")
      .eq("reference_id", sessionId);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows![0].movement_type).toBe("ADJUSTMENT_OPNAME");
    expect(ledgerRows![0].qty_delta).toBe(-3);
  });

  it("Tutup sesi TANPA selisih: gak ada ledger baru sama sekali", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const batchId = await addOpeningBalance(supabase, {
      productId: product.id,
      qty: 8,
      expiryDate: expiry,
      userId,
    });

    const { data: sessionId } = await supabase.rpc("fn_open_opname_session", { p_created_by: userId });

    const { data: itemBefore } = await supabase
      .from("opname_items")
      .select("id, system_qty")
      .eq("session_id", sessionId)
      .eq("batch_id", batchId)
      .single();

    await supabase
      .from("opname_items")
      .update({ physical_qty: itemBefore!.system_qty })
      .eq("id", itemBefore!.id);

    await supabase.rpc("fn_close_opname_session", { p_session_id: sessionId, p_closed_by: userId });

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("reference_type", "opname_session")
      .eq("reference_id", sessionId);
    expect(ledgerRows).toHaveLength(0);

    expect(await getProductBalance(supabase, product.id)).toBe(8); // gak berubah
  });

  it("REGRESI (bug 0115): cara API sungguhan nyimpen hasil hitung (physical_qty + discrepancy_reason SAJA, TANPA set variance) -- variance harus KEHITUNG OTOMATIS", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const batchId = await addOpeningBalance(supabase, {
      productId: product.id,
      qty: 20,
      expiryDate: expiry,
      userId,
    });

    const { data: sessionId } = await supabase.rpc("fn_open_opname_session", { p_created_by: userId });

    const { data: itemBefore } = await supabase
      .from("opname_items")
      .select("id")
      .eq("session_id", sessionId)
      .eq("batch_id", batchId)
      .single();

    // INI PERSIS payload yang dikirim app/api/opname/sessions/[id]/items/[batchId]/route.ts
    // (PATCH) -- cuma physical_qty, note, discrepancy_reason. Endpoint ini
    // TIDAK PERNAH nulis ke kolom `variance` secara eksplisit -- dan sekarang
    // gak perlu, karena variance GENERATED otomatis (migration 0115).
    await supabase
      .from("opname_items")
      .update({ physical_qty: 17, note: null, discrepancy_reason: "lost" })
      .eq("id", itemBefore!.id);

    const { data: itemAfterPatch } = await supabase
      .from("opname_items")
      .select("variance")
      .eq("id", itemBefore!.id)
      .single();
    expect(itemAfterPatch!.variance).toBe(-3); // otomatis kehitung, gak perlu API set manual

    await supabase.rpc("fn_close_opname_session", { p_session_id: sessionId, p_closed_by: userId });

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("movement_type, qty_delta")
      .eq("reference_type", "opname_session")
      .eq("reference_id", sessionId);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows![0].movement_type).toBe("ADJUSTMENT_OPNAME");
    expect(ledgerRows![0].qty_delta).toBe(-3);

    expect(await getProductBalance(supabase, product.id)).toBe(17); // stok akhir bener-bener terkoreksi
  });
});
