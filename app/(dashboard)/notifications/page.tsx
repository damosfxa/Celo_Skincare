"use client";

import { useExpiringNotifications } from "@/hooks/useNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, AlertTriangle, ShieldCheck } from "lucide-react";

export default function NotificationsPage() {
  const { notifications, isLoading, isError } = useExpiringNotifications();

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusBadge = (days: number) => {
    if (days < 0) {
      return <Badge variant="destructive" className="whitespace-nowrap">Sudah Kedaluwarsa</Badge>;
    }
    if (days <= 30) {
      return <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 whitespace-nowrap">Kritis ({days} hari)</Badge>;
    }
    if (days <= 90) {
      return <Badge variant="outline" className="text-amber-500 border-amber-500 whitespace-nowrap">Peringatan ({days} hari)</Badge>;
    }
    return <Badge variant="secondary" className="whitespace-nowrap">Aman ({days} hari)</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifikasi</h2>
          <p className="text-muted-foreground mt-1">
            Pantau batch produk yang mendekati tanggal kedaluwarsa (Expired Date).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Barang Expired & Mendekati Expired
          </CardTitle>
          <CardDescription>
            Menampilkan daftar batch dengan sisa waktu kurang dari 90 hari sebelum kedaluwarsa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Memuat notifikasi...</span>
            </div>
          ) : isError ? (
            <div className="text-destructive p-4 border rounded-md bg-destructive/10">
              Gagal memuat notifikasi barang expired.
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center">
              <ShieldCheck className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
              <p className="font-medium text-foreground">Stok Aman</p>
              <p className="text-sm mt-1">Tidak ada batch produk yang kedaluwarsa dalam 90 hari ke depan.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU / Produk</TableHead>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Tgl Kedaluwarsa</TableHead>
                    <TableHead className="text-right">Sisa Stok</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((item, idx) => (
                    <TableRow key={`${item.batch_id}-${idx}`}>
                      <TableCell>
                        <div className="font-medium">{item.sku}</div>
                        <div className="text-sm text-muted-foreground">{item.name}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.batch_id}</TableCell>
                      <TableCell className={item.days_remaining <= 30 ? "text-destructive font-medium" : ""}>
                        {formatDate(item.expiry_date)}
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.current_qty}</TableCell>
                      <TableCell className="text-right">
                        {getStatusBadge(item.days_remaining)}
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
