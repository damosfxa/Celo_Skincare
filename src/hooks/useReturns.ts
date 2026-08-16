import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) {
    const message = json.error?.message || 'Terjadi kesalahan saat memuat data retur';
    toast.error(message);
    throw new Error(message);
  }
  return json.data;
};

export type ReturnItem = {
  id: string;
  order_id: string;
  channel: string;
  type?: 'RETURN' | 'CANCELLATION';
  condition?: 'PENDING_INSPECTION' | 'SELLABLE' | 'DAMAGED' | 'LOST';
  created_at: string;
  claim_deadline?: string;
  photo_url?: string;
  product_name?: string;
  product_sku?: string;
  qty?: number;
};

// condition: undefined = ambil semua tanpa filter, null = jangan fetch dulu
// (dipakai untuk tab Riwayat yang baru diambil begitu tabnya dibuka), string
// = filter 1 kondisi atau beberapa dipisah koma (mis. "SELLABLE,DAMAGED,LOST").
// limit: batasi jumlah baris (dipakai tab Riwayat supaya tidak menarik seluruh
// riwayat sekaligus). Tanpa limit = ambil semua (dipakai Export Excel).
export function useReturns(condition?: string | null, limit?: number) {
  let key: string | null;
  if (condition === null) {
    key = null;
  } else {
    const parts: string[] = [];
    if (condition) parts.push(`condition=${encodeURIComponent(condition)}`);
    if (limit && limit > 0) parts.push(`limit=${limit}`);
    key = parts.length ? `/api/returns?${parts.join("&")}` : '/api/returns';
  }
  // keepPreviousData: pas limit dinaikkan ("Muat lebih banyak"), baris yang
  // sudah tampil tetap kelihatan selama data yang lebih banyak dimuat -- tanpa
  // ini tabel sekejap kosong lalu balik skeleton, terasa seperti reload penuh.
  const { data, error, isLoading, mutate } = useSWR<ReturnItem[]>(key, fetcher, {
    keepPreviousData: true,
  });

  return {
    returns: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export async function inspectReturn(returnId: string, condition: string, photoUrl: string, expiryDate?: string) {
  const res = await fetch(`/api/returns/${returnId}/inspect`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ condition, photo_url: photoUrl, expiry_date: expiryDate }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal memproses inspeksi retur');
  return json.data;
}
