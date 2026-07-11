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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Box, Eye, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const inspectSchema = z.object({
  condition: z.enum(["SELLABLE", "DAMAGED", "LOST"]),
  photo_url: z.string().optional(),
}).refine((data) => {
  if ((data.condition === "DAMAGED" || data.condition === "LOST") && !data.photo_url) {
    return false;
  }
  return true;
}, {
  message: "URL Foto wajib diisi untuk kondisi Rusak/Hilang",
  path: ["photo_url"],
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
    },
  });

  const handleOpenInspect = (item: ReturnItem) => {
    setSelectedReturn(item);
    form.reset({ condition: "SELLABLE", photo_url: "" });
  };

  const onSubmit = async (values: z.infer<typeof inspectSchema>) => {
    if (!selectedReturn) return;
    setIsSubmitting(true);
    try {
      await inspectReturn(selectedReturn.id, values.condition, values.photo_url || "");
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
                      <TableCell className="font-mono text-xs">{item.order_id}</TableCell>
                      <TableCell className="capitalize">{item.channel}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.created_at)}</TableCell>
                      <TableCell className="text-sm text-amber-600 font-medium">{formatDate(item.claim_deadline || "")}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            item.condition === 'PENDING_INSPECTION' ? 'outline' : 
                            item.condition === 'SELLABLE' ? 'default' : 'destructive'
                          }
                          className={item.condition === 'SELLABLE' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
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
                          <Button variant="ghost" size="sm" disabled>
                            Selesai
                          </Button>
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

              <div className="space-y-2 pt-2">
                <Label htmlFor="photo_url" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  URL Foto Bukti
                </Label>
                <Input
                  id="photo_url"
                  placeholder="https://.../bukti-retur.jpg"
                  disabled={isSubmitting}
                  {...form.register("photo_url")}
                />
                <p className="text-xs text-muted-foreground">
                  Karena Supabase Storage belum disetup, gunakan teks URL sementara (wajib diisi jika barang Rusak/Hilang).
                </p>
                {form.formState.errors.photo_url && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.photo_url.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
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
    </div>
  );
}
