"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useOpnameSessionDetail, submitOpnameItem, closeOpnameSession } from "@/hooks/useOpname";
import { CameraScanner } from "@/components/opname/camera-scanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ScanBarcode, Lock, ArrowLeft, Send, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/utils";

const formSchema = z.object({
  batch_id: z.string().min(1, "Batch ID wajib diisi"),
  physical_qty: z.number({ message: "Wajib berupa angka" }).min(0, "Kuantitas minimal 0"),
  discrepancy_reason: z.string().optional(),
});

export default function OpnameSessionDetail() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  
  const { session, isLoading: isLoadingSession, mutate } = useOpnameSessionDetail(sessionId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showDiscrepancyReason, setShowDiscrepancyReason] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  const isSessionOpen = session?.status === "OPEN";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batch_id: "",
      physical_qty: 0,
      discrepancy_reason: "",
    },
  });

  const batchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const watchedBatchId = form.watch("batch_id");
  const watchedPhysicalQty = form.watch("physical_qty");

  // Logic memunculkan Alasan Selisih
  useEffect(() => {
    if (!watchedBatchId) {
      setShowDiscrepancyReason(false);
      return;
    }
    
    // Cari item di session berdasarkan batch_id atau batch_code
    const item = session?.items?.find(
      (i) => i.batch_id === watchedBatchId || i.product_batches?.batch_code === watchedBatchId
    );
    
    if (item && item.system_qty !== undefined) {
      // Jika tidak sama dengan sistem, tampilkan dropdown alasan
      if (watchedPhysicalQty !== item.system_qty) {
        setShowDiscrepancyReason(true);
      } else {
        setShowDiscrepancyReason(false);
      }
    } else {
      setShowDiscrepancyReason(false);
    }
  }, [watchedBatchId, watchedPhysicalQty, session]);

  // Auto focus input scanner
  useEffect(() => {
    if (isSessionOpen) {
      batchInputRef.current?.focus();
    }
  }, [isSessionOpen]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Validasi lokal sebelum kirim ke backend
    if (showDiscrepancyReason && !values.discrepancy_reason) {
      form.setError("discrepancy_reason", { message: "Alasan selisih wajib dipilih karena stok fisik berbeda dengan sistem" });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitOpnameItem(sessionId, values.batch_id, values.physical_qty, values.discrepancy_reason);
      toast.success(`Batch ${values.batch_id} berhasil dicatat.`);
      form.reset({
        batch_id: "",
        physical_qty: 0,
        discrepancy_reason: "",
      });
      setShowDiscrepancyReason(false);
      mutate(); // Refresh the session data
      // Refocus the input for the next scan
      setTimeout(() => {
        batchInputRef.current?.focus();
      }, 100);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScan = (decodedText: string) => {
    form.setValue("batch_id", decodedText);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 100);
  };



  const handleExportCsv = () => {
    if (!session?.items || session.items.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const headers = ["Batch Code", "SKU", "Nama Produk", "Qty Sistem", "Qty Fisik", "Selisih"];
    
    const rows = session.items.map((item) => {
      const batchCode = item.product_batches?.batch_code || item.batch_id;
      const sku = item.product_batches?.products?.sku || "-";
      const name = item.product_batches?.products?.name || "-";
      const sysQty = item.system_qty ?? "-";
      const physQty = item.physical_qty === null ? "Belum dihitung" : item.physical_qty;
      const variance = item.variance === undefined ? "-" : item.variance;

      return [batchCode, sku, name, sysQty, physQty, variance];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`opname_${sessionId}_${dateStr}.csv`, headers, rows);
  };

  if (isLoadingSession) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto mt-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center text-destructive">
        Sesi tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => router.push("/opname")}
            className="h-10 w-10 shrink-0"
            title="Kembali ke Daftar Sesi"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Sesi Opname</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">ID: {sessionId}</p>
          </div>
        </div>
        {isSessionOpen && (
          <>
            <Button variant="destructive" onClick={() => setIsCloseConfirmOpen(true)} disabled={isClosing}>
              {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Tutup Sesi
            </Button>

            <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Tutup Sesi Opname</DialogTitle>
                  <DialogDescription>
                    Tutup sesi ini? Setelah ditutup, selisih stok akan langsung direkonsiliasi dan tidak bisa diubah.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCloseConfirmOpen(false)} disabled={isClosing}>
                    Batal
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isClosing}
                    onClick={async () => {
                      setIsCloseConfirmOpen(false);
                      setIsClosing(true);
                      try {
                        const result = await closeOpnameSession(sessionId);
                        if (result?.not_counted && result.not_counted.length > 0) {
                          toast.warning(`Sesi ditutup, tapi batch ini tidak terhitung: ${result.not_counted.join(", ")}`, { duration: 8000 });
                        } else {
                          toast.success("Sesi opname ditutup. Rekonsiliasi selesai.");
                        }
                        mutate();
                        router.push("/opname");
                      } catch (error: unknown) {
                        toast.error(error instanceof Error ? error.message : String(error));
                        setIsClosing(false);
                      }
                    }}
                  >
                    {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Ya, Tutup Sesi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {isSessionOpen && (
        <Card className="border-primary/50 shadow-sm">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center text-lg">
              <ScanBarcode className="mr-2 h-5 w-5" />
              Scan QR / Input Batch
            </CardTitle>
            <CardDescription>
              Pastikan kursor berada di kolom Batch ID jika menggunakan alat scanner fisik.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-full sm:flex-1 space-y-2">
                <Label htmlFor="batch_id">Batch ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="batch_id"
                    placeholder="Arahkan scanner ke QR Code..."
                    disabled={isSubmitting || isClosing}
                    {...form.register("batch_id")}
                    ref={(e) => {
                      form.register("batch_id").ref(e);
                      batchInputRef.current = e;
                    }}
                    className="font-mono text-lg h-[72px]"
                  />
                  <CameraScanner onScan={handleScan} />
                </div>
                {form.formState.errors.batch_id && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.batch_id.message}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-32 space-y-2">
                <Label htmlFor="physical_qty">Qty Fisik</Label>
                <Input
                  id="physical_qty"
                  type="number"
                  disabled={isSubmitting || isClosing}
                  {...form.register("physical_qty", { valueAsNumber: true })}
                  ref={(e) => {
                    form.register("physical_qty").ref(e);
                    qtyInputRef.current = e;
                  }}
                  className="text-lg h-[72px] text-center"
                />
                {form.formState.errors.physical_qty && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.physical_qty.message}
                  </p>
                )}
              </div>

              {showDiscrepancyReason && (() => {
                const DISCREPANCY_LABELS: Record<string, string> = {
                  damaged: "Barang Rusak", lost: "Barang Hilang", found_extra: "Ditemukan Lebih",
                  miscount_previous: "Salah Hitung Sebelumnya", other: "Lainnya",
                };
                return (
                <div className="w-full sm:w-48 space-y-2">
                  <Label htmlFor="discrepancy_reason">Alasan Selisih</Label>
                  <Select
                    disabled={isSubmitting || isClosing}
                    value={form.watch("discrepancy_reason")}
                    onValueChange={(value) => form.setValue("discrepancy_reason", value as string, { shouldValidate: true })}
                  >
                    <SelectTrigger className="w-full h-[72px]" id="discrepancy_reason">
                      <SelectValue placeholder="Pilih Alasan">
                        {(value: string | null) => (value ? DISCREPANCY_LABELS[value] ?? value : "Pilih Alasan")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damaged">Barang Rusak</SelectItem>
                      <SelectItem value="lost">Barang Hilang</SelectItem>
                      <SelectItem value="found_extra">Ditemukan Lebih</SelectItem>
                      <SelectItem value="miscount_previous">Salah Hitung Sebelumnya</SelectItem>
                      <SelectItem value="other">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.discrepancy_reason && (
                    <p className="text-sm font-medium text-destructive leading-tight">
                      {form.formState.errors.discrepancy_reason.message}
                    </p>
                  )}
                </div>
                );
              })()}

              <div className="w-full sm:w-auto pt-2 sm:pt-8">
                <Button type="submit" disabled={isSubmitting || isClosing} className="w-full h-[72px] px-6">
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1.5">
            <CardTitle>Riwayat Item Discan</CardTitle>
            <CardDescription>
              {isSessionOpen ? "Item yang sudah tercatat pada sesi ini." : "Hasil akhir stok opname untuk sesi ini."}
            </CardDescription>
          </div>
          <Button onClick={handleExportCsv} variant="outline" size="sm" className="h-8">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {!session.items || session.items.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
              Belum ada item yang di-scan.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead className="text-right">Qty Sistem</TableHead>
                    <TableHead className="text-right">Qty Fisik</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-mono text-sm font-medium">
                          {item.product_batches?.batch_code || item.batch_id}
                        </div>
                        {item.product_batches?.products && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.product_batches.products.sku} - {item.product_batches.products.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.system_qty ?? "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.physical_qty === null ? (
                          <span className="text-muted-foreground italic text-xs">Belum dihitung</span>
                        ) : (
                          item.physical_qty
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${
                        item.variance === undefined ? "text-muted-foreground" :
                        item.variance > 0 ? "text-emerald-500" :
                        item.variance < 0 ? "text-destructive" :
                        "text-muted-foreground"
                      }`}>
                        {item.variance === undefined ? "-" : item.variance > 0 ? `+${item.variance}` : item.variance}
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
  );
}
