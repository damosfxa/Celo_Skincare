"use client";

import Link from "next/link";
import { useDashboardToday, type WorklistItem } from "@/hooks/useDashboardToday";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Package,
  CalendarClock,
  RotateCcw,
  AlertTriangle,
  PackageX,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Edit,
  ClipboardList,
  FileDigit,
  Store,
} from "lucide-react";

const WORKLIST_ICON: Record<WorklistItem["type"], typeof Package> = {
  oversell_risk: PackageX,
  anomaly: AlertTriangle,
  tiktok_claim: Clock,
  expiring_batch: CalendarClock,
  pending_return: RotateCcw,
};

const WORKLIST_LABEL: Record<WorklistItem["type"], string> = {
  oversell_risk: "Resiko Oversell",
  anomaly: "Anomali Stok",
  tiktok_claim: "Klaim TikTok",
  expiring_batch: "Batch Kedaluwarsa",
  pending_return: "Retur Pending",
};

const QUICK_ACTIONS = [
  { label: "Keluar Manual", href: "/simulation", icon: Edit },
  { label: "Mulai Opname", href: "/opname", icon: ClipboardList },
  { label: "Lihat Ledger", href: "/ledger", icon: FileDigit },
  { label: "Simulasi Marketplace", href: "/simulation", icon: Store },
];

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboardToday();

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-destructive p-4 border rounded-md bg-destructive/10">
        Gagal memuat data dashboard.
      </div>
    );
  }

  const stats = [
    { label: "Total SKU Aktif", value: data.stats.total_active_sku, icon: Package, alert: false },
    {
      label: "Batch Mendekati Kedaluwarsa",
      value: data.stats.batches_near_expiry,
      icon: CalendarClock,
      alert: data.stats.batches_near_expiry > 0,
    },
    {
      label: "Retur Menunggu Inspeksi",
      value: data.stats.returns_pending_inspection,
      icon: RotateCcw,
      alert: data.stats.returns_pending_inspection > 0,
    },
    {
      label: "Anomali Terbuka",
      value: data.stats.open_anomalies,
      icon: AlertTriangle,
      alert: data.stats.open_anomalies > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tugas Hari Ini</h1>
        <p className="text-muted-foreground capitalize">{today}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className={stat.alert ? "border-destructive/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon
                className={cn("h-4 w-4", stat.alert ? "text-destructive" : "text-muted-foreground")}
              />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", stat.alert && "text-destructive")}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Worklist Hari Ini</CardTitle>
            <CardDescription>
              Hal-hal yang butuh perhatian, diurutkan dari yang paling mendesak.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {data.worklist.length === 0 ? (
              <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                <p className="font-medium text-foreground">Semua Aman</p>
                <p className="text-sm mt-1">Gak ada tugas yang butuh perhatian hari ini.</p>
              </div>
            ) : (
              data.worklist.map((item) => {
                const Icon = WORKLIST_ICON[item.type];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex gap-3 p-3 rounded-md border-l-4 bg-card hover:bg-accent/50 transition-colors",
                      item.priority === "HIGH"
                        ? "border-l-destructive"
                        : item.priority === "MEDIUM"
                          ? "border-l-amber-500"
                          : "border-l-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <Badge
                        variant={item.priority === "HIGH" ? "destructive" : "outline"}
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          item.priority === "MEDIUM" && "border-amber-500 text-amber-600"
                        )}
                      >
                        {WORKLIST_LABEL[item.type]}
                      </Badge>
                      <p className="font-medium mt-1">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pergerakan Terbaru</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recent_movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pergerakan stok.</p>
              ) : (
                data.recent_movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.product_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.movement_type.replace(/_/g, " ")} · {m.batch_code}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                        {new Date(m.created_at).toLocaleString("id-ID", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1 font-medium shrink-0",
                        m.qty_delta > 0 ? "text-emerald-600" : "text-destructive"
                      )}
                    >
                      {m.qty_delta > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {m.qty_delta > 0 ? "+" : ""}
                      {m.qty_delta.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Aksi Cepat</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-auto py-3 flex-col gap-1"
                  )}
                >
                  <action.icon className="h-4 w-4" />
                  <span className="text-xs">{action.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
