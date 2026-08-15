"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  SimulatedOrder, 
  simulateNewOrders, 
  simulateShipOrder, 
  simulateCancelOrder, 
  simulateReturnOrder,
  getOrderItems,
  OrderItem
} from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, PackageOpen, X, RotateCcw, Box, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SimulationPage() {
  const [orders, setOrders] = useState<SimulatedOrder[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null); // orderId-action
  const [returnItemDialogState, setReturnItemDialogState] = useState<{ isOpen: boolean; orderId: string; items: OrderItem[]; selectedItemId: string; qty: string } | null>(null);
  const [manualOutConfirmState, setManualOutConfirmState] = useState<{ product_id: string; product_sku: string; product_name: string; current_qty: number; qty: string; reason: string; note: string; campaign_reference?: string } | null>(null);
  
  const [channel, setChannel] = useState("shopee");
  const [count, setCount] = useState("1");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{created: number, failed: {external_order_id: string, message: string}[]} | null>(null);

  const { products } = useProducts();
  const [manualOutProduct, setManualOutProduct] = useState("");
  const [manualOutReason, setManualOutReason] = useState("offline");
  const [manualOutQty, setManualOutQty] = useState("");
  const [manualOutNote, setManualOutNote] = useState("");
  const [manualOutCampaignRef, setManualOutCampaignRef] = useState("");
  const [isManualOutLoading, setIsManualOutLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const data = await simulateNewOrders(channel, parseInt(count, 10));
      const newOrders = data.order_ids.map((id: string) => ({
        id,
        status: 'PENDING',
        channel,
        created_at: new Date().toISOString()
      }));
      setOrders(prev => [...newOrders, ...prev]);
      toast.success(`${data.created} pesanan berhasil dibuat (PENDING)`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      const res = await fetch("/api/orders/import", {
        method: "POST",
        body: formData,
      });
      // Cek res.ok DULU sebelum coba parse JSON -- kalau server/proxy
      // menolak request (misal file kebesaran, timeout), balasannya bisa
      // berupa halaman error HTML, bukan JSON. Coba parse itu sebagai JSON
      // akan melempar error mentah yang membingungkan ("Unexpected token <
      // in JSON"), bukan pesan yang jelas soal apa yang sebenarnya terjadi.
      if (!res.ok) {
        throw new Error(`Server menolak file (kode ${res.status}). Coba file yang lebih kecil atau cek koneksi, lalu coba lagi.`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || json.message || "Gagal mengimpor CSV");
      
      const payload = json.data;
      setImportResult({ created: payload.created || 0, failed: payload.failed || [] });
      
      if (payload.created_orders && payload.created_orders.length > 0) {
        const newOrders = payload.created_orders.map((o: { id: string; channel: string }) => ({
          id: o.id,
          status: 'PENDING',
          channel: o.channel,
          created_at: new Date().toISOString(),
        }));
        setOrders(prev => [...newOrders, ...prev]);
      }
      if (payload.created > 0) {
        toast.success(`${payload.created} pesanan berhasil diimpor`);
      } else {
        toast.warning("Tidak ada pesanan yang berhasil diimpor");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImporting(false);
      setCsvFile(null);
      const fileInput = document.getElementById('csv_file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  // Sebuah baris (order) dianggap "sibuk" hanya kalau aksinya sendiri yang
  // sedang diproses -- bukan flag global -- supaya order LAIN tetap bisa
  // diproses tanpa harus menunggu 1 order selesai lebih dulu.
  const isRowBusy = (orderId: string) => loadingAction?.startsWith(`${orderId}-`) ?? false;

  const handleAction = async (orderId: string, action: 'ship' | 'cancel' | 'return') => {
    setLoadingAction(`${orderId}-${action}`);
    try {
      if (action === 'ship') {
        const res = await simulateShipOrder(orderId);
        toast.success(`Pesanan ${orderId} berhasil di-SHIPPED. Alokasi FEFO berjalan.`);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: res.status || 'SHIPPED' } : o));
      } else if (action === 'cancel') {
        const res = await simulateCancelOrder(orderId);
        
        if (res?.needs_inspection) {
          toast.info("Pembatalan diajukan, perlu inspeksi kondisi barang di halaman Retur");
        } else {
          toast.success(`Pesanan ${orderId} dibatalkan.`);
        }
        
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
      } else if (action === 'return') {
        const items = await getOrderItems(orderId);
        if (items.length === 1) {
          await simulateReturnOrder(orderId);
          toast.success(`Retur diajukan untuk pesanan ${orderId}.`);
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'RETURNED' } : o));
        } else if (items.length > 1) {
          setReturnItemDialogState({
            isOpen: true,
            orderId,
            items,
            selectedItemId: items[0].id,
            qty: items[0].qty.toString()
          });
        } else {
          throw new Error("Order tidak memiliki item");
        }
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleManualOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOutProduct || !manualOutQty || !manualOutNote) return;
    
    if (["bonus", "promo", "sample"].includes(manualOutReason) && !manualOutCampaignRef) {
      toast.error("Referensi Campaign / Approval wajib diisi untuk alasan ini.");
      return;
    }
    
    const product = products.find(p => p.id === manualOutProduct);
    if (!product) return;
    
    setManualOutConfirmState({
      product_id: manualOutProduct,
      product_sku: product.sku,
      product_name: product.name,
      current_qty: product.current_qty,
      qty: manualOutQty,
      reason: manualOutReason,
      note: manualOutNote,
      campaign_reference: ["bonus", "promo", "sample"].includes(manualOutReason) ? manualOutCampaignRef : undefined,
    });
  };

  const executeManualOut = async () => {
    if (!manualOutConfirmState) return;
    
    setIsManualOutLoading(true);
    try {
      const res = await fetch("/api/ledger/manual-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: manualOutConfirmState.product_id,
          qty: parseInt(manualOutConfirmState.qty, 10),
          reason: manualOutConfirmState.reason,
          note: manualOutConfirmState.note,
          campaign_reference: manualOutConfirmState.campaign_reference,
        }),
      });
      const json = await res.json();
      
      if (!json.success) {
        if (json.error?.code === "INSUFFICIENT_STOCK") {
          throw new Error("Stok tidak mencukupi untuk jumlah yang diminta.");
        }
        throw new Error(json.error?.message || json.message || "Gagal mencatat mutasi manual");
      }
      
      const payload = json.data;
      const reasonLabels: Record<string, string> = {
        offline: "Penjualan Offline",
        bonus: "Bonus",
        promo: "Promo",
        sample: "Sample",
        damaged: "Barang Rusak",
        expired: "Barang Kedaluwarsa",
      };
      const label = reasonLabels[payload.reason] || payload.reason;
      
      toast.success(`${payload.qty} pcs berhasil dicatat sebagai ${label}`);
      
      setManualOutProduct("");
      setManualOutQty("");
      setManualOutNote("");
      setManualOutCampaignRef("");
      setManualOutConfirmState(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsManualOutLoading(false);
    }
  };

  const handleDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnItemDialogState) return;
    const { orderId, selectedItemId, qty } = returnItemDialogState;
    setLoadingAction(`${orderId}-return`);
    try {
      await simulateReturnOrder(orderId, selectedItemId, parseInt(qty, 10));
      toast.success(`Retur diajukan untuk pesanan ${orderId} (Item Spesifik).`);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'RETURNED' } : o));
      setReturnItemDialogState(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Simulasi Marketplace</h2>
          <p className="text-muted-foreground mt-1">
            Hasilkan pesanan uji coba (dummy) untuk mengetes alokasi FEFO dan pemotongan stok otomatis.
          </p>
        </div>
      </div>

      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4 flex items-start gap-3">
        <div className="text-sky-500 mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-sky-800 dark:text-sky-300">Baru menggunakan Simulasi?</h4>
          <p className="text-sm text-sky-700 dark:text-sky-400 mt-1">
            Halaman ini dipakai untuk memasukkan data pesanan karena sistem belum tersambung ke API asli.
            Silakan baca <Link href="/panduan#simulasi" scroll={false} className="underline font-medium hover:text-sky-900 dark:hover:text-sky-200">Panduan Simulasi</Link> untuk memahami cara kerjanya.
          </p>
        </div>
      </div>

      <Card className="border-primary/50 shadow-sm bg-muted/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Buat Pesanan Fiktif</CardTitle>
          <CardDescription>
            Pesanan yang baru dibuat akan berstatus PENDING dan bertindak sebagai reservasi (belum memotong ledger aktual).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 w-full sm:w-48">
              <Label htmlFor="channel">Channel / Platform</Label>
              <Select
                value={channel}
                onValueChange={(value) => setChannel(value as string)}
                disabled={isGenerating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Channel">
                    {(value: string | null) =>
                      value === "shopee" ? "Shopee" : value === "tiktok" ? "TikTok Shop" : "Pilih Channel"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="tiktok">TikTok Shop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 w-full sm:w-32">
              <Label htmlFor="count">Jumlah Pesanan</Label>
              <Select
                value={count}
                onValueChange={(value) => setCount(value as string)}
                disabled={isGenerating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Jumlah">
                    {(value: string | null) => (value ? `${value} Order${value !== "1" ? "s" : ""}` : "Pilih Jumlah")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Order</SelectItem>
                  <SelectItem value="3">3 Orders</SelectItem>
                  <SelectItem value="5">5 Orders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={isGenerating} className="w-full sm:w-auto">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Generate Orders
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-primary/50 shadow-sm bg-muted/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Mutasi Keluar Manual</CardTitle>
          <CardDescription>
            Catat pengeluaran barang di luar pesanan online (misal: barang rusak, sampel, dll).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualOutSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manualOutProduct">Pilih Produk</Label>
                <Select
                  value={manualOutProduct}
                  onValueChange={(value) => setManualOutProduct(value as string)}
                  disabled={isManualOutLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Produk">
                      {(value: string | null) => {
                        if (!value) return "Pilih Produk";
                        const p = products.find((pr) => pr.id === value);
                        return p ? `${p.sku} - ${p.name}` : value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => !p.is_bundle && p.current_qty > 0).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sku} - {p.name} (Sisa: {p.current_qty.toLocaleString("id-ID")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manualOutReason">Tipe Mutasi</Label>
                {(() => {
                  const REASON_LABELS: Record<string, string> = {
                    offline: "Penjualan Offline", bonus: "Bonus", promo: "Promo",
                    sample: "Sample", damaged: "Barang Rusak", expired: "Barang Kedaluwarsa",
                  };
                  return (
                    <Select
                      value={manualOutReason}
                      onValueChange={(value) => setManualOutReason(value as string)}
                      disabled={isManualOutLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih Tipe Mutasi">
                          {(value: string | null) => (value ? REASON_LABELS[value] ?? value : "Pilih Tipe Mutasi")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offline">Penjualan Offline</SelectItem>
                        <SelectItem value="bonus">Bonus</SelectItem>
                        <SelectItem value="promo">Promo</SelectItem>
                        <SelectItem value="sample">Sample</SelectItem>
                        <SelectItem value="damaged">Barang Rusak</SelectItem>
                        <SelectItem value="expired">Barang Kedaluwarsa</SelectItem>
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>

              {["bonus", "promo", "sample"].includes(manualOutReason) && (
                <div className="space-y-2">
                  <Label htmlFor="manualOutCampaignRef">Referensi Campaign / Approval</Label>
                  <Input
                    id="manualOutCampaignRef"
                    type="text"
                    required={["bonus", "promo", "sample"].includes(manualOutReason)}
                    placeholder="Nama campaign atau catatan approval..."
                    value={manualOutCampaignRef}
                    onChange={(e) => setManualOutCampaignRef(e.target.value)}
                    disabled={isManualOutLoading}
                    className="bg-background"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="manualOutQty">Kuantitas</Label>
                <Input
                  id="manualOutQty"
                  type="number"
                  min="1"
                  required
                  value={manualOutQty}
                  onChange={(e) => setManualOutQty(e.target.value)}
                  disabled={isManualOutLoading}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manualOutNote">Alasan / Catatan</Label>
                <Input
                  id="manualOutNote"
                  type="text"
                  required
                  placeholder="Wajib diisi..."
                  value={manualOutNote}
                  onChange={(e) => setManualOutNote(e.target.value)}
                  disabled={isManualOutLoading}
                  className="bg-background"
                />
              </div>
            </div>

            <Button type="submit" variant="secondary" disabled={isManualOutLoading || !manualOutProduct} className="w-full sm:w-auto mt-2">
              {isManualOutLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Box className="mr-2 h-4 w-4" />}
              Catat Pengeluaran
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-primary/50 shadow-sm bg-muted/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Impor Pesanan Massal (CSV)</CardTitle>
          <CardDescription>
            Format Header CSV: <code className="bg-muted px-1 py-0.5 rounded text-xs">channel,external_order_id,sku,qty,ordered_at</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImportCsv} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 w-full sm:flex-1">
              <Label htmlFor="csv_file">Pilih File CSV</Label>
              <Input 
                id="csv_file" 
                type="file" 
                accept=".csv" 
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                disabled={isImporting}
                className="cursor-pointer bg-background"
              />
            </div>
            
            <Button type="submit" variant="secondary" disabled={isImporting || !csvFile} className="w-full sm:w-auto">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import CSV
            </Button>
          </form>

          {importResult && (
            <div className={`mt-4 p-4 rounded-md border ${importResult.failed.length > 0 ? "border-amber-200 bg-amber-500/10" : "border-emerald-200 bg-emerald-500/10"}`}>
              <p className="font-medium text-sm mb-2">Hasil Impor:</p>
              <p className="text-sm">Berhasil dibuat: <strong>{importResult.created}</strong> pesanan</p>
              {importResult.failed.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium text-destructive">Gagal: {importResult.failed.length} pesanan</p>
                  <ul className="mt-1 max-h-32 overflow-y-auto list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                    {importResult.failed.map((fail, idx) => (
                      <li key={idx}>ID: <span className="font-mono text-foreground">{fail.external_order_id}</span> - {fail.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pesanan Simulasi (Sesi Ini)</CardTitle>
          <CardDescription>
            Pesanan ini tersimpan sementara di layar untuk memudahkan pengujian (Ship, Cancel, atau Ajukan Retur).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center">
              <Box className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
              <p>Belum ada order simulasi yang digenerate.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi Simulasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.id}</TableCell>
                      <TableCell className="capitalize">{order.channel}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            order.status === 'PENDING' ? 'text-amber-500 border-amber-500' : 
                            order.status === 'CANCELLED' ? 'text-muted-foreground border-muted-foreground' : 
                            order.status === 'RETURNED' ? 'text-destructive border-destructive' : 
                            'text-emerald-500 border-emerald-500'
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {order.status === 'PENDING' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                              disabled={isRowBusy(order.id)}
                              onClick={() => handleAction(order.id, 'ship')}
                            >
                              {loadingAction === `${order.id}-ship` ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="mr-1 h-3 w-3" />}
                              Ship
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              disabled={isRowBusy(order.id)}
                              onClick={() => handleAction(order.id, 'cancel')}
                            >
                              {loadingAction === `${order.id}-cancel` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-1 h-3 w-3" />}
                              Cancel
                            </Button>
                          </>
                        )}
                        {(order.status === 'SHIPPED' || order.status === 'IN_TRANSIT') && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="secondary" 
                              size="sm"
                              disabled={isRowBusy(order.id)}
                              onClick={() => handleAction(order.id, 'return')}
                            >
                              {loadingAction === `${order.id}-return` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                              Simulate Return
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              disabled={isRowBusy(order.id)}
                              onClick={() => handleAction(order.id, 'cancel')}
                            >
                              {loadingAction === `${order.id}-cancel` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-1 h-3 w-3" />}
                              Batalkan
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

      <Dialog
        open={!!returnItemDialogState?.isOpen}
        onOpenChange={(open, eventDetails) => {
          if (open) return;
          // Cegah dialog ini ketutup (X/ESC/klik luar) selagi retur masih
          // diajukan -- konsisten dengan guard yang sama di dialog Manual
          // Out, walau risikonya lebih rendah di sini (masih lewat inspeksi
          // terpisah sebelum stok benar-benar berubah).
          if (loadingAction !== null) {
            eventDetails.cancel();
            return;
          }
          setReturnItemDialogState(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih Item untuk Diretur</DialogTitle>
          </DialogHeader>
          {returnItemDialogState && (
            <form onSubmit={handleDialogSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Pilih Item Komponen</Label>
                <div className="space-y-2">
                  {returnItemDialogState.items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id={item.id} 
                        name="return_item"
                        value={item.id}
                        checked={returnItemDialogState.selectedItemId === item.id}
                        onChange={(e) => {
                          const selected = returnItemDialogState.items.find(i => i.id === e.target.value);
                          setReturnItemDialogState(prev => prev ? {...prev, selectedItemId: e.target.value, qty: selected?.qty.toString() || '1'} : null)
                        }}
                        className="text-primary focus:ring-primary h-4 w-4"
                      />
                      <Label htmlFor={item.id} className="cursor-pointer font-normal">
                        {item.products.name} ({item.products.sku}) - Max: {item.qty}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="returnQty">Kuantitas Diretur</Label>
                <Input
                  id="returnQty"
                  type="number"
                  min="1"
                  max={returnItemDialogState.items.find(i => i.id === returnItemDialogState.selectedItemId)?.qty || 1}
                  required
                  value={returnItemDialogState.qty}
                  onChange={(e) => setReturnItemDialogState(prev => prev ? {...prev, qty: e.target.value} : null)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loadingAction !== null}>
                {loadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ajukan Retur
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!manualOutConfirmState}
        onOpenChange={(open, eventDetails) => {
          if (open) return;
          // Cegah dialog ini ketutup (X/ESC/klik luar) selagi proses
          // simpan masih jalan -- tanpa ini, dialog kelihatan "batal"
          // padahal request permanen ke ledger tetap lanjut di belakang
          // layar, dan operator bisa jadi tidak sadar stok sudah terpotong.
          if (isManualOutLoading) {
            eventDetails.cancel();
            return;
          }
          setManualOutConfirmState(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Mutasi Manual</DialogTitle>
          </DialogHeader>
          {manualOutConfirmState && (
            <div className="space-y-4 mt-4">
              <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produk:</span>
                  <span className="font-medium text-right">{manualOutConfirmState.product_sku} - {manualOutConfirmState.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kuantitas:</span>
                  <span className="font-medium text-destructive">Keluar {parseInt(manualOutConfirmState.qty, 10).toLocaleString("id-ID")} pcs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alasan/Catatan:</span>
                  <span className="font-medium capitalize text-right">{manualOutConfirmState.reason} - {manualOutConfirmState.note}</span>
                </div>
                {manualOutConfirmState.campaign_reference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referensi Campaign:</span>
                    <span className="font-medium text-right">{manualOutConfirmState.campaign_reference}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-medium">
                    <span>Dampak Stok:</span>
                    <span>{manualOutConfirmState.current_qty.toLocaleString("id-ID")} → {(manualOutConfirmState.current_qty - parseInt(manualOutConfirmState.qty, 10)).toLocaleString("id-ID")}</span>
                  </div>
                  {(manualOutConfirmState.current_qty - parseInt(manualOutConfirmState.qty, 10)) <= 15 && (
                    <div className="flex items-center gap-2 text-amber-500 text-xs mt-2 p-2 bg-amber-500/10 rounded">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Peringatan: stok produk ini akan menjadi rendah ({(manualOutConfirmState.current_qty - parseInt(manualOutConfirmState.qty, 10))} pcs) setelah aksi ini.</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setManualOutConfirmState(null)} disabled={isManualOutLoading}>
                  Batal
                </Button>
                <Button type="button" onClick={executeManualOut} disabled={isManualOutLoading}>
                  {isManualOutLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Ya, Catat Pengeluaran
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
