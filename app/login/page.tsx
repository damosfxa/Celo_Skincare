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
              placeholder="nama@email.com"
              disabled={isLoading}
              className="border-[#EBD7DF] bg-[#FBF3F6] dark:bg-[#FBF3F6] text-[#3D2A32] placeholder:text-[#B79AA6] focus-visible:ring-[#C7527A]"
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
                className="border-[#EBD7DF] bg-[#FBF3F6] dark:bg-[#FBF3F6] text-[#3D2A32] placeholder:text-[#B79AA6] focus-visible:ring-[#C7527A]"
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
