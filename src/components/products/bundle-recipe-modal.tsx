"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Package } from "lucide-react";

import { useProductDetail, useProducts, submitBundleRecipe } from "@/hooks/useProducts";
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
} from "@/components/ui/sheet";

const componentSchema = z.object({
  component_product_id: z.string().min(1, "Produk komponen harus dipilih"),
  qty_per_bundle: z.number().min(1, "Qty minimal 1"),
});

const formSchema = z.object({
  components: z.array(componentSchema).min(1, "Minimal harus ada 1 komponen"),
});

type BundleRecipeModalProps = {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export function BundleRecipeModal({ productId, isOpen, onClose }: BundleRecipeModalProps) {
  const { product, isLoading: isLoadingDetail } = useProductDetail(isOpen ? productId : null);
  const { products, isLoading: isLoadingProducts } = useProducts();
  
  // Filter only non-bundle products for the component dropdown
  const physicalProducts = products.filter(p => !p.is_bundle);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      components: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "components",
  });

  // Populate form with existing recipe if any
  useEffect(() => {
    if (product?.recipe && product.recipe.length > 0) {
      form.reset({
        components: product.recipe.map(r => ({
          component_product_id: r.component_product_id,
          qty_per_bundle: r.qty_per_bundle,
        })),
      });
    } else {
      // Default to one empty row if no recipe exists yet
      form.reset({
        components: [{ component_product_id: "", qty_per_bundle: 1 }],
      });
    }
  }, [product, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!productId) return;
    
    try {
      await submitBundleRecipe(productId, values.components);
      toast.success("Resep bundle berhasil disimpan");
      onClose();
    } catch (error: unknown) {
      const pesan = error instanceof Error ? error.message : "";
      toast.error(pesan || "Gagal menyimpan resep bundle");
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isLoading = isLoadingDetail || isLoadingProducts;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pengaturan Resep Bundle</SheetTitle>
          <SheetDescription>
            Tentukan produk fisik penyusun untuk bundle <strong className="text-foreground">{product?.name || "..."}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Memuat data...</p>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Komponen Penyusun
                  </h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => append({ component_product_id: "", qty_per_bundle: 1 })}
                    disabled={isSubmitting}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Tambah Komponen
                  </Button>
                </div>

                {fields.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground border border-dashed rounded-md text-sm">
                    Belum ada komponen yang ditambahkan.
                  </div>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start p-3 border rounded-md bg-muted/20">
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs text-muted-foreground">Produk</Label>
                      <Select
                        modal={false}
                        disabled={isSubmitting}
                        value={form.watch(`components.${index}.component_product_id`)}
                        onValueChange={(value) => form.setValue(`components.${index}.component_product_id`, value as string, { shouldValidate: true })}
                      >
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Pilih Produk Fisik">
                            {(value: string | null) => {
                              if (!value) return "Pilih Produk Fisik";
                              const p = physicalProducts.find((pr) => pr.id === value);
                              return p ? `${p.sku} - ${p.name}` : value;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {physicalProducts.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.sku} - {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.components?.[index]?.component_product_id && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.components[index]?.component_product_id?.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="w-24 space-y-2">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        className="h-9"
                        disabled={isSubmitting}
                        {...form.register(`components.${index}.qty_per_bundle`, { valueAsNumber: true })}
                      />
                      {form.formState.errors.components?.[index]?.qty_per_bundle && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.components[index]?.qty_per_bundle?.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="pt-6">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {form.formState.errors.components?.root && (
                  <p className="text-sm text-destructive font-medium">
                    {form.formState.errors.components.root.message}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting || fields.length === 0}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Resep
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
