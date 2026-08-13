import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HashScrollHandler } from "@/components/layout/hash-scroll-handler";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
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
      <HashScrollHandler />
      <ScrollToTopButton />
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
              Ada 1 aturan paling penting yang berlaku di SEMUA halaman di sistem ini: <strong>angka stok tidak pernah diubah langsung</strong>.
            </p>
            <p>
              Begini cara kerjanya: tiap kali stok berubah, apa pun sebabnya (barang masuk, terjual, diretur, atau hasil hitung fisik ternyata beda), sistem menulis 1 baris catatan baru. Catatan ini disimpan di &quot;buku besar&quot; yang namanya <strong>Ledger</strong>.
            </p>
            <p>
              Angka stok yang kamu lihat di layar <strong>bukan</strong> angka yang disimpan lalu diketik ulang manual. Angka itu selalu dihitung ulang dari semua catatan di Ledger, setiap kali halaman dibuka.
            </p>
            <p>
              Karena itu, kamu tidak akan pernah menemukan tombol &quot;ubah stok jadi angka X&quot; di mana pun di sistem ini. Kalau stok perlu berubah, caranya selalu lewat salah satu aksi yang tercatat: barang masuk, keluar manual, retur, atau opname. Manfaatnya: kalau nanti ada yang tanya &quot;kenapa stok produk ini jadi segini?&quot;, jawabannya selalu bisa dicari di halaman Ledger.
            </p>
            <p>
              Konsekuensinya: catatan yang sudah tersimpan <strong>tidak bisa dihapus atau diedit</strong> oleh siapa pun, termasuk admin. Ini bukan cuma aturan di tampilan aplikasi, tapi dikunci langsung di database, jadi benar-benar tidak bisa diubah dengan cara apa pun, termasuk cara teknis sekalipun.
            </p>
            <p>
              Kalau ada yang salah input, cara membetulkannya adalah menambah catatan koreksi baru (lihat <strong>Koreksi Entri</strong> di Modul 3), bukan menghapus catatan yang lama. Ini yang membuat riwayat stok selalu bisa dipercaya sepenuhnya.
            </p>
            <p>
              Saat ini sistem cuma punya <strong>1 peran: Admin</strong>. Siapa pun yang login akan punya akses penuh ke semua halaman. Belum ada pembagian hak akses per orang.
            </p>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* Modul 1: Dashboard Tugas Hari Ini */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              1. Tugas Hari Ini (Halaman Utama)
            </CardTitle>
            <CardDescription>Ringkasan hal-hal yang butuh perhatian. Ini halaman pertama yang kelihatan tiap buka sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>4 kartu ringkasan</strong> di bagian atas: Total SKU Aktif, Batch Mendekati Kedaluwarsa, Retur Menunggu Inspeksi, dan Anomali Terbuka. Kartu yang berwarna merah artinya ada hal yang perlu segera dicek.
                <br />
                Catatan soal kartu <strong>Total SKU Aktif</strong>: ini cuma menghitung produk tipe Reguler. Produk tipe Bundle sengaja tidak ikut dihitung, karena stok Bundle sendiri memang tidak pernah ada. Stok Bundle selalu hasil hitung dari komponen penyusunnya (lihat Modul 2).
              </li>
              <li>
                <strong>Worklist Hari Ini</strong>: daftar tugas yang sudah diurutkan otomatis. Yang paling mendesak (label merah, HIGH) di atas, yang paling santai (label abu-abu, LOW) di bawah. Klik salah satu tugas untuk langsung dibawa ke halaman terkait.
                <br />
                Jenis tugas yang bisa muncul di sini:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Resiko Oversell</strong>: ada produk yang dipesan (statusnya PENDING, belum dikirim) melebihi stok yang benar-benar tersedia. Ini prioritas paling tinggi, karena kalau dibiarkan, pesanan bisa gagal dikirim. Detail lengkap ada di Modul 8.</li>
                  <li><strong>Anomali Stok</strong>: kejanggalan yang ketemu dari pengecekan konsistensi harian (lihat Modul 3). Contohnya: pesanan batal yang stoknya belum kembali, atau saldo batch yang jadi minus.</li>
                  <li><strong>Klaim TikTok</strong>: retur TikTok Shop yang mendekati batas waktu 40 hari untuk diajukan klaim ke platform.</li>
                  <li><strong>Batch Kedaluwarsa</strong>: batch yang mendekati tanggal kedaluwarsa (dalam 90 hari ke depan) atau sudah lewat tanggalnya, dan masih ada sisa stoknya.</li>
                  <li><strong>Retur Pending</strong>: barang retur yang sudah masuk tapi belum diinspeksi kondisinya. Makin lama menggantung, makin tinggi prioritasnya. Dihitung dari tanggal pengajuan retur, lebih dari 3 hari otomatis jadi HIGH.</li>
                </ul>
              </li>
              <li>
                <strong>Pergerakan Terbaru</strong>: 8 catatan ledger paling baru dari seluruh produk. Gunanya buat pantau aktivitas sekilas, tanpa harus buka halaman Ledger dulu.
              </li>
              <li>
                <strong>Aksi Cepat</strong>: tombol pintas ke tugas yang sering dipakai (Keluar Manual, Mulai Opname, Lihat Ledger, Simulasi Marketplace). Fungsinya sama saja dengan buka lewat menu sidebar, cuma lebih cepat diakses karena sudah ada di halaman utama.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 2: Produk & Batch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" />
              2. Produk & Batch
            </CardTitle>
            <CardDescription>Kelola daftar produk, penerimaan barang, dan stok awal.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>Tambah Produk</strong>: isi SKU dan nama produk, lalu pilih tipenya.
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><em>Reguler</em>: untuk produk fisik satuan.</li>
                  <li><em>Bundle</em>: untuk paket gabungan beberapa produk. Bundle sendiri tidak punya stok fisik, stoknya selalu dihitung dari komponen penyusunnya.</li>
                </ul>
                SKU harus unik. Sistem akan menolak kalau kamu coba pakai SKU yang sudah dipakai produk lain. Ini supaya tidak ada dua produk yang tertukar identitasnya saat impor atau input data.
              </li>
              <li>
                <strong>Barang Masuk (Maklon)</strong>: dipakai setiap kali ada kiriman barang dari pabrik maklon. Isi produk, kode batch (biasanya tertera di kemasan atau surat jalan), tanggal kedaluwarsa, dan jumlah barangnya.
                <br />
                Soal kode batch yang sama: boleh dipakai ulang untuk produk yang <em>berbeda</em> (kebetulan kode produksinya sama), tapi tidak boleh dipakai dua kali untuk produk yang <em>sama</em>. Kalau kamu input ulang kode batch yang persis sama untuk produk yang sama, sistem tidak akan bikin baris baru. Sistem akan menambah tanggal kedaluwarsanya dan menambahkan jumlahnya ke batch yang sudah ada.
              </li>
              <li>
                <strong>Input Stok Awal (Opening Balance)</strong>: khusus dipakai sekali di awal pemakaian sistem, untuk mencatat stok yang sudah ada di gudang sebelum sistem ini dipakai.
                <br />
                Karena angkanya masih perkiraan, entri ini otomatis ditandai <strong>&quot;belum terverifikasi&quot;</strong>. Tandanya baru hilang setelah sesi Stok Opname pertama menyentuh batch itu (hitungan fisiknya sudah diisi). Tujuannya supaya semua orang tahu angka itu masih perlu dicek ulang ke fisiknya. Daftar batch yang masih berstatus ini bisa dilihat di halaman Notifikasi (Modul 7).
              </li>
              <li>
                <strong>Klik nama produk</strong> di tabel untuk buka detailnya. Di halaman detail ada daftar semua batch produk itu beserta stoknya.
                <br />
                Khusus produk Bundle, di halaman detail juga ada form untuk atur <strong>resep</strong>: produk apa saja dan berapa jumlah yang membentuk 1 bundle. Kalau resep diubah, order lama yang sudah terjadi tidak ikut berubah, karena komposisinya sudah &quot;dibekukan&quot; sejak order itu dibuat. Cuma order baru sesudahnya yang memakai resep terbaru.
              </li>
              <li>
                Setiap batch bisa dicetak label QR-nya lewat halaman <strong>Ledger</strong>, untuk ditempel di kardus gudang. Label ini dipakai saat Stok Opname (lihat cara scan-nya di Modul 5 dan Modul 10). Isi QR-nya cuma kode batch itu sendiri, jadi tetap bisa dibaca manual kalau printer atau scanner sedang tidak tersedia.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 3: Ledger & Rekonsiliasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              3. Ledger & Rekonsiliasi
            </CardTitle>
            <CardDescription>&quot;Buku besar&quot; tempat menelusuri semua pergerakan stok.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Semua pergerakan stok tercatat otomatis di halaman ini. <strong>Tidak ada yang perlu diisi manual</strong> di sini. Isinya selalu hasil dari aksi di halaman lain: Barang Masuk, Simulasi, Retur, atau Opname.
              </li>
              <li>
                Tab <strong>Drilldown Produk</strong>: pilih 1 produk untuk lihat seluruh riwayat pergerakan stoknya, berurutan dari waktu ke waktu. Tiap barisnya dilengkapi <strong>saldo berjalan</strong> (running balance), supaya kelihatan persis kapan angka stok berubah jadi berapa.
                <br />
                Bisa difilter per Tipe Mutasi, Alasan (khusus baris Keluar Manual), Channel, dan rentang tanggal. Untuk baris Keluar Manual, alasan (bonus/promo/sample/dll) dan referensi campaign-nya ikut tampil langsung di tabel.
                <br />
                Ini jawaban paling lengkap kalau ada yang tanya &quot;kenapa stok produk ini jadi segini?&quot;.
              </li>
              <li>
                Tombol <strong>Koreksi Entri</strong>: muncul di tiap baris ledger. Dipakai khusus untuk kasus <em>salah input admin</em>, misalnya salah ketik jumlah saat mencatat barang keluar manual.
                <br />
                Bedanya dari Stok Opname: ini bukan hasil hitung fisik, tapi reversal cepat begitu operator sadar ada yang salah. Cuma berlaku untuk baris <strong>Barang Masuk Maklon</strong> dan <strong>Keluar Manual</strong>. Baris hasil penjualan, retur, atau opname sengaja tidak bisa dikoreksi lewat sini, karena masing-masing sudah punya jalur pembetulannya sendiri.
                <br />
                Sama seperti aksi lain, Koreksi Entri menulis entri ledger baru, bukan mengedit entri lama. Sebelum tersimpan permanen, ada layar konfirmasi yang menunjukkan produk, entri asli, jumlah koreksi, dan dampaknya ke stok. Sistem juga menolak koreksi yang akan membuat saldo batch jadi minus.
              </li>
              <li>
                Tab <strong>Anomali Harian</strong>: sistem otomatis mengecek konsistensi catatannya sendiri setiap hari, tanpa perlu dijalankan manual. Ada 2 jenis kejanggalan yang dideteksi:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Pesanan batal tapi stok belum kembali</strong>: order berstatus CANCELLED yang masih punya catatan barang keluar di ledger, tanpa ada proses retur atau pembatalan resmi yang menyelesaikannya. Ini persis skenario kebocoran stok: barang tercatat keluar, pesanan batal, tapi stok tidak pernah dikembalikan.</li>
                  <li><strong>Saldo batch minus</strong>: batch yang angka stoknya menjadi negatif. Ini seharusnya tidak pernah terjadi lewat jalur normal. Kalau muncul di sini, artinya ada yang perlu ditelusuri serius, jadi otomatis diberi prioritas HIGH.</li>
                </ul>
                Kalau ada baris di tab ini, artinya perlu ditelusuri lebih lanjut lewat Drilldown Produk.
              </li>
              <li>
                Tombol <strong>Export CSV</strong>: unduh riwayat ledger produk yang sedang dilihat (sesuai filter yang aktif) ke file CSV. Berguna kalau datanya perlu diolah lebih lanjut di luar sistem. Kolom alasan dan referensi campaign ikut disertakan di filenya.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 4: Retur */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              4. Retur
            </CardTitle>
            <CardDescription>Memutuskan nasib barang yang dikembalikan pembeli, atau batal setelah dikirim.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Setiap ada retur baru (dari pesanan yang diretur pembeli), atau pembatalan yang terjadi <em>setelah</em> barang dikirim, otomatis muncul di daftar dengan status <strong>&quot;Menunggu Inspeksi&quot;</strong>. Badge-nya biru untuk Pembatalan, ungu untuk Retur biasa.
                <br />
                Kondisi barangnya <strong>selalu diputuskan manual oleh gudang</strong>, setelah barang fisik benar-benar dicek. Sistem tidak pernah menebak atau mengambil kondisi otomatis dari data marketplace.
              </li>
              <li>
                Setelah barang fisik sampai dan dicek gudang, klik <strong>Inspeksi</strong> dan tentukan kondisinya:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Layak Jual</strong>: barang kembali normal, bisa dijual lagi. Wajib isi tanggal kedaluwarsa, dibaca dari kemasan fisiknya. Barang ini dicatat sebagai <strong>batch baru terpisah</strong> (bertanda &quot;RETUR&quot; untuk retur biasa, atau &quot;BATAL&quot; untuk pembatalan pasca-kirim), bukan digabung ke batch asal. Sebabnya: tanggal kedaluwarsa batch asal barang itu seringkali sudah tidak bisa dipastikan lagi begitu barang sempat keluar gudang. Batch baru ini menjaga alokasi FEFO (barang paling dekat kedaluwarsa keluar duluan) tetap akurat.</li>
                  <li><strong>Rusak</strong> atau <strong>Hilang</strong>: barang tidak bisa dijual lagi. <strong>Wajib upload foto bukti</strong> sebelum bisa menyelesaikan inspeksi, berlaku untuk retur biasa maupun pembatalan pasca-kirim. Stok TIDAK ditambah lagi untuk kondisi ini, karena sudah terpotong sejak barang pertama kali dikirim. Menambahkannya lagi justru bikin stok dobel-hitung. Barang ini tetap tercatat sebagai jejak audit lewat status dan fotonya. Kondisi Rusak dan Hilang sengaja dipisah statusnya, karena proses klaim ke ekspedisi atau marketplace-nya beda.</li>
                </ul>
              </li>
              <li>
                Retur atau pembatalan <strong>sebagian</strong> dari pesanan bundle didukung. Kalau pembeli cuma mengembalikan salah satu produk dari isi bundle, itu dihitung per produk satuan, bukan seluruh bundle. Ini karena bundle memang sudah dipecah jadi produk satuan sejak pesanan itu pertama kali dibuat.
              </li>
              <li>
                Khusus retur dari <strong>TikTok Shop</strong>, ada batas waktu 40 hari untuk klaim ke platform. Dihitung sejak retur diajukan ke sistem ini, bukan sejak barang dikirim atau diterima pembeli. Lihat halaman Notifikasi untuk daftar yang mendekati batas ini, sudah diurutkan dari yang paling mendesak.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 5: Stok Opname */}
        <Card id="opname" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-primary" />
              5. Stok Opname
            </CardTitle>
            <CardDescription>Mencocokkan catatan sistem dengan hasil hitung fisik gudang. Biasanya dilakukan berkala, misalnya tiap 1-3 bulan.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Klik <strong>Buka Sesi Baru</strong>. Sistem akan mengambil snapshot stok semua batch yang masih ada stoknya menurut catatan saat ini.
                <br />
                Boleh ada lebih dari satu sesi berjalan (status &quot;Aktif&quot;) di waktu yang sama. Contohnya kalau opname area gudang yang berbeda dikerjakan di hari yang berbeda, dan belum sempat ditutup semua.
              </li>
              <li>
                Untuk tiap kardus atau batch yang dihitung fisik: <strong>scan QR</strong> yang tertempel di kardus (klik ikon kamera), atau ketik manual kode batch kalau QR tidak terbaca. Isi jumlah fisik yang benar-benar dihitung.
              </li>
              <li>
                Kalau jumlah fisik <strong>beda</strong> dari catatan sistem, kolom <strong>Alasan Selisih</strong> wajib diisi. Pilihannya: <em>rusak</em>, <em>hilang</em>, <em>ketemu ekstra</em>, <em>salah hitung sebelumnya</em>, atau <em>lainnya</em>.
                <br />
                Ini yang bikin selisih opname bisa dijelaskan, bukan cuma diketahui angkanya saja. Alasan ini nanti ikut tersimpan di catatan ledger koreksinya.
              </li>
              <li>
                Ulangi langkah di atas untuk semua batch. Sesi tetap bisa ditutup walau ada batch yang belum sempat dihitung. Sistem akan memberi tahu batch mana saja yang terlewat, ditampilkan terpisah sebagai &quot;belum dihitung&quot;, bukan dianggap selisih 0.
              </li>
              <li>
                Klik <strong>Tutup Sesi</strong>. Untuk tiap batch yang hasilnya beda dari catatan, sistem otomatis menulis 1 baris koreksi ke Ledger (movement <code className="bg-muted px-1 py-0.5 rounded text-xs">ADJUSTMENT_OPNAME</code>). Baris ini bisa dilihat lagi lewat Drilldown Produk, dan tertaut ke sesi opname ini.
                <br />
                Setelah ditutup, sesi ini <strong>tidak bisa diubah lagi</strong>. Kalau ternyata ada yang salah setelah sesi ditutup, pembetulannya lewat sesi opname berikutnya, bukan membuka ulang sesi yang lama.
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Modul 6: Simulasi */}
        <Card id="simulasi" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              6. Simulasi
            </CardTitle>
            <CardDescription>Karena sistem belum tersambung ke API Shopee/TikTok Shop asli, halaman ini jadi jalan masuk data pesanan.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>Buat Pesanan Fiktif</strong>: pilih Channel (Shopee atau TikTok Shop) dan jumlah pesanan, lalu klik <strong>Generate Orders</strong>. Pesanan baru akan berstatus PENDING, belum memotong stok, masih sebatas reservasi. Fitur ini dipakai untuk simulasi alur &quot;pesanan masuk&quot;, sebelum barangnya benar-benar dikirim.
              </li>
              <li>
                Di daftar pesanan, tiap baris berstatus PENDING punya 2 tombol aksi:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Ship</strong>: tandai sudah dikirim. Sistem otomatis memilih batch dengan tanggal kedaluwarsa terdekat (disebut FEFO, First Expired First Out), dan memotong stok saat itu juga. Status berubah jadi SHIPPED untuk channel Shopee, atau IN_TRANSIT untuk TikTok Shop. Bedanya cuma nama status saja, keduanya sama-sama berarti &quot;stok sudah keluar gudang secara resmi&quot;.</li>
                  <li><strong>Cancel</strong>: batalkan sebelum dikirim. Cukup melepas reservasinya saja, tidak menyentuh ledger sama sekali, karena stoknya memang belum pernah terpotong.</li>
                </ul>
                Setelah status jadi SHIPPED atau IN_TRANSIT, akan muncul 2 tombol baru: <strong>Simulate Return</strong> (untuk mengajukan retur), atau <strong>Batalkan</strong> (untuk pembatalan setelah kirim). Pembatalan setelah kirim akan masuk ke halaman Retur untuk diinspeksi, sama seperti retur biasa. Lihat Modul 4 untuk detailnya.
              </li>
              <li>
                <strong>Mutasi Keluar Manual</strong>: dipakai untuk barang yang keluar gudang di luar pesanan online. Pilihan alasannya: <em>penjualan offline</em>, <em>bonus</em>, <em>promo</em>, <em>sample</em>, <em>barang rusak</em>, atau <em>barang kedaluwarsa</em>. Kolom alasan wajib diisi.
                <br />
                Khusus alasan <strong>bonus, promo, atau sample</strong> (sumber selisih stok terbesar menurut brief), kolom <strong>Referensi Campaign/Approval</strong> juga wajib diisi. Tujuannya supaya kebocoran stok ini bisa dijelaskan ke siapa dan kenapa, bukan cuma tercatat sebagai angka saja. Hasilnya nanti tampil langsung di halaman Ledger (lihat Modul 3).
                <br />
                Sebelum tersimpan, akan muncul layar konfirmasi yang menunjukkan produk, kuantitas, alasan, dan dampaknya ke stok. Ini satu-satunya titik yang sengaja diberi &quot;hambatan&quot; di seluruh sistem, supaya operator tidak salah klik untuk penulisan data yang sifatnya permanen.
              </li>
              <li>
                <strong>Impor Pesanan Massal (CSV)</strong>: untuk memasukkan banyak pesanan sekaligus dari 1 file. Format header wajib: <code className="bg-muted px-1 py-0.5 rounded text-xs">channel, external_order_id, sku, qty, ordered_at</code>.
                <br />
                Kalau 1 pesanan berisi banyak produk, cukup ditulis sebagai beberapa baris dengan <code className="bg-muted px-1 py-0.5 rounded text-xs">external_order_id</code> yang sama persis. SKU bundle akan otomatis dipecah ke komponen satuannya.
                <br />
                Pesanan dengan ID yang sama persis dengan yang sudah pernah diimpor akan otomatis dilewati, tidak akan tercatat dobel. Jadi file yang sama aman diunggah ulang, kalau ragu apakah sudah pernah masuk atau belum.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 7: Notifikasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              7. Notifikasi
            </CardTitle>
            <CardDescription>Tidak ada yang perlu dilakukan di halaman ini, cukup dicek berkala. Semua notifikasi tampil di dalam aplikasi (in-app), tidak dikirim lewat email atau WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li><strong>Barang Mendekati/Sudah Kedaluwarsa</strong>: daftar batch dengan sisa umur 90 hari atau kurang (dan masih ada stoknya), diurutkan dari yang paling mendesak. Batch yang sudah lewat tanggal kedaluwarsa tetap muncul di sini, ditampilkan sebagai hari negatif atau &quot;sudah lewat&quot;. Batch itu tidak akan otomatis hilang dari daftar, supaya tidak ada yang lolos begitu saja.</li>
              <li><strong>Klaim TikTok Menunggu Diajukan</strong>: retur TikTok Shop (kondisi rusak atau hilang) yang punya batas waktu klaim 40 hari ke platform, dihitung sejak retur itu diajukan. Sisa hari ditampilkan supaya tidak terlewat. Kalau sudah lewat batas waktunya, tetap ditampilkan sebagai peringatan, tidak hilang begitu saja dari daftar.</li>
              <li><strong>Stok Awal Belum Terverifikasi</strong>: daftar entri Opening Balance (lihat Modul 2) yang masih menunggu Stok Opname pertama untuk dikonfirmasi akurat. Begitu batch itu pernah dihitung fisik di sesi opname manapun, otomatis hilang dari daftar ini. Tidak perlu ada tombol &quot;tandai terverifikasi&quot; manual.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 8: Resiko Oversell */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageX className="h-5 w-5 text-primary" />
              8. Resiko Oversell
            </CardTitle>
            <CardDescription>Peringatan dini kalau pesanan yang belum dikirim melebihi stok yang benar-benar tersedia.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Muncul otomatis di <strong>Worklist Hari Ini</strong> (Modul 1) dengan prioritas HIGH, kalau ada produk yang jumlah pesanan PENDING-nya (dijumlahkan dari semua channel) melebihi stok fisik yang benar-benar tersedia untuk dialokasikan.
                <br />
                Ini bisa terjadi kalau, misalnya, ada banyak pesanan masuk hampir bersamaan sebelum stok sempat ditambah lagi.
              </li>
              <li>
                Klik untuk dibawa ke halaman Produk, cek stok produk terkait, lalu segera tindak lanjuti. Contoh tindak lanjutnya: percepat penerimaan barang maklon, atau koordinasi ke tim penjualan soal produk mana yang perlu ditahan dulu. Lakukan ini sebelum ada pesanan yang gagal dikirim karena stoknya ternyata tidak cukup saat giliran di-ship.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 9: Tema Gelap/Terang */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SunMoon className="h-5 w-5 text-primary" />
              9. Tema Gelap/Terang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                Tombol matahari/bulan ada di pojok bawah menu, sebelah tombol Logout. Klik untuk ganti tampilan antara mode gelap dan terang, sesuai kenyamanan mata masing-masing.
                <br />
                Mode terang cenderung lebih nyaman dipakai di ruangan terang atau outdoor. Mode gelap lebih nyaman dipakai di ruangan yang minim cahaya.
              </li>
              <li>Pilihan tema tersimpan otomatis di perangkat yang dipakai. Tidak perlu diganti ulang tiap kali buka sistem lagi dari perangkat yang sama.</li>
              <li>Kalau teksnya terasa kurang nyaman di mata (terlalu terang atau terlalu redup), coba dulu pindah ke tema satunya sebelum menyimpulkan ada yang salah. Ini murni soal kenyamanan masing-masing, bukan indikasi bug.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 10: Memakai di HP/Tablet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              10. Memakai di HP/Tablet
            </CardTitle>
            <CardDescription>Sistem ini dirancang bisa dipakai penuh dari HP, karena kegiatan seperti Stok Opname biasanya dilakukan sambil jalan keliling gudang.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-3 leading-relaxed text-muted-foreground">
              <li>
                <strong>Scan QR pakai kamera HP</strong> berfungsi langsung dari browser (Chrome di Android/iOS). Tidak perlu aplikasi tambahan atau alat scanner khusus. Pastikan browser diizinkan mengakses kamera, saat diminta pertama kali.
              </li>
              <li>
                Kalau gudang sudah punya <strong>alat scanner barcode fisik</strong> (yang dicolok lewat USB atau Bluetooth), itu juga bisa dipakai. Pastikan kursor sedang aktif di kolom &quot;Batch ID&quot; sebelum menembak scan, karena alat itu bekerja seperti mengetik otomatis lalu menekan Enter.
              </li>
              <li>
                Semua halaman menyesuaikan tampilan ke layar sempit. Form yang di laptop sejajar berdampingan akan otomatis tersusun ke bawah di HP. Menu navigasi juga berubah jadi tombol menu di pojok kiri atas.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 11: Daftar Istilah & Kode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" />
              11. Daftar Istilah & Kode di Sistem
            </CardTitle>
            <CardDescription>Kode-kode singkat yang muncul di halaman Ledger, Simulasi, dan Retur, dijelaskan artinya di sini biar tidak perlu menebak.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Tipe Mutasi (kolom &quot;Tipe Mutasi&quot; di halaman Ledger)</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_MAKLON</code>, barang masuk dari pabrik maklon.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_OPENING_BALANCE</code>, stok awal (perkiraan) yang diinput sekali di awal pemakaian sistem.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">OUT_SALE_MARKETPLACE</code>, barang keluar karena penjualan lewat Shopee/TikTok Shop. Terpotong otomatis saat pesanan di-Ship.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">OUT_MANUAL</code>, barang keluar manual. Lihat kolom Alasan di sebelahnya untuk tahu persisnya offline/bonus/promo/sample/rusak/kedaluwarsa yang mana.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_RETURN_SELLABLE</code>, barang retur yang kondisinya layak jual. Tercatat masuk ke batch baru.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">IN_CANCEL_REVERSAL</code>, stok dikembalikan karena pembatalan pesanan yang terjadi setelah barang sudah dikirim, dan setelah diinspeksi kondisinya layak jual.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">ADJUSTMENT_OPNAME</code>, koreksi hasil Stok Opname. Muncul dari selisih antara catatan sistem dan hitung fisik.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">ADJUSTMENT_CORRECTION</code>, koreksi manual lewat tombol &quot;Koreksi Entri&quot;, untuk kasus salah input admin.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Channel (kolom &quot;Channel&quot;)</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong>shopee</strong>, <strong>tiktok</strong>: pergerakan yang berasal dari penjualan lewat marketplace tersebut.</li>
                <li><strong>offline</strong>: penjualan langsung/tatap muka, bukan lewat marketplace.</li>
                <li><strong>internal</strong>: pergerakan yang bukan penjualan sama sekali. Contohnya bonus, promo, sample, barang rusak, kedaluwarsa, barang masuk maklon, dan stok awal.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Status Pesanan (di halaman Simulasi)</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong>PENDING</strong>: pesanan baru, masih sebatas reservasi, belum memotong stok.</li>
                <li><strong>SHIPPED</strong>: sudah dikirim, khusus channel Shopee. Stok sudah resmi terpotong.</li>
                <li><strong>IN_TRANSIT</strong>: sudah dikirim, khusus channel TikTok Shop. Stok sudah resmi terpotong. Fungsinya sama persis dengan SHIPPED, cuma beda nama sesuai istilah masing-masing platform.</li>
                <li><strong>CANCELLED</strong>: pesanan dibatalkan, baik sebelum maupun sesudah dikirim.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Kondisi Retur (di halaman Retur)</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong>Menunggu Inspeksi</strong>: retur atau pembatalan sudah masuk, tapi gudang belum mengecek kondisi fisiknya.</li>
                <li><strong>Layak Jual</strong>: barang normal, kembali ke stok sebagai batch baru.</li>
                <li><strong>Rusak</strong> / <strong>Hilang</strong>: barang tidak kembali ke stok, wajib ada foto bukti. Dipisah statusnya karena proses klaimnya beda.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Prioritas Worklist & Anomali</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-muted-foreground">
                <li><strong className="text-red-500">HIGH</strong>: perlu segera ditindaklanjuti hari ini juga.</li>
                <li><strong className="text-amber-500">MEDIUM</strong>: perlu dicek dalam beberapa hari ke depan.</li>
                <li><strong className="text-muted-foreground">LOW</strong>: masih bisa ditunda, tapi tetap dipantau supaya tidak naik prioritasnya.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
