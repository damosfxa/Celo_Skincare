"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const mount = () => setMounted(true);
    mount();
  }, []);
  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  const isDark = theme === "dark";

  const handleToggle = () => {
    const next = isDark ? "light" : "dark";

    // Browser tanpa dukungan View Transitions: ganti biasa, tanpa animasi.
    if (
      typeof document === "undefined" ||
      !("startViewTransition" in document)
    ) {
      setTheme(next);
      return;
    }

    // Snapshot instan + crossfade satu lapisan. flushSync wajib supaya
    // perubahan tema benar-benar diterapkan ke DOM di dalam callback ini,
    // jadi browser menangkap state "sesudah" dengan tepat.
    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(next);
      });
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      title={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
