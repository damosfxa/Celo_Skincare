import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }



  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="flex md:hidden h-16 items-center px-4 border-b bg-card justify-between sticky top-0 z-20">
        <div className="font-semibold text-lg">Rekonsiliasi Stok</div>
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="h-16 flex items-center px-6 border-b font-semibold text-lg">
              Rekonsiliasi Stok
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2">
              <NavLinks />
            </nav>
            <div className="p-4 border-t text-sm text-muted-foreground flex items-center gap-2 mt-auto">
              <div className="truncate flex-1">{user.email}</div>
              <ThemeToggle />
              <Link href="/login" className="p-2 hover:bg-accent rounded-md text-destructive" title="Logout">
                <LogOut className="h-4 w-4" />
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r bg-card flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b font-semibold text-lg">
          Rekonsiliasi Stok
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavLinks />
        </nav>
        <div className="p-4 border-t text-sm text-muted-foreground flex items-center gap-2">
          <div className="truncate flex-1">{user.email}</div>
          <ThemeToggle />
          <Link href="/login" className="p-2 hover:bg-accent rounded-md text-destructive" title="Logout">
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto bg-background p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
