import { z } from "zod";

export const opnameItemUpdateSchema = z.object({
  physical_qty: z.number().int().min(0, "Hasil hitung fisik tidak boleh negatif"),
  note: z.string().optional(),
  // Frontend ngirim string kosong "" waktu gak ada selisih (bukan
  // undefined, itu default value form-nya) -- preprocess dulu jadi
  // undefined sebelum dicek enum, biar "" gak ketolak sebagai "bukan
  // salah satu dari 5 pilihan". Tanpa ini, opname yang hasilnya PAS
  // SAMA dengan sistem (skenario paling umum & paling sehat di gudang)
  // gagal disimpan.
  discrepancy_reason: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(["damaged", "lost", "found_extra", "miscount_previous", "other"]).optional()
  ),
});
