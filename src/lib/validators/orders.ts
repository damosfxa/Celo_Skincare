import { z } from "zod";

export const simulateNewOrdersSchema = z.object({
  channel: z.enum(["shopee", "tiktok"]),
  count: z.number().int().min(1).max(50).default(10),
});

export const simulateShipSchema = z.object({
  order_id: z.string().uuid(),
});

export const simulateCancelSchema = z.object({
  order_id: z.string().uuid(),
});

// order_item_id & qty dibuat opsional -- endpoint simulate/new tidak pernah
// mengekspos order_item_id ke frontend, jadi tombol simulate return gak
// mungkin bisa isi itu. Backend yang resolve otomatis.
export const simulateReturnSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid().optional(),
  qty: z.number().int().positive().optional(),
});