import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) {
    const message = json.error?.message || 'Terjadi kesalahan saat memuat data';
    toast.error(message);
    throw new Error(message);
  }
  return json.data;
};

export type LedgerEntry = {
  id: string;
  batch_id: string;
  // Kode batch yang gampang dibaca (misal "OB-2026-001"), sama dengan yang
  // tertera di label QR fisik. batch_id (di atas) tetap raw UUID, dipakai
  // buat cari data QR-nya lewat QrGeneratorModal, bukan buat ditampilkan.
  batch_code?: string | null;
  movement_type: string;
  qty_delta: number;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  campaign_reference?: string;
  note?: string;
  channel?: string;
  created_at: string;
};

export type ReconciliationDrilldown = {
  product_id: string;
  current_qty: number;
  ledger: LedgerEntry[];
};

export function useReconciliationDrilldown(productId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ReconciliationDrilldown>(
    productId ? `/api/reconciliation/drilldown?product_id=${productId}` : null,
    fetcher
  );

  return {
    data,
    isLoading,
    isError: error,
    mutate,
  };
}

export type DailyAnomaly = {
  anomaly_id: string;
  order_id: string;
  anomaly_type: string;
  label: string;
  channel: string;
  external_order_id: string;
  detected_at: string;
  affected_product_ids: string[];
  affected_products?: { id: string; sku: string; name: string }[];
  leaked_qty: number;
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
};

export function useDailyAnomalies() {
  const { data, error, isLoading, mutate } = useSWR<DailyAnomaly[]>('/api/reconciliation/daily', fetcher);

  return {
    anomalies: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export async function correctLedgerEntry(id: string, qtyDelta: number, note: string) {
  const res = await fetch(`/api/ledger/${id}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qty_delta: qtyDelta, note }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal menyimpan koreksi ledger');
  return json.data;
}
