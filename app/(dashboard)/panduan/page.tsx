import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Box, FileText, Repeat, ScanBarcode, Beaker, Bell, CheckCircle2 } from "lucide-react";

export default function PanduanPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Panduan Penggunaan</h2>
        <p className="text-muted-foreground mt-1">
          Dokumentasi lengkap cara menggunakan sistem rekonsiliasi stok.
        </p>
      </div>

      <Card className="border-primary/50 shadow-sm bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <CheckCircle2 className="h-6 w-6" />
            Selamat Datang
          </CardTitle>
          <CardDescription className="text-base text-foreground mt-2">
            Panduan ini menjelaskan cara menggunakan tiap modul sistem rekonsiliasi stok. <strong>Prinsip utama:</strong> setiap pergerakan stok harus tercatat lewat sistem, bukan diubah manual di database, supaya selalu bisa ditelusuri.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Modul 1: Produk & Batch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-emerald-500" />
              1. Produk & Batch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Tambah produk baru pakai tombol <strong>"Tambah Produk"</strong>. Pilih tipe: <em>"Reguler"</em> untuk produk fisik biasa, <em>"Bundle"</em> untuk paket gabungan beberapa produk.
              </li>
              <li>
                Kalau produk baru barang fisik datang dari maklon, catat lewat <strong>"Barang Masuk (Maklon)"</strong>. Isi produk, kode batch, tanggal kedaluwarsa, dan jumlahnya.
              </li>
              <li>
                Klik nama produk di tabel untuk lihat detail dan (khusus produk Bundle) atur resep komposisinya.
              </li>
              <li>
                Setiap batch bisa dicetak label QR-nya lewat halaman <strong>Ledger</strong>, buat ditempel di kardus gudang.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 2: Ledger & Rekonsiliasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              2. Ledger & Rekonsiliasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Ini "buku besar" tempat semua pergerakan stok tercatat otomatis. <strong>Gak perlu diisi manual</strong>.
              </li>
              <li>
                Pilih produk di tab <strong>"Drilldown Produk"</strong> untuk lihat riwayat lengkap kenapa stok produk itu jadi sekian.
              </li>
              <li>
                Tab <strong>"Anomali Harian"</strong> otomatis ngecek kejanggalan sistem tiap hari. Kalau ada tanda ⚠️, perlu ditelusuri.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 3: Retur */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-purple-500" />
              3. Retur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Setiap ada barang retur dari pesanan, akan muncul di daftar <strong>"Menunggu Inspeksi"</strong>.
              </li>
              <li>
                Setelah barang fisik dicek, klik <strong>"Inspeksi"</strong> dan tentukan kondisinya:
                <ul className="list-circle pl-5 mt-2 space-y-1">
                  <li><strong>Layak Jual</strong> → stok otomatis balik nambah</li>
                  <li><strong>Rusak/Hilang</strong> → wajib upload foto bukti, stok TIDAK ditambah lagi (karena sudah kepotong pas awal kirim)</li>
                </ul>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 4: Stok Opname */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-amber-500" />
              4. Stok Opname
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Buka sesi baru pas mau hitung stok fisik gudang.
              </li>
              <li>
                Scan QR di kardus (atau ketik manual kode batch), lalu isi jumlah fisik yang dihitung.
              </li>
              <li>
                Kalau semua sudah dihitung, klik <strong>"Tutup Sesi"</strong>. Sistem otomatis catat selisihnya ke Ledger.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 5: Simulasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-orange-500" />
              5. Simulasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Karena belum connect ke Shopee/TikTok asli, gunakan tombol-tombol ini buat mensimulasikan pesanan:
                <ul className="list-circle pl-5 mt-2 space-y-1">
                  <li><strong>"Generate Orders"</strong> → bikin pesanan baru</li>
                  <li><strong>"Ship"</strong> → tandai dikirim (barang otomatis kepotong dari stok)</li>
                  <li><strong>"Simulate Return"</strong> → ajukan retur</li>
                </ul>
              </li>
              <li>
                <strong>"Impor CSV"</strong> untuk masukin banyak pesanan sekaligus dari file.
              </li>
              <li>
                <strong>"Mutasi Keluar Manual"</strong> untuk catat barang keluar di luar pesanan (bonus, promo, sample, rusak, kedaluwarsa). <strong>WAJIB</strong> isi alasan.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modul 6: Notifikasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-red-500" />
              6. Notifikasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Otomatis muncul peringatan kalau ada batch <strong>mendekati kedaluwarsa</strong>.
              </li>
              <li>
                Akan muncul juga jika ada <strong>klaim TikTok</strong> (barang retur rusak/hilang) yang belum diajukan sebelum batas waktu 40 hari.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
