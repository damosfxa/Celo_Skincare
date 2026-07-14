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

export type OpnameSession = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
  closed_at?: string;
  items?: OpnameItem[];
};

export type OpnameItem = {
  batch_id: string;
  physical_qty: number | null;
  system_qty?: number;
  variance?: number;
  created_at?: string;
  product_batches?: {
    batch_code: string;
    product_id: string;
    products?: {
      sku: string;
      name: string;
    };
  };
};

// Fetch list of sessions
export function useOpnameSessions() {
  const { data, error, isLoading, mutate } = useSWR<OpnameSession[]>('/api/opname/sessions', fetcher);

  return {
    sessions: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Fetch session detail
export function useOpnameSessionDetail(sessionId: string) {
  const { data, error, isLoading, mutate } = useSWR<OpnameSession>(`/api/opname/sessions/${sessionId}`, fetcher);

  return {
    session: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Create new session
export async function createOpnameSession() {
  const res = await fetch('/api/opname/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal membuka sesi opname');
  return json.data as { session_id: string };
}

// Submit scanned item
export async function submitOpnameItem(sessionId: string, batchId: string, physicalQty: number) {
  const res = await fetch(`/api/opname/sessions/${sessionId}/items/${batchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ physical_qty: physicalQty }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal menyimpan item opname');
  return json.data;
}

// Close session
export async function closeOpnameSession(sessionId: string) {
  const res = await fetch(`/api/opname/sessions/${sessionId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal menutup sesi opname');
  return json.data as { not_counted?: string[] };
}
