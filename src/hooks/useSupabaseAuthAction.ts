"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthActionResult = { error: { message: string } | null };

/**
 * Pola berulang buat aksi auth Supabase (login, logout): jalankan aksi,
 * urus status loading, pindah halaman + refresh kalau berhasil. Dibungkus
 * try/catch/finally supaya kalau aksinya melempar error (bukan cuma
 * balikin {error}), loading tetap balik ke false -- tidak macet permanen.
 *
 * Pesan sukses/gagal SENGAJA diserahkan ke pemanggil lewat onError/
 * onSuccess, bukan dipaksa format seragam -- tiap halaman butuh pesan yang
 * beda (Login pakai toast sukses + pesan error polos, Logout pakai prefix
 * "Gagal logout:" tanpa toast sukses karena keburu pindah halaman).
 */
export function useSupabaseAuthAction() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const run = async (
    action: () => Promise<AuthActionResult>,
    options: {
      successPath: string;
      onError: (message: string) => void;
      onSuccess?: () => void;
    }
  ) => {
    setIsLoading(true);
    try {
      const { error } = await action();
      if (error) {
        options.onError(error.message);
        return;
      }
      options.onSuccess?.();
      router.push(options.successPath);
      router.refresh();
    } catch (err) {
      options.onError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, run };
}
