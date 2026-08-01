import { z } from "zod";

export const opnameItemUpdateSchema = z.object({
  physical_qty: z.number().int().min(0, "Hasil hitung fisik tidak boleh negatif"),
  note: z.string().optional(),
  discrepancy_reason: z.enum(["damaged", "lost", "found_extra", "miscount_previous", "other"]).optional(),
});
