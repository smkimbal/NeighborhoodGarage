import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  Printer, 
  Copy, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  Tag,
  Wrench
} from 'lucide-react';
import { ToolItem } from '../types';

interface BarcodeModalProps {
  tool: ToolItem | null;
  onClose: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ tool, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!tool) return null;

  const handleCopySerial = () => {
    navigator.clipboard?.writeText(tool.serialNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Verified Inventory Tag</h3>
              <p className="text-[11px] text-slate-400">Tool Identification &amp; Anti-Tamper Serial Label</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tag Body */}
        <div className="p-6 space-y-5">
          {/* Printable Physical Label Card */}
          <div className="p-6 rounded-2xl bg-white text-slate-950 shadow-2xl border-4 border-amber-500 font-sans space-y-4">
            {/* Tag Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Wrench className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <span className="font-black text-sm tracking-tight block leading-none">NEIGHBORHOOD GARAGE</span>
                  <span className="text-[10px] text-slate-600 font-bold tracking-wider">CERTIFIED LOCAL TOOL REGISTRY</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                  SHIELD INSURED
                </span>
              </div>
            </div>

            {/* Tool Information */}
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                EQUIPMENT IDENTIFIER
              </span>
              <h4 className="font-extrabold text-base text-slate-900 leading-snug">
                {tool.title}
              </h4>
              <p className="text-xs text-slate-700 font-medium">
                {tool.brand} • Category: {tool.category}
              </p>
            </div>

            {/* Grid of Part & Serial */}
            <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">PART / MODEL #</span>
                <span className="font-mono font-black text-slate-900 text-xs">{tool.modelNumber}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">SERIAL NUMBER</span>
                <span className="font-mono font-black text-slate-900 text-xs">{tool.serialNumber}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">CONDITION</span>
                <span className="font-bold text-emerald-700 text-xs">{tool.conditionGrade}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">EST. DEPOSIT</span>
                <span className="font-bold text-amber-700 text-xs">${tool.depositAmount} Hold</span>
              </div>
            </div>

            {/* Barcode & QR Visualization */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-300">
              {/* Simulated Code 128 Barcode */}
              <div className="flex-1 pr-4">
                <div className="h-10 flex items-center gap-[2px] overflow-hidden">
                  {[2,1,3,1,2,4,1,3,1,2,1,3,2,1,4,1,2,3,1,1,2,4,2,1,3,1,2,3,2,1,1,4,2,1].map((w, i) => (
                    <div
                      key={i}
                      className="h-full bg-slate-900"
                      style={{ width: `${w * 1.5}px` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-slate-600 block text-center mt-1 tracking-widest">
                  *{tool.barcode}*
                </span>
              </div>

              {/* Simulated QR Code SVG */}
              <div className="w-16 h-16 bg-slate-900 p-1.5 rounded-lg shrink-0 flex items-center justify-center text-white">
                <QrCode className="w-full h-full text-white" />
              </div>
            </div>

            {/* Footer Security Note */}
            <div className="text-[9px] text-slate-500 text-center border-t border-slate-200 pt-2 flex items-center justify-between">
              <span>ToolShare Cryptographic Tag v2.4</span>
              <span>Owner: {tool.owner.name} ({tool.location.neighborhood})</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <button
              onClick={handleCopySerial}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Serial Copied!' : 'Copy Serial Number'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition shadow-lg"
            >
              <Printer className="w-4 h-4" />
              <span>Print Equipment Tag</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
