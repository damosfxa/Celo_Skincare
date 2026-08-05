# Migrations — Snapshot Skema Database

File `0100`–`0104` **bukan urutan migration asli** project (yang asli dijalankan manual satu-satu di Supabase SQL Editor sepanjang proses development, dan tidak semuanya sempat disimpan sebagai file). Kelimanya adalah **snapshot lengkap kondisi final skema database** per titik itu, diambil langsung dari database produksi yang sudah berjalan, disusun ulang jadi urutan yang bisa dijalankan dari nol.

Mulai `0105` dan seterusnya, file-file di folder ini **adalah migration asli** — ditulis sebagai bagian dari alur kerja project (lihat aturan di `CLAUDE.md`: setiap perubahan skema, sekecil apa pun, wajib jadi file migration bernomor urut), bukan hasil rekonstruksi lagi.

## Kenapa `0100`–`0104` dibuat ulang begini

Supaya siapa pun (termasuk reviewer) bisa membangun ulang database dari kosong dan mendapat hasil yang identik dengan yang dipakai aplikasi — tanpa perlu tahu histori perubahan yang sebenarnya terjadi sebelum titik itu.

## Urutan menjalankan (di Supabase SQL Editor, project baru/kosong)

Jalankan berurutan dari `0100` sampai nomor terbesar yang ada di folder ini. Per 2026-08-05, urutan lengkapnya:

| # | File | Isinya |
|---|---|---|
| 0100 | `schema_tables.sql` | Semua tabel + foreign key |
| 0101 | `schema_views.sql` | View turunan (`v_batch_stock`, `v_product_stock`, `v_expiring_batches`, `v_pending_tiktok_claims`, `v_daily_anomalies`) |
| 0102 | `schema_functions.sql` | Semua RPC function inti (FEFO, ship, manual-out, inspeksi retur, opname, dll) |
| 0103 | `schema_triggers.sql` | Trigger `updated_at` + auto-profile signup |
| 0104 | `schema_rls_policies.sql` | Aktifkan RLS + policy dasar |
| 0105 | `split_channel_reason.sql` | Pisah kolom `reason` (baru) dari `note` (lama), CHECK constraint reason |
| 0106 | `sync_migrations_and_fix_anomaly_view.sql` | Sinkronisasi drift + perbaikan `fn_inspect_return`/`fn_close_opname_session`/anomaly view |
| 0107 | `add_correction_entry.sql` | Fitur Koreksi Entri + dokumentasi tabel cache `batch_stock_summary`/`product_stock_summary` + trigger pengisinya |
| 0108 | `add_campaign_reference.sql` | Wajib referensi campaign untuk reason bonus/promo/sample |
| 0109 | `add_opening_balance.sql` | Fitur Input Stok Awal + view "belum terverifikasi" |
| 0110 | `add_opname_discrepancy_reason.sql` | Alasan selisih opname |
| 0111 | `fix_anomaly_view_add_priority.sql` | Tambah `priority_level` di anomaly view |
| 0112 | `bundle_recipe_versioning.sql` | Versioning resep bundle (soft-version, order lama tak berubah) |
| 0113 | `cleanup_duplicate_inspect_return_overload.sql` | Hapus versi lama `fn_inspect_return` (overload duplikat) |
| 0114 | `fix_opening_balance_conflict_target.sql` | Unique constraint `(product_id, batch_code)` |
| 0115 | `fix_opname_variance_generated_column.sql` | **Bugfix kritis**: `variance` jadi `GENERATED` column, sebelumnya selalu NULL |
| 0116 | `add_maklon_intake_rpc.sql` | RPC `fn_maklon_intake` (sebelumnya insert langsung dari API, pelanggaran prinsip RPC-only) |
| 0117 | `add_negative_batch_balance_anomaly.sql` | Deteksi anomali saldo batch negatif |
| 0118 | `add_oversell_risk_view.sql` | View resiko oversell |
| 0119 | `require_photo_for_cancellation_writeoff.sql` | Wajib foto write-off berlaku juga untuk pembatalan (bukan cuma retur biasa) |
| 0120 | `sync_missing_unique_constraints.sql` | Dokumentasi unique constraint yang sudah live tapi belum tercatat (`products.sku`, `orders(channel, external_order_id)`) |
| 0121 | `restrict_rls_to_authenticated.sql` | **Perbaikan keamanan kritikal**: policy RLS dibatasi ke `authenticated`, sebelumnya kebuka untuk publik |
| 0122 | `fix_views_security_invoker.sql` | **Perbaikan keamanan lanjutan**: view di-set `security_invoker` supaya tidak bypass RLS |
| 0123 | `harden_ledger_write_path.sql` | CHECK constraint kolom `channel` + `SECURITY DEFINER` untuk 7 RPC penulis ledger |
| 0124 | `lock_ledger_immutability.sql` | **Cabut hak tulis langsung** ke `stock_ledger`/`returns` dari role aplikasi + trigger penolak UPDATE/DELETE |
| 0125 | `read_balance_from_cache.sql` | Alihkan baca saldo (jalur panas: FEFO, buka sesi opname, batch mendekati kedaluwarsa) dari SUM ke tabel cache O(1) |

Ada juga file-file tak bernomor (`cleanup-*`, `diagnostic-*`, `backfill-*`) — itu skrip operasional sekali-pakai (bersih-bersih data QA, verifikasi manual), bukan bagian dari urutan migration skema. Lihat `CATATAN-KERJA-AUDIT-2026-08-05.md` untuk konteks audit terakhir dan urutan menjalankan `0123`–`0125` dengan aman di database yang sudah berjalan (beda dengan "dari nol" di sini — kalau databasenya sudah ada isinya, jalankan `0123` dulu, tes, baru `0124`, tes lagi, baru `0125`).

## Yang sudah ditegakkan di level database (bukan cuma konvensi kode)

- `stock_ledger`: append-only. INSERT/UPDATE/DELETE dari role `authenticated`/`anon` dicabut sejak `0124`; satu-satunya jalur tulis adalah 7 RPC `SECURITY DEFINER` (lihat `0123`). Trigger `trg_block_ledger_update`/`trg_block_ledger_delete` jadi lapis kedua untuk jalur di luar GRANT/RLS (service_role, SQL Editor).
- `stock_ledger.reason`: CHECK constraint tetap (`0105`).
- `stock_ledger.channel`: CHECK constraint tetap (`0123`).
- `stock_ledger.campaign_reference`: CHECK constraint wajib-isi untuk reason bonus/promo/sample (`0108`).
- `returns.condition`/`photo_url`: hanya bisa diubah lewat `fn_inspect_return` sejak `0124` (UPDATE langsung dicabut dari role aplikasi).
- `opname_items.variance`: `GENERATED` column, tidak bisa salah isi (`0115`).
- RLS seluruh tabel dibatasi ke role `authenticated` saja, publik ditolak total (`0121`), termasuk lewat view (`0122`).

Kalau ada CHECK constraint lain yang ternyata belum tertangkap di file-file ini, tambahkan manual setelah verifikasi (lihat pola `0120`/`0123` untuk cara aman: cek dulu data lama sebelum menambah constraint).
