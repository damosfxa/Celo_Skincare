"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  const isDark = theme === "dark";

  const handleToggle = () => {
    const root = document.documentElement;
    // Nyalakan transisi warna tepat sebelum tema diganti...
    root.classList.add("theme-transition");
    setTheme(isDark ? "light" : "dark");
    // ...lalu matikan lagi setelah transisi selesai (sedikit lebih
    // lama dari 300ms supaya animasi benar-benar tuntas dulu).
    window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 320);
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
