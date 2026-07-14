import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) {
    const message = json.error?.message || 'Terjadi kesalahan saat memuat data notifikasi';
    toast.error(message);
    throw new Error(message);
  }
  return json.data;
};

export type ExpiringBatch = {
  batch_id: string;
  product_id: string;
  sku: string;
  name: string;
  expiry_date: string;
  current_qty: number;
  days_remaining: number;
};

export function useExpiringNotifications() {
  const { data, error, isLoading, mutate } = useSWR<ExpiringBatch[]>('/api/notifications/expiring', fetcher);

  return {
    notifications: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export type TiktokClaim = {
  id: string;
  order_id: string;
  external_order_id: string;
  order_item_id: string;
  sku: string;
  name: string;
  qty: number;
  condition: string;
  claim_deadline: string;
  inspected_by: string;
  inspected_at: string;
  created_at: string;
  days_remaining: number;
};

export function useTiktokClaims() {
  const { data, error, isLoading, mutate } = useSWR<TiktokClaim[]>('/api/notifications/tiktok-claims', fetcher);

  return {
    claims: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
