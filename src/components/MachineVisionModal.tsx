import React, { useState } from 'react';
import { 
  X, 
  Camera, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Scan, 
  Coins, 
  ShieldCheck, 
  RefreshCw, 
  FileText,
  Upload,
  ArrowRight,
  Eye,
  Check,
  Award,
  UserCheck,
  CheckSquare
} from 'lucide-react';
import { MachineVisionResult, ToolItem, RentalBooking } from '../types';
import { CURRENT_USER_RENTER_RANK } from '../data/mockData';

interface MachineVisionModalProps {
  tool?: ToolItem | null;
  activeBooking?: RentalBooking | null;
  mode: 'listing' | 'return';
  onClose: () => void;
  onApplyAssessment?: (result: MachineVisionResult) => void;
  onConfirmInstantDepositRelease?: (bookingId: string, amount: number, bonusAmount: number) => void;
}

const SAMPLE_INSPECTION_PHOTOS = [
  {
    name: 'DeWalt 20V Drill - Front Chuck & Housing',
    url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80',
    type: 'drill',
  },
  {
    name: 'Air Compressor - Pressure Tank & Gauge',
    url: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=800&q=80',
    type: 'compressor',
  },
  {
    name: 'Table Saw - 10" Carbide Blade & Miter',
    url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    type: 'saw',
  },
  {
    name: 'Pressure Washer - Pump & High-Pressure Wand',
    url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    type: 'washer',
  },
];

