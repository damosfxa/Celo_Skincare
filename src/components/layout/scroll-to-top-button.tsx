"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Tombol melayang buat balik ke paling atas halaman secara halus. Cuma
 * muncul kalau sudah scroll cukup jauh ke bawah. Nempel ke area konten yang
 * beneran scroll (#main-scroll-area, dipasang di layout dashboard) -- bukan
 * window -- karena layout ini scroll-nya di dalam panel sendiri, bukan di
 * seluruh halaman.
 */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollArea = document.getElementById("main-scroll-area");
    if (!scrollArea) return;

    const handleScroll = () => {
      setVisible(scrollArea.scrollTop > 400);
    };
    handleScroll();
    scrollArea.addEventListener("scroll", handleScroll);
    return () => scrollArea.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    document.getElementById("main-scroll-area")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Kembali ke atas"
      title="Kembali ke atas"
      className="fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
