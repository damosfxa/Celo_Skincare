import { toast } from 'sonner';

export type SimulatedOrder = {
  id: string;
  status: 'PENDING' | 'SHIPPED' | 'IN_TRANSIT' | 'CANCELLED' | 'RETURNED';
  channel: string;
  created_at: string;
};

export async function simulateNewOrders(channel: string, count: number) {
  const res = await fetch('/api/orders/simulate/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, count }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal simulasi pesanan');
  return json.data;
}

export async function simulateShipOrder(orderId: string) {
  const res = await fetch('/api/orders/simulate/ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal ship order');
  return json.data;
}

export async function simulateCancelOrder(orderId: string) {
  const res = await fetch('/api/orders/simulate/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal membatalkan order');
  return json.data;
}

export async function simulateReturnOrder(orderId: string) {
  const res = await fetch('/api/orders/simulate/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Gagal mengajukan retur order');
  return json.data;
}
