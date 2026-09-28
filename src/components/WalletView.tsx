import React, { useState } from 'react';
import { 
  Coins, 
  ShieldCheck, 
  ArrowDownRight, 
  ArrowUpRight, 
  Sparkles, 
  Lock, 
  CheckCircle2, 
  CreditCard, 
  Building2, 
  Download,
  Plus,
  RefreshCw,
  Info,
  Award,
  Zap,
  Layers,
  Scale
} from 'lucide-react';
import { UserWallet, WalletTransaction } from '../types';
import { CURRENT_USER_RENTER_RANK, CURRENT_USER_OWNER_PROFIT } from '../data/mockData';

interface WalletViewProps {
  wallet: UserWallet;
  onTopUpCredits: (amount: number) => void;
  onWithdrawCredits: (amount: number) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  wallet,
  onTopUpCredits,
  onWithdrawCredits,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [withdrawAmount, setWithdrawAmount] = useState(50);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const filteredTransactions = wallet.transactions.filter((tx) => {
    if (filterType === 'all') return true;
    if (filterType === 'holds') return tx.type === 'deposit_hold';
    if (filterType === 'releases') return tx.type === 'deposit_release';
    if (filterType === 'earnings') return tx.type === 'lending_earning';
    return true;
  });

  const handleTopUp = () => {
    onTopUpCredits(topUpAmount);
    setShowTopUpModal(false);
    setSuccessToast(`Added $${topUpAmount} Neighborhood Garage Credits with +$${(topUpAmount * 0.06).toFixed(2)} bonus!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleWithdraw = () => {
    if (withdrawAmount > wallet.availableCredits) return;
    onWithdrawCredits(withdrawAmount);
    setShowWithdrawModal(false);
    setSuccessToast(`Initiated direct ACH payout of $${withdrawAmount.toFixed(2)} to linked bank account.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 border border-emerald-500 text-emerald-100 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Wallet Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Available Credits Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border-2 border-emerald-500/50 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-1">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              <span>Available Garage Credits</span>
            </span>
            <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
              1 Credit = $1.00 USD
            </span>
          </div>

          <div className="text-3xl font-black text-white mt-2">
            ${wallet.availableCredits.toFixed(2)}
          </div>

          <p className="text-[11px] text-slate-400 mt-1">
            Instantly spendable on any neighborhood tool rental
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setShowTopUpModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1 shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add Credits</span>
            </button>

            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-1 border border-slate-700"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Cash Out</span>
            </button>
          </div>
        </div>

        {/* Damage Deposit Escrow Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>Held in Safe Escrow</span>
            </span>
            <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-300">
              Active Escrow
            </span>
          </div>

          <div className="text-3xl font-black text-amber-400">
            ${wallet.heldInEscrow.toFixed(2)}
          </div>

          <p className="text-[11px] text-slate-400">
            Held during active rental. Refunds immediately to credits upon return concurrence!
          </p>
        </div>

        {/* Lifetime Earnings */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <span className="text-xs text-slate-400 font-bold block">
            Owner Net Lending Earnings
          </span>
          <div className="text-3xl font-black text-white">
            ${wallet.lifetimeEarned.toFixed(2)}
          </div>
          <p className="text-[11px] text-emerald-400">
            95% net payout after small 5% community margin fee
          </p>
        </div>

        {/* Estimated DIY Savings */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <span className="text-xs text-slate-400 font-bold block">
            Neighbor DIY Savings
          </span>
          <div className="text-3xl font-black text-white">
            ${wallet.lifetimeSaved.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">
            Compared to buying new retail tools for one-off projects
          </p>
        </div>
      </div>

      {/* DETAILED EXPLAINER: THE ESCROW & LOW-MARGIN SYSTEM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Why Escrow & Fast Refunds */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-base">
                Why the Escrow System Exists
              </h4>
              <span className="text-[11px] text-amber-300 font-semibold">Zero Bank Freeze Delays</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Traditional credit card authorizations can freeze funds for <strong>3 to 7 business days</strong> after you return an item. In Neighborhood Garage, damage deposits are held in a local safe escrow pool:
          </p>

          <ul className="space-y-1.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Instant Release:</strong> As soon as the owner acknowledges the AI wear scan, funds return in 1 second.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Reusable In-App:</strong> Ready to immediately rent the next tool for your project without waiting on bank deposits.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>+6% Community Reload Bonus:</strong> Every refunded deposit gets an extra bonus automatically added.</span>
            </li>
          </ul>
        </div>

        {/* Small Margin & Scale Philosophy */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-base">
                Small Margins, Powered by Scale
              </h4>
              <span className="text-[11px] text-emerald-300 font-semibold">Fair &amp; Transparent Neighborhood Economics</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Neighborhood Garage charges a <strong>small 5% platform margin</strong> to keep our cloud servers, machine-vision AI scanning, and escrow infrastructure running cleanly:
          </p>

          <div className="space-y-2 text-xs bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <div className="flex justify-between text-slate-300">
              <span>Owner Payout Share:</span>
              <strong className="text-emerald-400">95% (Kept by Tool Owner)</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Platform Upkeep Margin:</span>
              <strong className="text-white">5% (Servers, Escrow &amp; AI vision)</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Community Shield Insurance:</span>
              <strong className="text-amber-400">$0.00 (Included for 100% of loans)</strong>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            By operating on tiny margins and relying on community scale, DIYers save hundreds while garage owners earn consistent passive income.
          </p>
        </div>
      </div>

      {/* RENTER & OWNER RANKINGS CARD */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xl border border-amber-500/40 shrink-0">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-white">
                Neighbor Rank: {CURRENT_USER_RENTER_RANK.tier} (Level {CURRENT_USER_RENTER_RANK.level})
              </h4>
              <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Your perks: <strong>{CURRENT_USER_RENTER_RANK.depositDiscountPct}% lower deposit hold required</strong> on all tools • <strong>+{CURRENT_USER_RENTER_RANK.creditBonusPct}% reload bonus</strong> on refunded deposits!
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[11px] text-slate-400 block">Trust Rating:</span>
          <span className="text-base font-black text-amber-400">100% On-Time Returns</span>
          <span className="text-[10px] text-emerald-400 block">Instant Auto-Concurrence</span>
        </div>
      </div>

      {/* Transactions History Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-extrabold text-white text-base">Credit Escrow &amp; Transaction Ledger</h3>
            <p className="text-xs text-slate-400">
              Complete history of deposit holds, instant refunds, rental fees, and earnings
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'All Activity' },
              { id: 'holds', label: 'Escrow Holds' },
              { id: 'releases', label: 'Refunds / Releases' },
              { id: 'earnings', label: 'Earnings' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  filterType === f.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table/List */}
        <div className="divide-y divide-slate-800/80">
          {filteredTransactions.map((tx) => {
            const isPositive = tx.amount > 0;
            return (
              <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    tx.type === 'deposit_hold'
                      ? 'bg-amber-500/20 text-amber-400'
                      : tx.type === 'deposit_release' || tx.type === 'credit_bonus'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {tx.type === 'deposit_hold' ? (
                      <Lock className="w-4 h-4" />
                    ) : isPositive ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-white text-sm">{tx.title}</strong>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-semibold uppercase ${
                        tx.status === 'held'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{tx.description}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">{tx.date}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-base font-black ${
                    tx.type === 'deposit_hold'
                      ? 'text-amber-400'
                      : isPositive
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}>
                    {tx.type === 'deposit_hold' ? 'HOLD ' : isPositive ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Garage Credits</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TOP UP MODAL */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4">
            <h3 className="font-extrabold text-white text-base">Add Neighborhood Garage Credits</h3>
            <p className="text-xs text-slate-300">
              Purchasing Garage Credits grants an immediate <strong>+6% reload bonus</strong> and allows 1-click escrow checkout with instant returns.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpAmount(amt)}
                  className={`p-3 rounded-2xl border text-center transition ${
                    topUpAmount === amt
                      ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-white font-bold'
                  }`}
                >
                  ${amt}
                  <span className="block text-[10px] opacity-80">+${(amt * 0.06).toFixed(2)} bonus</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTopUpModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black"
              >
                Pay ${topUpAmount} (Get ${(topUpAmount * 1.06).toFixed(2)} Credits)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4">
            <h3 className="font-extrabold text-white text-base">Cash Out to Bank</h3>
            <p className="text-xs text-slate-300">
              Transfer available Neighborhood Garage Credits directly to your linked checking account (Chase •••• 4091).
            </p>

            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs">
              <span className="text-slate-400 block mb-1">Withdrawal Amount ($)</span>
              <input
                type="number"
                value={withdrawAmount}
                max={wallet.availableCredits}
                onChange={(e) => setWithdrawAmount(Math.min(wallet.availableCredits, Number(e.target.value)))}
                className="w-full bg-slate-900 text-white text-lg font-bold px-3 py-2 rounded-lg border border-slate-700"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Maximum available: ${wallet.availableCredits.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black"
              >
                Transfer ${withdrawAmount.toFixed(2)} to Bank
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
