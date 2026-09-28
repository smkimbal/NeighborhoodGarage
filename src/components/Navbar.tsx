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
  ScanLine,
  ToggleLeft,
  ToggleRight,
  User,
  HardDrive
} from 'lucide-react';
import { CURRENT_USER_RENTER_RANK, NEIGHBORHOODS } from '../data/mockData';
import { UserWallet, AppMode, UserProfile } from '../types';

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
  appMode: AppMode;
  onToggleMode: (mode: AppMode) => void;
  userProfile: UserProfile;
  onOpenProfileModal: () => void;
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
  appMode,
  onToggleMode,
  userProfile,
  onOpenProfileModal,
}) => {
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-xl">
      {/* Top Garage Trust & Mode Announcement Strip */}
      <div className={`text-[11px] font-semibold py-1 px-3 text-center flex items-center justify-center gap-2 transition-colors ${
        appMode === 'live'
          ? 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-emerald-100'
          : 'bg-gradient-to-r from-amber-700 via-orange-700 to-amber-800 text-amber-100'
      }`}>
        <div className="flex items-center gap-1.5 truncate max-w-full">
          {appMode === 'live' ? (
            <HardDrive className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          )}
          <span className="truncate">
            {appMode === 'live' ? (
              <strong>Live Mode Active:</strong>
            ) : (
              <strong>Demo Simulator:</strong>
            )}{' '}
            {appMode === 'live'
              ? 'Real local database & equipment sync enabled • $1.5k shield on all rentals'
              : 'Simulated neighborhood tool fleet • Toggle to Live Mode anytime for real local equipment'}
          </span>
        </div>
      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
          {/* Left Brand & Neighborhood Cluster */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Logo */}
            <div 
              className="flex items-center gap-2 cursor-pointer shrink-0" 
              onClick={() => setActiveTab('explore')}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 flex items-center justify-center shadow-md shadow-amber-500/20 text-slate-950 shrink-0">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 font-black stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-black text-sm sm:text-lg tracking-tight text-white truncate">
                    Neighborhood<span className="text-amber-400 ml-0.5">Garage</span>
                  </span>
                </div>
                <p className="text-[10px] text-amber-200/80 -mt-0.5 hidden md:block font-medium">Charming Neighbor Tool Sharing</p>
              </div>
            </div>

            {/* Neighborhood Zone Chip */}
            <div className="relative shrink-0 hidden xs:block">
              <button
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 transition max-w-[110px] sm:max-w-[150px]"
                title="Select your neighborhood zone"
              >
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="font-bold text-white truncate text-left">
                  {selectedNeighborhood === 'All Neighborhoods' ? 'All Areas' : selectedNeighborhood}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {showLocationDropdown && (
                <div className="absolute left-0 mt-2 w-56 sm:w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in">
                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                    Neighborhood Zones
                  </div>
                  <div className="mt-1 space-y-1 max-h-56 overflow-y-auto">
                    {NEIGHBORHOODS.map((nh) => (
                      <button
                        key={nh.name}
                        onClick={() => {
                          setSelectedNeighborhood(nh.name);
                          setShowLocationDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition ${
                          selectedNeighborhood === nh.name
                            ? 'bg-amber-500/20 text-amber-300 font-bold'
                            : 'text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{nh.name}</span>
                        </span>
                        {nh.distance > 0 && (
                          <span className="text-[10px] text-slate-400 font-normal shrink-0">{nh.distance} mi</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1 bg-slate-800/50 p-1 rounded-2xl border border-slate-700/50 shrink-0">
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
              <span>Rentals</span>
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
              <span>Credits</span>
            </button>
          </nav>

          {/* Right Action Bar: Mode Toggle + Lend Button + Wallet + Profile Avatar (ALWAYS VISIBLE!) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* DEMO / LIVE MODE TOGGLE BADGE */}
            <button
              onClick={() => onToggleMode(appMode === 'demo' ? 'live' : 'demo')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition active:scale-95 shrink-0 ${
                appMode === 'live'
                  ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/10'
                  : 'bg-amber-950/80 hover:bg-amber-900 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10'
              }`}
              title={`Currently in ${appMode.toUpperCase()} mode. Click to toggle.`}
            >
              {appMode === 'live' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Demo</span>
                </>
              )}
            </button>

            {/* Quick Barcode Scanner (Desktop only to conserve mobile width) */}
            <button
              onClick={onOpenBarcodeScanner}
              className="hidden lg:flex p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-400 border border-slate-700 transition shrink-0"
              title="Barcode Scanner: Scan Tool In or Out"
            >
              <ScanLine className="w-4 h-4" />
            </button>

            {/* Wallet Balance Pill */}
            <button
              onClick={() => setActiveTab('wallet')}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-700/50 text-xs transition shrink-0"
              title="Available Wallet Credits"
            >
              <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-black text-emerald-300 text-xs leading-none">
                ${wallet.availableCredits.toFixed(0)}
              </span>
            </button>

            {/* List Your Tool Button (ALWAYS VISIBLE!) */}
            <button
              onClick={onOpenListModal}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition active:scale-95 shrink-0"
              title="List a tool to lend out in your neighborhood"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Lend</span>
            </button>

            {/* User Profile Avatar Button (ALWAYS VISIBLE! Opens Profile Modal) */}
            <button
              onClick={onOpenProfileModal}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-amber-400/80 hover:border-amber-300 ring-2 ring-transparent hover:ring-amber-400/30 transition shrink-0 relative cursor-pointer"
              title={`Profile & Settings: ${userProfile.name} (${appMode.toUpperCase()} mode)`}
            >
              <img 
                src={userProfile.avatar} 
                alt={userProfile.name} 
                className="w-full h-full object-cover" 
              />
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                appMode === 'live' ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Neighbor Rank Modal */}
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
      <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 px-2 py-1 flex items-center justify-around shadow-2xl">
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
          onClick={onOpenListModal}
          className="flex flex-col items-center py-1 px-2.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30 shadow-sm"
        >
          <PlusCircle className="w-4 h-4 mb-0.5 text-amber-400 stroke-[2.5]" />
          <span>+ Lend</span>
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
          onClick={onOpenProfileModal}
          className="flex flex-col items-center py-1.5 px-2 text-[10px] font-medium text-slate-400 hover:text-amber-400 transition"
        >
          <User className="w-4 h-4 mb-0.5" />
          <span>Profile</span>
        </button>
      </div>
    </header>
  );
};
