"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ZoomIn } from "lucide-react";
import { toast } from "sonner";

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
}

export function CameraScanner({ onScan }: CameraScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // State untuk kontrol zoom manual
  const [zoomCapability, setZoomCapability] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  // Pola ref untuk onScan agar mendapat closure terbaru tanpa me-restart useEffect utama
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

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
      // Bersihkan state kapabilitas zoom saat dialog ditutup
      setZoomCapability(null);
      
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
          // Panggil lewat ref agar selalu versi fungsi terbaru
          onScanRef.current(decodedText);
          setIsOpen(false);
        },
        (errorMessage) => {
          // Parse errors are ignored (it just means it hasn't found a QR yet)
        }
      ).then(() => {
        // Setelah kamera sukses dijalankan, terapkan constraint defensif
        try {
          const trackCaps = scannerRef.current?.getRunningTrackCapabilities() as any;
          if (!trackCaps) return;

          const constraints: any = { advanced: [{}] };
          let shouldApply = false;

          // 1. Terapkan Auto-focus continuous jika didukung
          if (trackCaps.focusMode && Array.isArray(trackCaps.focusMode) && trackCaps.focusMode.includes("continuous")) {
            constraints.advanced[0].focusMode = "continuous";
            shouldApply = true;
          }

          // 2. Deteksi kapabilitas Zoom
          if (trackCaps.zoom && typeof trackCaps.zoom.min === 'number') {
            const { min, max, step } = trackCaps.zoom;
            setZoomCapability({ min, max, step });
            
            // Set initial zoom ke 35% dari rentang supaya agak diperbesar
            const initialZoom = min + (max - min) * 0.35;
            constraints.advanced[0].zoom = initialZoom;
            setCurrentZoom(initialZoom);
            shouldApply = true;
          }

          if (shouldApply) {
            scannerRef.current?.applyVideoConstraints(constraints).catch(() => {});
          }
        } catch (e) {
          // Abaikan error (device tidak mendukung advanced constraint)
        }
      }).catch((err) => {
        setIsScanning(false);
        toast.error("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
        console.error(err);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen]); // dependency onScan dihapus karena pakai useRef

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCurrentZoom(value);
    
    if (scannerRef.current && isScanning) {
      try {
        scannerRef.current.applyVideoConstraints({
          advanced: [{ zoom: value }]
        } as any).catch(() => {});
      } catch (err) {
        // Abaikan
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon" title="Scan via Kamera" className="h-full" />}>
        <Camera className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan QR Label Produk</DialogTitle>
          <DialogDescription>
            Arahkan kamera ke QR Code yang ada di produk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 space-y-4">
          <div id="reader" className="w-full max-w-sm rounded-lg overflow-hidden border"></div>
          
          {/* Slider Zoom Kondisional */}
          {zoomCapability && isScanning && (
            <div className="w-full max-w-sm space-y-2 bg-muted/30 p-3 rounded-md border">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span className="flex items-center"><ZoomIn className="w-3.5 h-3.5 mr-1" /> Zoom Manual</span>
                <span>{currentZoom.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min={zoomCapability.min} 
                max={zoomCapability.max} 
                step={zoomCapability.step}
                value={currentZoom}
                onChange={handleZoomChange}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          )}

          {!isScanning && isOpen && (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Menyiapkan kamera...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
