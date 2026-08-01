import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "Gagal memuat data dashboard");
  }
  return json.data;
};

export type WorklistItem = {
  id: string;
  type: "tiktok_claim" | "expiring_batch" | "anomaly" | "pending_return" | "oversell_risk";
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  href: string;
};

export type RecentMovement = {
  id: string;
  product_name: string;
  sku: string;
  batch_code: string;
  movement_type: string;
  qty_delta: number;
  created_at: string;
};

export type DashboardToday = {
  stats: {
    total_active_sku: number;
    batches_near_expiry: number;
    returns_pending_inspection: number;
    open_anomalies: number;
  };
  worklist: WorklistItem[];
  recent_movements: RecentMovement[];
};

export function useDashboardToday() {
  const { data, error, isLoading, mutate } = useSWR<DashboardToday>(
    "/api/dashboard/today",
    fetcher
  );

  return {
    data,
    isLoading,
    isError: error,
    mutate,
  };
}
