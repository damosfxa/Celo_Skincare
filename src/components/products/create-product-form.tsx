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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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
  sku: z.string().min(1, "SKU wajib diisi"),
  name: z.string().min(1, "Nama produk wajib diisi"),
  is_bundle: z.enum(["false", "true"]),
});

export function CreateProductForm() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { mutate } = useProducts();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      name: "",
      is_bundle: "false",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku: values.sku,
          name: values.name,
          is_bundle: values.is_bundle === "true",
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || "Gagal membuat produk");
      }

      toast.success("Produk berhasil dibuat");
      form.reset();
      setOpen(false);
      mutate(); // Refresh tabel produk
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="w-full lg:w-auto" />}>Tambah Produk</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tambah Produk Baru</SheetTitle>
          <SheetDescription>
            Masukkan detail produk baru ke dalam sistem.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                placeholder="Misal: SRM-VITC-30ML"
                disabled={isLoading}
                {...form.register("sku")}
              />
              {form.formState.errors.sku && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.sku.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Produk</Label>
              <Input
                id="name"
                placeholder="Misal: Serum Vitamin C 30ml"
                disabled={isLoading}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_bundle">Tipe Produk</Label>
              <Select
                modal={false}
                disabled={isLoading}
                value={form.watch("is_bundle")}
                onValueChange={(value) => form.setValue("is_bundle", value as "false" | "true", { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Tipe Produk">
                    {(value: string | null) =>
                      value === "true" ? "Bundle (Paket)" : value === "false" ? "Reguler (Fisik)" : "Pilih Tipe Produk"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Reguler (Fisik)</SelectItem>
                  <SelectItem value="true">Bundle (Paket)</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.is_bundle && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.is_bundle.message}
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
                "Simpan Produk"
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
