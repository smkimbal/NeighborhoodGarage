import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  CreditCard, 
  Coins, 
  Lock, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2,
  ArrowRight,
  Info
} from 'lucide-react';
import { ToolItem, UserWallet, RentalBooking } from '../types';
import { CURRENT_USER_RENTER_RANK } from '../data/mockData';

interface CheckoutModalProps {
  tool: ToolItem | null;
  wallet: UserWallet;
  onClose: () => void;
  onConfirmBooking: (bookingData: Partial<RentalBooking>) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  tool,
  wallet,
  onClose,
  onConfirmBooking,
}) => {
  const [daysCount, setDaysCount] = useState<number>(2);
  const [startDate, setStartDate] = useState<string>('2026-09-29');
  const [paymentMethod, setPaymentMethod] = useState<'credits' | 'card' | 'apple_pay'>('credits');
  const [agreedToSafety, setAgreedToSafety] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Card mock state
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 9812');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvc, setCardCvc] = useState('482');

  if (!tool) return null;

  const rentalFee = tool.dailyRate * daysCount;
  const platformFee = 2.50; // Small 5% community margin fee
  const insuranceFee = 0; // $0 included
  
  // Renter perk: 25% lower deposit hold required for Master Craftsman rank
  const rawDeposit = tool.depositAmount;
  const discountAmount = Math.round(rawDeposit * (CURRENT_USER_RENTER_RANK.depositDiscountPct / 100));
  const depositAmount = rawDeposit - discountAmount;
  
  const totalDueToday = rentalFee + platformFee + depositAmount;

  const hasEnoughCredits = wallet.availableCredits >= totalDueToday;

  const handleCompleteOrder = () => {
    if (!agreedToSafety) return;
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      onConfirmBooking({
        toolId: tool.id,
        toolTitle: tool.title,
        toolImage: tool.images[0],
        category: tool.category,
        lenderId: tool.owner.id,
        lenderName: tool.owner.name,
        lenderAvatar: tool.owner.avatar,
        lenderNeighborhood: tool.location.neighborhood,
        startDate: startDate,
        endDate: getEndDateString(startDate, daysCount),
        totalDays: daysCount,
        dailyRate: tool.dailyRate,
        rentalFee: rentalFee,
        platformFee: platformFee,
        insuranceFee: 0,
        depositAmount: depositAmount,
        totalPaid: totalDueToday,
        status: 'active',
        depositStatus: 'held_in_escrow',
        pickupDetails: {
          address: tool.location.address + ', ' + tool.location.neighborhood,
          neighborhood: tool.location.neighborhood,
          instructions: tool.location.pickupInstructions,
          lockboxCode: tool.location.pickupMethod === 'Smart Lockbox' ? '4921' : undefined,
        },
      });
    }, 1200);
  };

  function getEndDateString(startStr: string, days: number): string {
    const d = new Date(startStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Secure Neighborhood Checkout</h3>
              <p className="text-[11px] text-slate-400">256-bit Encrypted Escrow &amp; Insurance Protection</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* Tool Summary Card */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
            <img
              src={tool.images[0]}
              alt={tool.title}
              className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                <Sparkles className="w-3 h-3" />
                <span>{tool.conditionGrade.split(' ')[0]}</span>
                <span className="text-slate-400">• SN: {tool.serialNumber.substring(0, 10)}</span>
              </div>
              <h4 className="font-bold text-white text-sm truncate">{tool.title}</h4>
              <p className="text-xs text-slate-400">
                Pickup in {tool.location.neighborhood} • {tool.owner.name}
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-amber-400">${tool.dailyRate}</span>
              <span className="text-xs text-slate-400 block">/ day</span>
            </div>
          </div>

          {/* Duration & Date Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Rental Duration
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Start Date</span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 text-xs text-white">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none w-full"
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Rental Days</span>
                <div className="flex items-center justify-between p-1.5 rounded-xl bg-slate-800/70 border border-slate-700">
                  <button
                    onClick={() => setDaysCount(Math.max(1, daysCount - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold text-white">
                    {daysCount} {daysCount === 1 ? 'day' : 'days'}
                  </span>
                  <button
                    onClick={() => setDaysCount(daysCount + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Select Payment Method
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* ToolShare Credits Option */}
              <button
                onClick={() => setPaymentMethod('credits')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition ${
                  paymentMethod === 'credits'
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/50'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">ToolShare Credits</span>
                    {paymentMethod === 'credits' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <span className="text-[11px] text-emerald-300 font-semibold block">
                    ${wallet.availableCredits.toFixed(2)} available
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Instant 1-click escrow release</span>
                </div>
              </button>

              {/* Credit / Debit Card Option */}
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition ${
                  paymentMethod === 'card'
                    ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/50'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Credit / Debit Card</span>
                    {paymentMethod === 'card' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-300 font-medium block">
                    Visa, MC, Amex
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Escrow pre-authorization</span>
                </div>
              </button>
            </div>

            {/* If card chosen: display card inputs */}
            {paymentMethod === 'card' && (
              <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Expiration</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">CVC / CVV</label>
                    <input
                      type="password"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Deposit Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Rental Fee ({daysCount} days × ${tool.dailyRate}/day):</span>
              <span className="font-semibold text-white">${rentalFee.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Neighborhood Garage Shield Insurance ($1.5k limit):</span>
              </span>
              <span className="font-bold text-emerald-400 uppercase tracking-wide">
                $0.00 (INCLUDED)
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Community maintenance &amp; platform upkeep (5% margin):</span>
              <span className="font-semibold text-white">${platformFee.toFixed(2)}</span>
            </div>

            {/* Damage Deposit Row with Explanatory Highlight */}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-start">
              <div>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span>Damage Deposit (Safe Escrow):</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-normal">
                    100% Refundable
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                    25% Renter Rank Perk Applied!
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Standard deposit was ${rawDeposit}. Reduced to ${depositAmount} thanks to your Master Craftsman standing. Returns instantly to Garage Credits!
                </span>
              </div>
              <span className="font-black text-amber-400 text-sm">
                ${depositAmount.toFixed(2)}
              </span>
            </div>

            {/* 6% Credit Bonus notice */}
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>6% Re-Rental Bonus:</strong> When your ${depositAmount} deposit returns to internal Garage Credits, you receive an extra ${(depositAmount * 0.06).toFixed(2)} bonus!
              </span>
            </div>

            {/* Total Today */}
            <div className="pt-3 border-t border-slate-700 flex justify-between items-baseline text-sm">
              <div>
                <span className="font-black text-white text-base">Total Charged Today:</span>
                <span className="text-[11px] text-slate-400 block">
                  Includes ${depositAmount} refundable deposit hold
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-white">
                  ${totalDueToday.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Safety & Care Agreement Checkbox */}
          <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-xl hover:bg-slate-800/30 transition">
            <input
              type="checkbox"
              checked={agreedToSafety}
              onChange={(e) => setAgreedToSafety(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="leading-relaxed">
              I agree to operate this <strong>{tool.title}</strong> safely with proper eye/ear protection, keep it dry, and return it to {tool.location.neighborhood} by the return date.
            </span>
          </label>
        </div>

        {/* Footer Checkout CTA */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-slate-400 block">Due today:</span>
            <span className="font-black text-amber-400 text-base">
              ${totalDueToday.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              onClick={handleCompleteOrder}
              disabled={!agreedToSafety || isProcessing}
              className={`px-5 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-lg ${
                agreedToSafety && !isProcessing
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Securing Rental &amp; Escrow...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Confirm Reservation (${totalDueToday.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
