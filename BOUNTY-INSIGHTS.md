# Bounty Insights — Sistem Rekonsiliasi Stok (Phase 2)

Catatan insight sepanjang Phase 2, sesuai format Step 6 di SKILL BOUNTY.md. Direview di checkpoint "submission Phase 2 selesai" (2026-08-02) untuk diusulkan masuk ke SKILL.md.

## 2026-08-01, Sumber: audit menyeluruh + QA fungsional
- Insight: Bug paling parah di seluruh project (koreksi Stok Opname tidak pernah benar-benar tersimpan — kolom `variance` selalu NULL) HANYA ketemu lewat testing fungsional langsung di aplikasi berjalan (isi form sungguhan, cek hasil sungguhan), bukan lewat review kode atau `npm run build` sukses. Review kode dan build hijau sama sekali tidak menangkap ini.
- Generalizable ke bounty lain? Ya, karena ini pola umum: "build sukses" dan "kode kelihatan benar" adalah sinyal lemah untuk correctness bisnis. Rubric bounty hampir selalu naruh "logika benar" di prioritas #1 — itu artinya wajib ada fase testing fungsional langsung yang eksplisit, bukan cuma review pass.
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Step 5.5 poin 1).

## 2026-08-01, Sumber: QA fungsional (dropdown exhaustive testing)
- Insight: User secara eksplisit minta test SEMUA opsi dropdown, bukan cuma 1 sampel per dropdown. Ternyata banyak dropdown enum (reason code, kondisi retur, alasan selisih opname) punya business logic BERBEDA per opsi (mis. 3 dari 6 alasan "keluar manual" butuh field tambahan wajib "referensi campaign", yang lain tidak) — kalau cuma test 1 opsi, celah ini tidak akan ketemu.
- Generalizable ke bounty lain? Ya. Untuk field enum/dropdown yang terhubung ke business logic bersyarat, testing harus mencakup SEMUA opsi, bukan sampel — terutama kalau brief secara eksplisit menyebutkan aturan berbeda per kategori (reason vs channel, dsb).
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Step 5.5 poin 2).

## 2026-08-01, Sumber: audit klaim "siap webhook"
- Insight: Brief/Sync Update eksplisit bilang "kesiapan integrasi API asli harus nyata di arsitektur, bukan sekadar klaim". Waktu diaudit, ternyata cuma jalur "order baru" yang benar-benar diekstrak ke service layer bersama; jalur ship/cancel/return masih nempel langsung ke route tombol simulasi. Kalau tidak diaudit eksplisit per-jalur, celah ini gampang lolos karena "kelihatannya" sudah didesain modular.
- Generalizable ke bounty lain? Ya. Kalau brief mengklaim arsitektur "siap diganti X nanti", verifikasi tiap jalur/fitur yang relevan satu-satu, jangan asumsi konsistensi dari 1 contoh yang sudah benar.
- Sudah diusulkan ke SKILL.md? Belum — di luar 5 poin yang disepakati masuk versi 1.1.0, masih PR buat checkpoint berikutnya.

## 2026-08-01, Sumber: audit deploy sebelum submission
- Insight: URL live production ternyata basi ~2 minggu — commit terakhir ke GitHub jauh sebelum sebagian besar pekerjaan sesi-sesi terakhir, padahal semua kerjaan itu sudah "diverifikasi" jalan di localhost. Brief eksplisit bilang "submission harus live, bukan mockup/video" — kalau tidak ketahuan sebelum submission, client akan menilai versi lama yang jauh tertinggal tanpa disadari siapa pun.
- Generalizable ke bounty lain? SANGAT, ini salah satu insight paling penting. `git status`/`git log` vs live URL harus dicek berkala (bukan cuma sekali di akhir), terutama kalau workflow melibatkan banyak sesi kerja terpisah dari waktu ke waktu.
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Step 5.5).

## 2026-08-01, Sumber: audit keamanan (ditemukan gak sengaja saat verifikasi deploy)
- Insight: RLS policy Supabase yang ditulis `using (true)` TANPA klausa `TO authenticated` secara default berlaku untuk role `anon` juga (bukan cuma "siapa pun yang sudah login" seperti niat awal) — akibatnya seluruh data (termasuk insert/update) bisa diakses siapa saja tanpa login lewat REST API Supabase langsung, bypass total aplikasi. Ditemukan bukan dari testing sengaja, tapi kebetulan pas cek tab browser tanpa sesi login.
- Generalizable ke bounty lain? SANGAT, ini gotcha teknis Supabase/Postgres yang murni independen dari project spesifik ini. Kalau bounty pakai Supabase dengan RLS, WAJIB eksplisit cek tiap policy punya `TO authenticated` (atau role yang sesuai), jangan asumsi `using (true)` otomatis aman.
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Step 5.5, checklist RLS).

