import { z } from "zod";

export const opnameItemUpdateSchema = z.object({
  physical_qty: z.number().int().min(0, "Hasil hitung fisik tidak boleh negatif"),
  note: z.string().optional(),
});
