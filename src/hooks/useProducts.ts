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

export type Product = {
  id: string;
  sku: string;
  name: string;
  is_bundle: boolean;
  current_qty: number;
};

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR<Product[]>('/api/products', fetcher);

  return {
    products: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
