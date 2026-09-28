import React, { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  MapPin, 
  ShieldCheck, 
  Coins, 
  Sparkles, 
  Camera, 
  MessageSquare, 
  ArrowRight, 
  AlertCircle,
  Key,
  Calendar,
  Layers,
  ExternalLink,
  ScanLine,
  TrendingUp,
  Award,
  HelpCircle,
  Percent
} from 'lucide-react';
import { RentalBooking, ToolItem } from '../types';
import { CURRENT_USER_OWNER_PROFIT, CURRENT_USER_RENTER_RANK } from '../data/mockData';

interface RentalsViewProps {
  bookings: RentalBooking[];
  tools: ToolItem[];
  currentUserId: string;
  onOpenReturnScanner: (booking: RentalBooking) => void;
  onOpenBarcodeScanner: () => void;
  onOpenChat: (toolId: string, lenderId: string) => void;
  onOpenListTool: () => void;
  onSelectTool: (tool: ToolItem) => void;
}

export const RentalsView: React.FC<RentalsViewProps> = ({
  bookings,
  tools,
  currentUserId,
  onOpenReturnScanner,
  onOpenBarcodeScanner,
  onOpenChat,
  onOpenListTool,
  onSelectTool,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'borrowed' | 'lending'>('borrowed');

  const myBookings = bookings;
  const activeBookings = myBookings.filter(b => b.status === 'active');
  const pastBookings = myBookings.filter(b => b.status === 'completed');

  const myLendedTools = tools.filter(t => t.owner.id === currentUserId || t.owner.name.includes('Alex'));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Rentals &amp; Lending Hub</h2>
          <p className="text-xs text-slate-400 mt-1">
            Barcode scan-in/out, owner concurrence checks, and transparent profit projections
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveSubTab('borrowed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'borrowed'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Borrowed ({activeBookings.length} Active)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('lending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'lending'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Owner's Garage &amp; Profits ({myLendedTools.length})</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: BORROWED TOOLS */}
      {activeSubTab === 'borrowed' && (
        <div className="space-y-6">
          {/* Active Rentals Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Currently Active Rentals</span>
              </h3>
              <button
                onClick={onOpenBarcodeScanner}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Scan Barcode In / Out</span>
              </button>
            </div>

            {activeBookings.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
                You have no active tool rentals at the moment. Browse the neighborhood catalog or radar map to borrow tools!
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-5 rounded-3xl bg-slate-900 border-2 border-amber-500/40 shadow-xl space-y-4 relative overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={b.toolImage}
                        alt={b.toolTitle}
                        className="w-20 h-20 rounded-2xl object-cover border border-slate-700 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[10px] uppercase font-bold">
                            Active Rental
                          </span>
                          <span className="text-slate-400">• {b.category}</span>
                        </div>
                        <h4 className="font-extrabold text-white text-base truncate">
                          {b.toolTitle}
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Lender: <strong className="text-white">{b.lenderName}</strong> ({b.lenderNeighborhood})
                        </p>
                      </div>
                    </div>

                    {/* Escrow Status & Countdown Banner */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Due Date:</span>
                        <span className="font-bold text-white flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>{b.endDate} (2 days remaining)</span>
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 block text-[11px]">Escrow Deposit:</span>
                        <span className="font-bold text-amber-400 flex items-center gap-1 justify-end">
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          <span>${b.depositAmount.toFixed(2)} held</span>
                        </span>
                      </div>
                    </div>

                    {/* Barcode & Lockbox Status */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                        <ScanLine className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 text-[10px] block">Pickup Verification</span>
                          <span className="font-bold text-emerald-400 text-[11px]">Barcode Scanned</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 text-[10px] block">Porch Lockbox</span>
                          <span className="font-mono font-bold text-white text-[11px]">Code: {b.pickupDetails.lockboxCode || '4921'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Primary Actions: Return Inspection (Triggers Concurrence & Deposit Release) */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
                      <button
                        onClick={() => onOpenChat(b.toolId, b.lenderId)}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>Chat Lender</span>
                      </button>

                      <button
                        onClick={() => onOpenReturnScanner(b)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Return &amp; Concurrence (${b.depositAmount})</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Rentals Section */}
          <div className="space-y-3 pt-4">
            <h3 className="font-extrabold text-white text-base">Completed Rentals &amp; Concurrence History</h3>
            <div className="space-y-3">
              {pastBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={b.toolImage}
                      alt={b.toolTitle}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm">{b.toolTitle}</h4>
                      <p className="text-slate-400 mt-0.5">
                        Rented from {b.lenderName} • {b.startDate} to {b.endDate} ({b.totalDays} days)
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Owner Concurrence Acknowledged • Deposit returned to Credits</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-slate-400 block text-[11px]">Total Paid:</span>
                    <span className="font-black text-white text-sm">${b.rentalFee + b.platformFee}</span>
                    <span className="text-[10px] text-emerald-400 block">
                      +${b.depositAmount} deposit refunded (+5% bonus)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: OWNER'S VIEW & PROFIT MODEL */}
      {activeSubTab === 'lending' && (
        <div className="space-y-6">
          {/* Owner Financial Transparency & Expected Profit */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-2 border-emerald-500/40 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-black text-white text-lg">Owner Expected Profit &amp; Margin Breakdown</h3>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Neighborhood Garage keeps a tiny 5% platform margin to sustain servers and instant escrow processing, scaling with volume rather than high fees.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-700/50 text-xs font-bold text-emerald-300 shrink-0">
                <Percent className="w-3.5 h-3.5 text-emerald-400" />
                <span>You Keep 95% of Rental Rates</span>
              </div>
            </div>

            {/* Financial Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Gross Lending Revenue</span>
                <div className="text-xl font-black text-white mt-1">
                  ${CURRENT_USER_OWNER_PROFIT.grossEarnings.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500">12 completed rentals</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">5% Platform Margin Fee</span>
                <div className="text-xl font-black text-amber-400 mt-1">
                  -${CURRENT_USER_OWNER_PROFIT.platformFeeTotal.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500">Covers servers &amp; escrow float</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-700/50">
                <span className="text-emerald-400 text-[11px] block font-bold">Net Owner Payout</span>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  ${CURRENT_USER_OWNER_PROFIT.netOwnerPayout.toFixed(2)}
                </div>
                <span className="text-[10px] text-emerald-300/80">Available in wallet</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Projected Annual Profit</span>
                <div className="text-xl font-black text-white mt-1">
                  ${CURRENT_USER_OWNER_PROFIT.projectedAnnual.toFixed(0)}/yr
                </div>
                <span className="text-[10px] text-emerald-400">At ~4 rental days/mo per tool</span>
              </div>
            </div>
          </div>

          {/* Owner Tier & Perks Card */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Owner Tier Status</span>
                <h4 className="text-base font-black text-white">Tier 2: Master Workshop</h4>
                <p className="text-xs text-slate-400">
                  Perks: Platform margin reduced from 7% to 5% • Boosted radar map priority • Certified Tool Steward badge
                </p>
              </div>
            </div>

            <button
              onClick={onOpenListTool}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition shrink-0"
            >
              + List Another Tool
            </button>
          </div>

          {/* Listed Tools in Owner Garage */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-white text-base">Tools Currently In Your Garage ({myLendedTools.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myLendedTools.map((tool) => (
                <div
                  key={tool.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={tool.images[0]}
                      alt={tool.title}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-amber-400 uppercase">{tool.brand}</span>
                      <h4 className="font-bold text-white text-sm truncate">{tool.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ${tool.dailyRate}/day • Net ${(tool.dailyRate * 0.95).toFixed(2)}/day to you
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700 text-[10px] font-bold">
                      Listed
                    </span>
                    <button
                      onClick={() => onSelectTool(tool)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
