# Desain ulang halaman login: Opsi C (blush terang, elegan)

**Untuk:** Gemini (Antigravity)
**Dibuat:** 2026-08-06 oleh Claude Code. Pemilik project sudah memilih arah desain "Opsi C" dari mockup perbandingan.

Jangan ubah logika login/autentikasi sama sekali. Yang berubah HANYA tampilan (wrapper + styling + logo). Form schema, `useForm`, `onSubmit`, `signInWithPassword`, validasi, toggle show/hide password, dan state loading harus tetap persis seperti sekarang.

---

## Arah desain yang dipilih

Latar pink blush lembut (seperti warna asli logo), kartu putih bersih di tengah, kesan skincare yang anggun. Logo asli Celo Beaute di atas kartu, nama brand tipis ber-spasi, tombol rose.

## Keputusan penting: login sengaja SELALU terang, tidak ikut tema gelap

Aplikasi default-nya gelap, tapi halaman login ini sengaja dibuat committed ke tampilan blush terang (tidak ikut mode gelap). Alasannya: (1) tombol ganti tema memang tidak ada di halaman login, cuma di dashboard; (2) pemilik project memilih tampilan terang ini sebagai "wajah" brand sebelum masuk sistem. Karena `<html>` punya class `.dark` global (dari next-themes defaultTheme dark), komponen shadcn `Input` akan mewarisi token gelap, jadi **warna input WAJIB di-override eksplisit** ke terang (sudah ada di kode di bawah), jangan biarkan pakai token tema.

## Logo

Pakai file asli yang sudah ada: `public/logo-celo-beaute.jpg`. Tampilkan lewat `next/image` sebagai lingkaran (`rounded-full`), sama pendekatan seperti di sidebar. Logo aslinya berlatar pink, jadi bentuk lingkaran justru pas dengan estetika blush ini.

---

## Kode utuh, ganti seluruh isi `app/login/page.tsx` dengan ini

Semua bagian logika (baris `formSchema`, `useForm`, `onSubmit`, `register`, error, `isLoading`, `showPassword`) sama persis dengan versi sekarang, cuma JSX + styling yang diganti dan `next/image` ditambahkan.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import Image from "next/image";
import { Loader2, Eye, EyeOff } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  email: z.string().email({ message: "Format email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
});

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const supabase = createClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    toast.success("Login berhasil");
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "linear-gradient(170deg, #FBEAF0 0%, #F6DBE5 100%)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-8"
        style={{ boxShadow: "0 20px 50px rgba(150, 70, 100, 0.16)" }}
      >
        {/* Brand */}
        <div className="mb-7 flex flex-col items-center gap-3">
          <Image
            src="/logo-celo-beaute.jpg"
            alt="Celo Beaute"
            width={64}
            height={64}
            className="rounded-full object-cover"
            priority
          />
          <div
            className="text-sm font-light uppercase"
            style={{ letterSpacing: "0.32em", paddingLeft: "0.32em", color: "#6E2942" }}
          >
            Celo Beaute
          </div>
          <div style={{ width: 40, height: 1, background: "#E7C6D3" }} />
          <p className="text-center text-xs" style={{ color: "#9A7E88" }}>
            Sistem rekonsiliasi stok
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" style={{ color: "#6B5860" }}>
              Email
            </Label>
            <Input
              id="email"
              placeholder="admin@celobeaute.com"
              disabled={isLoading}
              className="border-[#EBD7DF] bg-[#FBF3F6] text-[#3D2A32] placeholder:text-[#B79AA6] focus-visible:ring-[#C7527A]"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm font-medium" style={{ color: "#C2334D" }}>
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" style={{ color: "#6B5860" }}>
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                disabled={isLoading}
                className="border-[#EBD7DF] bg-[#FBF3F6] text-[#3D2A32] placeholder:text-[#B79AA6] focus-visible:ring-[#C7527A]"
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 text-[#9A7E88] hover:bg-transparent hover:text-[#6E2942]"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? "Sembunyikan password" : "Tampilkan password"}
                </span>
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm font-medium" style={{ color: "#C2334D" }}>
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full border-0 text-white hover:opacity-90"
            style={{ background: "#C7527A" }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

---

## Catatan implementasi

- `CardTitle`/`CardDescription`/`Card...` yang lama tidak dipakai lagi di sini (diganti div biasa supaya bebas mengatur warna terang), jadi import-nya dihapus. Pastikan tidak ada import yang tidak terpakai (biar tidak nambah warning lint).
- Warna brand kunci: latar `#FBEAF0`→`#F6DBE5`, kartu putih, wordmark `#6E2942`, tombol `#C7527A`, input `#FBF3F6` border `#EBD7DF`. Kalau mau disetel lebih terang/gelap tinggal ubah hex-nya.
- Logo dipakai `rounded-full` ukuran 64px. Kalau ternyata logo aslinya kurang pas dibulatkan (misal ada teks "CELO" yang kepotong di lingkaran), boleh diganti `rounded-2xl` (kotak sudut tumpul) sebagai alternatif, cek mana yang paling rapi.

## Setelah selesai

```
npm run lint
```

```
npm run build
```

```
npm test
```

Laporkan hasil sebenarnya. Untuk halaman login ini, cukup dicek visualnya sekilas (ini bukan alur data penting, dan logikanya tidak disentuh), tapi tetap pastikan: (1) bisa login beneran dengan kredensial yang benar, (2) pesan error muncul kalau email/password salah format, (3) tombol mata show/hide password jalan.
