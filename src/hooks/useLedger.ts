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
  batch_id: string;
  movement_type: string;
  qty_delta: number;
  reference_type?: string;
  reference_id?: string;
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

export function useDailyAnomalies() {
  const { data, error, isLoading, mutate } = useSWR<any[]>('/api/reconciliation/daily', fetcher);

  return {
    anomalies: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
