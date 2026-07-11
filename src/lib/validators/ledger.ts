import { z } from "zod";

export const manualOutSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().positive("Qty harus lebih dari 0"),
  movement_type: z.enum([
    "OUT_SALE_OFFLINE",
    "OUT_BONUS",
    "OUT_PROMO",
    "OUT_SAMPLE",
    "OUT_DAMAGED",
    "OUT_EXPIRED",
  ]),
  reason: z.string().min(1, "Alasan wajib diisi untuk keluar manual"),
});
