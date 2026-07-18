import { z } from "zod";

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

export const inspectReturnSchema = z
  .object({
    condition: z.enum(["SELLABLE", "DAMAGED", "LOST"]),
    photo_url: z.preprocess(emptyToUndefined, z.string().url().optional()),
    expiry_date: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
        .optional()
    ),
  })
  .refine((data) => data.condition !== "SELLABLE" || !!data.expiry_date, {
    message: "Tanggal kedaluwarsa wajib diisi untuk kondisi layak jual (batch retur baru butuh tanggal ini)",
    path: ["expiry_date"],
  });