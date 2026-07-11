"use client";

import { useState } from "react";
import { 
  SimulatedOrder, 
  simulateNewOrders, 
  simulateShipOrder, 
  simulateCancelOrder, 
  simulateReturnOrder 
} from "@/hooks/useOrders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, PackageOpen, X, RotateCcw, Box } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function SimulationPage() {
  const [orders, setOrders] = useState<SimulatedOrder[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null); // orderId-action
  
  const [channel, setChannel] = useState("shopee");
  const [count, setCount] = useState("1");

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
