import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'garage_store.json');

export interface LiveUserProfile {
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
  lat?: number;
  lng?: number;
}

export interface AppDatabaseSchema {
  mode: 'demo' | 'live';
  userProfile: LiveUserProfile;
  liveTools: any[];
  liveBookings: any[];
  liveConversations: any[];
  liveMessages: Record<string, any[]>;
  liveWallet: {
    availableCredits: number;
    heldInEscrow: number;
    lifetimeEarned: number;
    lifetimeSaved: number;
    transactions: any[];
  };
  demoOverrides?: {
    tools?: any[];
    bookings?: any[];
    wallet?: any;
    conversations?: any[];
    messages?: Record<string, any[]>;
  };
}

const DEFAULT_PROFILE: LiveUserProfile = {
  id: 'user_live_primary',
  name: 'Stephen Kimball',
  email: 'Stephen.Kimball.13@gmail.com',
  phone: '(555) 392-8192',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
  neighborhood: 'Oakwood Terrace',
  bio: 'DIY enthusiast, home restorer, and tool steward. Happy to lend out workshop equipment to neighbors!',
  joinedYear: '2026',
  rating: 5.0,
  reviewsCount: 3,
  phoneVerified: true,
  idVerified: true,
  memberStatus: 'Neighborhood Steward',
  role: 'admin',
  address: '1042 Evergreen Way, Oakwood Terrace',
  lat: 37.7749,
  lng: -122.4194,
};

const DEFAULT_DB: AppDatabaseSchema = {
  mode: 'demo',
  userProfile: DEFAULT_PROFILE,
  liveTools: [],
  liveBookings: [],
  liveConversations: [],
  liveMessages: {},
  liveWallet: {
    availableCredits: 50.0,
    heldInEscrow: 0,
    lifetimeEarned: 0,
    lifetimeSaved: 0,
    transactions: [
      {
        id: 'tx_init_welcome',
        date: '2026-09-28',
        title: 'Neighborhood Garage Live Welcome Credits',
        description: 'Complimentary account credit for joining your local community sharing network.',
        amount: 50.0,
        type: 'credit_bonus',
        status: 'completed',
      },
    ],
  },
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load database with fallback
export function loadDatabase(): AppDatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        ...DEFAULT_DB,
        ...parsed,
        userProfile: { ...DEFAULT_PROFILE, ...(parsed.userProfile || {}) },
        liveWallet: { ...DEFAULT_DB.liveWallet, ...(parsed.liveWallet || {}) },
      };
    }
  } catch (err) {
    console.error('Error reading database file, using defaults:', err);
  }
  saveDatabase(DEFAULT_DB);
  return DEFAULT_DB;
}

// Atomic save to prevent corruption
export function saveDatabase(data: AppDatabaseSchema): void {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

// Singleton helper methods
export const db = {
  get(): AppDatabaseSchema {
    return loadDatabase();
  },
  update(updater: (data: AppDatabaseSchema) => void): AppDatabaseSchema {
    const data = loadDatabase();
    updater(data);
    saveDatabase(data);
    return data;
  },
  getMode(): 'demo' | 'live' {
    return loadDatabase().mode;
  },
  setMode(mode: 'demo' | 'live'): 'demo' | 'live' {
    this.update((d) => {
      d.mode = mode;
    });
    return mode;
  },
  getUserProfile(): LiveUserProfile {
    return loadDatabase().userProfile;
  },
  updateUserProfile(profileUpdates: Partial<LiveUserProfile>): LiveUserProfile {
    const updated = this.update((d) => {
      d.userProfile = {
        ...d.userProfile,
        ...profileUpdates,
      };
    });
    return updated.userProfile;
  },
  resetDemo(): void {
    this.update((d) => {
      delete d.demoOverrides;
    });
  },
};
