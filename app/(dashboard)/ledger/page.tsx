"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useProducts } from "@/hooks/useProducts";
import { useReconciliationDrilldown, useDailyAnomalies, correctLedgerEntry, LedgerEntry } from "@/hooks/useLedger";
import { QrGeneratorModal } from "@/components/products/qr-generator-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSearchParams } from "next/navigation";
import { scrollElementIntoView } from "@/lib/utils";
import { downloadXlsx } from "@/lib/xlsx-export";
import { toast } from "sonner";
import { Loader2, AlertTriangle, ArrowDownRight, ArrowUpRight, Edit, Download } from "lucide-react";

export default function LedgerPage() {
  const searchParams = useSearchParams();
  // States untuk Filter -- SENGAJA di komponen luar ini (yang tidak ikut
  // "lahir ulang"), bukan di LedgerPageContent -- supaya filter yang sudah
  // dipilih user TIDAK ikut ke-reset tiap kali link produk diklik dari
  // Anomali Harian. Ditemukan lewat code review: dulu semua filter ada di
  // dalam LedgerPageContent, jadi remount (lihat komentar `key` di bawah)
  // otomatis membuang filter yang sedang aktif tiap ganti produk.
  const [filterMovementType, setFilterMovementType] = useState<string>("all");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterReason, setFilterReason] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  // key={...} SENGAJA: cara paling pasti supaya halaman ini "lahir ulang"
  // (semua state di dalamnya kebaca fresh dari URL yang terbaru) tiap kali
  // link diklik (misal nama produk di Anomali Harian) -- persis efeknya
  // seperti refresh manual, tanpa benar-benar reload halaman. Sebelumnya
  // dicoba pakai bandingkan URL lama-vs-baru secara manual (dulu identitas
  // objek, lalu teks), dua-duanya masih kebobolan di klik ke-2/ke-3 --
  // remount pakai `key` React ini yang dijamin selalu benar, gak gantung ke
  // detail perilaku internal Next.js yang bisa berubah-ubah.
  return (
    <LedgerPageContent
      key={searchParams.toString()}
      searchParams={searchParams}
      filterMovementType={filterMovementType}
      setFilterMovementType={setFilterMovementType}
      filterChannel={filterChannel}
      setFilterChannel={setFilterChannel}
      filterReason={filterReason}
      setFilterReason={setFilterReason}
      filterDateFrom={filterDateFrom}
      setFilterDateFrom={setFilterDateFrom}
      filterDateTo={filterDateTo}
      setFilterDateTo={setFilterDateTo}
    />
  );
}

