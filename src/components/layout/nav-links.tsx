"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, FileText, Repeat, ScanBarcode, Beaker, Bell, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Produk & Batch", href: "/products", icon: Package },
  { name: "Ledger", href: "/ledger", icon: FileText },
  { name: "Retur", href: "/returns", icon: Repeat },
  { name: "Stok Opname", href: "/opname", icon: ScanBarcode },
  { name: "Simulasi", href: "/simulation", icon: Beaker },
  { name: "Notifikasi", href: "/notifications", icon: Bell },
  { name: "Panduan", href: "/panduan", icon: BookOpen },
];

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
              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              isActive 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </>
  );
}
