import { z } from "zod";

export const manualOutSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().positive("Qty harus lebih dari 0"),
  reason: z.enum(["offline", "bonus", "promo", "sample", "damaged", "expired"]),
  note: z.string().min(1, "Catatan wajib diisi untuk keluar manual"),
  campaign_reference: z.string().optional(),
}).refine((data) => {
  if (["bonus", "promo", "sample"].includes(data.reason)) {
    return !!data.campaign_reference && data.campaign_reference.trim().length > 0;
  }
  return true;
}, {
  message: "Referensi campaign/approval wajib diisi untuk reason bonus, promo, atau sample",
  path: ["campaign_reference"],
});

export const correctLedgerSchema = z.object({
  qty_delta: z.number().int().refine((v) => v !== 0, "Selisih koreksi tidak boleh 0"),
  note: z.string().min(1, "Catatan alasan wajib diisi untuk koreksi entri"),
});