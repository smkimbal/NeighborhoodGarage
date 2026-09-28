import React, { useState } from 'react';
import { 
  X, 
  ScanLine, 
  QrCode, 
  CheckCircle2, 
  MapPin, 
  Key, 
  ArrowRight, 
  Sparkles, 
  RefreshCw,
  Camera,
  Layers
} from 'lucide-react';
import { RentalBooking, ToolItem } from '../types';

interface BarcodeScannerModalProps {
  activeBookings: RentalBooking[];
  tools: ToolItem[];
  onClose: () => void;
  onScanSuccess: (bookingId: string, actionType: 'scan_out' | 'scan_in' | 'porch_dropoff') => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  activeBookings,
  tools,
  onClose,
  onScanSuccess,
}) => {
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    activeBookings[0]?.id || ''
  );
  const [scanMode, setScanMode] = useState<'scan_out' | 'scan_in' | 'porch_dropoff'>('scan_in');
  const [isScanning, setIsScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);

  const selectedBooking = activeBookings.find((b) => b.id === selectedBookingId);
  const matchingTool = tools.find((t) => t.id === selectedBooking?.toolId);

  const targetBarcode = matchingTool?.barcode || 'TS-DW-771-8921';

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanCompleted(true);
      if (selectedBooking) {
        onScanSuccess(selectedBooking.id, scanMode);
      }
    }, 1200);
  };

  const handlePorchDropoff = () => {
    if (selectedBooking) {
      onScanSuccess(selectedBooking.id, 'porch_dropoff');
      setScanCompleted(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Equipment Barcode Check-In / Out</h3>
              <p className="text-[11px] text-slate-400">Inventory Verification &amp; Contactless Handoff</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* Scan Action Mode Selector */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => {
                setScanMode('scan_out');
                setScanCompleted(false);
              }}
              className={`py-2 rounded-xl transition ${
                scanMode === 'scan_out'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scan Out (Pickup)
            </button>
            <button
              onClick={() => {
                setScanMode('scan_in');
                setScanCompleted(false);
              }}
              className={`py-2 rounded-xl transition ${
                scanMode === 'scan_in'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scan In (Return)
            </button>
            <button
              onClick={() => {
                setScanMode('porch_dropoff');
                setScanCompleted(false);
              }}
              className={`py-2 rounded-xl transition ${
                scanMode === 'porch_dropoff'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Porch Drop-off
            </button>
          </div>

          {/* Active Booking Selector */}
          {activeBookings.length > 0 ? (
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Select Active Rental Equipment
              </label>
              <select
                value={selectedBookingId}
                onChange={(e) => {
                  setSelectedBookingId(e.target.value);
                  setScanCompleted(false);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
              >
                {activeBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.toolTitle} • {b.lenderName} ({b.lenderNeighborhood})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-800 text-center text-xs text-slate-400">
              No active tool rentals in progress to scan.
            </div>
          )}

          {/* SCANNER CAMERA VIEWFINDER */}
          {scanMode !== 'porch_dropoff' ? (
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {/* Simulated Camera Feed Background */}
              {matchingTool && (
                <img
                  src={matchingTool.images[0]}
                  alt=""
                  className="w-full h-full object-cover opacity-40 blur-[1px]"
                />
              )}

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-0 m-6 border-2 border-dashed border-amber-400/60 rounded-xl flex items-center justify-center pointer-events-none">
                <div className="w-56 h-28 border-2 border-amber-400 bg-slate-950/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center p-3 text-center">
                  <ScanLine className="w-6 h-6 text-amber-400 animate-pulse mb-1" />
                  <span className="font-mono text-xs font-bold text-white tracking-wider">
                    {targetBarcode}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Align Barcode or QR within frame
                  </span>
                </div>

                {isScanning && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse top-1/2" />
                )}
              </div>

              {/* Status Badge */}
              <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] text-amber-300 font-semibold flex items-center gap-1.5">
                <Camera className="w-3 h-3 text-amber-400" />
                <span>Optical Barcode Reader Active</span>
              </div>
            </div>
          ) : (
            /* PORCH DROP-OFF ALTERNATIVE VIEW */
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <MapPin className="w-4 h-4" />
                <span>Contactless Porch Drop-Off Confirmation</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                If the owner is not physically present to scan the barcode, you can confirm drop-off at their designated secure porch lockbox location.
              </p>
              {selectedBooking && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Drop-Off Destination:</span>
                  <strong className="text-white block">{selectedBooking.pickupDetails.address}</strong>
                  <span className="text-emerald-400 text-[11px]">
                    Instructions: {selectedBooking.pickupDetails.instructions}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Trigger */}
          {scanCompleted ? (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500 text-xs text-emerald-200 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <strong className="text-white block">
                    {scanMode === 'scan_out'
                      ? 'Scan Out Confirmed: Equipment Picked Up!'
                      : 'Scan In Confirmed: Tool Successfully Checked In!'}
                  </strong>
                  <span className="text-[11px] text-emerald-300">
                    Timestamp logged. Concurrence &amp; deposit release workflow initialized.
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="text-center">
              {scanMode !== 'porch_dropoff' ? (
                <button
                  onClick={handleSimulateScan}
                  disabled={isScanning || !selectedBooking}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition mx-auto"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Reading Optical Tag {targetBarcode}...</span>
                    </>
                  ) : (
                    <>
                      <ScanLine className="w-4 h-4" />
                      <span>Scan Tool Barcode ({targetBarcode})</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handlePorchDropoff}
                  disabled={!selectedBooking}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition mx-auto"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Porch Lockbox Drop-off</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
