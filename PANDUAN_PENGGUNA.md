# Panduan Pengguna — Sistem Rekonsiliasi Stok

Panduan ini ditulis untuk operator gudang dan admin yang memakai sistem sehari-hari — bukan untuk developer. Kalau kamu mencari dokumentasi teknis (arsitektur, API), lihat `README.md`.

## Daftar Isi

- [Login & Kredensial](#login--kredensial)
- [Prinsip Dasar Sistem](#prinsip-dasar-sistem)
- [Hak Akses](#hak-akses)
- [Halaman Produk & Batch](#halaman-produk--batch)
- [Halaman Ledger & Rekonsiliasi](#halaman-ledger--rekonsiliasi)
- [Halaman Retur](#halaman-retur)
- [Halaman Stok Opname](#halaman-stok-opname)
- [Halaman Simulasi](#halaman-simulasi)
- [Halaman Notifikasi](#halaman-notifikasi)
- [Memakai di HP/Tablet](#memakai-di-hptablet)

## Login & Kredensial

Buka [stok-rekonsiliasi-skincare.vercel.app](https://stok-rekonsiliasi-skincare.vercel.app). Kredensial login dikirim terpisah lewat catatan private (tidak dicantumkan di sini karena repo ini publik).

## Prinsip Dasar Sistem

Satu aturan yang mendasari semua halaman di sistem ini: **angka stok tidak pernah diubah langsung**. Setiap kali stok berubah — barang masuk, terjual, retur, atau hasil hitung fisik beda dari catatan — sistem menulis satu baris catatan baru ke "buku besar" (Ledger). Angka stok yang kamu lihat di layar itu selalu hasil hitung ulang dari seluruh catatan itu, bukan angka yang disimpan dan diketik ulang manual.

Praktiknya buat kamu: **kamu tidak akan pernah menemukan tombol "edit stok jadi angka X"** di mana pun di sistem ini. Kalau stok perlu berubah, selalu lewat salah satu aksi tercatat (barang masuk, keluar manual, retur, atau opname) — supaya nanti kalau ada yang tanya "kenapa stok produk ini segini", selalu ada jawabannya.

## Hak Akses

Saat ini sistem hanya punya **1 peran: Admin**. Siapa pun yang login (dengan kredensial di atas) punya akses penuh ke semua halaman — tidak ada pembatasan menu antar operator dan admin.

## Halaman Produk & Batch

Tempat kelola daftar produk dan penerimaan barang.

- **Tambah Produk** — isi SKU, nama, dan pilih tipe: *Reguler* (produk fisik satuan) atau *Bundle* (paket gabungan beberapa produk).
- **Barang Masuk (Maklon)** — dipakai setiap kali ada kiriman barang dari pabrik maklon. Isi produk, kode batch (biasanya tertera di kemasan/surat jalan), tanggal kedaluwarsa, dan jumlah. Sistem otomatis mencetak QR untuk batch ini.
- **Klik nama produk** untuk buka detail — di situ ada daftar semua batch produk itu beserta stoknya, dan (khusus produk Bundle) form untuk atur resep: produk apa saja dan berapa jumlahnya yang membentuk 1 bundle.
- **Cetak QR** — dari halaman Ledger, klik tombol "Cetak QR" di baris batch mana pun untuk generate label QR. Tempelkan hasil cetaknya ke kardus/dus produk di gudang — QR ini yang nanti dipakai saat Stok Opname.

## Halaman Ledger & Rekonsiliasi

Tempat menelusuri riwayat pergerakan stok — murni untuk dilihat, tidak ada yang perlu diisi manual di sini.

- **Drilldown Produk** — pilih 1 produk, lihat semua pergerakan stoknya dari awal (barang masuk, terjual, retur, koreksi opname) berurutan waktu. Ini jawaban kalau ada yang tanya "kenapa stok produk ini jadi segini".
- **Anomali Harian** — sistem otomatis mengecek konsistensi catatannya sendiri setiap hari. Kalau ada tanda peringatan di sini, artinya ada kejanggalan yang perlu ditelusuri lebih lanjut lewat Drilldown Produk.

## Halaman Retur

Tempat memutuskan nasib barang yang dikembalikan pembeli.

Setiap ada retur baru (dari pesanan yang di-Ship lalu diretur lewat Simulasi, atau nantinya dari data marketplace asli), otomatis muncul di daftar dengan status "Menunggu Inspeksi". Setelah barang fisik sampai dan dicek langsung oleh gudang:

1. Klik **Inspeksi** pada baris retur itu.
2. Pilih kondisi barang:
   - **Layak Jual** — barang kembali normal, bisa dijual lagi. Stok otomatis bertambah kembali.
   - **Rusak** atau **Hilang** — barang tidak bisa dijual lagi. **Wajib upload foto bukti** sebelum bisa menyelesaikan inspeksi (sistem akan menolak kalau foto kosong). Stok TIDAK ditambah lagi untuk kondisi ini, karena sudah terpotong sejak barang pertama kali dikirim.
3. Khusus retur dari **TikTok Shop**, ada batas waktu 40 hari untuk mengajukan klaim ke platform sejak barang dikirim — lihat halaman Notifikasi untuk daftar yang mendekati batas ini.

## Halaman Stok Opname

Tempat mencocokkan catatan sistem dengan hasil hitung fisik di gudang. Biasanya dilakukan berkala (misal tiap bulan).

1. Klik **Buka Sesi Baru**. Sistem mengambil snapshot stok semua batch menurut catatan saat ini.
2. Untuk tiap kardus/batch yang dihitung fisik: **scan QR** yang tertempel di kardus (klik ikon kamera di sebelah kolom Batch ID), atau ketik manual kode batch kalau QR tidak terbaca. Isi jumlah fisik yang dihitung, lalu kirim.
3. Ulangi untuk semua batch. Kalau ada batch yang belum sempat dihitung saat sesi ditutup, sistem tetap mengizinkan tutup sesi, tapi akan memberi tahu batch mana saja yang terlewat.
4. Klik **Tutup Sesi**. Untuk tiap batch yang hasil hitung fisiknya beda dari catatan sistem, otomatis tertulis 1 baris koreksi ke Ledger (bisa dilihat lagi lewat Drilldown Produk). Setelah ditutup, sesi ini tidak bisa diubah lagi.

## Halaman Simulasi

Karena sistem belum terhubung ke API Shopee/TikTok Shop yang asli, halaman ini menyediakan tombol-tombol untuk mensimulasikan kejadian marketplace, supaya seluruh alur sistem tetap bisa dicoba dan didemokan.

- **Buat Pesanan Fiktif** — generate pesanan dummy. Pesanan baru berstatus PENDING (belum memotong stok, masih reservasi).
- **Ship** — tandai pesanan dikirim. Sistem otomatis memilih batch mana yang dipakai (barang dengan tanggal kedaluwarsa terdekat dipakai duluan / FEFO) dan memotong stok.
- **Simulate Return** — ajukan retur untuk pesanan yang sudah dikirim, akan muncul di halaman Retur untuk diinspeksi.
- **Mutasi Keluar Manual** — untuk barang yang keluar gudang di luar pesanan online: penjualan offline, bonus, promo, sampel, barang rusak, atau barang kedaluwarsa yang dimusnahkan. Kolom alasan wajib diisi.
- **Impor CSV** — untuk memasukkan banyak pesanan sekaligus dari file (format header: `channel,external_order_id,sku,qty,ordered_at`). Berguna kalau data pesanan datang dari sumber luar, bukan diketik manual satu-satu.

## Halaman Notifikasi

Tidak ada yang perlu dilakukan di sini — cukup dicek berkala.

- **Barang Expired & Mendekati Expired** — daftar batch dengan sisa waktu kurang dari 90 hari sebelum kedaluwarsa, diurutkan dari yang paling mendesak.
- **Klaim TikTok Menunggu Diajukan** — daftar retur dari TikTok Shop (kondisi rusak/hilang, atau yang belum diinspeksi) yang punya batas waktu klaim ke platform. Sisa hari ditampilkan supaya tidak sampai terlewat batas 40 hari.

## Memakai di HP/Tablet

Sistem ini dirancang bisa dipakai penuh dari HP, karena kegiatan seperti Stok Opname biasanya dilakukan sambil jalan keliling gudang, bukan duduk di depan laptop.

- **Scan QR pakai kamera HP** berfungsi langsung dari browser (Chrome di Android/iOS), tidak perlu aplikasi tambahan atau alat scanner khusus.
- Kalau gudang sudah punya **alat scanner barcode fisik** (yang biasa dicolok USB/Bluetooth), itu juga bisa dipakai — cukup pastikan kursor sedang aktif di kolom "Batch ID" sebelum menembak scan, karena alat itu bekerja seperti mengetik otomatis.
- Semua halaman menyesuaikan tampilan ke layar sempit (form yang di laptop sejajar berdampingan akan otomatis tersusun ke bawah di HP), supaya tidak ada tombol atau kolom yang terpotong.