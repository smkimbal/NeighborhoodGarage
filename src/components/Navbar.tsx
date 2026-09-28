import React, { useState } from 'react';
import { 
  Home, 
  MapPin, 
  ShieldCheck, 
  Coins, 
  PlusCircle, 
  MessageSquare, 
  Clock, 
  ChevronDown,
  Sparkles,
  Layers,
  Map as MapIcon,
  Wallet,
  Award,
  ScanLine
} from 'lucide-react';
import { CURRENT_USER, CURRENT_USER_RENTER_RANK, NEIGHBORHOODS } from '../data/mockData';
import { UserWallet } from '../types';

interface NavbarProps {
  activeTab: 'explore' | 'map' | 'rentals' | 'messages' | 'wallet';
  setActiveTab: (tab: 'explore' | 'map' | 'rentals' | 'messages' | 'wallet') => void;
  wallet: UserWallet;
  selectedNeighborhood: string;
  setSelectedNeighborhood: (n: string) => void;
  onOpenListModal: () => void;
  onOpenBarcodeScanner: () => void;
  unreadCount: number;
  activeRentalsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  wallet,
  selectedNeighborhood,
  setSelectedNeighborhood,
  onOpenListModal,
  onOpenBarcodeScanner,
  unreadCount,
  activeRentalsCount,
}) => {
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-xl">
      {/* Top Friendly Garage Trust Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-xs font-medium py-1 px-4 text-center text-amber-50 flex items-center justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>
          <strong>Neighborhood Garage:</strong> Up to $1,500 damage &amp; repair protection included on 100% of rentals • Fast escrow refunds with 6% community bonus
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Charming Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('explore')}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 flex items-center justify-center shadow-md shadow-amber-500/20 text-slate-950">
              <Home className="w-5 h-5 font-black stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xl tracking-tight text-white">
                  Neighborhood<span className="text-amber-400 font-bold ml-1">Garage</span>
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Local
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80 -mt-0.5 hidden sm:block font-medium">Charming Neighbor Tool Sharing</p>
            </div>
          </div>

          {/* Neighborhood Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition"
              title="Select neighborhood to filter tools near you"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="text-left">
                <span className="font-medium text-slate-400 block text-[10px] leading-tight">My Garage Zone</span>
                <span className="font-bold text-white truncate max-w-[120px] sm:max-w-[160px] block leading-tight">
                  {selectedNeighborhood}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showLocationDropdown && (
              <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in">
                <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  Neighborhood Zones
                </div>
                <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                  {NEIGHBORHOODS.map((nh) => (
                    <button
                      key={nh.name}
                      onClick={() => {
                        setSelectedNeighborhood(nh.name);
                        setShowLocationDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                        selectedNeighborhood === nh.name
                          ? 'bg-amber-500/20 text-amber-300 font-bold'
                          : 'text-slate-300 hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {nh.name}
                      </span>
                      {nh.distance > 0 && (
                        <span className="text-[11px] text-slate-400 font-normal">{nh.distance} mi</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-800/50 p-1 rounded-2xl border border-slate-700/50">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'explore'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Browse Garage</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Radar Map</span>
            </button>

            <button
              onClick={() => setActiveTab('rentals')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 relative ${
                activeTab === 'rentals'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>My Rentals</span>
              {activeRentalsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 relative ${
                activeTab === 'messages'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Messages</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('wallet')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'wallet'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Credits &amp; Escrow</span>
            </button>
          </nav>

          {/* Right Action Bar: Scan Barcode, Neighbor Rank & Lending */}
          <div className="flex items-center gap-2">
            {/* Quick Barcode Scanner Button */}
            <button
              onClick={onOpenBarcodeScanner}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-400 border border-slate-700 transition"
              title="Barcode Scanner: Scan Tool In or Out"
            >
              <ScanLine className="w-4 h-4" />
            </button>

            {/* Renter Rank Badge */}
            <button
              onClick={() => setShowRankModal(!showRankModal)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/60 to-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold transition hover:border-amber-400"
              title="Click to view your Neighbor Rank &amp; Renter Perks"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px]">{CURRENT_USER_RENTER_RANK.tier}</span>
            </button>

            {/* Wallet Escrow & Credits Pill */}
            <button
              onClick={() => setActiveTab('wallet')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-700/50 text-xs transition"
              title="Neighborhood Garage Internal Credits - Available Balance"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-[10px] text-emerald-300/80 block leading-tight font-medium">Credits</span>
                <span className="font-black text-emerald-300 block leading-tight">
                  ${wallet.availableCredits.toFixed(2)}
                </span>
              </div>
              {wallet.heldInEscrow > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono hidden md:inline-block" title="Held in rental damage deposit escrow">
                  ${wallet.heldInEscrow.toFixed(0)} escrow
                </span>
              )}
            </button>

            {/* List Your Tool Button */}
            <button
              onClick={onOpenListModal}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Lend a Tool</span>
              <span className="sm:hidden">Lend</span>
            </button>

            {/* User Profile Avatar */}
            <div 
              onClick={() => setActiveTab('rentals')}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-slate-700 hover:border-amber-400 cursor-pointer transition shrink-0 relative"
              title={`Logged in as ${CURRENT_USER.name} (${CURRENT_USER.rating}★)`}
            >
              <img 
                src={CURRENT_USER.avatar} 
                alt={CURRENT_USER.name} 
                className="w-full h-full object-cover" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Neighbor Rank & Perks Modal */}
      {showRankModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-white text-base">Neighbor Ranking &amp; Perks</h3>
              </div>
              <button
                onClick={() => setShowRankModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-400">Current Standing</span>
                  <h4 className="text-lg font-black text-white">{CURRENT_USER_RENTER_RANK.tier}</h4>
                  <p className="text-xs text-slate-300">
                    {CURRENT_USER_RENTER_RANK.rentalsCompleted} verified rentals • {CURRENT_USER_RENTER_RANK.onTimeReturnRate}% on-time record
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-lg border border-amber-500/40">
                  Lvl {CURRENT_USER_RENTER_RANK.level}
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Your Active Perks &amp; Trust Benefits:
              </h5>
              <div className="space-y-2">
                {CURRENT_USER_RENTER_RANK.perks.map((perk, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-200 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every on-time return and well-maintained tool increases your neighbor ranking, unlocking lower escrow requirements and higher re-rental bonuses!
            </p>

            <button
              onClick={() => setShowRankModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              Awesome, Got It!
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 px-2 py-1 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex flex-col items-center py-1.5 px-2 text-[10px] font-medium transition ${
            activeTab === 'explore' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span>Garage</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center py-1.5 px-2 text-[10px] font-medium transition ${
            activeTab === 'map' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4 mb-0.5" />
          <span>Radar</span>
        </button>

        <button
          onClick={onOpenBarcodeScanner}
          className="flex flex-col items-center py-1.5 px-2 text-[10px] font-medium text-slate-400 hover:text-amber-400"
        >
          <ScanLine className="w-4 h-4 mb-0.5" />
          <span>Scan In/Out</span>
        </button>

        <button
          onClick={() => setActiveTab('rentals')}
          className={`flex flex-col items-center py-1.5 px-2 text-[10px] font-medium relative transition ${
            activeTab === 'rentals' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 mb-0.5" />
          <span>Rentals</span>
          {activeRentalsCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center py-1.5 px-2 text-[10px] font-medium transition ${
            activeTab === 'wallet' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="w-4 h-4 mb-0.5" />
          <span>Credits</span>
        </button>
      </div>
    </header>
  );
};
