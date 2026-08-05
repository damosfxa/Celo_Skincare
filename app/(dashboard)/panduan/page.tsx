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
              Saat ini sistem hanya punya <strong>1 peran: Admin</strong>. Siapa pun yang login punya akses penuh ke semua halaman.
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
                <strong>4 kartu ringkasan</strong> di bagian atas: Total SKU Aktif, Batch Mendekati Kedaluwarsa, Retur Menunggu Inspeksi, dan Anomali Terbuka. Kartu yang berwarna merah artinya ada hal yang perlu segera dicek.
              </li>
              <li>
                <strong>Worklist Hari Ini</strong>: daftar tugas yang sudah diurutkan otomatis dari yang paling mendesak (label merah = HIGH) ke yang santai (label abu-abu = LOW). Klik salah satu untuk langsung dibawa ke halaman terkait. Jenis tugas yang bisa muncul:
                <ul className="list-circle pl-5 mt-3 space-y-2">
                  <li><strong>Resiko Oversell</strong>: ada produk yang dipesan (reserved) melebihi stok yang benar-benar tersedia. Ini prioritas tertinggi karena kalau dibiarkan, pesanan bisa gagal dikirim.</li>
                  <li><strong>Anomali Stok</strong>: kejanggalan yang ketemu dari pengecekan konsistensi harian (lihat Modul 3).</li>
                  <li><strong>Klaim TikTok</strong>: retur TikTok Shop yang mendekati batas waktu 40 hari.</li>
                  <li><strong>Batch Kedaluwarsa</strong>: batch yang mendekati atau sudah lewat tanggal kedaluwarsa.</li>
                  <li><strong>Retur Pending</strong>: barang retur yang sudah masuk tapi belum diinspeksi kondisinya.</li>
                </ul>
              </li>
              <li>
                <strong>Pergerakan Terbaru</strong>: 8 catatan ledger paling baru, buat pantau aktivitas sekilas tanpa buka halaman Ledger.
              </li>
              <li>
                <strong>Aksi Cepat</strong>: tombol pintas ke tugas yang sering dipakai (Keluar Manual, Mulai Opname, Lihat Ledger, Simulasi Marketplace).
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
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <strong>Tambah Produk</strong>: isi SKU dan nama, lalu pilih tipe: <em>Reguler</em> untuk produk fisik satuan, <em>Bundle</em> untuk paket gabungan beberapa produk (bundle sendiri tidak punya stok fisik, stoknya dihitung dari komponen penyusunnya).
              </li>
              <li>
                <strong>Barang Masuk (Maklon)</strong>: dipakai setiap kali ada kiriman barang dari pabrik maklon. Isi produk, kode batch (biasanya tertera di kemasan/surat jalan), tanggal kedaluwarsa, dan jumlah.
              </li>
              <li>
                <strong>Input Stok Awal (Opening Balance)</strong>: khusus dipakai sekali di awal pemakaian sistem, untuk mencatat stok yang sudah ada di gudang sebelum sistem ini dipakai. Karena angkanya masih perkiraan, entri ini otomatis ditandai <strong>"belum terverifikasi"</strong> sampai sesi Stok Opname pertama selesai, jadi semua orang tahu angka itu masih perlu dicek ulang fisiknya.
              </li>
              <li>
                <strong>Klik nama produk</strong> di tabel untuk buka detail, di sana ada daftar semua batch produk itu beserta stoknya, dan (khusus produk Bundle) form untuk atur <strong>resep</strong>: produk apa saja dan berapa jumlah yang membentuk 1 bundle. Kalau resep diubah, order lama yang sudah terjadi tidak ikut berubah, hanya order baru yang memakai resep terbaru.
              </li>
              <li>
                Setiap batch bisa dicetak label QR nya lewat halaman <strong>Ledger</strong>, buat ditempel di kardus gudang dan dipakai saat Stok Opname.
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
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Semua pergerakan stok tercatat otomatis di sini, <strong>tidak ada yang perlu diisi manual</strong> di halaman ini sendiri (isinya selalu hasil dari aksi di halaman lain).
              </li>
              <li>
                Tab <strong>Drilldown Produk</strong>: pilih 1 produk untuk lihat seluruh riwayat pergerakan stoknya berurutan waktu, bisa difilter per Tipe Mutasi dan Channel, plus rentang tanggal. Ini jawaban paling lengkap kalau ada yang tanya "kenapa stok produk ini jadi segini".
              </li>
              <li>
                Tombol <strong>Koreksi Entri</strong>: muncul di tiap baris ledger, dipakai khusus untuk kasus <em>salah input admin</em> (misalnya salah ketik jumlah saat mencatat barang keluar manual). Beda dari Stok Opname: ini bukan hasil hitung fisik, tapi reversal cepat begitu operator sadar ada yang salah. Sama seperti aksi lain, ini menulis entri ledger baru (bukan mengedit entri lama), dan melewati layar konfirmasi (menunjukkan produk, entri asli, jumlah koreksi, dan dampaknya ke stok) sebelum tersimpan permanen.
              </li>
              <li>
                Tab <strong>Anomali Harian</strong>: sistem otomatis mengecek konsistensi catatannya sendiri setiap hari (misalnya: pesanan yang dibatalkan tapi stoknya belum kembali, atau saldo batch yang jadi minus). Kalau ada baris di sini, artinya perlu ditelusuri lebih lanjut lewat Drilldown Produk.
              </li>
              <li>
                Tombol <strong>Export CSV</strong>: unduh riwayat ledger produk yang sedang dilihat ke file CSV, kalau perlu diolah lebih lanjut di luar sistem.
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
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Setiap ada retur baru (dari pesanan yang diretur pembeli) atau pembatalan yang terjadi <em>setelah</em> barang dikirim, otomatis muncul di daftar dengan status <strong>"Menunggu Inspeksi"</strong>, badge biru untuk Pembatalan, ungu untuk Retur biasa.
              </li>
              <li>
                Setelah barang fisik sampai dan dicek gudang, klik <strong>Inspeksi</strong> dan tentukan kondisinya:
                <ul className="list-circle pl-5 mt-2 space-y-1">
                  <li><strong>Layak Jual</strong>: barang kembali normal, bisa dijual lagi. Wajib isi tanggal kedaluwarsa (dibaca dari kemasan fisik), karena barang ini dicatat sebagai <strong>batch baru terpisah</strong> (bertanda "RETUR" atau "BATAL"), bukan digabung ke batch asal, supaya alokasi FEFO tetap akurat.</li>
                  <li><strong>Rusak</strong> atau <strong>Hilang</strong>: barang tidak bisa dijual lagi. <strong>Wajib upload foto bukti</strong> sebelum bisa menyelesaikan inspeksi, berlaku untuk retur biasa maupun pembatalan pasca-kirim. Stok TIDAK ditambah lagi untuk kondisi ini (sudah terpotong sejak barang pertama kali dikirim), tapi tetap tercatat sebagai jejak audit.</li>
                </ul>
              </li>
              <li>
                Retur atau pembatalan <strong>sebagian</strong> dari pesanan bundle didukung: kalau pembeli cuma mengembalikan salah satu produk dari isi bundle, itu dihitung per produk satuan, bukan seluruh bundle.
              </li>
              <li>
                Khusus retur dari <strong>TikTok Shop</strong>, ada batas waktu 40 hari (dihitung sejak retur diajukan) untuk klaim ke platform. Lihat halaman Notifikasi untuk daftar yang mendekati batas ini.
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
            <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
              <li>Klik <strong>Buka Sesi Baru</strong>. Sistem mengambil snapshot stok semua batch menurut catatan saat ini.</li>
              <li>
                Untuk tiap kardus/batch yang dihitung fisik: <strong>scan QR</strong> yang tertempel di kardus (klik ikon kamera), atau ketik manual kode batch kalau QR tidak terbaca. Isi jumlah fisik yang benar-benar dihitung.
              </li>
              <li>
                Kalau jumlah fisik <strong>beda</strong> dari catatan sistem, kolom <strong>Alasan Selisih</strong> wajib diisi, pilihannya: <em>rusak</em>, <em>hilang</em>, <em>ketemu ekstra</em>, <em>salah hitung sebelumnya</em>, atau <em>lainnya</em>. Ini yang bikin selisih opname bisa dijelaskan, bukan cuma diketahui angkanya.
              </li>
              <li>Ulangi untuk semua batch. Sesi tetap bisa ditutup walau ada batch yang belum sempat dihitung, sistem akan memberi tahu batch mana saja yang terlewat.</li>
              <li>
                Klik <strong>Tutup Sesi</strong>. Untuk tiap batch yang hasilnya beda dari catatan, otomatis tertulis 1 baris koreksi ke Ledger (movement <em>ADJUSTMENT_OPNAME</em>, bisa dilihat lagi lewat Drilldown Produk). Setelah ditutup, sesi ini <strong>tidak bisa diubah lagi</strong>.
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
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <strong>Buat Pesanan Fiktif</strong>: pilih Channel (Shopee/TikTok Shop) dan jumlah, lalu <strong>Generate Orders</strong>. Pesanan baru berstatus PENDING (belum memotong stok, masih sebatas reservasi).
              </li>
              <li>
                Di daftar pesanan, tiap baris PENDING punya tombol:
                <ul className="list-circle pl-5 mt-2 space-y-1">
                  <li><strong>Ship</strong>: tandai dikirim. Sistem otomatis memilih batch dengan tanggal kedaluwarsa terdekat (FEFO) dan memotong stok saat ini juga.</li>
                  <li><strong>Cancel</strong>: batalkan sebelum dikirim, cukup lepas reservasi, tidak menyentuh ledger sama sekali.</li>
                </ul>
                Setelah SHIPPED, tersedia tombol <strong>Simulate Return</strong> (ajukan retur) atau <strong>Batalkan</strong> (pembatalan setelah kirim, akan masuk ke halaman Retur untuk diinspeksi, sama seperti retur biasa).
              </li>
              <li>
                <strong>Mutasi Keluar Manual</strong>: untuk barang yang keluar gudang di luar pesanan online: <em>penjualan offline, bonus, promo, sample, barang rusak,</em> atau <em>barang kedaluwarsa</em>. Kolom alasan wajib diisi. Khusus alasan <strong>bonus/promo/sample</strong> (sumber selisih terbesar menurut brief), kolom <strong>Referensi Campaign/Approval</strong> juga wajib diisi, supaya kebocoran ini bisa dijelaskan ke siapa & kenapa, bukan cuma tercatat sebagai angka. Sebelum tersimpan, muncul layar konfirmasi yang menunjukkan produk, kuantitas, alasan, dan dampaknya ke stok. Ini satu-satunya titik yang sengaja diberi friksi di seluruh sistem, supaya operator tidak salah klik untuk penulisan yang permanen.
              </li>
              <li>
                <strong>Impor Pesanan Massal (CSV)</strong>: untuk memasukkan banyak pesanan sekaligus dari file. Format header wajib: <code className="bg-muted px-1 py-0.5 rounded text-xs">channel,external_order_id,sku,qty,ordered_at</code>. Satu pesanan dengan banyak produk cukup ditulis sebagai beberapa baris dengan <code className="bg-muted px-1 py-0.5 rounded text-xs">external_order_id</code> yang sama. SKU bundle otomatis dipecah ke komponen satuannya. Pesanan dengan ID yang sama persis dengan yang sudah pernah diimpor otomatis dilewati (tidak dobel).
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
            <CardDescription>Tidak ada yang perlu dilakukan di sini, cukup dicek berkala.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong>Barang Mendekati/Sudah Kedaluwarsa</strong>: daftar batch, diurutkan dari yang paling mendesak.</li>
              <li><strong>Klaim TikTok Menunggu Diajukan</strong>: retur TikTok Shop (rusak/hilang) yang punya batas waktu klaim 40 hari ke platform, sisa hari ditampilkan supaya tidak terlewat.</li>
              <li><strong>Stok Awal Belum Terverifikasi</strong>: daftar entri Opening Balance yang masih menunggu Stok Opname pertama untuk dikonfirmasi akurat.</li>
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
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Muncul otomatis di <strong>Worklist Hari Ini</strong> (Modul 1) dengan prioritas HIGH kalau ada produk yang jumlah pesanan PENDING-nya melebihi stok fisik yang tersedia untuk dialokasikan.
              </li>
              <li>
                Klik untuk dibawa ke halaman Produk, cek stok produk terkait, dan segera tindak lanjuti (misalnya percepat penerimaan barang maklon) sebelum ada pesanan yang gagal dikirim karena stok ternyata tidak cukup.
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
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Tombol matahari/bulan di pojok bawah menu (sebelah tombol Logout) untuk ganti tampilan antara mode gelap dan terang, sesuai kenyamanan mata masing-masing.
              </li>
              <li>Pilihan tema tersimpan otomatis untuk pemakaian berikutnya.</li>
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
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <strong>Scan QR pakai kamera HP</strong> berfungsi langsung dari browser (Chrome di Android/iOS), tidak perlu aplikasi tambahan atau alat scanner khusus.
              </li>
              <li>
                Kalau gudang sudah punya <strong>alat scanner barcode fisik</strong> (yang dicolok USB/Bluetooth), itu juga bisa dipakai, pastikan kursor sedang aktif di kolom "Batch ID" sebelum menembak scan, karena alat itu bekerja seperti mengetik otomatis.
              </li>
              <li>
                Semua halaman menyesuaikan tampilan ke layar sempit (form yang di laptop sejajar berdampingan akan otomatis tersusun ke bawah di HP), termasuk menu navigasi yang berubah jadi tombol menu di pojok kiri atas.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
