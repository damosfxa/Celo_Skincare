"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * Tombol Logout yang BENERAN menghapus sesi login (signOut), bukan cuma
 * link biasa ke halaman Login. Sebelum ini, tombolnya cuma <Link
 * href="/login"> -- kelihatan seperti berhasil logout, padahal sesi di
 * balik layar masih aktif sama sekali. Setelah middleware.ts ditambah
 * (yang otomatis melempar balik ke dashboard kalau sesi masih aktif), bug
 * ini jadi kelihatan jelas: klik Logout malah nyangkut balik ke dashboard.
 */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error("Gagal logout: " + error.message);
      setIsLoading(false);
      return;
    }

    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      title="Logout"
      className={className ?? "p-2 hover:bg-accent rounded-md text-destructive disabled:opacity-50"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
    </button>
  );
}
