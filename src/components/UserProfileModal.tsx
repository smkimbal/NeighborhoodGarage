import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Award, 
  Check, 
  Save, 
  X, 
  ToggleLeft, 
  ToggleRight, 
  RotateCcw, 
  Download, 
  HardDrive, 
  Sparkles,
  Camera,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, AppMode } from '../types';
import { NEIGHBORHOODS } from '../data/mockData';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaveProfile: (updated: Partial<UserProfile>) => void;
  appMode: AppMode;
  onToggleMode: (mode: AppMode) => void;
  onResetDemo: () => void;
  onExportBackup: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  appMode,
  onToggleMode,
  onResetDemo,
  onExportBackup,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<UserProfile>(profile);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(formData);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl animate-in fade-in my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">User Profile &amp; Backend Sync</h2>
              <p className="text-[11px] text-slate-400 font-medium">Manage your identity, settings, and demo/live database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* DEMO / LIVE MODE TOGGLE HERO CARD */}
        <div className={`p-4 rounded-2xl border transition-all ${
          appMode === 'live'
            ? 'bg-gradient-to-br from-emerald-950/60 to-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
            : 'bg-gradient-to-br from-amber-950/60 to-slate-900 border-amber-500/40 shadow-lg shadow-amber-950/30'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                appMode === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {appMode === 'live' ? <HardDrive className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">
                    {appMode === 'live' ? '🟢 Live Production Mode' : '⚡ Demo Simulator Mode'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    appMode === 'live'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {appMode === 'live' ? 'Real Database' : 'Simulated Data'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                  {appMode === 'live'
                    ? 'Using secure, persistent local backend storage for your actual equipment, bookings, and profile.'
                    : 'Using simulated neighborhood equipment catalog, test bookings, and mock escrow wallet.'}
                </p>
              </div>
            </div>

            {/* Toggle Button */}
            <button
              type="button"
              onClick={() => onToggleMode(appMode === 'demo' ? 'live' : 'demo')}
              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 shrink-0 ${
                appMode === 'live'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              }`}
              title="Click to toggle between Demo Simulator and Live Production mode"
            >
              {appMode === 'live' ? (
                <>
                  <ToggleRight className="w-4 h-4 stroke-[2.5]" />
                  <span>Switch to Demo</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 stroke-[2.5]" />
                  <span>Go Live</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar & Basic Info */}
          <div className="flex items-center gap-4 bg-slate-800/40 p-3.5 rounded-2xl border border-slate-700/60">
            <div className="relative shrink-0">
              <img
                src={formData.avatar}
                alt={formData.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/60 shadow-md"
              />
              <button
                type="button"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="absolute -bottom-1.5 -right-1.5 p-1 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md transition"
                title="Change Avatar"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Current User</span>
              <h3 className="font-extrabold text-sm sm:text-base text-white truncate">{formData.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified
                </span>
                <span>•</span>
                <span>{formData.rating} ★ Rating</span>
              </div>
            </div>
          </div>

          {/* Avatar Presets Drawer */}
          {showAvatarPicker && (
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2 animate-in fade-in">
              <div className="text-[10px] font-bold uppercase text-slate-400">Select an Avatar Preset</div>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_PRESETS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, avatar: url });
                      setShowAvatarPicker(false);
                    }}
                    className={`rounded-xl overflow-hidden border-2 transition hover:scale-105 ${
                      formData.avatar === url ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-transparent'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-12 object-cover" />
                  </button>
                ))}
              </div>
              <div className="pt-1">
                <input
                  type="url"
                  placeholder="Or paste custom image URL..."
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500"
                />
              </div>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Neighborhood Zone
              </label>
              <select
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {NEIGHBORHOODS.filter((n) => n.name !== 'All Neighborhoods').map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
              Member Bio &amp; Tool Philosophy
            </label>
            <textarea
              rows={2}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none"
              placeholder="Tell neighbors a bit about your DIY projects and workshop equipment..."
            />
          </div>

          {/* Quick Database Management Tools */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetDemo}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                title="Reset simulated tools, active bookings, and mock wallet"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Demo Data</span>
              </button>

              <button
                type="button"
                onClick={onExportBackup}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                title="Export your profile and equipment database as local JSON backup"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Local Data</span>
              </button>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition active:scale-95"
            >
              {savedToast ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
