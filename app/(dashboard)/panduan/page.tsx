import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Box,
  FileText,
  Repeat,
  ScanBarcode,
  Beaker,
  Bell,
  CheckCircle2,
  LayoutDashboard,
  PackageX,
  SunMoon,
  Smartphone,
  Tags,
} from "lucide-react";

export default function PanduanPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Panduan Penggunaan</h2>
        <p className="text-muted-foreground mt-1">
          Dokumentasi lengkap cara menggunakan sistem rekonsiliasi stok, ditulis untuk operator gudang dan admin, bukan untuk developer.
        </p>
      </div>

      <Card className="border-primary/50 shadow-sm bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <CheckCircle2 className="h-6 w-6" />
            Prinsip Dasar Sistem
          </CardTitle>
          <CardDescription className="text-base text-foreground mt-2 space-y-2">
            <p>
              Satu aturan yang mendasari semua halaman di sistem ini: <strong>angka stok tidak pernah diubah langsung</strong>. Setiap kali stok berubah (barang masuk, terjual, retur, atau hasil hitung fisik beda dari catatan), sistem menulis satu baris catatan baru ke "buku besar" (Ledger). Angka stok yang kamu lihat di layar selalu hasil hitung ulang dari seluruh catatan itu, bukan angka yang disimpan dan diketik ulang manual.
            </p>
            <p>
              Praktiknya: kamu tidak akan pernah menemukan tombol "edit stok jadi angka X" di mana pun di sistem ini. Kalau stok perlu berubah, selalu lewat salah satu aksi tercatat (barang masuk, keluar manual, retur, atau opname), supaya nanti kalau ada yang tanya "kenapa stok produk ini segini", selalu ada jawabannya lewat halaman Ledger.
            </p>
            <p>
              Konsekuensinya: catatan yang sudah tersimpan <strong>tidak bisa dihapus atau diedit</strong> siapa pun, termasuk admin, bahkan lewat cara teknis sekalipun, ini ditegakkan di level database, bukan cuma aturan di aplikasi. Kalau ada yang salah input, caranya selalu menambah catatan koreksi baru (lihat <strong>Koreksi Entri</strong> di Modul 3), bukan menghapus yang lama. Ini yang membuat riwayatnya selalu bisa dipercaya penuh.
            </p>
            <p>
              Saat ini sistem hanya punya <strong>1 peran: Admin</strong>. Siapa pun yang login punya akses penuh ke semua halaman, tidak ada pembagian hak akses per orang.
            </p>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* Modul 1: Dashboard Tugas Hari Ini */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-sky-500" />
              1. Tugas Hari Ini (Halaman Utama)
            </CardTitle>
            <CardDescription>Ringkasan hal-hal yang butuh perhatian, dilihat pertama setiap buka sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>4 kartu ringkasan</strong> di bagian atas: Total SKU Aktif, Batch Mendekati Kedaluwarsa, Retur Menunggu Inspeksi, dan Anomali Terbuka. Kartu yang berwarna merah artinya ada hal yang perlu segera dicek. Catatan: <strong>Total SKU Aktif</strong> cuma menghitung produk Reguler, produk tipe Bundle sengaja tidak ikut dihitung di sini karena stoknya sendiri memang tidak pernah ada (selalu hasil hitung dari komponen penyusunnya, lihat Modul 2).
              </li>
              <li>
                <strong>Worklist Hari Ini</strong>: daftar tugas yang sudah diurutkan otomatis dari yang paling mendesak (label merah = HIGH) ke yang santai (label abu-abu = LOW). Klik salah satu untuk langsung dibawa ke halaman terkait. Jenis tugas yang bisa muncul:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Resiko Oversell</strong>: ada produk yang dipesan (reserved, status PENDING belum dikirim) melebihi stok yang benar-benar tersedia. Ini prioritas tertinggi karena kalau dibiarkan, pesanan bisa gagal dikirim. Detail lengkap di Modul 8.</li>
                  <li><strong>Anomali Stok</strong>: kejanggalan yang ketemu dari pengecekan konsistensi harian (lihat Modul 3), misalnya pesanan batal yang stoknya belum kembali, atau saldo batch yang jadi minus.</li>
                  <li><strong>Klaim TikTok</strong>: retur TikTok Shop yang mendekati batas waktu 40 hari untuk diajukan klaim ke platform.</li>
                  <li><strong>Batch Kedaluwarsa</strong>: batch yang mendekati (dalam 90 hari) atau sudah lewat tanggal kedaluwarsa, dan masih ada sisa stoknya.</li>
                  <li><strong>Retur Pending</strong>: barang retur yang sudah masuk tapi belum diinspeksi kondisinya. Makin lama menggantung (dihitung dari tanggal pengajuan), makin tinggi prioritasnya, lebih dari 3 hari otomatis jadi HIGH.</li>
                </ul>
              </li>
              <li>
                <strong>Pergerakan Terbaru</strong>: 8 catatan ledger paling baru dari seluruh produk, buat pantau aktivitas sekilas tanpa buka halaman Ledger.
              </li>
              <li>
                <strong>Aksi Cepat</strong>: tombol pintas ke tugas yang sering dipakai (Keluar Manual, Mulai Opname, Lihat Ledger, Simulasi Marketplace), sama saja fungsinya dengan buka lewat menu sidebar, cuma lebih cepat diakses dari halaman utama.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 2: Produk & Batch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-emerald-500" />
              2. Produk & Batch
            </CardTitle>
            <CardDescription>Kelola daftar produk, penerimaan barang, dan stok awal.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>Tambah Produk</strong>: isi SKU dan nama, lalu pilih tipe: <em>Reguler</em> untuk produk fisik satuan, <em>Bundle</em> untuk paket gabungan beberapa produk (bundle sendiri tidak punya stok fisik, stoknya dihitung dari komponen penyusunnya). SKU harus unik, sistem menolak kalau kamu coba pakai SKU yang sudah dipakai produk lain, supaya tidak ada dua produk yang tertukar identitasnya saat impor atau input.
              </li>
              <li>
                <strong>Barang Masuk (Maklon)</strong>: dipakai setiap kali ada kiriman barang dari pabrik maklon. Isi produk, kode batch (biasanya tertera di kemasan/surat jalan), tanggal kedaluwarsa, dan jumlah. Kode batch yang sama boleh dipakai ulang untuk produk yang <em>berbeda</em> (kebetulan kode produksi sama), tapi tidak boleh dipakai dua kali untuk produk yang <em>sama</em>, kalau kamu input ulang kode batch yang sama persis untuk produk yang sama, sistem akan menambah tanggal kedaluwarsanya (bukan bikin baris baru) dan menambahkan jumlahnya ke batch yang sudah ada.
              </li>
              <li>
                <strong>Input Stok Awal (Opening Balance)</strong>: khusus dipakai sekali di awal pemakaian sistem, untuk mencatat stok yang sudah ada di gudang sebelum sistem ini dipakai. Karena angkanya masih perkiraan, entri ini otomatis ditandai <strong>"belum terverifikasi"</strong> sampai sesi Stok Opname pertama menyentuh batch itu (physical count-nya diisi), jadi semua orang tahu angka itu masih perlu dicek ulang fisiknya. Daftar batch yang masih berstatus ini bisa dilihat di halaman Notifikasi (Modul 7).
              </li>
              <li>
                <strong>Klik nama produk</strong> di tabel untuk buka detail, di sana ada daftar semua batch produk itu beserta stoknya, dan (khusus produk Bundle) form untuk atur <strong>resep</strong>: produk apa saja dan berapa jumlah yang membentuk 1 bundle. Kalau resep diubah, order lama yang sudah terjadi tidak ikut berubah (komposisinya sudah "dibekukan" saat order dibuat), hanya order baru sesudahnya yang memakai resep terbaru.
              </li>
              <li>
                Setiap batch bisa dicetak label QR nya lewat halaman <strong>Ledger</strong>, buat ditempel di kardus gudang dan dipakai saat Stok Opname (lihat cara scan-nya di Modul 5 dan Modul 10). Isi QR-nya cuma kode batch itu sendiri, jadi tetap bisa dibaca manual kalau printer/scanner sedang tidak tersedia.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 3: Ledger & Rekonsiliasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              3. Ledger & Rekonsiliasi
            </CardTitle>
            <CardDescription>"Buku besar" tempat menelusuri semua pergerakan stok.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Semua pergerakan stok tercatat otomatis di sini, <strong>tidak ada yang perlu diisi manual</strong> di halaman ini sendiri (isinya selalu hasil dari aksi di halaman lain, Barang Masuk, Simulasi, Retur, atau Opname).
              </li>
              <li>
                Tab <strong>Drilldown Produk</strong>: pilih 1 produk untuk lihat seluruh riwayat pergerakan stoknya berurutan waktu, lengkap dengan <strong>saldo berjalan</strong> (running balance) di tiap barisnya supaya kelihatan persis kapan angka stok berubah jadi berapa. Bisa difilter per Tipe Mutasi, Alasan (khusus baris Keluar Manual), Channel, dan rentang tanggal. Ini jawaban paling lengkap kalau ada yang tanya "kenapa stok produk ini jadi segini", untuk baris Keluar Manual, alasan (bonus/promo/sample/dll) dan referensi campaign-nya ikut tampil langsung di tabel.
              </li>
              <li>
                Tombol <strong>Koreksi Entri</strong>: muncul di tiap baris ledger, dipakai khusus untuk kasus <em>salah input admin</em> (misalnya salah ketik jumlah saat mencatat barang keluar manual). Beda dari Stok Opname: ini bukan hasil hitung fisik, tapi reversal cepat begitu operator sadar ada yang salah. Hanya berlaku untuk baris <strong>Barang Masuk Maklon</strong> dan <strong>Keluar Manual</strong>, baris hasil penjualan, retur, atau opname sengaja tidak bisa dikoreksi lewat sini (masing-masing punya jalur pembetulannya sendiri). Sama seperti aksi lain, ini menulis entri ledger baru (bukan mengedit entri lama), dan melewati layar konfirmasi (menunjukkan produk, entri asli, jumlah koreksi, dan dampaknya ke stok) sebelum tersimpan permanen. Sistem juga menolak koreksi yang akan membuat saldo batch jadi minus.
              </li>
              <li>
                Tab <strong>Anomali Harian</strong>: sistem otomatis mengecek konsistensi catatannya sendiri setiap hari, tanpa perlu dijalankan manual. Dua jenis yang dideteksi:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Pesanan batal tapi stok belum kembali</strong>: order berstatus CANCELLED yang masih punya catatan barang keluar di ledger, tanpa ada proses retur/pembatalan resmi yang menyelesaikannya. Ini persis skenario kebocoran yang disebut di awal (barang tercatat keluar, pesanan batal, tapi stok tidak pernah dikembalikan).</li>
                  <li><strong>Saldo batch minus</strong>: batch yang angka stoknya menjadi negatif, seharusnya tidak pernah terjadi lewat jalur normal, jadi kalau muncul di sini artinya ada yang perlu ditelusuri serius, otomatis diberi prioritas HIGH.</li>
                </ul>
                Kalau ada baris di sini, artinya perlu ditelusuri lebih lanjut lewat Drilldown Produk.
              </li>
              <li>
                Tombol <strong>Export CSV</strong>: unduh riwayat ledger produk yang sedang dilihat (sesuai filter yang aktif) ke file CSV, kalau perlu diolah lebih lanjut di luar sistem, kolom alasan dan referensi campaign ikut disertakan.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 4: Retur */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-purple-500" />
              4. Retur
            </CardTitle>
            <CardDescription>Memutuskan nasib barang yang dikembalikan pembeli, atau batal setelah dikirim.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Setiap ada retur baru (dari pesanan yang diretur pembeli) atau pembatalan yang terjadi <em>setelah</em> barang dikirim, otomatis muncul di daftar dengan status <strong>"Menunggu Inspeksi"</strong>, badge biru untuk Pembatalan, ungu untuk Retur biasa. Kondisi barangnya <strong>selalu diputuskan manual oleh gudang</strong> setelah barang fisik benar-benar dicek, sistem tidak pernah menebak atau mengambil kondisi otomatis dari data marketplace.
              </li>
              <li>
                Setelah barang fisik sampai dan dicek gudang, klik <strong>Inspeksi</strong> dan tentukan kondisinya:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Layak Jual</strong>: barang kembali normal, bisa dijual lagi. Wajib isi tanggal kedaluwarsa (dibaca dari kemasan fisik), karena barang ini dicatat sebagai <strong>batch baru terpisah</strong> (bertanda "RETUR" untuk retur biasa atau "BATAL" untuk pembatalan pasca-kirim), bukan digabung ke batch asal, sebabnya, tanggal kedaluwarsa batch asal barang itu seringkali sudah tidak bisa dipastikan lagi begitu barang sempat keluar gudang, jadi batch baru ini menjaga alokasi FEFO (barang paling dekat kedaluwarsa keluar duluan) tetap akurat.</li>
                  <li><strong>Rusak</strong> atau <strong>Hilang</strong>: barang tidak bisa dijual lagi. <strong>Wajib upload foto bukti</strong> sebelum bisa menyelesaikan inspeksi, berlaku untuk retur biasa maupun pembatalan pasca-kirim. Stok TIDAK ditambah lagi untuk kondisi ini (sudah terpotong sejak barang pertama kali dikirim, menambahkannya lagi justru bikin stok dobel-hitung), tapi tetap tercatat sebagai jejak audit lewat status dan fotonya, dan kedua kondisi ini sengaja dipisah statusnya karena proses klaim ke ekspedisi/marketplace-nya beda.</li>
                </ul>
              </li>
              <li>
                Retur atau pembatalan <strong>sebagian</strong> dari pesanan bundle didukung: kalau pembeli cuma mengembalikan salah satu produk dari isi bundle, itu dihitung per produk satuan, bukan seluruh bundle, karena bundle memang sudah dipecah jadi produk satuan sejak pesanan itu pertama kali dibuat.
              </li>
              <li>
                Khusus retur dari <strong>TikTok Shop</strong>, ada batas waktu 40 hari (dihitung sejak retur diajukan ke sistem ini, bukan sejak barang dikirim atau diterima pembeli) untuk klaim ke platform. Lihat halaman Notifikasi untuk daftar yang mendekati batas ini, diurutkan dari yang paling mendesak.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 5: Stok Opname */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-amber-500" />
              5. Stok Opname
            </CardTitle>
            <CardDescription>Mencocokkan catatan sistem dengan hasil hitung fisik gudang. Biasanya dilakukan berkala (mis. tiap 1-3 bulan).</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>Klik <strong>Buka Sesi Baru</strong>. Sistem mengambil snapshot stok semua batch yang masih ada stoknya menurut catatan saat ini. Boleh ada lebih dari satu sesi berjalan (status "Aktif") bersamaan, misalnya kalau opname area gudang berbeda dikerjakan hari yang berbeda dan belum sempat ditutup semua.</li>
              <li>
                Untuk tiap kardus/batch yang dihitung fisik: <strong>scan QR</strong> yang tertempel di kardus (klik ikon kamera), atau ketik manual kode batch kalau QR tidak terbaca. Isi jumlah fisik yang benar-benar dihitung.
              </li>
              <li>
                Kalau jumlah fisik <strong>beda</strong> dari catatan sistem, kolom <strong>Alasan Selisih</strong> wajib diisi, pilihannya: <em>rusak</em>, <em>hilang</em>, <em>ketemu ekstra</em>, <em>salah hitung sebelumnya</em>, atau <em>lainnya</em>. Ini yang bikin selisih opname bisa dijelaskan, bukan cuma diketahui angkanya, alasan ini nanti ikut tersimpan di catatan ledger korekesinya.
              </li>
              <li>Ulangi untuk semua batch. Sesi tetap bisa ditutup walau ada batch yang belum sempat dihitung, sistem akan memberi tahu batch mana saja yang terlewat (ditampilkan terpisah sebagai "belum dihitung", bukan dianggap selisih 0).</li>
              <li>
                Klik <strong>Tutup Sesi</strong>. Untuk tiap batch yang hasilnya beda dari catatan, otomatis tertulis 1 baris koreksi ke Ledger (movement <code className="bg-muted px-1 py-0.5 rounded text-xs">ADJUSTMENT_OPNAME</code>, bisa dilihat lagi lewat Drilldown Produk, tertaut ke sesi opname ini). Setelah ditutup, sesi ini <strong>tidak bisa diubah lagi</strong>, kalau ternyata ada yang salah setelah sesi ditutup, pembetulannya lewat sesi opname berikutnya, bukan membuka ulang sesi lama.
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Modul 6: Simulasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-orange-500" />
              6. Simulasi
            </CardTitle>
            <CardDescription>Karena sistem belum tersambung ke API Shopee/TikTok Shop asli, halaman ini jadi jalan masuk data pesanan.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>Buat Pesanan Fiktif</strong>: pilih Channel (Shopee/TikTok Shop) dan jumlah, lalu <strong>Generate Orders</strong>. Pesanan baru berstatus PENDING (belum memotong stok, masih sebatas reservasi), dipakai untuk simulasi alur "pesanan masuk" sebelum benar-benar dikirim.
              </li>
              <li>
                Di daftar pesanan, tiap baris PENDING punya tombol:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Ship</strong>: tandai dikirim. Sistem otomatis memilih batch dengan tanggal kedaluwarsa terdekat (FEFO, First Expired, First Out) dan memotong stok saat ini juga. Status berubah jadi SHIPPED untuk channel Shopee, atau IN_TRANSIT untuk TikTok Shop, bedanya cuma nama status, keduanya sama-sama artinya "stok sudah keluar gudang secara resmi".</li>
                  <li><strong>Cancel</strong>: batalkan sebelum dikirim, cukup lepas reservasi, tidak menyentuh ledger sama sekali karena stoknya memang belum pernah terpotong.</li>
                </ul>
                Setelah SHIPPED/IN_TRANSIT, tersedia tombol <strong>Simulate Return</strong> (ajukan retur) atau <strong>Batalkan</strong> (pembatalan setelah kirim, akan masuk ke halaman Retur untuk diinspeksi, sama seperti retur biasa, lihat Modul 4).
              </li>
              <li>
                <strong>Mutasi Keluar Manual</strong>: untuk barang yang keluar gudang di luar pesanan online: <em>penjualan offline, bonus, promo, sample, barang rusak,</em> atau <em>barang kedaluwarsa</em>. Kolom alasan wajib diisi. Khusus alasan <strong>bonus/promo/sample</strong> (sumber selisih terbesar menurut brief), kolom <strong>Referensi Campaign/Approval</strong> juga wajib diisi, supaya kebocoran ini bisa dijelaskan ke siapa & kenapa, bukan cuma tercatat sebagai angka, hasilnya nanti tampil langsung di halaman Ledger (lihat Modul 3). Sebelum tersimpan, muncul layar konfirmasi yang menunjukkan produk, kuantitas, alasan, dan dampaknya ke stok. Ini satu-satunya titik yang sengaja diberi friksi di seluruh sistem, supaya operator tidak salah klik untuk penulisan yang permanen.
              </li>
              <li>
                <strong>Impor Pesanan Massal (CSV)</strong>: untuk memasukkan banyak pesanan sekaligus dari file. Format header wajib: <code className="bg-muted px-1 py-0.5 rounded text-xs">channel, external_order_id, sku, qty, ordered_at</code>. Satu pesanan dengan banyak produk cukup ditulis sebagai beberapa baris dengan <code className="bg-muted px-1 py-0.5 rounded text-xs">external_order_id</code> yang sama. SKU bundle otomatis dipecah ke komponen satuannya. Pesanan dengan ID yang sama persis dengan yang sudah pernah diimpor otomatis dilewati (tidak dobel-tercatat), jadi file yang sama aman diunggah ulang kalau ragu apakah sudah pernah masuk atau belum.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 7: Notifikasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-red-500" />
              7. Notifikasi
            </CardTitle>
            <CardDescription>Tidak ada yang perlu dilakukan di sini, cukup dicek berkala. Semua notifikasi tampil di dalam aplikasi (in-app), tidak dikirim lewat email atau WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li><strong>Barang Mendekati/Sudah Kedaluwarsa</strong>: daftar batch dengan sisa umur 90 hari atau kurang (dan masih ada stoknya), diurutkan dari yang paling mendesak. Batch yang sudah lewat tanggal kedaluwarsa tetap muncul di sini (ditampilkan sebagai hari negatif/sudah lewat), bukan otomatis hilang dari daftar, supaya tidak ada yang lolos begitu saja.</li>
              <li><strong>Klaim TikTok Menunggu Diajukan</strong>: retur TikTok Shop (kondisi rusak/hilang) yang punya batas waktu klaim 40 hari ke platform, dihitung sejak retur itu diajukan. Sisa hari ditampilkan supaya tidak terlewat; kalau sudah lewat batas, tetap ditampilkan sebagai peringatan (bukan hilang begitu saja dari daftar).</li>
              <li><strong>Stok Awal Belum Terverifikasi</strong>: daftar entri Opening Balance (lihat Modul 2) yang masih menunggu Stok Opname pertama untuk dikonfirmasi akurat. Begitu batch itu pernah dihitung fisik di sesi opname manapun, otomatis hilang dari daftar ini, tidak perlu ada tombol "tandai terverifikasi" manual.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 8: Resiko Oversell */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageX className="h-5 w-5 text-rose-500" />
              8. Resiko Oversell
            </CardTitle>
            <CardDescription>Peringatan dini kalau pesanan yang belum dikirim melebihi stok yang benar-benar tersedia.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Muncul otomatis di <strong>Worklist Hari Ini</strong> (Modul 1) dengan prioritas HIGH kalau ada produk yang jumlah pesanan PENDING-nya (dijumlahkan dari semua channel) melebihi stok fisik yang benar-benar tersedia untuk dialokasikan. Ini bisa terjadi kalau, misalnya, ada banyak pesanan masuk hampir bersamaan sebelum stok sempat ditambah lagi.
              </li>
              <li>
                Klik untuk dibawa ke halaman Produk, cek stok produk terkait, dan segera tindak lanjuti (misalnya percepat penerimaan barang maklon, atau koordinasi ke tim penjualan soal produk mana yang perlu ditahan dulu) sebelum ada pesanan yang gagal dikirim karena stok ternyata tidak cukup saat giliran di-ship.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 9: Tema Gelap/Terang */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SunMoon className="h-5 w-5 text-indigo-500" />
              9. Tema Gelap/Terang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Tombol matahari/bulan di pojok bawah menu (sebelah tombol Logout) untuk ganti tampilan antara mode gelap dan terang, sesuai kenyamanan mata masing-masing, mode terang cenderung lebih nyaman dipakai di ruangan terang/outdoor, mode gelap lebih nyaman di ruangan minim cahaya.
              </li>
              <li>Pilihan tema tersimpan otomatis di perangkat yang dipakai, jadi tidak perlu diganti ulang tiap kali buka sistem lagi dari perangkat yang sama.</li>
              <li>Kalau teksnya terasa kurang nyaman di mata (terlalu terang/terlalu redup), coba dulu pindah ke tema satunya sebelum menyimpulkan ada yang salah, ini murni soal kenyamanan masing-masing, bukan indikasi bug.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 10: Memakai di HP/Tablet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-teal-500" />
              10. Memakai di HP/Tablet
            </CardTitle>
            <CardDescription>Sistem ini dirancang bisa dipakai penuh dari HP, karena kegiatan seperti Stok Opname biasanya dilakukan sambil jalan keliling gudang.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>Scan QR pakai kamera HP</strong> berfungsi langsung dari browser (Chrome di Android/iOS), tidak perlu aplikasi tambahan atau alat scanner khusus. Pastikan browser diizinkan mengakses kamera saat diminta pertama kali.
              </li>
              <li>
                Kalau gudang sudah punya <strong>alat scanner barcode fisik</strong> (yang dicolok USB/Bluetooth), itu juga bisa dipakai, pastikan kursor sedang aktif di kolom "Batch ID" sebelum menembak scan, karena alat itu bekerja seperti mengetik otomatis lalu menekan Enter.
              </li>
              <li>
                Semua halaman menyesuaikan tampilan ke layar sempit (form yang di laptop sejajar berdampingan akan otomatis tersusun ke bawah di HP), termasuk menu navigasi yang berubah jadi tombol menu di pojok kiri atas.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 11: Daftar Istilah & Kode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-fuchsia-500" />
              11. Daftar Istilah & Kode di Sistem
            </CardTitle>
            <CardDescription>Kode-kode singkat yang muncul di halaman Ledger, Simulasi, dan Retur, dijelaskan artinya di sini biar tidak perlu menebak.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Tipe Mutasi (kolom "Tipe Mutasi" di halaman Ledger)</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_MAKLON</code>, barang masuk dari pabrik maklon.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_OPENING_BALANCE</code>, stok awal (perkiraan) yang diinput sekali di awal pemakaian sistem.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">OUT_SALE_MARKETPLACE</code>, barang keluar karena penjualan lewat Shopee/TikTok Shop, terpotong otomatis saat pesanan di-Ship.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">OUT_MANUAL</code>, barang keluar manual (lihat kolom Alasan di sebelahnya untuk tahu persisnya offline/bonus/promo/sample/rusak/kedaluwarsa yang mana).</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_RETURN_SELLABLE</code>, barang retur yang kondisinya layak jual, tercatat masuk ke batch baru.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_CANCEL_REVERSAL</code>, stok dikembalikan karena pembatalan pesanan yang terjadi setelah barang sudah dikirim, dan setelah diinspeksi kondisinya layak jual.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">ADJUSTMENT_OPNAME</code>, koreksi hasil Stok Opname, dari selisih antara catatan sistem dan hitung fisik.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">ADJUSTMENT_CORRECTION</code>, koreksi manual lewat tombol "Koreksi Entri" (salah input admin).</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Channel (kolom "Channel")</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong>shopee</strong>, <strong>tiktok</strong>, pergerakan yang berasal dari penjualan lewat marketplace tersebut.</li>
                <li><strong>offline</strong>, penjualan langsung/tatap muka (bukan lewat marketplace).</li>
                <li><strong>internal</strong>, pergerakan yang bukan penjualan sama sekali: bonus, promo, sample, barang rusak, kedaluwarsa, barang masuk maklon, dan stok awal.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Status Pesanan (di halaman Simulasi)</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong>PENDING</strong>, pesanan baru, masih sebatas reservasi, belum memotong stok.</li>
                <li><strong>SHIPPED</strong>, sudah dikirim (khusus channel Shopee), stok sudah resmi terpotong.</li>
                <li><strong>IN_TRANSIT</strong>, sudah dikirim (khusus channel TikTok Shop), stok sudah resmi terpotong. Fungsinya sama persis dengan SHIPPED, cuma beda nama sesuai istilah masing-masing platform.</li>
                <li><strong>CANCELLED</strong>, pesanan dibatalkan, baik sebelum maupun sesudah dikirim.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Kondisi Retur (di halaman Retur)</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong>Menunggu Inspeksi</strong>, retur/pembatalan sudah masuk, tapi gudang belum mengecek kondisi fisiknya.</li>
                <li><strong>Layak Jual</strong>, barang normal, kembali ke stok sebagai batch baru.</li>
                <li><strong>Rusak</strong> / <strong>Hilang</strong>, barang tidak kembali ke stok, wajib ada foto bukti. Dipisah statusnya karena proses klaimnya beda.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Prioritas Worklist & Anomali</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong className="text-red-500">HIGH</strong>, perlu segera ditindaklanjuti hari ini juga.</li>
                <li><strong className="text-amber-500">MEDIUM</strong>, perlu dicek dalam beberapa hari ke depan.</li>
                <li><strong className="text-muted-foreground">LOW</strong>, masih bisa ditunda, tapi tetap dipantau supaya tidak naik prioritasnya.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
