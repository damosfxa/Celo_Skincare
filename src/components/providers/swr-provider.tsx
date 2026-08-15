"use client";

import { SWRConfig } from "swr";

// revalidateOnFocus DIMATIKAN secara sengaja di sini. Defaultnya SWR (true)
// bikin SEMUA hook fetch ulang tiap kali tab/app dapat fokus lagi -- di
// aplikasi ini itu kejadian tiap kali operator balik dari kamera HP (scan
// QR, foto bukti retur), dan kalau internet gudang lagi lambat, muncul
// "kedip reload" data yang lagi dilihat pas mau lanjut kerja. Refresh yang
// benar-benar perlu setelah aksi (submit, ship, dll) tetap jalan lewat
// mutate() manual yang sudah dipakai tiap hook, jadi tidak kehilangan
// update penting -- cuma refresh "asal-asalan tiap dapat fokus" yang
// dimatikan.
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}
