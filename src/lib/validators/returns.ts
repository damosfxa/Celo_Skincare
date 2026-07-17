import { z } from "zod";

// String kosong ("") dari form diperlakukan sama seperti field yang
// gak diisi -- sebelumnya z.string().url().optional() tetap menolak ""
// karena "" bukan URL valid, padahal maksudnya field ini kosong/gak diisi.
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
  .refine((data) => data.condition === "SELLABLE" || !!data.photo_url, {
    message: "Foto bukti wajib untuk kondisi rusak atau hilang",
    path: ["photo_url"],
  })
  .refine((data) => data.condition !== "SELLABLE" || !!data.expiry_date, {
    message: "Tanggal kedaluwarsa wajib diisi untuk kondisi layak jual (batch retur baru butuh tanggal ini)",
    path: ["expiry_date"],
  });