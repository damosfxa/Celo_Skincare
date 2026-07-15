"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOpnameSessions, createOpnameSession } from "@/hooks/useOpname";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function OpnameSessionsPage() {
  const router = useRouter();
  const { sessions, isLoading, isError, mutate } = useOpnameSessions();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const newSession = await createOpnameSession();
      toast.success("Sesi opname berhasil dibuka");
      await mutate();
      router.push(`/opname/${newSession.session_id}`);
    } catch (error: any) {
      toast.error(error.message);
      setIsCreating(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stok Opname</h2>
          <p className="text-muted-foreground mt-1">
            Kelola sesi pencatatan stok fisik berkala dan rekonsiliasi data.
          </p>
        </div>
        <Button onClick={handleCreateSession} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Buka Sesi Baru
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Sesi</CardTitle>
          <CardDescription>
            Daftar sesi stok opname yang pernah dan sedang berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Memuat daftar sesi...</span>
            </div>
          ) : isError ? (
            <div className="text-destructive p-4 border rounded-md bg-destructive/10">
              Gagal memuat sesi stok opname.
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground flex flex-col items-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
              <p>Belum ada sesi stok opname yang tercatat.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sesi ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waktu Dibuka</TableHead>
                    <TableHead>Waktu Ditutup</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono text-xs">{session.id}</TableCell>
                      <TableCell>
                        {session.status === "OPEN" ? (
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500">Aktif</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Selesai</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(session.created_at)}</TableCell>
                      <TableCell className="text-sm">{formatDate(session.closed_at || "")}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/opname/${session.id}`} prefetch={false}>
                          <Button variant={session.status === "OPEN" ? "default" : "outline"} size="sm">
                            {session.status === "OPEN" ? "Lanjutkan" : "Lihat Detail"}
                          </Button>
                        </Link>
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