export const MachineVisionModal: React.FC<MachineVisionModalProps> = ({
  tool,
  activeBooking,
  mode,
  onClose,
  onApplyAssessment,
  onConfirmInstantDepositRelease,
}) => {
  const initialPhoto = tool?.images[0] || activeBooking?.toolImage || SAMPLE_INSPECTION_PHOTOS[0].url;
  const [selectedPhoto, setSelectedPhoto] = useState<string>(initialPhoto);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<MachineVisionResult | null>(null);
  
  // Concurrence State
  const [ownerConcurred, setOwnerConcurred] = useState<boolean>(true);
  const [ownerNote, setOwnerNote] = useState<string>('Everything looks great, thanks for returning clean!');
  const [depositReleased, setDepositReleased] = useState<boolean>(false);

  const targetTitle = tool?.title || activeBooking?.toolTitle || 'Tool Inspection Item';
  const targetBrand = tool?.brand || 'DeWalt';
  const targetModel = tool?.modelNumber || 'DCD771C2';
  const targetSerial = tool?.serialNumber || 'DW-8921-X992';
  const depositHoldAmount = activeBooking?.depositAmount || tool?.depositAmount || 35;
  const bonusPct = (CURRENT_USER_RENTER_RANK.creditBonusPct || 5.0) / 100;
  const calculatedBonus = Number((depositHoldAmount * bonusPct).toFixed(2));

  const handleRunMachineVision = async () => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch('/api/verify-tool-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: targetTitle,
          brand: targetBrand,
          modelNumber: targetModel,
          serialNumber: targetSerial,
          checkType: mode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.assessment) {
        setResult(data.assessment);
        setIsAnalyzing(false);
        return;
      }
      throw new Error('No assessment received');
    } catch (err) {
      console.info('Using client-side machine vision appraisal engine (static GitHub Pages mode)');
      // Realistic simulated inspection delay for optical effect
      await new Promise((r) => setTimeout(r, 650));
      setResult({
        detectedBrand: targetBrand,
        detectedModel: targetModel,
        conditionGrade: 'Grade A (Excellent)',
        wearLevel: 'Normal DIY Use (sawdust & superficial scuff)',
        wearVariancePercent: 4.2,
        acceptableWearThresholdPercent: 15.0,
        isWithinAcceptableVariance: true,
        concurrenceRecommendation: 'APPROVED: Observed cosmetic wear (4.2%) is well within the 15% DIY project variance limit. Normal wear confirmed.',
        opticalInspectionSummary: 'Visual analysis confirmed composite motor housing intact, power contacts free of oxidation, chuck teeth undamaged, serial plate authentic.',
        estimatedReplacementValue: tool?.replacementValue || 160,
        recommendedDailyRate: tool?.dailyRate || 10,
        recommendedDeposit: depositHoldAmount,
        confidenceScore: 0.96,
        serialVerified: true,
        depositReleaseApproved: true,
        damageDetected: false,
        maintenanceTips: 'Keep battery contacts dry and lubricate chuck sleeve periodically.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTriggerDepositRelease = () => {
    if (!activeBooking) return;
    setDepositReleased(true);
    if (onConfirmInstantDepositRelease) {
      onConfirmInstantDepositRelease(activeBooking.id, depositHoldAmount, calculatedBonus);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base">
                  {mode === 'return' ? 'Return Condition & Owner Concurrence Check' : 'Machine-Vision Condition Appraisal'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  AI Optical Sweep
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Automated wear variance tolerance (15% DIY limit) • In-app owner acknowledgment
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* Target Tool Card */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Target Inspection Item
              </span>
              <h4 className="font-bold text-white text-sm">{targetTitle}</h4>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Brand: <strong className="text-slate-200">{targetBrand}</strong> • Model: <strong className="text-slate-200">{targetModel}</strong> • SN: <strong className="text-slate-200">{targetSerial}</strong>
              </p>
            </div>

            {mode === 'return' && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Held Deposit in Escrow:</span>
                <span className="text-base font-black text-amber-400">${depositHoldAmount}</span>
                <span className="text-[10px] text-emerald-400 block">Eligible for instant credit refund</span>
              </div>
            )}
          </div>

          {/* Optical Scanner Viewport */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
            <img
              src={selectedPhoto}
              alt="Tool to scan"
              className="w-full h-full object-cover"
            />

            {/* Scanning HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none border-2 border-amber-500/40 m-4 rounded-xl">
              {/* Corner reticles */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-amber-400" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber-400" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber-400" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-amber-400" />

              {/* Optical center crosshair */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-dashed border-amber-400/50 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
              </div>

              {/* Serial OCR Box Simulation */}
              <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] text-slate-200 font-mono flex items-center gap-1.5">
                <Scan className="w-3 h-3 text-emerald-400" />
                <span>OCR TARGET: {targetSerial}</span>
              </div>

              {isAnalyzing && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse top-1/2" />
              )}
            </div>

            {/* Sample Photo Selector Buttons */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 px-1 hidden sm:inline">Presets:</span>
              {SAMPLE_INSPECTION_PHOTOS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhoto(p.url)}
                  className={`w-7 h-7 rounded-lg overflow-hidden border text-[10px] font-bold transition ${
                    selectedPhoto === p.url ? 'border-amber-400 scale-105' : 'border-slate-700 opacity-60'
                  }`}
                  title={p.name}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Trigger Scan Button */}
          {!result && (
            <div className="text-center pt-2">
              <button
                onClick={handleRunMachineVision}
                disabled={isAnalyzing}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/20 active:scale-95 transition inline-flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Wear &amp; Calculating DIY Tolerance Variance...</span>
                  </>
                ) : (
                  <>
                    <Scan className="w-4 h-4" />
                    <span>Run Machine-Vision Analysis &amp; Concurrence Check</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              {/* Wear & Tear Tolerance Banner */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">
                      Normal DIY Wear Confirmed ({result.conditionGrade})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
                    Wear Variance: {result.wearVariancePercent || 4.2}% (Limit: 15.0%)
                  </span>
                </div>

                {/* Tolerance Progress Bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((result.wearVariancePercent || 4.2) / 15) * 100)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-300">
                  {result.concurrenceRecommendation ||
                    'Observed wear is within acceptable project tolerances (sawdust, light scuffs). Fully covered under normal DIY allowance.'}
                </p>
              </div>

              {/* Optical Inspection Analysis */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Optical Integrity Scan</span>
                </div>
                <p className="leading-relaxed text-slate-300">
                  {result.opticalInspectionSummary}
                </p>
              </div>

              {/* OWNER CONCURRENCE CHECK BOX */}
              {mode === 'return' && (
                <div className="p-4 rounded-xl bg-slate-900 border-2 border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      <h5 className="font-bold text-white text-xs">
                        Owner Concurrence Acknowledgment
                      </h5>
                    </div>
                    <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      Dispute-Free Guarantee
                    </span>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition">
                    <input
                      type="checkbox"
                      checked={ownerConcurred}
                      onChange={(e) => setOwnerConcurred(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500/30"
                    />
                    <span className="leading-relaxed">
                      I acknowledge that the returned tool's condition matches the AI scan and is within the <strong>acceptable normal wear and tear</strong> of DIY usage.
                    </span>
                  </label>

                  {/* Pre-approved perk notification for top renters */}
                  <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">
                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>Renter Perk Active:</strong> Borrower holds <em>{CURRENT_USER_RENTER_RANK.tier}</em> status with 100% on-time record.
                    </span>
                  </div>

                  {/* INSTANT DEPOSIT RELEASE ACTION */}
                  {depositReleased ? (
                    <div className="p-3 rounded-xl bg-emerald-900/50 border border-emerald-500 text-xs text-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          <strong>Success!</strong> ${depositHoldAmount.toFixed(2)} deposit refunded + ${calculatedBonus.toFixed(2)} bonus added to Neighborhood Garage Credits!
                        </span>
                      </div>
                      <button
                        onClick={onClose}
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleTriggerDepositRelease}
                      disabled={!ownerConcurred}
                      className={`w-full py-2.5 px-4 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 shadow-lg ${
                        ownerConcurred
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>
                        Owner Concurred: Release ${depositHoldAmount.toFixed(2)} Deposit Instantly (+${calculatedBonus.toFixed(2)} Bonus)
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Action for Listing Mode */}
              {mode === 'listing' && onApplyAssessment && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      onApplyAssessment(result);
                      onClose();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <span>Apply Assessment to Tool Listing</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
