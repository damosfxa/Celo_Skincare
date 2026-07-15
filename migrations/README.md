# Migrations — Snapshot Skema Database

File-file di folder ini **bukan urutan migration asli** project (yang asli dijalankan manual satu-satu di Supabase SQL Editor sepanjang proses development, dan tidak semuanya sempat disimpan sebagai file). Ini adalah **snapshot lengkap kondisi final skema database**, diambil langsung dari database produksi yang sudah berjalan, disusun ulang jadi urutan yang bisa dijalankan dari nol.

## Kenapa dibuat ulang begini

Supaya siapa pun (termasuk reviewer) bisa membangun ulang database dari kosong dan mendapat hasil yang identik dengan yang dipakai aplikasi ini sekarang — tanpa perlu tahu histori perubahan yang sebenarnya terjadi.

## Urutan menjalankan (di Supabase SQL Editor, project baru/kosong)

1. `0100_schema_tables.sql` — semua tabel + foreign key
2. `0101_schema_views.sql` — semua view (`v_batch_stock`, `v_product_stock`, `v_expiring_batches`, `v_pending_tiktok_claims`, `v_daily_anomalies`)
3. `0102_schema_functions.sql` — semua RPC function
4. `0103_schema_triggers.sql` — pasang trigger yang function-nya didefinisikan di langkah 3
5. `0104_schema_rls_policies.sql` — aktifkan RLS + semua policy

## Yang perlu diverifikasi manual

Beberapa hal ini diasumsikan berdasarkan pola kode yang terlihat di API routes, dan **belum diverifikasi 100% lewat query terpisah** — nilai default kolom seperti `orders.status` (asumsi `'PENDING'` diisi dari kode aplikasi, bukan `DEFAULT` di kolom) dan tipe data enum-like (`movement_type`, `condition`, `channel`, dll) yang di sistem asli kemungkinan besar berupa `text` polos dengan validasi di level Zod/RPC, bukan Postgres `ENUM` atau `CHECK constraint` eksplisit. Kalau ternyata ada `CHECK constraint` yang tidak tertangkap di query kolom, tambahkan manual setelah verifikasi.

## Cleanup opsional

Ada 2 versi `fn_inspect_return` tersimpan di database (1 lama tanpa parameter foto, 1 baru dengan `p_photo_url`). File `0102` sudah berisi versi terbaru yang dipakai sistem. Versi lama aman dihapus:

```sql
drop function if exists fn_inspect_return(uuid, text, uuid);
```
