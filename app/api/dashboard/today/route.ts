import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

type WorklistItem = {
  id: string;
  type: "tiktok_claim" | "expiring_batch" | "anomaly" | "pending_return" | "oversell_risk";
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  href: string;
};

function claimPriority(daysRemaining: number): "HIGH" | "MEDIUM" | "LOW" {
  if (daysRemaining <= 5) return "HIGH";
  if (daysRemaining <= 15) return "MEDIUM";
  return "LOW";
}

function expiryPriority(daysRemaining: number): "HIGH" | "MEDIUM" | "LOW" {
  if (daysRemaining <= 7) return "HIGH";
  if (daysRemaining <= 20) return "MEDIUM";
  return "LOW";
}

const PRIORITY_WEIGHT: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// Klien Supabase di project ini sengaja tidak diberi tipe skema hasil-generate,
// jadi hasil query datang longgar. Dua bentuk di bawah ini punya relasi
// bersarang hasil join, dideklarasikan supaya aksesnya tetap terperiksa.
//
// Catatan penting soal `as unknown as ...` di bawah: tanpa tipe skema,
// Supabase menebak SEMUA relasi bersarang sebagai array. Untuk relasi
// many-to-one (returns -> order_items, stock_ledger -> product_batches)
// PostgREST sebenarnya mengembalikan OBJEK TUNGGAL, bukan array. Bentuk
// di bawah ini yang benar secara runtime, jadi tebakan Supabase perlu
// ditimpa. Sebelumnya hal ini disembunyikan dengan `as any`, yang berarti
// akses field-nya sama sekali tidak diperiksa.
type PendingReturnRow = {
  id: string;
  qty: number;
  created_at: string;
  order_items: { products: { sku: string; name: string } | null } | null;
  orders: { channel: string; external_order_id: string } | null;
};

type RecentLedgerRow = {
  id: string;
  movement_type: string;
  qty_delta: number;
  created_at: string;
  product_batches: {
    batch_code: string;
    products: { sku: string; name: string } | null;
  } | null;
};

