import { z } from "zod";

// Batas panjang wajar (ketemu saat QA: nama produk sempat diisi payload
// XSS ~90 karakter tanpa penolakan sama sekali -- terbukti gak bisa
// dieksekusi karena React eskape default & gak ada dangerouslySetInnerHTML
// di mana pun, tapi tetap gak sehat membiarkan input sepanjang/sebebas
// apa pun masuk tanpa batas). SKU juga dibatasi ke karakter yang wajar
// buat kode produk (huruf/angka/dash/underscore/titik), sesuai pola SKU
// yang sudah ada di seluruh data (mis. SRM-VITC-30ML).
export const createProductSchema = z.object({
  sku: z
    .string()
    .min(1, "SKU wajib diisi")
    .max(50, "SKU maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9\-_.]+$/, "SKU cuma boleh huruf, angka, tanda hubung (-), underscore (_), dan titik (.)"),
  name: z.string().min(1, "Nama produk wajib diisi").max(200, "Nama produk maksimal 200 karakter"),
  is_bundle: z.boolean().default(false),
});

// Cuma boleh ubah label (nama/SKU) -- bukan is_bundle atau apa pun yang
// menyangkut logika stok. Dipakai untuk membetulkan salah ketik admin.
export const updateProductSchema = z.object({
  sku: z
    .string()
    .min(1, "SKU wajib diisi")
    .max(50, "SKU maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9\-_.]+$/, "SKU cuma boleh huruf, angka, tanda hubung (-), underscore (_), dan titik (.)"),
  name: z.string().min(1, "Nama produk wajib diisi").max(200, "Nama produk maksimal 200 karakter"),
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