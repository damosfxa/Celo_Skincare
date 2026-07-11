"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Printer, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

interface QrGeneratorModalProps {
  batchId: string;
}

export function QrGeneratorModal({ batchId }: QrGeneratorModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [qrData, setQrData] = useState<{
    payload: string;
    productName: string;
    sku: string;
    expiryDate: string;
  } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchQrData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/qr`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Gagal memuat data QR");
      
      const payload = json.data.qr_payload;
      setQrData({
        payload,
        productName: json.data.product?.name || "-",
        sku: json.data.product?.sku || "-",
        expiryDate: json.data.expiry_date || "-",
      });

      // Give a tiny delay for canvas to render in DOM
      setTimeout(() => {
        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, payload, {
            width: 250,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
        }
      }, 50);
      
    } catch (error: any) {
      toast.error(error.message);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQrData();
    } else {
      setQrData(null);
    }
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" title="Cetak QR Code" />}>
        <QrCode className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline">Cetak QR</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Label QR Code Batch</DialogTitle>
          <DialogDescription>
            Cetak label ini dan tempelkan pada kardus produk di gudang.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6 min-h-[300px]">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : qrData ? (
            <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-xl shadow-sm border" id="printable-qr">
              <canvas ref={canvasRef} className="w-[250px] h-[250px]"></canvas>
              <div className="text-center text-black space-y-1">
                <p className="font-bold text-lg">{qrData.productName}</p>
                <p className="font-mono text-sm">SKU: {qrData.sku}</p>
                <p className="font-mono text-sm">Batch: {qrData.payload}</p>
                <p className="text-sm font-medium mt-1">Exp: {new Date(qrData.expiryDate).toLocaleDateString('id-ID')}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Tutup
          </Button>
          <Button onClick={handlePrint} disabled={!qrData}>
            <Printer className="mr-2 h-4 w-4" />
            Cetak Label
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