## 2026-08-01, Sumber: audit keamanan (lanjutan RLS)
- Insight: Bahkan setelah semua table-level RLS policy diperbaiki (`TO authenticated`), celah masih ada lewat VIEW — Postgres view secara default jalan pakai hak akses PEMBUAT view (biasanya role admin/postgres saat migration), bukan pakai hak akses user yang query, jadi otomatis bypass RLS tabel dasarnya kecuali `security_invoker = true` di-set eksplisit (butuh Postgres 15+).
- Generalizable ke bounty lain? SANGAT, gotcha lanjutan dari insight di atas, sama-sama independen dari project ini. Kalau bounty pakai VIEW di atas tabel yang di-RLS, cek juga `security_invoker` tiap view, jangan cuma cek tabel dasarnya.
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Step 5.5, checklist RLS).

## 2026-08-01, Sumber: audit reproducibility migration
- Insight: Folder migrations yang direkonstruksi (tujuannya biar bisa rebuild database dari nol) berulang kali ketahuan drift dari kondisi database live sungguhan — constraint/index yang ditambahkan langsung lewat SQL Editor kadang tidak tercatat sebagai file migration baru, jadi rebuild dari nol akan menghasilkan skema yang beda dari production.
- Generalizable ke bounty lain? Ya, kalau bounty punya tuntutan "reproducible dari nol" (baik eksplisit dari brief atau sebagai praktik baik), audit periodik `pg_constraint`/`pg_policies`/`pg_indexes` live vs isi migrations folder itu perlu jadi kebiasaan, bukan cuma sekali di awal.
- Sudah diusulkan ke SKILL.md? Belum — di luar 5 poin yang disepakati masuk versi 1.1.0, masih PR buat checkpoint berikutnya.

## 2026-08-01, Sumber: pola kerja sepanjang Phase 2 (kontradiksi sama Step 5 SKILL.md saat ini)
- Insight: SKILL.md saat ini (Step 5) eksplisit bilang "Full-stack dikerjakan sendiri, gak ada model split ke AI/tool lain untuk penulisan kode aplikasi" dan Step 5.2 bilang Stitch cuma buat visual/mockup, bukan nulis kode. Tapi praktik nyata sepanjang Phase 2 project ini justru sebaliknya: ada pembagian kerja eksplisit antara Claude Code (backend: API routes, service layer, database/migration) dan tool AI lain ("Antigravity", berbasis Gemini) yang benar-benar menulis kode frontend (`app/**/page.tsx`, `src/components/**`, `src/hooks/**`). Pola kerja yang muncul: Claude Code temporarily edit file frontend buat validasi (build + test live), lalu REVERT filenya, dan kasih spec lengkap (isi file utuh, bukan diff) ke user buat di-paste ke Antigravity.
- Generalizable ke bounty lain? Ya, kalau user punya setup serupa (AI lain yang pegang bagian frontend), pola "temp-edit-validate-revert-spec" ini terbukti efektif: tetap bisa validasi perubahan (build sukses + live browser test) tanpa melanggar batas kepemilikan kode. Tapi ini KONTRADIKSI LANGSUNG sama Step 5 & 5.2 SKILL.md yang sekarang eksplisit melarang split kerja ke AI lain — bagian itu perlu direvisi biar SKILL.md gak menyesatkan buat bounty berikutnya yang mungkin punya setup serupa.
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Prinsip Inti #5, Step 5, Step 5.3 baru).

## 2026-08-01, Sumber: verifikasi ambiguitas brief
- Insight: Waktu ada teks ringkasan (dari listing platform) yang berpotensi ambigu/beda tafsir dari brief PDF lengkap, cara paling meyakinkan buat resolve ambiguitas adalah download ulang file brief LANGSUNG dari sumber resmi platform dan bandingkan checksum (MD5) sama file yang sudah dipegang — bukan cuma re-baca ulang teks yang sama.
- Generalizable ke bounty lain? Ya, teknik verifikasi yang reusable: kalau ada keraguan soal "apakah brief yang dipegang ini versi terbaru/asli", cek langsung ke link resmi platform dan bandingkan hash file, bukan cuma percaya nama file lokal.
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Step 2).

