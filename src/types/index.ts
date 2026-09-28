export type ToolCategory =
  | 'Power Tools'
  | 'Lawn & Garden'
  | 'Woodworking'
  | 'Masonry & Tile'
  | 'Ladders & Safety'
  | 'Hand Tools'
  | 'Plumbing'
  | 'Automotive';

export interface Review {
  id: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  date: string;
  comment: string;
  verifiedRental: boolean;
  rentalDurationDays: number;
  helpfulCount: number;
}

export interface InspectionRecord {
  date: string;
  photoUrl: string;
  conditionGrade: string;
  wearLevel: string;
  wearVariancePercent?: number; // e.g. 4.2%
  acceptableWearThresholdPercent?: number; // 15%
  isWithinAcceptableVariance?: boolean;
  concurrenceRecommendation?: string;
  summary: string;
  approved: boolean;
  verifiedByAI: boolean;
  replacementValue: number;
  calculatedDeposit: number;
}

export interface ToolOwner {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  neighborhood: string;
  badges: string[];
  responseTime: string;
  joinedYear: string;
  phoneVerified: boolean;
  idVerified: boolean;
  ownerRank?: 'Friendly Garage' | 'Master Workshop' | 'Cornerstone Tool Library';
  platformMarginPct?: number; // e.g. 5%
}

export interface ToolLocation {
  lat: number;
  lng: number;
  address: string;
  neighborhood: string;
  distanceMiles?: number;
  pickupMethod: 'Porch Pickup' | 'Direct Handoff' | 'Smart Lockbox';
  pickupInstructions: string;
}

export interface InsurancePolicy {
  included: boolean;
  planName: string;
  coverageLimit: number;
  deductible: number;
  description: string;
}

export interface ToolItem {
  id: string;
  title: string;
  category: ToolCategory;
  description: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  barcode: string;
  dailyRate: number;
  weeklyDiscountPct: number;
  replacementValue: number;
  depositAmount: number;
  conditionGrade: string; // e.g., 'Grade A (Excellent)'
  wearLevel: string;
  opticalInspectionNotes: string;
  lastVisionInspection: string;
  images: string[];
  owner: ToolOwner;
  location: ToolLocation;
  availability: 'available' | 'rented' | 'maintenance';
  specifications: Record<string, string>;
  includedAccessories: string[];
  safetyNotes: string[];
  insurance: InsurancePolicy;
  reviews: Review[];
  featured?: boolean;
  studioBackgroundApplied?: boolean;
}

export interface RentalBooking {
  id: string;
  toolId: string;
  toolTitle: string;
  toolImage: string;
  category: ToolCategory;
  lenderId: string;
  lenderName: string;
  lenderAvatar: string;
  lenderNeighborhood: string;
  borrowerId: string;
  borrowerName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyRate: number;
  rentalFee: number;
  platformFee: number; // small transparent margin (~5-7%)
  insuranceFee: number; // $0.00
  depositAmount: number;
  totalPaid: number;
  status: 'active' | 'upcoming' | 'return_pending' | 'completed' | 'cancelled';
  depositStatus: 'held_in_escrow' | 'released_to_credits' | 'retained';
  pickupDetails: {
    address: string;
    neighborhood: string;
    instructions: string;
    lockboxCode?: string;
  };
  checkinInspection?: InspectionRecord;
  checkoutInspection?: InspectionRecord;
  
  // Barcode Check-In / Check-Out tracking
  pickupHandoffMethod?: 'scanned_barcode' | 'porch_dropoff';
  returnHandoffMethod?: 'scanned_barcode' | 'porch_dropoff';
  scannedAtPickup?: boolean;
  scannedAtReturn?: boolean;

  // In-App Concurrence with Owner
  concurrenceStatus?: 'pending_owner_concurrence' | 'acknowledged_by_owner' | 'auto_approved';
  ownerAcknowledgment?: {
    acknowledgedAt?: string;
    ownerNote?: string;
    wearVarianceApproved?: boolean;
  };

  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  date: string;
  title: string;
  description: string;
  amount: number; // positive for credits added/refunded, negative for payments/holds
  type: 'deposit_hold' | 'deposit_release' | 'rental_payment' | 'lending_earning' | 'credit_topup' | 'credit_bonus';
  status: 'completed' | 'held' | 'released';
  relatedRentalId?: string;
}

export interface UserWallet {
  availableCredits: number; // 1 credit = $1.00 USD
  heldInEscrow: number;
  lifetimeEarned: number;
  lifetimeSaved: number;
  transactions: WalletTransaction[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
  isLender: boolean;
  actionCard?: {
    type: 'pickup_details' | 'deposit_hold' | 'deposit_released' | 'return_instructions' | 'concurrence_check';
    title: string;
    details: string;
    amount?: number;
    variancePercent?: number;
  };
}

export interface Conversation {
  id: string;
  toolId: string;
  toolTitle: string;
  toolImage: string;
  otherUser: {
    id: string;
    name: string;
    avatar: string;
    neighborhood: string;
    rating: number;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  bookingId?: string;
}

export interface MachineVisionResult {
  detectedBrand: string;
  detectedModel: string;
  conditionGrade: string;
  wearLevel: string;
  wearVariancePercent?: number;
  acceptableWearThresholdPercent?: number;
  isWithinAcceptableVariance?: boolean;
  concurrenceRecommendation?: string;
  opticalInspectionSummary: string;
  estimatedReplacementValue: number;
  recommendedDailyRate: number;
  recommendedDeposit: number;
  confidenceScore: number;
  serialVerified: boolean;
  depositReleaseApproved?: boolean;
  damageDetected?: boolean;
  maintenanceTips?: string;
}

export type RenterRankTier = 'Apprentice Neighbor' | 'Journeyman Handyman' | 'Master Craftsman' | 'Legendary Tool Steward';

export interface RenterRankInfo {
  tier: RenterRankTier;
  level: number;
  rentalsCompleted: number;
  onTimeReturnRate: number;
  depositDiscountPct: number; // e.g., 25% lower deposit required
  creditBonusPct: number; // e.g., 6.5% reload bonus
  perks: string[];
}

export interface OwnerProfitMetrics {
  grossEarnings: number;
  platformMarginPct: number; // small 5% margin
  platformFeeTotal: number;
  netOwnerPayout: number;
  activeToolsCount: number;
  projectedMonthly: number;
  projectedAnnual: number;
}

export type AppMode = 'demo' | 'live';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  neighborhood: string;
  bio: string;
  joinedYear: string;
  rating: number;
  reviewsCount: number;
  phoneVerified: boolean;
  idVerified: boolean;
  memberStatus: 'Community Member' | 'Verified Lender' | 'Neighborhood Steward';
  role: 'user' | 'admin';
  address?: string;
}

