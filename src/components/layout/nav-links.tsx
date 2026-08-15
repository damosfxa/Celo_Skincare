"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, FileText, Repeat, ScanBarcode, Beaker, Bell, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Tugas Hari Ini", href: "/", icon: LayoutDashboard },
  { name: "Produk & Batch", href: "/products", icon: Package },
  { name: "Ledger", href: "/ledger", icon: FileText },
  { name: "Retur", href: "/returns", icon: Repeat },
  { name: "Stok Opname", href: "/opname", icon: ScanBarcode },
  { name: "Simulasi", href: "/simulation", icon: Beaker },
  { name: "Notifikasi", href: "/notifications", icon: Bell },
  { name: "Panduan", href: "/panduan", icon: BookOpen },
];

// Titik kecil yang nyala begitu Link ini diklik dan halaman tujuannya
// belum selesai dimuat -- tanpa ini, layar diam total tanpa tanda apa pun
// saat operator tap menu, gampang dikira tap tidak kena.
function NavLinkPendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-current transition-opacity",
        pending ? "opacity-70 animate-pulse" : "opacity-0"
      )}
    />
  );
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        // Active if exact match or if it's a sub-route (e.g. /products/123)
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors active:scale-[0.98]",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent active:bg-accent hover:text-accent-foreground text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
            <NavLinkPendingDot />
          </Link>
        );
      })}
    </>
  );
}
