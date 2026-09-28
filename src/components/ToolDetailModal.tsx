import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  MapPin, 
  Star, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  QrCode, 
  MessageSquare, 
  Calendar, 
  CreditCard, 
  Camera, 
  Info,
  Clock,
  ArrowRight,
  Share2,
  Check
} from 'lucide-react';
import { ToolItem } from '../types';

interface ToolDetailModalProps {
  tool: ToolItem | null;
  onClose: () => void;
  onRent: (tool: ToolItem) => void;
  onMessageOwner: (tool: ToolItem) => void;
  onViewTag: (tool: ToolItem) => void;
  onScanCondition: (tool: ToolItem) => void;
}

export const ToolDetailModal: React.FC<ToolDetailModalProps> = ({
  tool,
  onClose,
  onRent,
  onMessageOwner,
  onViewTag,
  onScanCondition,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!tool) return null;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider border border-amber-500/30">
              {tool.category}
            </span>
            <span className="text-xs text-slate-400">
              Listed by <strong className="text-white">{tool.owner.name}</strong> ({tool.location.neighborhood})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1.5"
              title="Share listing"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Share'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Main Grid: Images & Quick Booking Column */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Gallery & Identity */}
            <div className="lg:col-span-7 space-y-4">
              {/* Primary Image View */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
                <img
                  src={tool.images[selectedImageIdx] || tool.images[0]}
                  alt={tool.title}
                  className="w-full h-full object-cover"
                />
                
                {/* Condition Grade Chip */}
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-xs font-bold text-white shadow-xl">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{tool.conditionGrade}</span>
                </div>

                {/* Machine Vision Verification stamp */}
                <button
                  onClick={() => onScanCondition(tool)}
                  className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 backdrop-blur-md border border-amber-500/50 text-xs font-semibold text-amber-300 shadow-xl transition"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Condition Report</span>
                </button>
              </div>

              {/* Thumbnails if multiple */}
              {tool.images.length > 1 && (
                <div className="flex gap-2">
                  {tool.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIdx(idx)}
                      className={`w-20 h-16 rounded-xl overflow-hidden border-2 transition ${
                        selectedImageIdx === idx ? 'border-amber-400 shadow-md' : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Tool Identification & Barcode Box */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                    Verified Tool Identification
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-slate-400">Brand: </span>
                      <strong className="text-white">{tool.brand}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Model: </span>
                      <strong className="text-white font-mono">{tool.modelNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Serial No: </span>
                      <strong className="text-white font-mono">{tool.serialNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Tag ID: </span>
                      <strong className="text-white font-mono">{tool.barcode}</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onViewTag(tool)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                >
                  <QrCode className="w-4 h-4 text-amber-400" />
                  <span>View Tag</span>
                </button>
              </div>
            </div>

            {/* Right 5 Columns: Price & Action Panel */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-4 shadow-xl">
                <div>
                  <h2 className="text-xl font-black text-white leading-tight">
                    {tool.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{tool.owner.rating}</span>
                      <span className="text-slate-400 font-normal">({tool.reviews.length} reviews)</span>
                    </div>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      {tool.location.neighborhood} ({tool.location.distanceMiles ?? 0.4} mi)
                    </span>
                  </div>
                </div>

                {/* Price Display */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/70">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-amber-400">${tool.dailyRate}</span>
                      <span className="text-xs text-slate-400"> / day</span>
                    </div>
                    {tool.weeklyDiscountPct > 0 && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/50">
                        {tool.weeklyDiscountPct}% weekly discount
                      </span>
                    )}
                  </div>

                  {/* Damage Deposit explanation */}
                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-300">Damage Deposit:</span>
                    <div className="text-right">
                      <span className="font-bold text-white">${tool.depositAmount}</span>
                      <span className="text-[10px] text-emerald-400 block">
                        Held safely, returned instantly to credits
                      </span>
                    </div>
                  </div>
                </div>

                {/* Community Shield Insurance Guarantee Card */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-600/40 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Neighborhood Garage Shield &amp; Wear Allowance</span>
                    <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                      $0 Deductible
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    All rentals include up to <strong>${tool.insurance.coverageLimit}</strong> in Shield protection plus a built-in <strong>15% DIY normal wear-and-tear tolerance</strong> (sawdust, minor scuffs fully approved).
                  </p>
                </div>

                {/* CTA Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => onRent(tool)}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Reserve &amp; Rent</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>

                  <button
                    onClick={() => onMessageOwner(tool)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span>Message {tool.owner.name} (Avg reply {tool.owner.responseTime})</span>
                  </button>
                </div>
              </div>

              {/* Owner Trust Box */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={tool.owner.avatar}
                    alt={tool.owner.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-amber-500/40"
                  />
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                      <span>{tool.owner.name}</span>
                      <span title="Identity Verified">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Neighbor in {tool.owner.neighborhood} • Member since {tool.owner.joinedYear}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-black text-amber-400">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{tool.owner.rating}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{tool.owner.reviewCount} rentals</span>
                </div>
              </div>
            </div>
          </div>

          {/* Machine Vision Optical Inspection Details */}
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Machine-Vision Condition &amp; Deposit Appraisal
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verified on {tool.lastVisionInspection} via high-resolution optical sweep
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-semibold">
                  Condition: {tool.conditionGrade}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono">
                  Replacement Value: ${tool.replacementValue}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <strong className="text-white">Optical Inspection Notes: </strong>
              {tool.opticalInspectionNotes}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Wear Assessment:</span>
                <span className="font-medium text-slate-200">{tool.wearLevel}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Auto-Deposit Formula:</span>
                <span className="font-medium text-amber-300">
                  ${tool.replacementValue} repl. × 24% risk = ${tool.depositAmount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Instant Return Method:</span>
                <span className="font-medium text-emerald-400">Auto-credited to ToolShare Wallet</span>
              </div>
            </div>
          </div>

          {/* Specifications & Accessories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tech Specs */}
            <div className="space-y-3">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider text-slate-300">
                Technical Specifications
              </h4>
              <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800 text-xs">
                {Object.entries(tool.specifications).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-2 px-3 bg-slate-900/40">
                    <span className="text-slate-400">{key}</span>
                    <span className="font-medium text-white">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Included Accessories */}
            <div className="space-y-3">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider text-slate-300">
                Included Accessories &amp; Safety
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {tool.includedAccessories.map((acc, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{acc}</span>
                  </li>
                ))}
              </ul>

              {tool.safetyNotes.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Neighborhood Safety Notice</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-200/90 text-[11px]">
                    {tool.safetyNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Pickup & Handoff Details */}
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800 text-xs">
            <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Pickup Coordination: {tool.location.pickupMethod}</span>
            </h4>
            <p className="text-slate-300 leading-relaxed">
              {tool.location.pickupInstructions}
            </p>
            <p className="text-slate-400 text-[11px] mt-1.5">
              Exact address: {tool.location.address}, {tool.location.neighborhood} • 
              Coordinates sent immediately upon reservation.
            </p>
          </div>

          {/* Neighbor Reviews */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-base">
                Neighbor Reviews ({tool.reviews.length})
              </h4>
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>5.0 rating average</span>
              </div>
            </div>

            <div className="space-y-3">
              {tool.reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={rev.authorAvatar} alt={rev.authorName} className="w-6 h-6 rounded-full object-cover" />
                      <strong className="text-white">{rev.authorName}</strong>
                      {rev.verifiedRental && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded font-medium">
                          Verified Rental ({rev.rentalDurationDays} days)
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[11px]">{rev.date}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
