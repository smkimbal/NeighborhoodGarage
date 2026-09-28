import React, { useState, useEffect } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  MapPin, 
  ShieldCheck, 
  Sparkles, 
  Coins, 
  CheckCircle2, 
  ArrowRight, 
  Filter,
  Wrench,
  Clock,
  Layers,
  Map as MapIcon,
  MessageSquare,
  ScanLine,
  Home,
  Award,
  Zap,
  PlusCircle,
  HardDrive
} from 'lucide-react';
import { 
  ToolItem, 
  RentalBooking, 
  Conversation, 
  ChatMessage, 
  UserWallet,
  MachineVisionResult,
  AppMode,
  UserProfile
} from './types';
import { 
  INITIAL_TOOLS, 
  INITIAL_BOOKINGS, 
  INITIAL_CONVERSATIONS, 
  INITIAL_MESSAGES, 
  INITIAL_WALLET,
  CURRENT_USER_RENTER_RANK,
  CURRENT_USER_OWNER_PROFIT,
  NEIGHBORHOODS
} from './data/mockData';
import { apiService, DEFAULT_LIVE_PROFILE } from './services/apiService';
import { Navbar } from './components/Navbar';
import { ToolCard } from './components/ToolCard';
import { NeighborhoodMap } from './components/NeighborhoodMap';
import { ToolDetailModal } from './components/ToolDetailModal';
import { CheckoutModal } from './components/CheckoutModal';
import { MachineVisionModal } from './components/MachineVisionModal';
import { BarcodeModal } from './components/BarcodeModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ListToolModal } from './components/ListToolModal';
import { RentalsView } from './components/RentalsView';
import { MessagingView } from './components/MessagingView';
import { WalletView } from './components/WalletView';
import { UserProfileModal } from './components/UserProfileModal';

