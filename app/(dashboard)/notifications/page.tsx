"use client";

import { useExpiringNotifications, useTiktokClaims, useUnverifiedOpeningBalances } from "@/hooks/useNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, ShieldCheck, CheckCircle2, Ticket, ClipboardList } from "lucide-react";

export default function NotificationsPage() {
  const { notifications, isLoading, isError } = useExpiringNotifications();
  const { claims, isLoading: isLoadingClaims, isError: isErrorClaims } = useTiktokClaims();
  const { unverified, isLoading: isLoadingUnverified, isError: isErrorUnverified } = useUnverifiedOpeningBalances();

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
      return <Badge variant="outline" className="text-red-500 border-red-500 whitespace-nowrap">Sudah Kedaluwarsa</Badge>;
    }
    if (days <= 30) {
      return <Badge variant="outline" className="text-red-500 border-red-500 whitespace-nowrap">Kritis ({days} hari)</Badge>;
    }
    if (days <= 90) {
      return <Badge variant="outline" className="text-amber-500 border-amber-500 whitespace-nowrap">Peringatan ({days} hari)</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">Aman ({days} hari)</Badge>;
  };

  const getClaimDaysBadge = (days: number) => {
    if (days < 0) {
      return <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">Hangus</Badge>;
    }
    if (days <= 7) {
      return <Badge variant="outline" className="text-red-500 border-red-500 whitespace-nowrap">Kritis ({days} hari)</Badge>;
    }
    if (days <= 14) {
      return <Badge variant="outline" className="text-amber-500 border-amber-500 whitespace-nowrap">Peringatan ({days} hari)</Badge>;
    }
    return <Badge variant="outline" className="text-emerald-500 border-emerald-500 whitespace-nowrap">Aman ({days} hari)</Badge>;
  };

  const getConditionBadge = (cond: string) => {
    if (cond === 'PENDING_INSPECTION') return <Badge variant="outline" className="text-amber-500 border-amber-500 whitespace-nowrap">Menunggu Inspeksi</Badge>;
    if (cond === 'DAMAGED' || cond === 'LOST') return <Badge variant="outline" className="text-red-500 border-red-500 whitespace-nowrap">{cond === 'DAMAGED' ? 'Barang Rusak' : 'Barang Hilang'}</Badge>;
    return <Badge variant="outline" className="whitespace-nowrap">{cond}</Badge>;
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
            <ClipboardList className="h-5 w-5 text-primary" />
            Stok Awal Belum Terverifikasi
          </CardTitle>
          <CardDescription>
            Daftar batch dari input stok awal (opening balance) yang belum pernah dihitung secara fisik melalui Stok Opname.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUnverified ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isErrorUnverified ? (
            <div className="text-destructive p-4 border rounded-md bg-destructive/10">
              Gagal memuat data stok awal.
            </div>
          ) : unverified.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
              <p className="font-medium text-foreground">Semua Stok Terverifikasi</p>
              <p className="text-sm mt-1">Semua stok awal sudah terverifikasi lewat opname fisik.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU / Produk</TableHead>
                    <TableHead>Batch ID / Code</TableHead>
                    <TableHead className="text-right">Kuantitas</TableHead>
                    <TableHead>Tanggal Input</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unverified.map((item) => (
                    <TableRow key={item.ledger_id}>
                      <TableCell>
                        <div className="font-medium">{item.sku}</div>
                        <div className="text-sm text-muted-foreground">{item.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">{item.batch_id}</div>
                        <div className="text-xs text-muted-foreground">{item.batch_code}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.qty_delta.toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        {formatDate(item.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
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
                      <TableCell className="text-right font-medium">{item.current_qty.toLocaleString("id-ID")}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Klaim TikTok Menunggu Diajukan
          </CardTitle>
          <CardDescription>
            Daftar retur TikTok Shop bermasalah (rusak/hilang) yang harus segera diklaim ke platform sebelum hangus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClaims ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isErrorClaims ? (
            <div className="text-destructive p-4 border rounded-md bg-destructive/10">
              Gagal memuat data klaim TikTok.
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
              <p className="font-medium text-foreground">Semua Aman</p>
              <p className="text-sm mt-1">Tidak ada klaim TikTok yang perlu ditindaklanjuti saat ini.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU / Produk</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Kondisi</TableHead>
                    <TableHead>Batas Klaim</TableHead>
                    <TableHead className="text-right">Sisa Hari</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <div className="font-medium">{claim.sku}</div>
                        <div className="text-sm text-muted-foreground">{claim.name}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{claim.external_order_id}</TableCell>
                      <TableCell className="text-right font-medium">{claim.qty.toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        {getConditionBadge(claim.condition)}
                      </TableCell>
                      <TableCell className={claim.days_remaining <= 7 ? "text-destructive font-medium" : ""}>
                        {formatDate(claim.claim_deadline)}
                      </TableCell>
                      <TableCell className="text-right">
                        {getClaimDaysBadge(claim.days_remaining)}
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
