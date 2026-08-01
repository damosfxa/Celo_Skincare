"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useProducts } from "@/hooks/useProducts";

const formSchema = z.object({
  product_id: z.string().min(1, "Produk wajib dipilih"),
  batch_code: z.string().min(1, "Kode batch wajib diisi"),
  expiry_date: z.string().min(1, "Tanggal kedaluwarsa wajib diisi"),
  qty: z.number({ message: "Harus berupa angka" }).min(1, "Kuantitas minimal 1"),
});

export function OpeningBalanceForm() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { products, mutate } = useProducts();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: "",
      batch_code: "",
      expiry_date: "",
      qty: 0,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const res = await fetch("/api/batches/opening-balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: values.product_id,
          batch_code: values.batch_code,
          expiry_date: values.expiry_date,
          qty: values.qty,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || "Gagal mencatat stok awal");
      }

      toast.success("Stok awal berhasil dicatat (Belum Terverifikasi)");
      form.reset();
      setOpen(false);
      mutate(); // Refresh tabel produk
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter produk yang bukan bundle
  const regularProducts = products.filter(p => !p.is_bundle);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" />}>Input Stok Awal (Opening Balance)</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Input Stok Awal (Opening Balance)</SheetTitle>
          <SheetDescription>
            Gunakan ini khusus untuk mencatat stok awal yang masih perkiraan saat sistem pertama kali dipakai. Stok ini akan ditandai "Belum Terverifikasi" sampai dihitung ulang lewat Stok Opname.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="product_id">Produk</Label>
              <select
                id="product_id"
                disabled={isLoading}
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register("product_id")}
              >
                <option value="" className="bg-background text-muted-foreground">-- Pilih Produk --</option>
                {regularProducts.map(p => (
                  <option key={p.id} value={p.id} className="bg-background">
                    {p.sku} - {p.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.product_id && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.product_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch_code">Kode Batch</Label>
              <Input
                id="batch_code"
                placeholder="Misal: OB-2026-001"
                disabled={isLoading}
                {...form.register("batch_code")}
              />
              {form.formState.errors.batch_code && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.batch_code.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry_date">Tanggal Kedaluwarsa</Label>
              <Input
                id="expiry_date"
                type="date"
                disabled={isLoading}
                {...form.register("expiry_date")}
              />
              {form.formState.errors.expiry_date && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.expiry_date.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qty">Kuantitas</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                placeholder="0"
                disabled={isLoading}
                {...form.register("qty", { valueAsNumber: true })}
              />
              {form.formState.errors.qty && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.qty.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Catat Stok Awal"
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
