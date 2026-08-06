# Security

Dokumen ini menjelaskan bagaimana sistem menjaga integritas data stok di level database, bukan cuma di level kode aplikasi.

## Prinsip Utama: Immutability Dikunci di Level Database, Bukan Cuma Konvensi Kode

Aturan "tidak ada angka stok yang berubah tanpa jejak" **tidak** bergantung pada disiplin programmer mengikuti aturan saat menulis kode API. Aturan ini dipaksakan langsung lewat **Row Level Security (RLS)** Postgres di Supabase:

- Tabel `stock_ledger` hanya punya policy `INSERT` dan `SELECT`. **Tidak ada policy `UPDATE` atau `DELETE`** untuk role mana pun. Artinya, secara teknis mustahil mengubah atau menghapus baris ledger yang sudah tertulis. Bahkan seandainya ada bug di kode aplikasi yang mencoba melakukannya, database akan menolak.
- Tabel `bundle_recipes` (resep bundle) sengaja juga hanya punya policy `INSERT`/`SELECT`. Mengubah resep **hanya** bisa lewat RPC function `fn_save_bundle_recipe`, yang menjalankan hapus-lalu-tulis-ulang sebagai satu operasi atomik (bukan `UPDATE` baris satu-satu), supaya ganti resep selalu tercatat sebagai keputusan baru yang utuh, bukan editan bertahap yang sulit dilacak.

Detail lengkap tiap tabel dan policy-nya ada di `migrations/0104_schema_rls_policies.sql`.

## Kenapa Beberapa RPC Function Pakai `SECURITY DEFINER`

Dua function di `migrations/0102_schema_functions.sql`, yaitu `fn_save_bundle_recipe` dan `fn_handle_new_user`, dijalankan dengan `SECURITY DEFINER`. Artinya function itu berjalan dengan hak akses milik pembuatnya, bukan hak akses user yang memanggilnya.

Ini **bukan** cara untuk melewati RLS secara sembarangan. Sebaliknya, ini dipakai justru karena RLS memang sengaja membatasi user biasa dari melakukan `DELETE` langsung ke tabel-tabel itu. Function dengan `SECURITY DEFINER` jadi satu-satunya pintu resmi untuk operasi yang butuh privilese lebih (hapus baris resep lama, atau insert profil user baru saat signup), dengan validasi bisnisnya sendiri di dalam function, bukan celah bebas tanpa aturan.

## Alur Menulis Ledger Selalu Lewat RPC Function

API route **tidak pernah** melakukan `insert()` langsung ke `stock_ledger` untuk operasi yang butuh alokasi batch (ship order, keluar manual, tutup opname). Semua lewat `plpgsql` function (`fn_ship_order_item`, `fn_manual_out`, `fn_close_opname_session`, dst) yang menjalankan baca-stok-lalu-tulis-ledger sebagai satu transaksi. Ini mencegah race condition kalau ada dua aksi menyentuh batch yang sama nyaris bersamaan (misal dua simulasi order jalan cepat berurutan).

## Autentikasi & Akses

- Login memakai Supabase Auth (email + password), dikelola penuh oleh Supabase, kredensial tidak pernah disimpan sendiri di tabel aplikasi.
- Saat ini sistem hanya punya 1 peran (Admin), lihat catatan project terkait update brief "hanya ada 1 user role". Tidak ada pembatasan akses granular antar operator dan admin per saat ini.
- Variabel lingkungan (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) tidak pernah di-commit ke repo, disimpan di `.env.local` (masuk `.gitignore`) untuk pengembangan lokal, dan sebagai environment variable di Vercel untuk production.
- Kunci `anon` Supabase yang dipakai di sisi client aman untuk terekspos ke browser (sesuai desain Supabase), pembatasan akses data sesungguhnya tetap dijalankan oleh RLS di database, bukan oleh kerahasiaan kunci ini.

## Upload File (Foto Bukti Retur)

Foto bukti kondisi retur (rusak/hilang) diunggah ke Supabase Storage, bukan disimpan sebagai file di server aplikasi. URL hasil upload disimpan di kolom `returns.photo_url`.