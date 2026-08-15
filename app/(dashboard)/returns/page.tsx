"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useReturns, inspectReturn, ReturnItem } from "@/hooks/useReturns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { downloadXlsx } from "@/lib/xlsx-export";
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
import { Loader2, Box, Eye, Image as ImageIcon, Download } from "lucide-react";
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

const PHOTO_MAX_DIMENSION = 1280;
const PHOTO_QUALITY = 0.8;

// Kompres gambar lewat canvas sebelum upload -- murni fungsi utilitas,
// tidak bergantung state komponen, jadi ditaruh di luar ReturnsPage.
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > PHOTO_MAX_DIMENSION || height > PHOTO_MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * PHOTO_MAX_DIMENSION) / width);
          width = PHOTO_MAX_DIMENSION;
        } else {
          width = Math.round((width * PHOTO_MAX_DIMENSION) / height);
          height = PHOTO_MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas tidak didukung"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Gagal mengompres gambar"))),
        "image/jpeg",
        PHOTO_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Format gambar tidak didukung untuk dikompres"));
    };
    img.src = objectUrl;
  });
}

export default function ReturnsPage() {
  const searchParams = useSearchParams();
  const { returns, isLoading, isError, mutate } = useReturns();
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Antrean kerja (belum diinspeksi) dipisah dari riwayat yang sudah selesai
  // -- tanpa ini, retur lama menumpuk di tabel yang sama dengan yang masih
  // perlu ditindak, dan tabelnya makin berat seiring waktu.
  // Baca ?tab= dari URL (mis. link "Klaim TikTok" dari Dashboard) supaya
  // bisa langsung membuka tab yang benar -- tanpa ini, link ke retur yang
  // sudah diinspeksi (kondisi DAMAGED/LOST) akan nyasar ke tab "Menunggu
  // Inspeksi" yang default, dan kelihatan kosong padahal datanya ada.
  const [returnsTab, setReturnsTab] = useState<"pending" | "history">(
    searchParams.get("tab") === "history" ? "history" : "pending"
  );
  const pendingReturns = returns.filter((r) => r.condition === "PENDING_INSPECTION");
  const historyReturns = returns.filter((r) => r.condition !== "PENDING_INSPECTION");

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
      // Kompres dulu di device sebelum upload -- foto langsung dari kamera
      // HP modern biasanya 3-10MB, dikompres ke maksimal 1280px/kualitas 80%
      // JPEG supaya upload jauh lebih cepat di WiFi gudang yang pas-pasan,
      // tanpa mengorbankan kejelasan sebagai bukti kondisi barang. Kalau
      // kompresi gagal (format tidak didukung, dll), pakai file asli apa
      // adanya -- jangan sampai fitur ini malah menggagalkan upload yang
      // sebelumnya bekerja baik-baik saja.
      let uploadBody: File | Blob = file;
      let contentType: string | undefined;
      try {
        uploadBody = await compressImage(file);
        contentType = "image/jpeg";
      } catch {
        uploadBody = file;
      }

      // Membersihkan nama file dari karakter aneh
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${selectedReturn.id}/${Date.now()}-${cleanFileName}`;

      const { data, error } = await supabase.storage
        .from('return-photos')
        .upload(fileName, uploadBody, contentType ? { contentType } : undefined);

      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('return-photos')
        .getPublicUrl(data.path);
        
      form.setValue("photo_url", urlData.publicUrl);
      setPhotoPreview(urlData.publicUrl);
      toast.success("Foto berhasil diunggah");
    } catch (error: unknown) {
      const pesan = error instanceof Error ? error.message : String(error);
      toast.error(`Gagal upload foto: ${pesan}`);
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const CHANNEL_LABELS: Record<string, string> = {
    shopee: "Shopee",
    tiktok: "TikTok",
    offline: "Offline",
    internal: "Internal",
  };

  const formatChannel = (channel: string | null | undefined) => {
    if (!channel) return "-";
    return CHANNEL_LABELS[channel.toLowerCase()] || channel;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleExportExcel = async () => {
    if (!returns || returns.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    setIsExporting(true);
    try {
      const headers = ["Order ID", "Tipe", "Produk", "SKU", "Channel", "Qty", "Kondisi", "Tanggal Diajukan", "Batas Klaim"];

      const rows = returns.map((item) => {
        const orderId = item.order_id || "-";
        const type = item.type === 'CANCELLATION' ? 'Pembatalan' : 'Retur';
        const productName = item.product_name || "-";
        const sku = item.product_sku || "-";
        const channel = formatChannel(item.channel);
        const qty = item.qty !== undefined ? item.qty : 1;
        const condition = item.condition === 'PENDING_INSPECTION' ? 'Menunggu Inspeksi' :
                          item.condition === 'SELLABLE' ? 'Layak Jual (Kembali ke Stok)' :
                          item.condition === 'DAMAGED' ? 'Rusak (Write-off)' :
                          item.condition === 'LOST' ? 'Hilang di Kurir' : (item.condition || "-");
        const submittedDate = formatDate(item.created_at);
        const deadline = formatDate(item.claim_deadline || "");

        return [orderId, type, productName, sku, channel, qty, condition, submittedDate, deadline];
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadXlsx(`retur_${dateStr}.xlsx`, headers, rows);
    } finally {
      setIsExporting(false);
    }
  };

  // Dipakai bersama oleh tab "Menunggu Inspeksi" dan "Riwayat" -- 1 tabel,
  // beda daftar & pesan kosongnya saja, supaya markup-nya tidak terduplikasi.
  const renderReturnsTable = (items: ReturnItem[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center">
          <Box className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Tanggal Diajukan</TableHead>
              <TableHead>Batas Klaim</TableHead>
              <TableHead>Kondisi</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
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
                <TableCell>
                  <div className="font-medium text-sm">{item.product_name || "-"}</div>
                  <div className="text-xs text-muted-foreground">{item.product_sku || "-"}</div>
                </TableCell>
                <TableCell>{formatChannel(item.channel)}</TableCell>
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
    );
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
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1.5">
            <CardTitle>Daftar Antrean Retur</CardTitle>
            <CardDescription>
              Inspeksi barang retur untuk menentukan apakah kembali ke stok (SELLABLE) atau dihapus (WRITE_OFF).
            </CardDescription>
          </div>
          <Button onClick={handleExportExcel} disabled={isExporting} variant="outline" size="sm" className="h-8">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isExporting ? "Mengekspor..." : "Export Excel"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-destructive p-4 border rounded-md bg-destructive/10">
              Gagal memuat data retur.
            </div>
          ) : (
            <Tabs value={returnsTab} onValueChange={(v) => setReturnsTab(v as "pending" | "history")}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending">Menunggu Inspeksi ({pendingReturns.length})</TabsTrigger>
                <TabsTrigger value="history">Riwayat</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-0">
                {renderReturnsTable(pendingReturns, "Belum ada data pengajuan retur yang perlu diinspeksi.")}
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                {renderReturnsTable(historyReturns, "Belum ada riwayat retur.")}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={!!selectedReturn}
        onOpenChange={(open, eventDetails) => {
          if (open) return;
          // Cegah sheet ini ketutup (X/ESC/klik luar) selagi foto masih
          // diupload atau inspeksi masih disimpan -- tanpa ini, operator
          // bisa buru-buru pindah ke retur lain sebelum proses selesai,
          // dan hasilnya (foto/submit) bisa nyasar ke retur yang salah,
          // atau memicu submit ganda untuk retur yang sama.
          if (isSubmitting || isUploading) {
            eventDetails.cancel();
            return;
          }
          setSelectedReturn(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Inspeksi Barang Retur</SheetTitle>
            <SheetDescription className="space-y-1 pt-1">
              <div>Order ID: <span className="font-mono text-foreground">{selectedReturn?.order_id}</span></div>
              <div>Produk: <span className="text-foreground">{selectedReturn?.product_name || "-"}</span> <span className="text-xs">({selectedReturn?.product_sku || "-"})</span></div>
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Kondisi Barang</Label>
                <Select
                  disabled={isSubmitting}
                  value={form.watch("condition")}
                  onValueChange={(value) => form.setValue("condition", value as "SELLABLE" | "DAMAGED" | "LOST", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Kondisi">
                      {(value: string | null) => {
                        if (value === "SELLABLE") return "Layak Jual (Kembali ke Stok)";
                        if (value === "DAMAGED") return "Rusak (Write-off)";
                        if (value === "LOST") return "Hilang di Kurir (Write-off / Klaim)";
                        return "Pilih Kondisi";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELLABLE">Layak Jual (Kembali ke Stok)</SelectItem>
                    <SelectItem value="DAMAGED">Rusak (Write-off)</SelectItem>
                    <SelectItem value="LOST">Hilang di Kurir (Write-off / Klaim)</SelectItem>
                  </SelectContent>
                </Select>
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
