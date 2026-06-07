import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, ScanLine } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Ignore continuous scanning errors
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="bg-[#1A365D] p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-emerald-400" />
            وجّه الكاميرا نحو الباركود
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-2 bg-slate-50">
          <div id="qr-reader" className="w-full rounded-xl overflow-hidden border-2 border-dashed border-indigo-300"></div>
        </div>
      </div>
    </div>
  );
}