export default function App() {
  // App Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'explore' | 'map' | 'rentals' | 'messages' | 'wallet'>('explore');
  
  // App Mode & User Profile
  const [appMode, setAppMode] = useState<AppMode>('demo');
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_LIVE_PROFILE);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [isLoadingMode, setIsLoadingMode] = useState<boolean>(true);

  // Data States
  const [tools, setTools] = useState<ToolItem[]>(INITIAL_TOOLS);
  const [bookings, setBookings] = useState<RentalBooking[]>(INITIAL_BOOKINGS);
  const [wallet, setWallet] = useState<UserWallet>(INITIAL_WALLET);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv_dave_drill');

  // Filters
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Oakwood Terrace');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [maxRate, setMaxRate] = useState<number>(50);

  // Modals
  const [detailTool, setDetailTool] = useState<ToolItem | null>(null);
  const [checkoutTool, setCheckoutTool] = useState<ToolItem | null>(null);
  const [barcodeTool, setBarcodeTool] = useState<ToolItem | null>(null);
  const [showListModal, setShowListModal] = useState<boolean>(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState<boolean>(false);
  
  // Machine Vision & Concurrence Modal State
  const [machineVisionTarget, setMachineVisionTarget] = useState<{
    tool?: ToolItem | null;
    booking?: RentalBooking | null;
    mode: 'listing' | 'return';
  } | null>(null);

  // Success Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initialize data on mount
  useEffect(() => {
    async function initData() {
      try {
        const mode = await apiService.getAppMode();
        setAppMode(mode);
        const profile = await apiService.getUserProfile();
        setUserProfile(profile);
        const loadedTools = await apiService.getTools(mode);
        setTools(loadedTools);
        const loadedBookings = await apiService.getBookings(mode);
        setBookings(loadedBookings);
        const loadedWallet = await apiService.getWallet(mode);
        setWallet(loadedWallet);
      } catch (err) {
        console.error('Failed to initialize app state:', err);
      } finally {
        setIsLoadingMode(false);
      }
    }
    initData();
  }, []);

  // Handle Mode Toggle
  const handleToggleMode = async (newMode: AppMode) => {
    setIsLoadingMode(true);
    await apiService.setAppMode(newMode);
    setAppMode(newMode);
    
    // Load tools, bookings, and wallet for the chosen mode
    const loadedTools = await apiService.getTools(newMode);
    setTools(loadedTools);
    const loadedBookings = await apiService.getBookings(newMode);
    setBookings(loadedBookings);
    const loadedWallet = await apiService.getWallet(newMode);
    setWallet(loadedWallet);
    setIsLoadingMode(false);

    if (newMode === 'live') {
      showToast('🟢 Switched to Live Production Mode with persistent local storage!');
    } else {
      showToast('⚡ Switched to Demo Simulator: exploring simulated neighborhood tools.');
    }
  };

  // Handle Profile Update
  const handleSaveProfile = async (updated: Partial<UserProfile>) => {
    const saved = await apiService.updateUserProfile(updated);
    setUserProfile(saved);
    showToast(`Profile updated: ${saved.name}`);
  };

  // Handle Reset Demo
  const handleResetDemo = async () => {
    await apiService.resetDemoData();
    if (appMode === 'demo') {
      const refreshedTools = await apiService.getTools('demo');
      setTools(refreshedTools);
      const refreshedBookings = await apiService.getBookings('demo');
      setBookings(refreshedBookings);
      const refreshedWallet = await apiService.getWallet('demo');
      setWallet(refreshedWallet);
    }
    showToast('Demo simulated data reset to original catalog!');
  };

  // Handle Export Local Backup
  const handleExportBackup = () => {
    const jsonStr = apiService.exportLocalBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neighborhood_garage_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported local database backup successfully!');
  };

  // Filter tools for Explore tab
  const filteredTools = tools.filter((tool) => {
    const matchesNeighborhood =
      selectedNeighborhood === 'All Neighborhoods' ||
      tool.location.neighborhood.toLowerCase() === selectedNeighborhood.toLowerCase();
    const matchesCategory =
      selectedCategory === 'All' || tool.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRate = tool.dailyRate <= maxRate;

    return matchesNeighborhood && matchesCategory && matchesSearch && matchesRate;
  });

  // Handle Checkout Booking Confirmation
  const handleConfirmBooking = (bookingData: Partial<RentalBooking>) => {
    const newBooking: RentalBooking = {
      id: `booking_${Date.now()}`,
      toolId: bookingData.toolId || '',
      toolTitle: bookingData.toolTitle || '',
      toolImage: bookingData.toolImage || '',
      category: bookingData.category || 'Power Tools',
      lenderId: bookingData.lenderId || '',
      lenderName: bookingData.lenderName || '',
      lenderAvatar: bookingData.lenderAvatar || '',
      lenderNeighborhood: bookingData.lenderNeighborhood || '',
      borrowerId: userProfile.id,
      borrowerName: userProfile.name,
      startDate: bookingData.startDate || '2026-09-29',
      endDate: bookingData.endDate || '2026-10-01',
      totalDays: bookingData.totalDays || 2,
      dailyRate: bookingData.dailyRate || 10,
      rentalFee: bookingData.rentalFee || 20,
      platformFee: bookingData.platformFee || 2.5,
      insuranceFee: 0,
      depositAmount: bookingData.depositAmount || 35,
      totalPaid: bookingData.totalPaid || 57.5,
      status: 'active',
      depositStatus: 'held_in_escrow',
      pickupDetails: bookingData.pickupDetails || {
        address: 'Neighborhood Porch',
        neighborhood: selectedNeighborhood,
        instructions: 'Pickup ready in porch lockbox.',
      },
      createdAt: new Date().toISOString(),
      scannedAtPickup: false,
    };

    const updatedBookings = [newBooking, ...bookings];
    setBookings(updatedBookings);
    apiService.saveBookings(updatedBookings, appMode);

    // Update Wallet: deduct rental fee, place deposit hold in escrow
    const updatedWallet: UserWallet = {
      ...wallet,
      availableCredits: Math.max(0, wallet.availableCredits - (newBooking.rentalFee + newBooking.platformFee)),
      heldInEscrow: wallet.heldInEscrow + newBooking.depositAmount,
      transactions: [
        {
          id: `tx_${Date.now()}_hold`,
          date: 'Just now',
          title: `Safe Escrow Hold: ${newBooking.toolTitle}`,
          description: `Safe escrow hold during active rental. Returns instantly to Garage Credits on return concurrence.`,
          amount: -newBooking.depositAmount,
          type: 'deposit_hold',
          status: 'held',
          relatedRentalId: newBooking.id,
        },
        {
          id: `tx_${Date.now()}_fee`,
          date: 'Just now',
          title: `Rental Fee: ${newBooking.toolTitle} (${newBooking.totalDays} days)`,
          description: `Daily rate $${newBooking.dailyRate} + small 5% platform upkeep. Insurance covered at $0.00.`,
          amount: -(newBooking.rentalFee + newBooking.platformFee),
          type: 'rental_payment',
          status: 'completed',
          relatedRentalId: newBooking.id,
        },
        ...wallet.transactions,
      ],
    };

    setWallet(updatedWallet);
    apiService.saveWallet(updatedWallet, appMode);

    setCheckoutTool(null);
    setDetailTool(null);
    setActiveTab('rentals');
    showToast(`Rental Booked! Safe escrow held with $1,500 repair insurance.`);
  };

  // Handle Barcode Scan Success
  const handleBarcodeScanSuccess = (bookingId: string, actionType: 'scan_out' | 'scan_in' | 'porch_dropoff') => {
    setShowBarcodeScanner(false);
    
    // Find matching active booking
    const matchingBooking = bookings.find((b) => b.id === bookingId);

    if (actionType === 'scan_out') {
      if (matchingBooking) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === matchingBooking.id
              ? {
                  ...b,
                  scannedAtPickup: true,
                  pickupHandoffMethod: 'scanned_barcode',
                }
              : b
          )
        );
        showToast(`Scan Confirmed! Tool checked OUT for rental #${matchingBooking.id.slice(-6)}.`);
      }
    } else {
      // Return: prompt optical inspection modal
      const matchedTool = tools.find((t) => t.id === matchingBooking?.toolId);
      if (matchedTool) {
        setMachineVisionTarget({
          tool: matchedTool,
          booking: matchingBooking || null,
          mode: 'return',
        });
      }
    }
  };

  // Handle Instant Deposit Release
  const handleInstantDepositRelease = (bookingId: string, amount: number, bonusAmount: number) => {
    const totalCreditReturn = amount + bonusAmount;

    const updatedBookings = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'completed' as const,
            depositStatus: 'released_to_credits' as const,
            concurrenceStatus: 'acknowledged_by_owner' as const,
            ownerAcknowledgment: {
              acknowledgedAt: new Date().toISOString(),
              ownerNote: 'Checked return photos. Tool clean & within 15% DIY wear tolerance! Released deposit.',
              wearVarianceApproved: true,
            },
          }
        : b
    );
    setBookings(updatedBookings);
    apiService.saveBookings(updatedBookings, appMode);

    const updatedWallet: UserWallet = {
      ...wallet,
      availableCredits: wallet.availableCredits + totalCreditReturn,
      heldInEscrow: Math.max(0, wallet.heldInEscrow - amount),
      transactions: [
        {
          id: `tx_${Date.now()}_refund`,
          date: 'Just now',
          title: `Instant Deposit Return: $${amount} + $${bonusAmount} Bonus`,
          description: `Owner acknowledged AI wear scan within normal DIY project variance. Escrow deposit + ${CURRENT_USER_RENTER_RANK.creditBonusPct}% reload bonus credited to wallet!`,
          amount: totalCreditReturn,
          type: 'deposit_release',
          status: 'released',
          relatedRentalId: bookingId,
        },
        ...wallet.transactions,
      ],
    };
    setWallet(updatedWallet);
    apiService.saveWallet(updatedWallet, appMode);

    showToast(`Owner Concurred! +$${totalCreditReturn.toFixed(2)} Neighborhood Garage Credits returned to your wallet.`);
  };

  // Handle Listing a new tool
  const handleAddTool = (newTool: ToolItem) => {
    const toolWithUserOwner: ToolItem = {
      ...newTool,
      owner: {
        ...newTool.owner,
        id: userProfile.id,
        name: userProfile.name,
        avatar: userProfile.avatar,
        neighborhood: userProfile.neighborhood,
      },
    };
    const updated = [toolWithUserOwner, ...tools];
    setTools(updated);
    apiService.saveTools(updated, appMode);
    showToast(`"${toolWithUserOwner.title}" is now active in ${toolWithUserOwner.location.neighborhood}!`);
  };

  // Handle In-App Chat Messages
  const handleSendMessage = (conversationId: string, text: string) => {
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      conversationId,
      senderId: userProfile.id,
      senderName: userProfile.name,
      senderAvatar: userProfile.avatar,
      text,
      timestamp: 'Just now',
      isLender: false,
    };

    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: text, lastMessageTime: 'Just now' }
          : c
      )
    );

    // Friendly neighbor auto-reply simulator in demo mode
    if (appMode === 'demo') {
      setTimeout(() => {
        const lenderReply: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          conversationId,
          senderId: 'owner_dave',
          senderName: 'Neighbor Lender',
          senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
          text: text.toLowerCase().includes('lockbox') || text.toLowerCase().includes('code')
            ? "The lockbox code is 4921! It's mounted right beside the front porch door."
            : text.toLowerCase().includes('concurrence') || text.toLowerCase().includes('return')
            ? "Saw the AI scan! Minor sawdust and light wear look totally normal for DIY work. Acknowledged and deposit released!"
            : "Got it! Thanks for coordinating. Let me know if you need any extra bits or attachments.",
          timestamp: 'Just now',
          isLender: true,
        };

        setMessages((prev) => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), lenderReply],
        }));

        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: lenderReply.text, lastMessageTime: 'Just now' }
              : c
          )
        );
      }, 1200);
    }
  };

  // Open Chat from Tool
  const handleOpenChatFromTool = (tool: ToolItem) => {
    const existingConv = conversations.find((c) => c.toolId === tool.id);
    if (existingConv) {
      setActiveConversationId(existingConv.id);
    } else {
      const newConv: Conversation = {
        id: `conv_${tool.id}`,
        toolId: tool.id,
        toolTitle: tool.title,
        toolImage: tool.images[0],
        otherUser: {
          id: tool.owner.id,
          name: tool.owner.name,
          avatar: tool.owner.avatar,
          neighborhood: tool.location.neighborhood,
          rating: tool.owner.rating,
        },
        lastMessage: `Hi ${tool.owner.name}, I have a question about this ${tool.title}.`,
        lastMessageTime: 'Just now',
        unreadCount: 0,
      };
      setConversations([newConv, ...conversations]);
      setActiveConversationId(newConv.id);
    }
    setDetailTool(null);
    setActiveTab('messages');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16 md:pb-0 overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 bg-slate-900 border border-amber-500 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 max-w-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wallet={wallet}
        selectedNeighborhood={selectedNeighborhood}
        setSelectedNeighborhood={setSelectedNeighborhood}
        onOpenListModal={() => setShowListModal(true)}
        onOpenBarcodeScanner={() => setShowBarcodeScanner(true)}
        unreadCount={conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
        activeRentalsCount={bookings.filter((b) => b.status === 'active').length}
        appMode={appMode}
        onToggleMode={handleToggleMode}
        userProfile={userProfile}
        onOpenProfileModal={() => setShowProfileModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* TAB 1: EXPLORE / CATALOG */}
        {activeTab === 'explore' && (
          <div className="space-y-6">
            {/* Friendly Garage Hero Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 p-5 sm:p-8 shadow-2xl">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                  <Home className="w-3.5 h-3.5" />
                  <span>Welcome to Neighborhood Garage • Charming Local Tool Sharing</span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  Why buy when you can borrow?<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">
                    Friendly rates. $0 deductible insurance.
                  </span>
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Rent workshop tools from friendly neighbors around <strong>{selectedNeighborhood}</strong>. With built-in <strong>15% DIY normal wear-and-tear allowance</strong>, optical AI scanning, and fast escrow refunds, you can tackle home projects with peace of mind.
                </p>

                {/* Search & Action Bar */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-xl">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search drills, mowers, saws, ladders, compressors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('map')}
                      className="flex-1 sm:flex-none px-4 py-2.5 sm:py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
                    >
                      <MapIcon className="w-4 h-4" />
                      <span>Radar Map</span>
                    </button>

                    <button
                      onClick={() => setShowBarcodeScanner(true)}
                      className="px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
                      title="Scan tool in or out"
                    >
                      <ScanLine className="w-4 h-4 text-amber-400" />
                      <span className="hidden sm:inline">Scan Tag</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Trust Badges Strip */}
              <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>$1.5k Shield:</strong> $0 deductible</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span><strong>15% DIY Wear:</strong> Tolerance built-in</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span><strong>Safe Escrow:</strong> Instant return bonus</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Zap className="w-4 h-4 text-orange-400 shrink-0" />
                  <span><strong>Zero Markups:</strong> Transparent 5% margin</span>
                </div>
              </div>
            </div>

            {/* Category Filter Chips Bar */}
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center gap-2">
                {[
                  'All',
                  'Power Tools',
                  'Lawn & Garden',
                  'Woodworking',
                  'Masonry & Tile',
                  'Ladders & Safety',
                  'Hand Tools',
                ].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Tools Count Tag */}
              <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
                Showing <strong className="text-white">{filteredTools.length} garage tools</strong>
              </span>
            </div>

            {/* Tools Grid / Empty State */}
            {filteredTools.length === 0 ? (
              <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center font-black">
                  <Wrench className="w-7 h-7" />
                </div>
                <h3 className="font-extrabold text-white text-base sm:text-lg">
                  {appMode === 'live' ? 'No Live Tools in this Filter Yet' : 'No Tools Found'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {appMode === 'live'
                    ? `You are running in Live Mode with your real database! Click "+ Lend a Tool" to list equipment in your neighborhood, or switch to Demo Simulator to explore the simulated tool fleet.`
                    : 'Try clearing your search query or selecting "All Neighborhoods" to view all available tools.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {appMode === 'live' ? (
                    <>
                      <button
                        onClick={() => setShowListModal(true)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition"
                      >
                        <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                        <span>+ Lend a Tool Now</span>
                      </button>
                      <button
                        onClick={() => handleToggleMode('demo')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>View Demo Fleet</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                        setSelectedNeighborhood('All Neighborhoods');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onSelect={(t) => setDetailTool(t)}
                    onRent={(t) => setCheckoutTool(t)}
                    onViewTag={(t) => setBarcodeTool(t)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RADAR MAP VIEW */}
        {activeTab === 'map' && (
          <NeighborhoodMap
            tools={tools}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedNeighborhood={selectedNeighborhood}
            onSelectTool={(t) => setDetailTool(t)}
            onRentTool={(t) => setCheckoutTool(t)}
          />
        )}

        {/* TAB 3: RENTALS VIEW */}
        {activeTab === 'rentals' && (
          <RentalsView
            bookings={bookings}
            tools={tools}
            currentUserId={userProfile.id}
            onOpenReturnScanner={(booking) => {
              const tool = tools.find((t) => t.id === booking.toolId);
              setMachineVisionTarget({
                tool: tool || null,
                booking,
                mode: 'return',
              });
            }}
            onOpenBarcodeScanner={() => setShowBarcodeScanner(true)}
            onOpenChat={(toolId) => {
              const tool = tools.find((t) => t.id === toolId);
              if (tool) handleOpenChatFromTool(tool);
            }}
            onOpenListTool={() => setShowListModal(true)}
            onSelectTool={(t) => setDetailTool(t)}
          />
        )}

        {/* TAB 4: IN-APP MESSAGES */}
        {activeTab === 'messages' && (
          <MessagingView
            conversations={conversations}
            messages={messages}
            activeConversationId={activeConversationId}
            setActiveConversationId={setActiveConversationId}
            onSendMessage={handleSendMessage}
          />
        )}

        {/* TAB 5: ESCROW CREDITS & WALLET VIEW */}
        {activeTab === 'wallet' && (
          <WalletView
            wallet={wallet}
            onTopUpCredits={(amount: number) => {
              const updatedWallet: UserWallet = {
                ...wallet,
                availableCredits: wallet.availableCredits + amount,
                transactions: [
                  {
                    id: `tx_${Date.now()}`,
                    date: 'Just now',
                    title: `Reload: +$${amount.toFixed(2)} Credits`,
                    description: 'Instant Garage credits reload. 1 credit = $1.00 USD value.',
                    amount: amount,
                    type: 'credit_topup',
                    status: 'completed',
                  },
                  ...wallet.transactions,
                ],
              };
              setWallet(updatedWallet);
              apiService.saveWallet(updatedWallet, appMode);
              showToast(`Added $${amount.toFixed(2)} Credits to your wallet!`);
            }}
            onWithdrawCredits={(amount: number) => {
              const updatedWallet: UserWallet = {
                ...wallet,
                availableCredits: Math.max(0, wallet.availableCredits - amount),
                transactions: [
                  {
                    id: `tx_${Date.now()}`,
                    date: 'Just now',
                    title: `Withdrawal: -$${amount.toFixed(2)}`,
                    description: 'Transfer to linked bank account / debit card.',
                    amount: -amount,
                    type: 'deposit_release',
                    status: 'completed',
                  },
                  ...wallet.transactions,
                ],
              };
              setWallet(updatedWallet);
              apiService.saveWallet(updatedWallet, appMode);
              showToast(`Withdrew $${amount.toFixed(2)} to your bank account.`);
            }}
          />
        )}
      </main>

      {/* --- MODALS & DIALOGS --- */}

      {/* 0. User Profile & Backend Sync Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={userProfile}
        onSaveProfile={handleSaveProfile}
        appMode={appMode}
        onToggleMode={handleToggleMode}
        onResetDemo={handleResetDemo}
        onExportBackup={handleExportBackup}
      />

      {/* 1. Tool Detail Modal */}
      {detailTool && (
        <ToolDetailModal
          tool={detailTool}
          onClose={() => setDetailTool(null)}
          onRent={(t) => {
            setDetailTool(null);
            setCheckoutTool(t);
          }}
          onMessageOwner={(t) => handleOpenChatFromTool(t)}
          onScanCondition={(t) => {
            setDetailTool(null);
            setMachineVisionTarget({
              tool: t,
              booking: null,
              mode: 'listing',
            });
          }}
          onViewTag={(t) => {
            setDetailTool(null);
            setBarcodeTool(t);
          }}
        />
      )}

      {/* 2. Checkout Modal */}
      {checkoutTool && (
        <CheckoutModal
          tool={checkoutTool}
          wallet={wallet}
          onClose={() => setCheckoutTool(null)}
          onConfirmBooking={handleConfirmBooking}
        />
      )}

      {/* 3. Barcode & Inventory Tag Modal */}
      {barcodeTool && (
        <BarcodeModal
          tool={barcodeTool}
          onClose={() => setBarcodeTool(null)}
        />
      )}

      {/* 4. Barcode Check-In / Check-Out Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScannerModal
          activeBookings={bookings.filter((b) => b.status === 'active')}
          tools={tools}
          onClose={() => setShowBarcodeScanner(false)}
          onScanSuccess={handleBarcodeScanSuccess}
        />
      )}

      {/* 5. List a Tool Modal (with Autofill & Studio Background Removal) */}
      {showListModal && (
        <ListToolModal
          onClose={() => setShowListModal(false)}
          onAddTool={handleAddTool}
        />
      )}

      {/* 6. Machine Vision & Concurrence Modal */}
      {machineVisionTarget && (
        <MachineVisionModal
          tool={machineVisionTarget.tool}
          activeBooking={machineVisionTarget.booking}
          mode={machineVisionTarget.mode}
          onClose={() => setMachineVisionTarget(null)}
          onConfirmInstantDepositRelease={(bookingId, amount, bonus) => {
            handleInstantDepositRelease(bookingId, amount, bonus);
          }}
        />
      )}
    </div>
  );
}
