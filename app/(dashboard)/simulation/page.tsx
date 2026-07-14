"use client";

import { useState } from "react";
import { 
  SimulatedOrder, 
  simulateNewOrders, 
  simulateShipOrder, 
  simulateCancelOrder, 
  simulateReturnOrder 
} from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, PackageOpen, X, RotateCcw, Box, Upload } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function SimulationPage() {
  const [orders, setOrders] = useState<SimulatedOrder[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null); // orderId-action
  
  const [channel, setChannel] = useState("shopee");
  const [count, setCount] = useState("1");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{created: number, failed: any[]} | null>(null);

  const { products } = useProducts();
  const [manualOutProduct, setManualOutProduct] = useState("");
  const [manualOutType, setManualOutType] = useState("OUT_SALE_OFFLINE");
  const [manualOutQty, setManualOutQty] = useState("");
  const [manualOutReason, setManualOutReason] = useState("");
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
    } catch (error: any) {
      toast.error(error.message);
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
      const json = await res.json();
      if (!json.success) throw new Error(json.error || json.message || "Gagal mengimpor CSV");
      
      const payload = json.data;
      setImportResult({ created: payload.created || 0, failed: payload.failed || [] });
      if (payload.created > 0) {
        toast.success(`${payload.created} pesanan berhasil diimpor`);
      } else {
        toast.warning("Tidak ada pesanan yang berhasil diimpor");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsImporting(false);
      setCsvFile(null);
      // Reset input file visual
      const fileInput = document.getElementById('csv_file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const handleAction = async (orderId: string, action: 'ship' | 'cancel' | 'return') => {
    setLoadingAction(`${orderId}-${action}`);
    try {
      if (action === 'ship') {
        const res = await simulateShipOrder(orderId);
        toast.success(`Pesanan ${orderId} berhasil di-SHIPPED. Alokasi FEFO berjalan.`);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: res.status || 'SHIPPED' } : o));
      } else if (action === 'cancel') {
        await simulateCancelOrder(orderId);
        toast.success(`Pesanan ${orderId} dibatalkan.`);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
      } else if (action === 'return') {
        await simulateReturnOrder(orderId);
        toast.success(`Retur diajukan untuk pesanan ${orderId}.`);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'RETURNED' } : o));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleManualOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOutProduct || !manualOutQty || !manualOutReason) return;
    
    setIsManualOutLoading(true);
    try {
      const res = await fetch("/api/ledger/manual-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: manualOutProduct,
          qty: parseInt(manualOutQty, 10),
          movement_type: manualOutType,
          reason: manualOutReason,
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
      // Get the type label for the toast
      const typeLabels: Record<string, string> = {
        "OUT_SALE_OFFLINE": "Penjualan Offline",
        "OUT_BONUS": "Bonus",
        "OUT_PROMO": "Promo",
        "OUT_SAMPLE": "Sample",
        "OUT_DAMAGED": "Barang Rusak",
        "OUT_EXPIRED": "Barang Kedaluwarsa",
      };
      const label = typeLabels[payload.movement_type] || payload.movement_type;
      
      toast.success(`${payload.qty} pcs berhasil dicatat sebagai ${label}`);
      
      // Reset form
      setManualOutProduct("");
      setManualOutQty("");
      setManualOutReason("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsManualOutLoading(false);
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
              <select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                disabled={isGenerating}
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="shopee" className="bg-background">Shopee</option>
                <option value="tiktok" className="bg-background">TikTok Shop</option>
                <option value="offline" className="bg-background">Offline Store</option>
              </select>
            </div>
            
            <div className="space-y-2 w-full sm:w-32">
              <Label htmlFor="count">Jumlah Pesanan</Label>
              <select
                id="count"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={isGenerating}
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="1" className="bg-background">1 Order</option>
                <option value="3" className="bg-background">3 Orders</option>
                <option value="5" className="bg-background">5 Orders</option>
              </select>
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
          <form onSubmit={handleManualOut} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manualOutProduct">Pilih Produk</Label>
                <select
                  id="manualOutProduct"
                  value={manualOutProduct}
                  onChange={(e) => setManualOutProduct(e.target.value)}
                  disabled={isManualOutLoading}
                  required
                  className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>-- Pilih Produk --</option>
                  {products.filter(p => !p.is_bundle && p.current_qty > 0).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name} (Sisa: {p.current_qty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manualOutType">Tipe Mutasi</Label>
                <select
                  id="manualOutType"
                  value={manualOutType}
                  onChange={(e) => setManualOutType(e.target.value)}
                  disabled={isManualOutLoading}
                  className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="OUT_SALE_OFFLINE">Penjualan Offline</option>
                  <option value="OUT_BONUS">Bonus</option>
                  <option value="OUT_PROMO">Promo</option>
                  <option value="OUT_SAMPLE">Sample</option>
                  <option value="OUT_DAMAGED">Barang Rusak</option>
                  <option value="OUT_EXPIRED">Barang Kedaluwarsa</option>
                </select>
              </div>

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
                <Label htmlFor="manualOutReason">Alasan / Catatan</Label>
                <Input
                  id="manualOutReason"
                  type="text"
                  required
                  placeholder="Wajib diisi..."
                  value={manualOutReason}
                  onChange={(e) => setManualOutReason(e.target.value)}
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
                              disabled={loadingAction !== null}
                              onClick={() => handleAction(order.id, 'ship')}
                            >
                              {loadingAction === `${order.id}-ship` ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="mr-1 h-3 w-3" />}
                              Ship
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              disabled={loadingAction !== null}
                              onClick={() => handleAction(order.id, 'cancel')}
                            >
                              {loadingAction === `${order.id}-cancel` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-1 h-3 w-3" />}
                              Cancel
                            </Button>
                          </>
                        )}
                        {(order.status === 'SHIPPED' || order.status === 'IN_TRANSIT') && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            disabled={loadingAction !== null}
                            onClick={() => handleAction(order.id, 'return')}
                          >
                            {loadingAction === `${order.id}-return` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                            Simulate Return
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
    </div>
  );
}
