# Workflow, Alur Proses Bisnis Utama

Dokumen ini menjelaskan alur bisnis inti sistem lewat diagram. Untuk detail teknis (schema, API), lihat `database-schema.md` dan `README.md`.

## Flow 1: Kapan Stok Benar-Benar Berkurang

Prinsip dari brief: order masuk hanyalah **reservasi**, bukan pergerakan stok. Stok baru benar-benar terpotong saat barang secara fisik meninggalkan gudang. Titik ini beda tiap channel (Shopee saat `SHIPPED`, TikTok saat `IN_TRANSIT`).

```mermaid
flowchart TD
    A["Order masuk (Shopee/TikTok)<br/>Reservasi, belum ledger"] --> B{Apa yang terjadi?}
    B -->|Batal sebelum shipped| C["Tidak ada stock movement<br/>Status: CANCELLED"]
    B -->|Shipped / in_transit| D["Alokasi FEFO otomatis<br/>Ledger: OUT_SALE_MARKETPLACE"]
```

**Kenapa dibedakan begini:** kalau order batal sebelum shipped, stok memang belum pernah tersentuh, jadi tidak ada apa pun yang perlu "dikembalikan" ke ledger. Ini mencegah bug klasik: menulis ledger keluar untuk reservasi yang batal, lalu bingung kenapa stok kurang padahal barang tidak pernah keluar gudang.

## Flow 2: Retur, Kondisi Barang

Kondisi retur diputuskan manual oleh gudang setelah barang fisik diinspeksi, bukan otomatis dari marketplace, karena hanya gudang yang bisa memastikan kondisi barang yang benar-benar diterima.

```mermaid
flowchart TD
    A["Retur masuk<br/>Kondisi diinspeksi gudang"] --> B{Kondisi barang?}
    B -->|Layak jual| C["Ledger: IN_RETURN_SELLABLE<br/>Stok bertambah kembali"]
    B -->|Rusak / hilang| D["Tanpa ledger baru<br/>Foto bukti WAJIB diupload"]
```

**Kenapa kondisi Rusak/Hilang tidak menulis ledger baru:** stok untuk barang ini sudah terpotong sejak awal pengiriman (lihat Flow 1). Menulis ledger keluar lagi di titik ini akan menghitung barang yang sama dua kali sebagai kerugian (*double-count*). Foto wajib berfungsi sebagai bukti audit: kenapa barang ini tidak kembali ke stok jual.

## Flow 3: Stok Opname (Rekonsiliasi Fisik)

```mermaid
flowchart TD
    A["Buka sesi opname<br/>Snapshot system_qty semua batch"] --> B["Scan QR / input manual tiap batch<br/>Isi physical_qty hasil hitung"]
    B --> C{Semua batch sudah dihitung?}
    C -->|Belum, tutup sesi juga boleh| D["Tutup sesi<br/>Batch belum dihitung ditandai terpisah"]
    C -->|Sudah semua| E["Tutup sesi"]
    D --> F{Ada selisih system_qty vs physical_qty?}
    E --> F
    F -->|Ya| G["Ledger: ADJUSTMENT_OPNAME<br/>qty_delta = selisih"]
    F -->|Tidak| H["Tidak ada ledger baru<br/>Stok sudah sesuai catatan"]
```

**Kenapa sesi tetap bisa ditutup walau ada batch belum dihitung:** operasional gudang sering tidak sempat menghitung 100% batch dalam satu sesi. Sistem tidak memaksa, batch yang belum dihitung tetap tercatat statusnya (bukan diam-diam diabaikan), sehingga terlihat jelas mana yang perlu opname susulan.