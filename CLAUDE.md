<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-safety-rules -->
# Aturan Keselamatan Project — Sistem Rekonsiliasi Stok

Project ini adalah bounty VibeDev Phase 2. Prinsip inti: stock ledger append-only sebagai satu-satunya sumber kebenaran, tidak ada kolom stok yang diedit langsung.

## Batasan akses & eksekusi
- JANGAN eksekusi migration SQL langsung ke database, walau kamu punya akses MCP Supabase. Selalu tampilkan SQL-nya dulu ke user sebagai file, biarkan user yang jalankan manual di Supabase SQL Editor.
- JANGAN commit atau push ke GitHub tanpa diminta eksplisit oleh user.
- JANGAN ubah file di folder `app/`, `src/components/`, `src/hooks/` (frontend) kecuali user secara eksplisit minta -- itu wilayah kerja AI lain (Gemini via Antigravity). Kalau perubahan backend butuh penyesuaian frontend, cukup jelaskan apa yang perlu diubah, jangan langsung edit filenya.

## Aturan skema database
- Semua tulisan ke tabel `stock_ledger` HARUS lewat Postgres RPC function, tidak boleh insert langsung dari kode aplikasi (API route).
- SETIAP perubahan skema database (ALTER TABLE, CREATE/REPLACE FUNCTION, RLS policy baru, dll) WAJIB dituliskan sebagai file migration baru bernomor urut di folder `migrations/` (ikuti konvensi penomoran yang sudah ada di folder itu), walau perubahannya kecil atau cuma "menambal" sesuatu. Ini mencegah drift antara file migration di repo dan kondisi database asli -- masalah ini pernah ditemukan dan diperbaiki di migration 0106.
- Sebelum menulis migration baru, cek dulu isi migration-migration sebelumnya yang relevan di folder `migrations/` untuk memahami konvensi penamaan kolom, function, dan policy yang sudah ada.

## Cara kerja
- User tidak terlalu familiar dengan istilah teknis -- jelaskan dengan bahasa sederhana, langkah demi langkah, satu langkah konkret dalam satu waktu untuk hal yang berisiko.
- Sebelum mengubah kode apa pun, jelaskan dulu rencana perubahan dan alasannya, tunggu konfirmasi user -- kecuali untuk perubahan kecil dan jelas yang sudah diminta eksplisit.
- Kalau menemukan bug, inkonsistensi, atau ambiguitas desain, laporkan dulu semuanya sebagai daftar temuan sebelum memperbaiki apa pun. Jangan membuat keputusan desain sepihak untuk hal yang ambigu -- tanyakan ke user.
- Jangan berasumsi laporan sukses dari diri sendiri itu akurat. Selalu minta hasil `npm run build` yang sebenarnya (bukan ringkasan) sebelum menyatakan sesuatu berhasil, dan sarankan user memvalidasi secara fungsional di aplikasi (bukan cuma build sukses) untuk perubahan yang menyentuh alur data penting.
<!-- END:project-safety-rules -->