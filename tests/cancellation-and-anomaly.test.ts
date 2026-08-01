import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import {
  addOpeningBalance,
  addMaklonIntake,
  createOrder,
  createReturnRow,
  createTestProduct,
  getProductBalance,
  shipOrder,
} from "./helpers/fixtures";

describe("Pembatalan setelah shipped & deteksi anomali harian", () => {
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

  it("Batal SETELAH shipped, jalur resmi: batch baru 'BATAL-', ledger IN_CANCEL_REVERSAL, TIDAK muncul di anomali harian", async () => {
    const { supabase, userId } = ctx;
    const { product, order, item } = await setupShippedOrder(4);

    // Jalur resmi: return type=CANCELLATION + inspeksi SELLABLE.
    const ret = await createReturnRow(supabase, {
      orderId: order.id,
      orderItemId: item.id,
      qty: 4,
      type: "CANCELLATION",
    });
    await supabase.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);

    const { error } = await supabase.rpc("fn_inspect_return", {
      p_return_id: ret.id,
      p_condition: "SELLABLE",
      p_inspected_by: userId,
      p_photo_url: null,
      p_expiry_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    });
    expect(error).toBeNull();

    expect(await getProductBalance(supabase, product.id)).toBe(20); // balik penuh

    const { data: newBatches } = await supabase
      .from("product_batches")
      .select("id")
      .eq("product_id", product.id)
      .like("batch_code", "BATAL-%");
    expect(newBatches).toHaveLength(1);

    const { data: ledgerRows } = await supabase
      .from("stock_ledger")
      .select("movement_type, qty_delta")
      .eq("reference_type", "return")
      .eq("reference_id", ret.id);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows![0].movement_type).toBe("IN_CANCEL_REVERSAL");

    // Regresi bug 0106: order CANCELLED + ledger keluar + SUDAH ada
    // pembatalan resmi yang diinspeksi -> jangan dianggap anomali.
    const { data: anomalies } = await supabase
      .from("v_daily_anomalies")
      .select("order_id")
      .eq("order_id", order.id);
    expect(anomalies).toHaveLength(0);
  });

  it("Batal SETELAH shipped TAPI belum lewat jalur resmi -- HARUS muncul di anomali harian", async () => {
    const { supabase, userId } = ctx;
    const { product, order } = await setupShippedOrder(6);

    // Order ditandai CANCELLED langsung (skip proses retur/inspeksi resmi)
    // -- ini persis skenario "selisih gak ketauan asalnya" yang harus
    // ketangkep sistem, bukan dibiarkan lewat diam-diam.
    await supabase.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);

    const { data: anomalies } = await supabase
      .from("v_daily_anomalies")
      .select("order_id, anomaly_type, leaked_qty, priority_level")
      .eq("order_id", order.id);
    expect(anomalies).toHaveLength(1);
    expect(anomalies![0].anomaly_type).toBe("CANCELLED_BUT_HAS_OUTBOUND_LEDGER");
    expect(anomalies![0].leaked_qty).toBe(6);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(anomalies![0].priority_level);
  });

  it("Batch dengan saldo minus (seharusnya mustahil lewat guard normal) -- HARUS muncul sebagai anomali prioritas HIGH", async () => {
    const { supabase, userId } = ctx;
    const product = await createTestProduct(supabase);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const batchId = await addMaklonIntake(supabase, {
      productId: product.id,
      qty: 5,
      expiryDate: expiry,
      userId,
    });

    // Simulasi skenario "seharusnya mustahil": insert ledger langsung yang
    // melewati guard fn_allocate_fefo (mis. race condition 2 request
    // nyaris bersamaan). Ini SENGAJA insert manual buat nguji deteksinya,
    // BUKAN pola yang boleh dipakai kode aplikasi (semua write asli tetap
    // WAJIB lewat RPC).
    await supabase.from("stock_ledger").insert({
      batch_id: batchId,
      movement_type: "OUT_MANUAL",
      qty_delta: -10,
      channel: "internal",
      reason: "offline",
      created_by: userId,
    });

    expect(await getProductBalance(supabase, product.id)).toBe(-5);

    const { data: anomalies } = await supabase
      .from("v_daily_anomalies")
      .select("anomaly_id, anomaly_type, leaked_qty, priority_level, label")
      .eq("anomaly_type", "NEGATIVE_BATCH_BALANCE")
      .eq("anomaly_id", batchId);
    expect(anomalies).toHaveLength(1);
    expect(anomalies![0].leaked_qty).toBe(5);
    expect(anomalies![0].priority_level).toBe("HIGH");
    expect(anomalies![0].label).toContain("saldo minus");
  });

  it("anomaly_id selalu unik & gak pernah null, meski gabungan dari 2 jenis anomali berbeda", async () => {
    const { supabase } = ctx;
    const { data: allAnomalies } = await supabase.from("v_daily_anomalies").select("anomaly_id");
    const ids = (allAnomalies ?? []).map((a) => a.anomaly_id);
    expect(ids.every((id) => id !== null && id !== undefined)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length); // gak ada duplikat
  });
});
