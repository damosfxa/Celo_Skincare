# Migrations, Snapshot Skema Database

File `0100`–`0104` **bukan urutan migration asli** project (yang asli dijalankan manual satu-satu di Supabase SQL Editor sepanjang proses development, dan tidak semuanya sempat disimpan sebagai file). Kelimanya adalah **snapshot lengkap kondisi final skema database** per titik itu, diambil langsung dari database produksi yang sudah berjalan, disusun ulang jadi urutan yang bisa dijalankan dari nol.

Mulai `0105` dan seterusnya, file-file di folder ini **adalah migration asli**, ditulis sebagai bagian dari alur kerja project (lihat aturan di `CLAUDE.md`: setiap perubahan skema, sekecil apa pun, wajib jadi file migration bernomor urut), bukan hasil rekonstruksi lagi.

## Kenapa `0100`–`0104` dibuat ulang begini

Supaya siapa pun (termasuk reviewer) bisa membangun ulang database dari kosong dan mendapat hasil yang identik dengan yang dipakai aplikasi, tanpa perlu tahu histori perubahan yang sebenarnya terjadi sebelum titik itu.

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
| 0126 | `security_hardening.sql` | **Perbaikan keamanan (audit 2026-08-06)**: hapus 2 policy `public` siluman yang membocorkan saldo cache ke anon (drift, tak pernah tercatat di migration), + `SET search_path` untuk 4 fungsi non-SECURITY-DEFINER (bersihkan warning advisor) |
| 0127 | `add_performance_indexes.sql` | Index performa untuk kolom filter/sort/join yang belum terindeks (`stock_ledger.batch_id`/`created_at`/`reference`, FK, `orders.status`, `returns.condition`). Murni percepat query saat data membesar, tidak menyentuh data/logika/hak akses |
| 0128 | `allow_delete_products_without_history.sql` | Buka izin hapus produk, TAPI dibatasi ketat lewat `USING`: cuma boleh kalau produk itu nol batch dan nol order_item (belum pernah tersentuh sama sekali). Melengkapi endpoint `DELETE /api/products/[id]` untuk kasus "salah input produk baru, belum kejadian apa-apa" -- bukan jalan pintas menghapus riwayat. `PATCH` (ubah nama/SKU, buat betulkan typo) tidak butuh migration ini, sudah dibolehkan `update_products` sejak `0104` |

Ada juga file-file tak bernomor (`cleanup-*`, `diagnostic-*`, `backfill-*`), itu skrip operasional sekali-pakai (bersih-bersih data QA, verifikasi manual, audit keamanan), bukan bagian dari urutan migration skema.

Catatan urutan aman untuk database yang SUDAH BERJALAN (beda dengan rebuild "dari nol" di atas): `0123`–`0125` menyentuh hak akses & jalur tulis, jadi jalankan berurutan satu per satu sambil menguji aplikasi di antaranya, jangan sekaligus. `0123` dulu (memberi hak RPC), tes aplikasi, baru `0124` (mencabut hak tulis langsung), tes lagi, baru `0125` (alihkan baca saldo ke cache). `0126` (hardening keamanan) aman dijalankan langsung karena hanya mencabut policy publik + menambah `search_path`. `0127` (index performa) juga aman dijalankan langsung kapan saja, hanya menambah index (tidak menyentuh data/logika/hak akses); di database yang sudah sangat besar, jalankan tiap `CREATE INDEX` sebagai `CONCURRENTLY` di luar transaksi (lihat catatan di dalam file). `0128` (izin hapus produk terbatas) juga aman dijalankan langsung kapan saja, cuma menambah satu policy baru yang dibatasi ketat, tidak mengubah data atau policy yang sudah ada.

## Yang sudah ditegakkan di level database (bukan cuma konvensi kode)

- `stock_ledger`: append-only. INSERT/UPDATE/DELETE dari role `authenticated`/`anon` dicabut sejak `0124`; satu-satunya jalur tulis adalah 7 RPC `SECURITY DEFINER` (lihat `0123`). Trigger `trg_block_ledger_update`/`trg_block_ledger_delete` jadi lapis kedua untuk jalur di luar GRANT/RLS (service_role, SQL Editor).
- `stock_ledger.reason`: CHECK constraint tetap (`0105`).
- `stock_ledger.channel`: CHECK constraint tetap (`0123`).
- `stock_ledger.campaign_reference`: CHECK constraint wajib-isi untuk reason bonus/promo/sample (`0108`).
- `returns.condition`/`photo_url`: hanya bisa diubah lewat `fn_inspect_return` sejak `0124` (UPDATE langsung dicabut dari role aplikasi).
- `opname_items.variance`: `GENERATED` column, tidak bisa salah isi (`0115`).
- RLS seluruh tabel dibatasi ke role `authenticated` saja, publik ditolak total (`0121` + `0126`), termasuk lewat view (`0122`). Diverifikasi menyeluruh 2026-08-06 lewat `diagnostic-security-audit-2026-08-06.sql` (langsung ke database live): 13 tabel RLS aktif, semua policy `authenticated`-only, semua view `security_invoker`, semua fungsi punya `search_path`. `0126` menutup 2 policy `public` siluman pada tabel cache yang lolos dari `0121` karena ditambahkan manual di luar migration (drift).
- Bucket Storage `return-photos`: upload dibatasi `authenticated`, tanpa policy UPDATE/DELETE (foto tak bisa dihapus/ditimpa lewat API), baca-publik lewat URL ber-UUID acak. Tradeoff yang disengaja untuk foto bukti retur; ubah ke privat butuh signed URL + perubahan frontend.
- `products`: tidak bisa dihapus kalau sudah punya batch/order sama sekali (`0104` = tanpa policy delete sama sekali; `0128` = buka izin hapus TAPI cuma untuk yang nol batch dan nol order_item, ditegakkan lewat `USING`). Nama/SKU tetap bisa dibetulkan kapan saja lewat `update_products` (`0104`).

Kalau ada CHECK constraint lain yang ternyata belum tertangkap di file-file ini, tambahkan manual setelah verifikasi (lihat pola `0120`/`0123` untuk cara aman: cek dulu data lama sebelum menambah constraint).
