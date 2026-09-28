import { AppMode, UserProfile, ToolItem, RentalBooking, UserWallet } from '../types';
import { INITIAL_TOOLS, INITIAL_BOOKINGS, INITIAL_WALLET, CURRENT_USER } from '../data/mockData';

const STORAGE_KEYS = {
  APP_MODE: 'neighborhood_garage_mode',
  USER_PROFILE: 'neighborhood_garage_user_profile',
  LIVE_TOOLS: 'neighborhood_garage_live_tools',
  LIVE_BOOKINGS: 'neighborhood_garage_live_bookings',
  LIVE_WALLET: 'neighborhood_garage_live_wallet',
  DEMO_TOOLS: 'neighborhood_garage_demo_tools',
  DEMO_BOOKINGS: 'neighborhood_garage_demo_bookings',
  DEMO_WALLET: 'neighborhood_garage_demo_wallet',
};

export const DEFAULT_LIVE_PROFILE: UserProfile = {
  id: 'user_stephen_live',
  name: 'Stephen Kimball',
  email: 'Stephen.Kimball.13@gmail.com',
  phone: '(555) 392-8192',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
  neighborhood: 'Oakwood Terrace',
  bio: 'Community tool steward, craftsman, and DIY enthusiast. Keeping good tools in neighborhood hands!',
  joinedYear: '2026',
  rating: 5.0,
  reviewsCount: 3,
  phoneVerified: true,
  idVerified: true,
  memberStatus: 'Neighborhood Steward',
  role: 'admin',
  address: '1042 Evergreen Way, Oakwood Terrace',
};

// Test if server API is reachable
let isServerOnline: boolean | null = null;
async function checkServerOnline(): Promise<boolean> {
  if (isServerOnline !== null) return isServerOnline;
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(1500) });
    isServerOnline = res.ok;
  } catch {
    isServerOnline = false;
  }
  return isServerOnline;
}