export async function GET() {
  const supabase = await createClient();

  const [
    productsRes,
    expiringRes,
    pendingReturnsRes,
    anomaliesRes,
    tiktokClaimsRes,
    recentLedgerRes,
    oversellRiskRes,
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_bundle", false),
    supabase.from("v_expiring_batches").select("*").order("days_remaining", { ascending: true }),
    supabase
      .from("returns")
      .select(
        "id, qty, created_at, order_items(product_id, products(sku, name)), orders(channel, external_order_id)"
      )
      .eq("condition", "PENDING_INSPECTION")
      .order("created_at", { ascending: true }),
    supabase
      .from("v_daily_anomalies")
      .select("anomaly_id, anomaly_type, label, priority_level, leaked_qty, detected_at"),
    supabase.from("v_pending_tiktok_claims").select("*").order("days_remaining", { ascending: true }),
    supabase
      .from("stock_ledger")
      .select("id, movement_type, qty_delta, created_at, product_batches(batch_code, products(sku, name))")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("v_oversell_risk")
      .select("product_id, sku, name, reserved_qty, available_qty, shortfall")
      .order("shortfall", { ascending: false }),
  ]);

  for (const res of [
    productsRes,
    expiringRes,
    pendingReturnsRes,
    anomaliesRes,
    tiktokClaimsRes,
    recentLedgerRes,
    oversellRiskRes,
  ]) {
    if (res.error) return handleError(res.error);
  }

  const worklist: WorklistItem[] = [];

  for (const claim of tiktokClaimsRes.data ?? []) {
    const claimDaysText =
      claim.days_remaining < 0
        ? `sudah lewat batas klaim ${Math.abs(claim.days_remaining)} hari lalu`
        : `${claim.days_remaining} hari lagi`;
    worklist.push({
      id: `tiktok_claim-${claim.id}`,
      type: "tiktok_claim",
      priority: claimPriority(claim.days_remaining),
      title: `Klaim TikTok ${claim.external_order_id}, ${claimDaysText}`,
      detail: `${claim.condition === "PENDING_INSPECTION" ? "Belum diinspeksi" : claim.condition}, ${claim.name} x${claim.qty}`,
      // Halaman Retur sekarang punya 2 tab (Menunggu Inspeksi / Riwayat).
      // Klaim TikTok bisa masih PENDING_INSPECTION (belum diinspeksi) ATAU
      // sudah DAMAGED/LOST (sudah diinspeksi, tinggal ajukan klaim) --
      // arahkan ke tab yang sesuai kondisinya, bukan cuma "/returns" polos,
      // supaya tidak nyasar ke tab yang kosong.
      href: claim.condition === "PENDING_INSPECTION" ? "/returns?tab=pending" : "/returns?tab=history",
    });
  }

  for (const batch of expiringRes.data ?? []) {
    const expiryDaysText =
      batch.days_remaining < 0
        ? `sudah kedaluwarsa ${Math.abs(batch.days_remaining)} hari lalu`
        : `kedaluwarsa ${batch.days_remaining} hari lagi`;
    worklist.push({
      id: `expiring_batch-${batch.batch_id}`,
      type: "expiring_batch",
      priority: expiryPriority(batch.days_remaining),
      title: `${batch.name}, batch ${batch.batch_code} ${expiryDaysText}`,
      detail: `Sisa ${batch.current_qty.toLocaleString("id-ID")} unit`,
      href: `/products/${batch.product_id}`,
    });
  }

  for (const anomaly of anomaliesRes.data ?? []) {
    worklist.push({
      id: `anomaly-${anomaly.anomaly_id}`,
      type: "anomaly",
      priority: anomaly.priority_level,
      title: anomaly.label,
      detail: `${anomaly.anomaly_type}, qty ${anomaly.leaked_qty.toLocaleString("id-ID")}`,
      href: "/ledger?tab=anomalies",
    });
  }

  for (const ret of pendingReturnsRes.data ?? []) {
    const r = ret as unknown as PendingReturnRow;
    const productName = r.order_items?.products?.name ?? "Produk tidak diketahui";
    const externalOrderId = r.orders?.external_order_id ?? "-";
    const ageMs = Date.now() - new Date(r.created_at).getTime();
    const ageDays = ageMs / 86400000;
    const priority = ageDays >= 3 ? "HIGH" : ageDays >= 1 ? "MEDIUM" : "LOW";
    worklist.push({
      id: `pending_return-${r.id}`,
      type: "pending_return",
      priority,
      title: `Retur ${productName} x${r.qty} menunggu inspeksi`,
      detail: `Order ${r.orders?.channel ?? "-"} #${externalOrderId}`,
      href: "/returns?tab=pending",
    });
  }

  for (const risk of oversellRiskRes.data ?? []) {
    worklist.push({
      id: `oversell_risk-${risk.product_id}`,
      type: "oversell_risk",
      priority: "HIGH",
      title: `Resiko oversell: ${risk.name}`,
      detail: `${risk.reserved_qty.toLocaleString("id-ID")} unit dipesan, cuma ${risk.available_qty.toLocaleString("id-ID")} unit tersedia (kurang ${risk.shortfall.toLocaleString("id-ID")})`,
      href: `/products/${risk.product_id}`,
    });
  }

  worklist.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]);

  const recentMovements = ((recentLedgerRes.data as unknown as RecentLedgerRow[]) ?? []).map((row) => ({
    id: row.id,
    product_name: row.product_batches?.products?.name ?? "-",
    sku: row.product_batches?.products?.sku ?? "-",
    batch_code: row.product_batches?.batch_code ?? "-",
    movement_type: row.movement_type,
    qty_delta: row.qty_delta,
    created_at: row.created_at,
  }));

  return ok({
    stats: {
      total_active_sku: productsRes.count ?? 0,
      batches_near_expiry: expiringRes.data?.length ?? 0,
      returns_pending_inspection: pendingReturnsRes.data?.length ?? 0,
      open_anomalies: anomaliesRes.data?.length ?? 0,
    },
    worklist,
    recent_movements: recentMovements,
  });
}
