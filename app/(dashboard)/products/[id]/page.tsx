"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ArrowLeft, Layers, Loader2, Package, Plus, Trash2, Save, Pencil } from "lucide-react";

import { useProducts, useProductDetail, submitBundleRecipe, updateProduct, deleteProduct } from "@/hooks/useProducts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const componentSchema = z.object({
  component_product_id: z.string().min(1, "Produk komponen harus dipilih"),
  qty_per_bundle: z.number().min(1, "Qty minimal 1"),
});

const recipeSchema = z.object({
  components: z.array(componentSchema).min(1, "Minimal harus ada 1 komponen untuk bundle"),
});

type RecipeFormValues = z.infer<typeof recipeSchema>;

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const { product, isLoading, isError, mutate } = useProductDetail(productId);
  const { products: allProducts } = useProducts();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editSku, setEditSku] = useState("");
  const [editName, setEditName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Form for bundle recipe
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      components: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "components",
  });

  // Load existing recipe into form when product data is available
  useEffect(() => {
    if (product && product.is_bundle) {
      if (product.recipe && product.recipe.length > 0) {
        form.reset({
          components: product.recipe.map(r => ({
            component_product_id: r.component_product_id,
            qty_per_bundle: r.qty_per_bundle,
          }))
        });
      } else {
        // Ensure at least one empty row if no recipe exists
        if (fields.length === 0) {
          form.reset({
            components: [{ component_product_id: "", qty_per_bundle: 1 }]
          });
        }
      }
    }
  }, [product, form]);

  const onSubmit = async (values: RecipeFormValues) => {
    setIsSubmitting(true);
    try {
      await submitBundleRecipe(productId, values.components);
      toast.success("Resep bundle berhasil disimpan!");
      mutate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editSku || !editName) {
      toast.error("SKU dan Nama Produk harus diisi");
      return;
    }
    setIsUpdating(true);
    try {
      await updateProduct(productId, editSku, editName);
      toast.success("Produk berhasil diperbarui!");
      setIsEditDialogOpen(false);
      mutate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdating(false);
    }
  };



  const nonBundleProducts = allProducts?.filter(p => !p.is_bundle) || [];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto mt-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="text-center p-12 border rounded-md bg-destructive/10 text-destructive">
        Produk tidak ditemukan atau terjadi kesalahan.
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/products")}>Kembali ke Daftar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => router.push("/products")}
            className="h-10 w-10 shrink-0"
            title="Kembali ke Daftar Produk"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Detail Produk</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground font-mono text-sm">{product.sku}</p>
              {product.is_bundle ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary uppercase">
                  <Layers className="h-3 w-3" /> Bundle
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground uppercase">
                  <Package className="h-3 w-3" /> Fisik
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary/20 shadow-sm bg-card/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <CardTitle>Informasi Dasar</CardTitle>
            <div className="flex flex-col gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  setEditSku(product?.sku || "");
                  setEditName(product?.name || "");
                  setIsEditDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Produk</DialogTitle>
                    <DialogDescription>
                      Ubah informasi SKU atau Nama Produk.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input 
                        id="sku" 
                        value={editSku} 
                        onChange={(e) => setEditSku(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nama Produk</Label>
                      <Input 
                        id="name" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>Batal</Button>
                    <Button onClick={handleUpdate} disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Simpan Perubahan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={product.batches && product.batches.length > 0}
                title={product.batches && product.batches.length > 0 ? "Produk sudah punya riwayat batch, tidak bisa dihapus" : "Hapus Produk"}
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>

              <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Hapus Produk</DialogTitle>
                    <DialogDescription>
                      Hapus produk ini? Tindakan ini tidak bisa dibatalkan.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isDeleting}>
                      Batal
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={async () => {
                        setIsDeleteConfirmOpen(false);
                        setIsDeleting(true);
                        try {
                          await deleteProduct(productId);
                          toast.success("Produk berhasil dihapus!");
                          router.push("/products");
                        } catch (error: unknown) {
                          toast.error(error instanceof Error ? error.message : String(error));
                          setIsDeleting(false);
                        }
                      }}
                    >
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Ya, Hapus
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nama Produk</p>
              <p className="text-lg font-semibold">{product.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">SKU</p>
              <p className="font-mono">{product.sku}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tipe Produk</p>
              <p>{product.is_bundle ? "Bundle (Gabungan)" : "Produk Fisik (Tunggal)"}</p>
            </div>
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm font-medium text-muted-foreground">Total Stok (Tersedia)</p>
              <p className="text-3xl font-bold text-primary">{product.batches?.reduce((sum, b) => sum + b.current_qty, 0).toLocaleString("id-ID") || 0} <span className="text-lg font-normal text-muted-foreground">pcs</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Daftar Batch & Stok</CardTitle>
            <CardDescription>
              Rincian stok produk ini di setiap batch yang ada di sistem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!product.batches || product.batches.length === 0 ? (
              <div className="text-center p-6 border border-dashed rounded-md text-muted-foreground">
                Belum ada data batch untuk produk ini.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode Batch</TableHead>
                      <TableHead>Expired Date</TableHead>
                      <TableHead className="text-right">Stok (Current Qty)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono text-sm font-medium">{batch.batch_code}</TableCell>
                        <TableCell className="text-muted-foreground">{batch.expiry_date || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {batch.current_qty.toLocaleString("id-ID")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {product.is_bundle && (
        <Card className="border-primary/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Resep Bundle
            </CardTitle>
            <CardDescription>
              Atur komposisi produk fisik yang akan otomatis dipotong stoknya ketika bundle ini terjual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end p-4 border rounded-md bg-muted/20">
                    <div className="flex-1 space-y-2 w-full">
                      <Label htmlFor={`components.${index}.component_product_id`}>Produk Komponen</Label>
                      <Select
                        disabled={isSubmitting}
                        value={form.watch(`components.${index}.component_product_id`)}
                        onValueChange={(value) => form.setValue(`components.${index}.component_product_id`, value as string, { shouldValidate: true })}
                      >
                        <SelectTrigger className="w-full bg-background" id={`components.${index}.component_product_id`}>
                          <SelectValue placeholder="Pilih produk...">
                            {(value: string | null) => {
                              if (!value) return "Pilih produk...";
                              const p = nonBundleProducts.find((pr) => pr.id === value);
                              return p ? `${p.sku} - ${p.name}` : value;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {nonBundleProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.sku} - {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.components?.[index]?.component_product_id && (
                        <p className="text-sm font-medium text-destructive">
                          {form.formState.errors.components[index]?.component_product_id?.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="w-full sm:w-32 space-y-2">
                      <Label htmlFor={`components.${index}.qty_per_bundle`}>Qty per Bundle</Label>
                      <Input
                        id={`components.${index}.qty_per_bundle`}
                        type="number"
                        min="1"
                        disabled={isSubmitting}
                        {...form.register(`components.${index}.qty_per_bundle` as const, { valueAsNumber: true })}
                      />
                      {form.formState.errors.components?.[index]?.qty_per_bundle && (
                        <p className="text-sm font-medium text-destructive">
                          {form.formState.errors.components[index]?.qty_per_bundle?.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)}
                      disabled={isSubmitting || fields.length === 1}
                      title="Hapus baris"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {form.formState.errors.components?.root && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.components.root.message}
                </p>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ component_product_id: "", qty_per_bundle: 1 })}
                  disabled={isSubmitting}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Komponen
                </Button>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan Resep Bundle
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}