## 2026-08-01, Sumber: review UX/copy pass
- Insight: Logika yang benar (mis. prioritas urgensi dihitung benar untuk batch yang sudah lewat kedaluwarsa) tetap bisa punya COPY yang membingungkan buat user non-teknis (mis. teks "kedaluwarsa -12 hari lagi" — angka minus dengan kata "lagi" itu confusing). Ini bug terpisah dari correctness logika, ketemu lewat review pass khusus "kemudahan pakai", bukan lewat testing logika.
- Generalizable ke bounty lain? Ya. Review pass "kemudahan pakai operator non-teknis" (kriteria #3 rubric) perlu eksplisit cek copy/teks yang muncul dari kalkulasi angka (terutama kasus edge: angka negatif, nol, sangat besar), bukan cuma cek logika kalkulasinya benar.
- Sudah diusulkan ke SKILL.md? Ya, di versi 1.1.0 (Step 5.5 poin 3).

## 2026-08-01, Sumber: review konsistensi format
- Insight: Sweep konsistensi (format angka, larangan karakter tertentu di UI) perlu grep MENYELURUH ke seluruh codebase (app/ dan src/), bukan spot-check — dan wajib bisa membedakan teks yang benar-benar tampil ke user (string JSX, template literal) vs sintaks kode yang cuma KELIHATAN mirip (CSS custom property `--nama-variable`, komentar kode `//`). Salah pukul rata bisa merusak fungsionalitas (CSS variable) atau buang waktu (comment gak pernah dibaca user).
- Generalizable ke bounty lain? Ya, teknik grep reusable untuk sweep konsistensi apa pun di codebase Next.js/Tailwind.
- Sudah diusulkan ke SKILL.md? Belum — di luar 5 poin yang disepakati masuk versi 1.1.0, masih PR buat checkpoint berikutnya.

## 2026-08-05, Sumber: audit stack + pembersihan lint
- Insight: `next build` di Next.js 16 TIDAK menjalankan ESLint. Sepanjang project ini verifikasi selalu pakai `npm run build` + `npm test` dan keduanya selalu hijau, padahal `npm run lint` ternyata gagal dengan 105 masalah (84 error) yang sama sekali tidak pernah terlihat. Brief menempatkan "kualitas teknis, kode rapi" sebagai kriteria penilaian #4, dan linter gagal adalah hal paling gampang dicek reviewer.
- Generalizable ke bounty lain? Ya, sangat. Jangan pernah menganggap "build hijau" sama dengan "kode bersih". Untuk project Next.js 13+ (dan makin tegas di 15/16), `lint` wajib dijalankan sebagai perintah terpisah, bukan diasumsikan ikut jalan saat build. Idealnya ketiganya (`tsc --noEmit`, `lint`, `build`) dijalankan sebagai satu paket verifikasi, karena masing-masing menangkap kelas masalah yang berbeda dan tidak saling menggantikan.
- Sudah diusulkan ke SKILL.md? Belum, PR buat checkpoint berikutnya.

## 2026-08-05, Sumber: perbaikan lint yang justru menimbulkan bug runtime
- Insight: Mengganti `catch (error: any)` jadi `catch (error: unknown)` MEMUASKAN linter tapi MEMECAHKAN TypeScript kalau `.message` dibaca tanpa penyempitan tipe. Di project ini 15 dari 17 lokasi dikerjakan benar, 2 terlewat, dan hasilnya `npm run build` gagal total padahal `npm run lint` sudah 0 error. Ini bukti konkret bahwa lint dan typecheck menangkap hal berbeda dan keduanya wajib dijalankan setelah perubahan tipe apa pun.
- Generalizable ke bounty lain? Ya. Setiap kali membereskan aturan `no-explicit-any` secara massal, WAJIB jalankan `npx tsc --noEmit` sesudahnya (lebih cepat dari build penuh dan menampilkan SEMUA error tipe sekaligus, bukan berhenti di error pertama seperti `next build`).
- Sudah diusulkan ke SKILL.md? Belum, PR buat checkpoint berikutnya.

## 2026-08-05, Sumber: bug kamera scanner yang lolos SELURUH pemeriksaan otomatis
- Insight: Bug paling parah di sesi ini (kamera HP tidak pernah berhenti setelah QR sukses dipindai, callback sukses terpanggil berulang setiap frame sehingga toast menumpuk tanpa henti) LOLOS DARI KEEMPAT pemeriksaan otomatis sekaligus: `tsc --noEmit` bersih, `lint` 0 error, `build` berhasil, 28/28 tes lulus. Bug ini sempat LIVE di production dan cuma ketahuan waktu pemilik project mencoba langsung di HP Android dan melihat titik hijau indikator kamera tetap menyala. Akar masalahnya: teardown dipindah dari `useEffect([isOpen])` ke event handler `onOpenChange`, padahal ada DUA jalur penutupan dialog dan jalur sukses-scan menutup lewat `setIsOpen(false)` langsung, yang memang secara desain tidak memicu `onOpenChange`.
- Generalizable ke bounty lain? SANGAT. Dua pelajaran terpisah: (1) Untuk komponen dialog/modal terkontrol, selalu inventarisasi SEMUA jalur yang mengubah state buka/tutup sebelum memindahkan logika cleanup ke salah satu di antaranya, karena `onOpenChange` hanya dipanggil saat komponen dialog sendiri yang meminta perubahan, bukan saat parent mengubah state secara langsung. (2) Untuk fitur yang menyentuh perangkat keras (kamera, mikrofon, geolokasi), siklus hidup komponen, atau interaksi pengguna, pengujian tangan di perangkat asli TIDAK TERGANTIKAN oleh pemeriksaan otomatis mana pun. Rencana verifikasi harus eksplisit memisahkan "apa yang bisa dibuktikan otomatis" vs "apa yang wajib dicoba manusia".
- Sudah diusulkan ke SKILL.md? Belum, PR buat checkpoint berikutnya.
