import { z } from "zod";

export const createProductSchema = z.object({
  sku: z.string().min(1, "SKU wajib diisi"),
  name: z.string().min(1, "Nama produk wajib diisi"),
  is_bundle: z.boolean().default(false),
});

// Cuma boleh ubah label (nama/SKU) -- bukan is_bundle atau apa pun yang
// menyangkut logika stok. Dipakai untuk membetulkan salah ketik admin.
export const updateProductSchema = z.object({
  sku: z.string().min(1, "SKU wajib diisi"),
  name: z.string().min(1, "Nama produk wajib diisi"),
});

export const batchIntakeSchema = z.object({
  product_id: z.string().uuid("product_id harus UUID valid"),
  batch_code: z.string().min(1, "Kode batch wajib diisi"),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  qty: z.number().int().positive("Qty harus lebih dari 0"),
});

export const bundleRecipeSchema = z
  .array(
    z.object({
      component_product_id: z.string().uuid(),
      qty_per_bundle: z.number().int().positive("Qty per bundle harus lebih dari 0"),
    })
  )
  .min(1, "Bundle harus punya minimal 1 komponen");