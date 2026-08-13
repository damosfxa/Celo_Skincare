import { redirect } from "next/navigation";
import Image from "next/image";
import { Menu } from "lucide-react";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoutButton } from "@/components/layout/logout-button";
import { ScrollResetOnNavigate } from "@/components/layout/scroll-reset-on-navigate";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // Pengecekan utama (yang bener-bener nanya ke server Supabase) sudah
  // dilakukan di middleware.ts untuk SETIAP pindah halaman, dan cookie
  // sesinya sudah disegarkan di sana. Di sini cukup baca data sesi yang
  // sudah tersimpan (tanpa nanya ulang ke server), jadi tidak dobel network
  // call tiap pindah halaman -- ini akar dari keluhan "delay pindah
  // halaman". Redirect di bawah tetap dijaga sebagai jaring pengaman kedua.
  //
  // PENTING (ditemukan lewat code review): getSession() di sini TIDAK
  // memvalidasi ulang ke server -- dia cuma baca cookie yang ada, murni
  // percaya. Ini aman HANYA karena middleware.ts (config.matcher di
  // middleware.ts) dijamin selalu jalan lebih dulu untuk SEMUA route di
  // folder (dashboard) ini. Kalau nanti matcher middleware.ts diubah dan
  // ada halaman dashboard yang jadi kelewat, layout ini kehilangan
  // pemeriksaan yang beneran valid. Jangan ubah matcher di middleware.ts
  // tanpa mastiin folder (dashboard) tetap 100% tercakup.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }



  return (
    // h-screen (bukan min-h-screen) SENGAJA: ini yang bikin area konten
    // kanan (#main-scroll-area) beneran jadi kotak scroll sendiri yang
    // terbatas persis 1 layar, bukan ikut memanjang mengikuti konten.
    // Tanpa ini, min-h-0 di <main> di bawah jadi tidak berefek apa-apa
    // (baris tinggi tanpa batas atas), makanya sidebar kiri gagal nempel
    // pas discroll & tombol "kembali ke atas" tidak pernah muncul (dia
    // memantau scroll di dalam kotak ini, yang kalau tidak dibatasi tidak
    // akan pernah benar-benar discroll).
    <div className="flex h-screen flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="flex md:hidden h-16 items-center px-4 border-b bg-card justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white overflow-hidden shrink-0">
            <Image
              src="/logo-celo-beaute.jpg"
              alt="Celo Beaute"
              width={32}
              height={32}
              className="rounded-md object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight">Celo Beaute</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Rekonsiliasi Stok</span>
          </div>
        </div>
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="h-16 flex items-center px-6 border-b gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white overflow-hidden shrink-0">
                <Image
                  src="/logo-celo-beaute.jpg"
                  alt="Celo Beaute"
                  width={32}
                  height={32}
                  className="rounded-md object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight">Celo Beaute</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Rekonsiliasi Stok</span>
              </div>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2">
              <NavLinks />
            </nav>
            <div className="p-4 border-t text-sm text-muted-foreground flex items-center gap-2 mt-auto">
              <div className="truncate flex-1">{user.email}</div>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r bg-card flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white overflow-hidden shrink-0">
            <Image
              src="/logo-celo-beaute.jpg"
              alt="Celo Beaute"
              width={32}
              height={32}
              className="rounded-md object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight">Celo Beaute</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Rekonsiliasi Stok</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavLinks />
        </nav>
        <div className="p-4 border-t text-sm text-muted-foreground flex items-center gap-2">
          <div className="truncate flex-1">{user.email}</div>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <div id="main-scroll-area" className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 md:p-6">
          <ScrollResetOnNavigate />
          {children}
        </div>
      </main>
    </div>
  );
}
