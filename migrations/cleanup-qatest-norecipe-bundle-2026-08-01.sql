-- Produk percobaan tunggal, dibuat khusus buat verifikasi fix
-- "Generate Orders acak gak boleh milih bundle tanpa resep aktif".
-- Belum pernah punya batch/resep/order sama sekali, jadi aman dihapus
-- langsung tanpa perlu urutan hapus anak-induk kayak cleanup sebelumnya.
DELETE FROM products WHERE sku = 'QATEST-NORECIPE-BUNDLE';
