"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
}

export function CameraScanner({ onScan }: CameraScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {
          // ignore sync error
        }
      }
    };
  }, [isScanning]);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current && isScanning) {
        try {
          scannerRef.current.stop().then(() => {
            setIsScanning(false);
            scannerRef.current?.clear();
          }).catch(() => {});
        } catch (e) {
          setIsScanning(false);
        }
      }
      return;
    }

    // Delay a bit to allow Dialog content to mount in DOM
    const timer = setTimeout(() => {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader", { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      }

      setIsScanning(true);
      scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          // Success callback
          toast.success("QR Berhasil dipindai!");
          onScan(decodedText);
          setIsOpen(false);
        },
        (errorMessage) => {
          // Parse errors are ignored (it just means it hasn't found a QR yet)
        }
      ).catch((err) => {
        setIsScanning(false);
        toast.error("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
        console.error(err);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen]);


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon" title="Scan via Kamera" />}>
        <Camera className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan QR Label Produk</DialogTitle>
          <DialogDescription>
            Arahkan kamera ke QR Code yang ada di produk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4">
          <div id="reader" className="w-full max-w-sm rounded-lg overflow-hidden border"></div>
          {!isScanning && isOpen && (
            <div className="flex items-center text-muted-foreground mt-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Menyiapkan kamera...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
