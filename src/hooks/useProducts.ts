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

export type RecipeComponent = {
  component_product_id: string;
  qty_per_bundle: number;
  component?: {
    sku: string;
    name: string;
  };
};

export type ProductDetail = Product & {
  recipe?: RecipeComponent[];
  batches?: {
    id: string;
    batch_code: string;
    expiry_date?: string;
    current_qty: number;
  }[];
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

export function useProductDetail(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ProductDetail>(
    id ? `/api/products/${id}` : null, 
    fetcher
  );

  return {
    product: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export async function submitBundleRecipe(productId: string, components: { component_product_id: string; qty_per_bundle: number }[]) {
  const res = await fetch(`/api/products/${productId}/recipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(components),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal menyimpan resep bundle');
  return json.data;
}
