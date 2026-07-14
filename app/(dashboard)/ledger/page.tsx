"use client";

import { useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useReconciliationDrilldown, useDailyAnomalies } from "@/hooks/useLedger";
import { QrGeneratorModal } from "@/components/products/qr-generator-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";

export default function LedgerPage() {
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const { products, isLoading: isLoadingProducts } = useProducts();
  const { data: drilldownData, isLoading: isLoadingDrilldown } = useReconciliationDrilldown(
    selectedProductId || undefined
  );
  const { anomalies, isLoading: isLoadingAnomalies } = useDailyAnomalies();

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatQty = (qty: number) => {
    if (qty > 0) {
      return (
        <span className="flex items-center justify-end text-emerald-500 font-medium">
          <ArrowUpRight className="h-4 w-4 mr-1" />
          +{qty.toLocaleString("id-ID")}
        </span>
      );
    } else if (qty < 0) {
      return (
        <span className="flex items-center justify-end text-destructive font-medium">
          <ArrowDownRight className="h-4 w-4 mr-1" />
          {qty.toLocaleString("id-ID")}
        </span>
      );
    }
    return <span className="font-medium">{qty}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ledger & Rekonsiliasi</h2>
        <p className="text-muted-foreground mt-1">
          Pantau riwayat pergerakan stok (drilldown) dan deteksi anomali harian.
        </p>
      </div>

      <Tabs defaultValue="drilldown" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="drilldown">Drilldown Produk</TabsTrigger>
          <TabsTrigger value="anomalies">Anomali Harian</TabsTrigger>
        </TabsList>

        <TabsContent value="drilldown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Ledger Produk</CardTitle>
              <CardDescription>
                Pilih produk untuk melihat seluruh riwayat pergerakan stoknya antar batch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 max-w-sm">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="" className="bg-background">-- Pilih Produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} className="bg-background">
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedProductId ? (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  Silakan pilih produk terlebih dahulu untuk melihat riwayat ledger.
                </div>
              ) : isLoadingDrilldown ? (
                <div className="flex justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Memuat riwayat ledger...</span>
                </div>
              ) : drilldownData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                    <span className="text-sm font-medium text-muted-foreground">Total Stok Saat Ini (Semua Batch)</span>
                    <span className="text-2xl font-bold">{drilldownData.current_qty.toLocaleString("id-ID")}</span>
                  </div>

                  {drilldownData.ledger.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                      Belum ada pergerakan stok untuk produk ini.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Waktu</TableHead>
                            <TableHead>Batch ID</TableHead>
                            <TableHead>Tipe Mutasi</TableHead>
                            <TableHead>Referensi</TableHead>
                            <TableHead className="text-right">Perubahan Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drilldownData.ledger.map((entry, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                                {formatDate(entry.created_at)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <div className="flex items-center justify-between gap-2" title={entry.batch_id}>
                                  <span className="truncate max-w-[90px]">{entry.batch_id}</span>
                                  {entry.batch_id !== "-" && <QrGeneratorModal batchId={entry.batch_id} />}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                  {entry.movement_type.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {entry.reference_type ? (
                                  <span className="capitalize">{entry.reference_type}: {entry.reference_id?.substring(0, 8)}...</span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {formatQty(entry.qty_delta)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-destructive p-4 border rounded-md bg-destructive/10">
                  Gagal memuat data drilldown.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Anomali Harian
              </CardTitle>
              <CardDescription>
                Daftar kejanggalan self-consistency harian pada stok produk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAnomalies ? (
                <div className="flex justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Mengecek anomali...</span>
                </div>
              ) : anomalies.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-medium text-foreground">Sistem Konsisten</p>
                  <p className="text-sm mt-1">Tidak ditemukan anomali atau selisih data stok harian.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Produk ID</TableHead>
                        <TableHead className="text-right">Stok Diharapkan</TableHead>
                        <TableHead className="text-right">Stok Aktual</TableHead>
                        <TableHead className="text-right">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {anomalies.map((anom, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{formatDate(anom.date)}</TableCell>
                          <TableCell className="font-mono text-xs">{anom.product_id}</TableCell>
                          <TableCell className="text-right">{anom.expected_qty}</TableCell>
                          <TableCell className="text-right">{anom.actual_qty}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {anom.variance}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
