"use client";

import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuthAction } from "@/hooks/useSupabaseAuthAction";
import { toast } from "sonner";

/**
 * Tombol Logout yang BENERAN menghapus sesi login (signOut), bukan cuma
 * link biasa ke halaman Login. Sebelum ini, tombolnya cuma <Link
 * href="/login"> -- kelihatan seperti berhasil logout, padahal sesi di
 * balik layar masih aktif sama sekali. Setelah middleware ditambah
 * (yang otomatis melempar balik ke dashboard kalau sesi masih aktif), bug
 * ini jadi kelihatan jelas: klik Logout malah nyangkut balik ke dashboard.
 *
 * Pola loading/error/navigasinya dipakai bareng app/login/page.tsx lewat
 * useSupabaseAuthAction (src/hooks/), supaya perbaikan seperti try/catch
 * ini cukup ditulis 1x, bukan 2x di 2 file.
 */
export function LogoutButton({ className }: { className?: string }) {
  const { isLoading, run } = useSupabaseAuthAction();

  const handleLogout = () => {
    const supabase = createClient();
    run(() => supabase.auth.signOut(), {
      successPath: "/login",
      onError: (message) => toast.error("Gagal logout: " + message),
    });
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