type LedgerPageContentProps = {
  searchParams: ReturnType<typeof useSearchParams>;
  filterMovementType: string;
  setFilterMovementType: (value: string) => void;
  filterChannel: string;
  setFilterChannel: (value: string) => void;
  filterReason: string;
  setFilterReason: (value: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (value: string) => void;
  filterDateTo: string;
  setFilterDateTo: (value: string) => void;
};

function LedgerPageContent({
  searchParams,
  filterMovementType,
  setFilterMovementType,
  filterChannel,
  setFilterChannel,
  filterReason,
  setFilterReason,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
}: LedgerPageContentProps) {
  const initialTab = searchParams.get("tab") === "anomalies" ? "anomalies" : "drilldown";
  const initialProduct = searchParams.get("product") || "";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProduct);
  // const biasa (bukan useState): LedgerPageContent selalu "lahir ulang"
  // pas URL berubah (lihat key={...} di LedgerPage), jadi initialTab/
  // initialProduct sudah pasti tetap sama sepanjang umur komponen ini --
  // nangkep sekali lewat useState cuma nambah 1 hook tanpa manfaat.
  // Dipakai buat nentuin perlu auto-scroll atau tidak, lihat effect scroll
  // di bawah, dekat useReconciliationDrilldown.
  const arrivedViaProductLink = initialTab === "drilldown" && !!initialProduct;
  const hasAutoScrolledRef = useRef(false);

  type CorrectionState = {
    entry: LedgerEntry;
    product: { id: string; sku: string; name: string } & Record<string, unknown>;
    step: 'input' | 'confirm';
    qtyDelta: string;
    note: string;
  };
  const [correctionState, setCorrectionState] = useState<CorrectionState | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { products, isLoading: isLoadingProducts } = useProducts();
  const { data: drilldownData, isLoading: isLoadingDrilldown, mutate } = useReconciliationDrilldown(
    selectedProductId || undefined
  );
  const { anomalies, isLoading: isLoadingAnomalies } = useDailyAnomalies();

  // Scroll halus ke tabel Riwayat Ledger begitu tiba di sini lewat link
  // (bukan lewat klik tab manual) -- ditandai arrivedViaProductLink, nilai
  // yang ditangkap sekali pas komponen ini lahir (lihat atas). Ini efek ke
  // luar (posisi scroll browser), jadi memang tempatnya di useEffect.
  //
  // SENGAJA nunggu isLoadingDrilldown selesai (data beneran sudah kegambar)
  // sebelum scroll -- kalau scroll pas masih skeleton loading, posisinya
  // dihitung dari skeleton yang kosong/pendek, begitu data asli masuk
  // (biasanya lebih tinggi) tampilan jadi kelihatan "gagal scroll" padahal
  // cuma salah waktu. hasAutoScrolledRef mencegah scroll ini terulang lagi
  // kalau nanti user ganti produk manual lewat dropdown di mount yang sama.
  useEffect(() => {
    if (arrivedViaProductLink && !isLoadingDrilldown && !hasAutoScrolledRef.current) {
      hasAutoScrolledRef.current = true;
      // Tunggu 1 frame biar tabel yang baru selesai dimuat benar-benar
      // kerender dulu, baru discroll. Dulu 2 frame bersarang (jaga-jaga dari
      // versi awal effect ini, sebelum ada penjaga isLoadingDrilldown) --
      // sekarang effect ini baru jalan SETELAH data beneran siap (React
      // sudah commit render-nya), jadi 1 frame sudah cukup.
      requestAnimationFrame(() => scrollElementIntoView("drilldown-view"));
    }
  }, [arrivedViaProductLink, isLoadingDrilldown]);

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

  const calculateBatchStock = (batchId: string) => {
    if (!drilldownData?.ledger) return 0;
    return drilldownData.ledger
      .filter((e) => e.batch_id === batchId)
      .reduce((sum, e) => sum + e.qty_delta, 0);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionState) return;

    if (correctionState.step === 'input') {
      if (!correctionState.qtyDelta || !correctionState.note) {
        toast.error("Selisih dan catatan wajib diisi.");
        return;
      }
      setCorrectionState({ ...correctionState, step: 'confirm' });
    } else if (correctionState.step === 'confirm') {
      setIsCorrecting(true);
      try {
        await correctLedgerEntry(correctionState.entry.id, parseInt(correctionState.qtyDelta, 10), correctionState.note);
        toast.success("Koreksi ledger berhasil disimpan.");
        mutate();
        setCorrectionState(null);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setIsCorrecting(false);
      }
    }
  };

  const runningBalances = drilldownData?.ledger
    ? drilldownData.ledger.reduce((acc: number[], entry) => {
        const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
        acc.push(prev + entry.qty_delta);
        return acc;
      }, [])
    : [];

  const uniqueMovementTypes = drilldownData?.ledger 
    ? Array.from(new Set(drilldownData.ledger.map(e => e.movement_type)))
    : [];

  const uniqueReasons = drilldownData?.ledger 
    ? Array.from(new Set(drilldownData.ledger.map(e => e.reason).filter(Boolean))) as string[]
    : [];

  const filteredRows = drilldownData?.ledger
    ? drilldownData.ledger.map((entry, idx) => ({ entry, idx })).filter(({ entry }) => {
        let match = true;
        
        if (filterMovementType !== "all" && entry.movement_type !== filterMovementType) {
          match = false;
        }
        
        if (filterReason !== "all") {
          const entryReason = entry.reason || "none";
          if (entryReason.toLowerCase() !== filterReason.toLowerCase()) {
            match = false;
          }
        }
        
        if (filterChannel !== "all") {
          const entryChannel = entry.channel || "";
          if (entryChannel.toLowerCase() !== filterChannel.toLowerCase()) {
            match = false;
          }
        }
        
        if (filterDateFrom) {
          if (new Date(entry.created_at) < new Date(filterDateFrom)) match = false;
        }
        
        if (filterDateTo) {
          const toDate = new Date(filterDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (new Date(entry.created_at) > toDate) match = false;
        }
        
        return match;
      })
    : [];

  const handleExportExcel = async () => {
    if (!filteredRows || filteredRows.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    setIsExporting(true);
    try {
      const headers = ["Waktu", "Batch ID", "Tipe Mutasi", "Channel", "Referensi", "Alasan", "Ref. Campaign", "Perubahan Qty", "Saldo Berjalan"];

      const rows = filteredRows.map(({ entry, idx }) => {
        const waktu = formatDate(entry.created_at);
        const batchId = entry.batch_code || entry.batch_id;
        const type = entry.movement_type;
        const channel = entry.channel || "-";
        const reference = entry.reference_type ? `${entry.reference_type}: ${entry.reference_id}` : "-";
        const reason = entry.reason || "-";
        const campaign = entry.campaign_reference || "-";
        const qty = entry.qty_delta;
        const saldo = runningBalances[idx] !== undefined ? runningBalances[idx] : 0;

        return [waktu, batchId, type, channel, reference, reason, campaign, qty, saldo];
      });

      const selectedProduct = products.find(p => p.id === selectedProductId);
      const skuForFilename = selectedProduct?.sku?.replace(/[^a-zA-Z0-9-]/g, "_") || "produk";
      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadXlsx(`ledger_${skuForFilename}_${dateStr}.xlsx`, headers, rows);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ledger & Rekonsiliasi</h2>
        <p className="text-muted-foreground mt-1">
          Pantau riwayat pergerakan stok (drilldown) dan deteksi anomali harian.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="drilldown">Drilldown Produk</TabsTrigger>
          <TabsTrigger value="anomalies">Anomali Harian</TabsTrigger>
        </TabsList>

        <TabsContent value="drilldown" className="space-y-4">
          <Card id="drilldown-view" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Riwayat Ledger Produk</CardTitle>
              <CardDescription>
                Pilih produk untuk melihat seluruh riwayat pergerakan stoknya antar batch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 max-w-sm">
                <Select
                  value={selectedProductId}
                  onValueChange={(value) => setSelectedProductId(value as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Produk">
                      {(value: string | null) => {
                        if (!value) return "Pilih Produk";
                        if (isLoadingProducts) return "Memuat...";
                        const p = products.find((pr) => pr.id === value);
                        return p ? `${p.sku} - ${p.name}` : "Produk tidak ditemukan";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProductId && !isLoadingDrilldown && drilldownData && (
                <div className="mb-6 space-y-4 p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Filter Data Ledger</h3>
                    <Button onClick={handleExportExcel} disabled={isExporting} variant="outline" size="sm" className="h-8">
                      {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      {isExporting ? "Mengekspor..." : "Export Excel"}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipe Mutasi</Label>
                      <Select
                        value={filterMovementType}
                        onValueChange={(value) => setFilterMovementType(value as string)}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Tipe Mutasi">
                            {(value: string | null) => (!value || value === "all" ? "Semua" : value.replace(/_/g, " "))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua</SelectItem>
                          {uniqueMovementTypes.map(type => (
                            <SelectItem key={type} value={type}>{type.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Alasan (Manual)</Label>
                      <Select
                        value={filterReason}
                        onValueChange={(value) => setFilterReason(value as string)}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Alasan (Manual)">
                            {(value: string | null) => (!value || value === "all" ? "Semua" : value.replace(/_/g, " "))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua</SelectItem>
                          {uniqueReasons.map(reason => (
                            <SelectItem key={reason} value={reason} className="capitalize">{reason.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs">Channel</Label>
                      <Select
                        value={filterChannel}
                        onValueChange={(value) => setFilterChannel(value as string)}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Channel">
                            {(value: string | null) => (!value || value === "all" ? "Semua" : value)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua</SelectItem>
                          <SelectItem value="Shopee">Shopee</SelectItem>
                          <SelectItem value="TikTok">TikTok</SelectItem>
                          <SelectItem value="Offline">Offline</SelectItem>
                          <SelectItem value="Internal">Internal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs">Dari Tanggal</Label>
                      <Input 
                        type="date" 
                        className="h-9 text-sm"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sampai Tanggal</Label>
                      <Input 
                        type="date" 
                        className="h-9 text-sm"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!selectedProductId ? (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  Silakan pilih produk terlebih dahulu untuk melihat riwayat ledger.
                </div>
              ) : isLoadingDrilldown ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                </div>
              ) : drilldownData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                    <span className="text-sm font-medium text-muted-foreground">Total Stok Saat Ini (Semua Batch)</span>
                    <span className="text-2xl font-bold">{drilldownData.current_qty.toLocaleString("id-ID")}</span>
                  </div>

                  {filteredRows.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                      Belum ada pergerakan stok atau tidak ada data yang cocok dengan filter.
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Waktu</TableHead>
                            <TableHead>Batch ID</TableHead>
                            <TableHead>Tipe Mutasi</TableHead>
                            <TableHead>Alasan</TableHead>
                            <TableHead>Referensi</TableHead>
                            <TableHead className="text-right">Perubahan Qty</TableHead>
                            <TableHead className="text-right">Saldo Berjalan</TableHead>
                            <TableHead className="text-right w-[60px]">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRows.map(({ entry, idx }) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                                {formatDate(entry.created_at)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <div className="flex items-center justify-between gap-2" title={entry.batch_code || entry.batch_id}>
                                  <span className="truncate max-w-[90px]">{entry.batch_code || entry.batch_id}</span>
                                  {entry.batch_id !== "-" && <QrGeneratorModal batchId={entry.batch_id} />}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                  {entry.movement_type.replace(/_/g, " ")}
                                </Badge>
                                {entry.channel && (
                                  <div className="mt-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                    {entry.channel}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {entry.reason ? (
                                  <div className="text-foreground font-medium capitalize">
                                    {entry.reason.replace(/_/g, " ")}
                                    {entry.campaign_reference && (
                                      <span className="text-muted-foreground block text-[11px] font-normal mt-0.5 normal-case">Ref: {entry.campaign_reference}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
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
                              <TableCell className="text-right font-medium">
                                {runningBalances[idx] !== undefined ? runningBalances[idx].toLocaleString("id-ID") : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {(entry.movement_type === "IN_MAKLON" || entry.movement_type === "OUT_MANUAL") ? (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                                    title="Koreksi Entri"
                                    onClick={() => {
                                      const product = products.find(p => p.id === selectedProductId);
                                      if (product) {
                                        setCorrectionState({
                                          entry,
                                          product,
                                          step: 'input',
                                          qtyDelta: '',
                                          note: ''
                                        });
                                      }
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
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
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
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
                        <TableHead>Prioritas</TableHead>
                        <TableHead>Terdeteksi</TableHead>
                        <TableHead>Produk</TableHead>
                        <TableHead>Channel & No. Order</TableHead>
                        <TableHead>Jenis Anomali</TableHead>
                        <TableHead className="text-right">Qty Nyangkut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {anomalies.map((anom) => (
                        <TableRow key={anom.anomaly_id}>
                          <TableCell>
                            <Badge
                              variant={anom.priority_level === 'HIGH' ? 'destructive' : 'outline'}
                              className={anom.priority_level === 'MEDIUM' ? 'border-amber-500 text-amber-600' : ''}
                            >
                              {anom.priority_level}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(anom.detected_at)}</TableCell>
                          <TableCell>
                            {anom.affected_products && anom.affected_products.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {anom.affected_products.map((p) => (
                                  <Link key={p.id} href={`/ledger?tab=drilldown&product=${p.id}`}>
                                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 text-[10px]">
                                      {p.name}
                                    </Badge>
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {anom.channel ? `${anom.channel} · ${anom.external_order_id}` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">{anom.label}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {anom.leaked_qty}
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

      <Dialog
        open={!!correctionState}
        onOpenChange={(open, eventDetails) => {
          if (open) return;
          // Cegah dialog ini ketutup (X/ESC/klik luar) selagi koreksi masih
          // disimpan -- tanpa ini, operator bisa buru-buru buka koreksi
          // untuk entri LAIN, dan begitu request lama selesai, state-nya
          // ketimpa `setCorrectionState(null)` tanpa peringatan, menghapus
          // isian form koreksi kedua yang sedang diisi.
          if (isCorrecting) {
            eventDetails.cancel();
            return;
          }
          setCorrectionState(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koreksi Entri Ledger</DialogTitle>
          </DialogHeader>
          {correctionState && (
            <form onSubmit={handleCorrectionSubmit} className="space-y-4 mt-4">
              {correctionState.step === 'input' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Entri Asli</Label>
                    <div className="text-sm p-3 rounded bg-muted/50 border flex items-center justify-between">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{correctionState.entry.movement_type.replace(/_/g, " ")}</Badge>
                        <p className="text-muted-foreground text-xs">{formatDate(correctionState.entry.created_at)}</p>
                      </div>
                      <div className="text-right">
                        {formatQty(correctionState.entry.qty_delta)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qtyDelta">Jumlah Selisih (Koreksi)</Label>
                    <Input
                      id="qtyDelta"
                      type="number"
                      required
                      placeholder="Misal: -2 atau 5"
                      value={correctionState.qtyDelta}
                      onChange={(e) => setCorrectionState({...correctionState, qtyDelta: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">Input angka negatif untuk mengurangi stok, positif untuk menambah stok.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">Alasan Koreksi</Label>
                    <Input
                      id="note"
                      type="text"
                      required
                      placeholder="Wajib diisi..."
                      value={correctionState.note}
                      onChange={(e) => setCorrectionState({...correctionState, note: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Lanjut Konfirmasi
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produk:</span>
                      <span className="font-medium text-right">{correctionState.product.sku} - {correctionState.product.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entri Asli:</span>
                      <span className="font-medium text-right">{correctionState.entry.qty_delta.toLocaleString("id-ID")} pcs ({correctionState.entry.movement_type.replace(/_/g, " ")})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jumlah Koreksi (Selisih):</span>
                      <span className="font-medium text-right text-primary">{parseInt(correctionState.qtyDelta, 10).toLocaleString("id-ID")} pcs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Alasan:</span>
                      <span className="font-medium text-right">{correctionState.note}</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-medium">
                        <span>Dampak Stok pada Batch Ini:</span>
                        <span>{calculateBatchStock(correctionState.entry.batch_id).toLocaleString("id-ID")} → {(calculateBatchStock(correctionState.entry.batch_id) + parseInt(correctionState.qtyDelta, 10)).toLocaleString("id-ID")}</span>
                      </div>
                      {(calculateBatchStock(correctionState.entry.batch_id) + parseInt(correctionState.qtyDelta, 10)) <= 15 && (
                        <div className="flex items-center gap-2 text-amber-500 text-xs mt-2 p-2 bg-amber-500/10 rounded">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Peringatan: stok batch ini akan menjadi rendah ({(calculateBatchStock(correctionState.entry.batch_id) + parseInt(correctionState.qtyDelta, 10))} pcs) setelah aksi ini.</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setCorrectionState({...correctionState, step: 'input'})} disabled={isCorrecting}>
                      Kembali
                    </Button>
                    <Button type="submit" disabled={isCorrecting}>
                      {isCorrecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Ya, Simpan Koreksi
                    </Button>
                  </div>
                </div>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
