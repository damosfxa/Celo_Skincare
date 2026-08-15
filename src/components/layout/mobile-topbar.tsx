"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu } from "lucide-react";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoutButton } from "@/components/layout/logout-button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function MobileTopbar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
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
      {/* key={pathname} SENGAJA: cara paling pasti supaya drawer ini "lahir
          ulang" (otomatis balik ke kondisi tertutup) tiap kali halaman
          berpindah, tanpa butuh state open/effect manual (yang kena lint
          react-hooks/set-state-in-effect). Pola yang sama sudah dipakai di
          ledger/page.tsx (key={searchParams.toString()}) untuk masalah
          "reset state pas navigasi" yang serupa. */}
      <Sheet key={pathname}>
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
            <div className="truncate flex-1">{userEmail}</div>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
