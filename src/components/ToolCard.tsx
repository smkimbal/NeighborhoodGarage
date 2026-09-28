import React from 'react';
import { 
  ShieldCheck, 
  MapPin, 
  Star, 
  Sparkles, 
  QrCode, 
  Zap, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Eye
} from 'lucide-react';
import { ToolItem } from '../types';

interface ToolCardProps {
  tool: ToolItem;
  onSelect: (tool: ToolItem) => void;
  onRent: (tool: ToolItem) => void;
  onViewTag: (tool: ToolItem) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  onSelect,
  onRent,
  onViewTag,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300 flex flex-col group relative">
      {/* Top Media Container */}
      <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden cursor-pointer" onClick={() => onSelect(tool)}>
        <img
          src={tool.images[0]}
          alt={tool.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

        {/* Condition Grade Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 text-xs font-semibold text-white shadow-md">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>{tool.conditionGrade.split(' ')[0]}</span>
          <span className="text-[10px] text-emerald-400 font-normal">Verified</span>
        </div>

        {/* Insurance Shield Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 backdrop-blur-md border border-emerald-500/40 text-[11px] font-medium text-emerald-300 shadow-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>$1.5k Insured</span>
        </div>

        {/* Inventory Barcode Tag Quick Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewTag(tool);
          }}
          className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-amber-400 border border-slate-700/80 backdrop-blur-md transition shadow-md"
          title="View Serial & Barcode Tag"
        >
          <QrCode className="w-4 h-4" />
        </button>

        {/* Distance Pill */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/90 backdrop-blur-md text-[11px] font-medium text-slate-300">
          <MapPin className="w-3 h-3 text-amber-400" />
          <span>{tool.location.distanceMiles ?? 0.5} mi away • {tool.location.neighborhood}</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Serial Subhead */}
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-amber-400/90 tracking-wide uppercase">{tool.brand}</span>
            <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              SN: {tool.serialNumber.substring(0, 11)}...
            </span>
          </div>

          {/* Title */}
          <h3 
            onClick={() => onSelect(tool)}
            className="font-bold text-white text-base leading-snug group-hover:text-amber-400 transition cursor-pointer line-clamp-1"
          >
            {tool.title}
          </h3>

          {/* Specs / Feature highlight */}
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {tool.description}
          </p>

          {/* Owner & Pickup info */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <img
                src={tool.owner.avatar}
                alt={tool.owner.name}
                className="w-6 h-6 rounded-full object-cover border border-slate-700"
              />
              <span className="text-slate-300 font-medium">{tool.owner.name}</span>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-white">{tool.owner.rating}</span>
              <span className="text-slate-400 text-[11px]">({tool.owner.reviewCount})</span>
            </div>
          </div>
        </div>

        {/* Pricing & Booking CTA */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-amber-400">${tool.dailyRate}</span>
              <span className="text-xs text-slate-400">/ day</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1" title="Returned automatically as ToolShare credits">
              <span className="text-emerald-400 font-medium">${tool.depositAmount} deposit</span>
              <span className="text-slate-400">• safe hold</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSelect(tool)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs"
              title="Inspect specifications and condition"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              onClick={() => onRent(tool)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-amber-500/10 active:scale-95 transition"
            >
              <span>Rent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