export const apiService = {
  // App Mode (demo vs live)
  async getAppMode(): Promise<AppMode> {
    const local = (localStorage.getItem(STORAGE_KEYS.APP_MODE) as AppMode) || 'demo';
    const online = await checkServerOnline();
    if (online) {
      try {
        const res = await fetch('/api/app-mode');
        const data = await res.json();
        if (data.mode) {
          localStorage.setItem(STORAGE_KEYS.APP_MODE, data.mode);
          return data.mode;
        }
      } catch (err) {
        console.warn('Failed to fetch app mode from server, using local:', err);
      }
    }
    return local;
  },

  async setAppMode(mode: AppMode): Promise<AppMode> {
    localStorage.setItem(STORAGE_KEYS.APP_MODE, mode);
    const online = await checkServerOnline();
    if (online) {
      try {
        await fetch('/api/app-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
      } catch (err) {
        console.warn('Server offline, saved mode locally:', err);
      }
    }
    return mode;
  },

  // User Profile
  async getUserProfile(): Promise<UserProfile> {
    const localStr = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    let localProfile: UserProfile = localStr ? JSON.parse(localStr) : DEFAULT_LIVE_PROFILE;

    const online = await checkServerOnline();
    if (online) {
      try {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        if (data.profile) {
          localProfile = { ...DEFAULT_LIVE_PROFILE, ...data.profile };
          localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(localProfile));
        }
      } catch (err) {
        console.warn('Using local user profile:', err);
      }
    }
    return localProfile;
  },

  async updateUserProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getUserProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));

    const online = await checkServerOnline();
    if (online) {
      try {
        await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch (err) {
        console.warn('Server offline, updated profile locally:', err);
      }
    }
    return updated;
  },

  // Tools
  async getTools(mode: AppMode): Promise<ToolItem[]> {
    if (mode === 'demo') {
      const localStr = localStorage.getItem(STORAGE_KEYS.DEMO_TOOLS);
      return localStr ? JSON.parse(localStr) : INITIAL_TOOLS;
    }

    const localStr = localStorage.getItem(STORAGE_KEYS.LIVE_TOOLS);
    let liveTools: ToolItem[] = localStr ? JSON.parse(localStr) : [];

    const online = await checkServerOnline();
    if (online) {
      try {
        const res = await fetch('/api/tools?mode=live');
        const data = await res.json();
        if (Array.isArray(data.tools) && data.tools.length > 0) {
          liveTools = data.tools;
          localStorage.setItem(STORAGE_KEYS.LIVE_TOOLS, JSON.stringify(liveTools));
        }
      } catch (err) {
        console.warn('Using local live tools:', err);
      }
    }
    return liveTools;
  },

  async saveTools(tools: ToolItem[], mode: AppMode): Promise<void> {
    const key = mode === 'live' ? STORAGE_KEYS.LIVE_TOOLS : STORAGE_KEYS.DEMO_TOOLS;
    localStorage.setItem(key, JSON.stringify(tools));

    const online = await checkServerOnline();
    if (online) {
      // Sync last tool if newly created
      try {
        if (tools.length > 0) {
          await fetch('/api/tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...tools[0], mode }),
          });
        }
      } catch (err) {
        console.warn('Saved tools locally:', err);
      }
    }
  },

  // Bookings
  async getBookings(mode: AppMode): Promise<RentalBooking[]> {
    if (mode === 'demo') {
      const localStr = localStorage.getItem(STORAGE_KEYS.DEMO_BOOKINGS);
      return localStr ? JSON.parse(localStr) : INITIAL_BOOKINGS;
    }

    const localStr = localStorage.getItem(STORAGE_KEYS.LIVE_BOOKINGS);
    let liveBookings: RentalBooking[] = localStr ? JSON.parse(localStr) : [];

    const online = await checkServerOnline();
    if (online) {
      try {
        const res = await fetch('/api/bookings?mode=live');
        const data = await res.json();
        if (Array.isArray(data.bookings) && data.bookings.length > 0) {
          liveBookings = data.bookings;
          localStorage.setItem(STORAGE_KEYS.LIVE_BOOKINGS, JSON.stringify(liveBookings));
        }
      } catch (err) {
        console.warn('Using local live bookings:', err);
      }
    }
    return liveBookings;
  },

  async saveBookings(bookings: RentalBooking[], mode: AppMode): Promise<void> {
    const key = mode === 'live' ? STORAGE_KEYS.LIVE_BOOKINGS : STORAGE_KEYS.DEMO_BOOKINGS;
    localStorage.setItem(key, JSON.stringify(bookings));

    const online = await checkServerOnline();
    if (online && bookings.length > 0) {
      try {
        await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...bookings[0], mode }),
        });
      } catch (err) {
        console.warn('Saved bookings locally:', err);
      }
    }
  },

  // Wallet
  async getWallet(mode: AppMode): Promise<UserWallet> {
    if (mode === 'demo') {
      const localStr = localStorage.getItem(STORAGE_KEYS.DEMO_WALLET);
      return localStr ? JSON.parse(localStr) : INITIAL_WALLET;
    }

    const localStr = localStorage.getItem(STORAGE_KEYS.LIVE_WALLET);
    let liveWallet: UserWallet = localStr
      ? JSON.parse(localStr)
      : {
          availableCredits: 50.0,
          heldInEscrow: 0,
          lifetimeEarned: 0,
          lifetimeSaved: 0,
          transactions: [
            {
              id: 'tx_init_welcome',
              date: 'Just now',
              title: 'Welcome to Neighborhood Garage',
              description: 'Initial community credit welcome balance.',
              amount: 50.0,
              type: 'credit_bonus',
              status: 'completed',
            },
          ],
        };

    const online = await checkServerOnline();
    if (online) {
      try {
        const res = await fetch('/api/wallet?mode=live');
        const data = await res.json();
        if (data.wallet) {
          liveWallet = data.wallet;
          localStorage.setItem(STORAGE_KEYS.LIVE_WALLET, JSON.stringify(liveWallet));
        }
      } catch (err) {
        console.warn('Using local live wallet:', err);
      }
    }
    return liveWallet;
  },

  async saveWallet(wallet: UserWallet, mode: AppMode): Promise<void> {
    const key = mode === 'live' ? STORAGE_KEYS.LIVE_WALLET : STORAGE_KEYS.DEMO_WALLET;
    localStorage.setItem(key, JSON.stringify(wallet));
  },

  // Reset Demo Data
  async resetDemoData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.DEMO_TOOLS);
    localStorage.removeItem(STORAGE_KEYS.DEMO_BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.DEMO_WALLET);

    const online = await checkServerOnline();
    if (online) {
      try {
        await fetch('/api/reset-demo', { method: 'POST' });
      } catch (err) {
        console.warn('Reset demo locally:', err);
      }
    }
  },

  // Export Data for User Sovereignty & Security
  exportLocalBackup(): string {
    const backup = {
      exportedAt: new Date().toISOString(),
      userProfile: localStorage.getItem(STORAGE_KEYS.USER_PROFILE),
      liveTools: localStorage.getItem(STORAGE_KEYS.LIVE_TOOLS),
      liveBookings: localStorage.getItem(STORAGE_KEYS.LIVE_BOOKINGS),
      liveWallet: localStorage.getItem(STORAGE_KEYS.LIVE_WALLET),
    };
    return JSON.stringify(backup, null, 2);
  },
};
