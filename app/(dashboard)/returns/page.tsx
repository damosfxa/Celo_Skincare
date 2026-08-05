"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useReturns, inspectReturn, ReturnItem } from "@/hooks/useReturns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Box, Eye, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const inspectSchema = z.object({
  condition: z.enum(["SELLABLE", "DAMAGED", "LOST"]),
  photo_url: z.string().optional(),
  expiry_date: z.string().optional(),
  type: z.string().optional(),
}).refine((data) => {
  if ((data.condition === "DAMAGED" || data.condition === "LOST") && !data.photo_url) {
    return false;
  }
  return true;
}, {
  message: "URL Foto wajib diisi untuk kondisi Rusak/Hilang",
  path: ["photo_url"],
}).refine((data) => {
  if (data.condition === "SELLABLE" && !data.expiry_date) {
    return false;
  }
  return true;
}, {
  message: "Tanggal kedaluwarsa wajib diisi untuk kondisi layak jual",
  path: ["expiry_date"],
});

export default function ReturnsPage() {
  const { returns, isLoading, isError, mutate } = useReturns();
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof inspectSchema>>({
    resolver: zodResolver(inspectSchema),
    defaultValues: {
      condition: "SELLABLE",
      photo_url: "",
      expiry_date: "",
      type: "RETURN",
    },
  });

  const condition = form.watch("condition");

  const supabase = createClient();
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedReturn) return;
    
    const file = e.target.files[0];
    setIsUploading(true);
    
    try {
      // Membersihkan nama file dari karakter aneh
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${selectedReturn.id}/${Date.now()}-${cleanFileName}`;
      
      const { data, error } = await supabase.storage
        .from('return-photos')
        .upload(fileName, file);
        
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('return-photos')
        .getPublicUrl(data.path);
        
      form.setValue("photo_url", urlData.publicUrl);
      setPhotoPreview(urlData.publicUrl);
      toast.success("Foto berhasil diunggah");
    } catch (error: any) {
      toast.error(`Gagal upload foto: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenInspect = (item: ReturnItem) => {
    setSelectedReturn(item);
    setPhotoPreview(null);
    form.reset({ 
      condition: "SELLABLE", 
      photo_url: "", 
      expiry_date: "",
      type: item.type || "RETURN" 
    });
  };

  const onSubmit = async (values: z.infer<typeof inspectSchema>) => {
    if (!selectedReturn) return;
    setIsSubmitting(true);
    try {
      await inspectReturn(selectedReturn.id, values.condition, values.photo_url || "", values.expiry_date);
      toast.success(`Retur untuk order ${selectedReturn.order_id} berhasil diinspeksi.`);
      mutate();
      setSelectedReturn(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Retur Barang</h2>
          <p className="text-muted-foreground mt-1">
            Daftar pengajuan retur order dan form inspeksi kondisi barang.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Antrean Retur</CardTitle>
          <CardDescription>
            Inspeksi barang retur untuk menentukan apakah kembali ke stok (SELLABLE) atau dihapus (WRITE_OFF).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Memuat daftar retur...</span>
            </div>
          ) : isError ? (
            <div className="text-destructive p-4 border rounded-md bg-destructive/10">
              Gagal memuat data retur.
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center">
              <Box className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
              <p>Belum ada data pengajuan retur.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Tanggal Diajukan</TableHead>
                    <TableHead>Batas Klaim</TableHead>
                    <TableHead>Kondisi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{item.order_id}</div>
                        <div className="mt-1">
                          <Badge 
                            variant="secondary" 
                            className={item.type === 'CANCELLATION' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs px-2 py-0.5' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs px-2 py-0.5'}
                          >
                            {item.type === 'CANCELLATION' ? 'Pembatalan' : 'Retur'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{item.channel}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.created_at)}</TableCell>
                      <TableCell className="text-sm text-amber-600 font-medium">{formatDate(item.claim_deadline || "")}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={
                            item.condition === 'PENDING_INSPECTION' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500 text-xs' : 
                            item.condition === 'SELLABLE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-500 text-xs' : 
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500 text-xs'
                          }
                        >
                          {item.condition === 'PENDING_INSPECTION' ? 'Menunggu Inspeksi' : item.condition}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.condition === 'PENDING_INSPECTION' ? (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleOpenInspect(item)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Inspeksi
                          </Button>
                        ) : (
                          <div className="flex justify-end items-center gap-2">
                            {item.photo_url && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setViewPhotoUrl(item.photo_url!)}
                              >
                                <ImageIcon className="mr-1 h-3 w-3" />
                                Foto
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" disabled>
                              Selesai
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Inspeksi Barang Retur</SheetTitle>
            <SheetDescription>
              Order ID: <span className="font-mono text-foreground">{selectedReturn?.order_id}</span>
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Kondisi Barang</Label>
                <select
                  id="condition"
                  disabled={isSubmitting}
                  className="flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  {...form.register("condition")}
                >
                  <option value="SELLABLE" className="bg-background">Layak Jual (Kembali ke Stok)</option>
                  <option value="DAMAGED" className="bg-background">Rusak (Write-off)</option>
                  <option value="LOST" className="bg-background">Hilang di Kurir (Write-off / Klaim)</option>
                </select>
              </div>

              {condition === "SELLABLE" && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="expiry_date">Tanggal Kedaluwarsa Batch Baru</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    disabled={isSubmitting}
                    {...form.register("expiry_date")}
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    {condition === "SELLABLE" &&
                      (form.getValues("type") === "CANCELLATION"
                        ? "Pembatalan layak jual dicatat sebagai batch baru terpisah. Baca tanggal kedaluwarsa dari kemasan fisik barang."
                        : "Retur layak jual dicatat sebagai batch baru terpisah. Baca tanggal kedaluwarsa dari kemasan fisik barang.")}
                  </p>
                  {form.formState.errors.expiry_date && (
                    <p className="text-sm font-medium text-destructive mt-1">
                      {form.formState.errors.expiry_date.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label htmlFor="photo" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Foto Bukti Kondisi
                </Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={isSubmitting || isUploading}
                  onChange={handleFileUpload}
                />
                
                <input type="hidden" {...form.register("photo_url")} />
                
                {isUploading && (
                  <div className="flex items-center text-sm text-muted-foreground mt-2">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengunggah foto...
                  </div>
                )}
                
                {photoPreview && !isUploading && (
                  <div className="mt-3 border rounded-md p-1 bg-muted/10">
                    <img 
                      src={photoPreview} 
                      alt="Preview Foto Retur" 
                      className="w-full h-auto max-h-48 object-contain rounded" 
                    />
                  </div>
                )}
                
                {form.formState.errors.photo_url && (
                  <p className="text-sm font-medium text-destructive mt-1">
                    {form.formState.errors.photo_url.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full mt-4" disabled={isSubmitting || isUploading}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Selesaikan Inspeksi"
                )}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!viewPhotoUrl} onOpenChange={(open) => !open && setViewPhotoUrl(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Foto Bukti Kondisi</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center mt-2">
            {viewPhotoUrl && (
              <img 
                src={viewPhotoUrl} 
                alt="Foto Bukti Retur" 
                className="max-w-full h-auto max-h-[70vh] object-contain rounded-md shadow-sm border" 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
