import React, { useState } from 'react';
import { 
  MapPin, 
  Navigation, 
  Sliders, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Star, 
  X,
  Compass,
  LocateFixed,
  Car,
  Footprints
} from 'lucide-react';
import { ToolItem, ToolCategory } from '../types';
import { CURRENT_USER } from '../data/mockData';

interface NeighborhoodMapProps {
  tools: ToolItem[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  onSelectTool: (tool: ToolItem) => void;
  onRentTool: (tool: ToolItem) => void;
  selectedNeighborhood: string;
}

export const NeighborhoodMap: React.FC<NeighborhoodMapProps> = ({
  tools,
  selectedCategory,
  setSelectedCategory,
  onSelectTool,
  onRentTool,
  selectedNeighborhood,
}) => {
  const [radiusMiles, setRadiusMiles] = useState<number>(3);
  const [activePinTool, setActivePinTool] = useState<ToolItem | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [userLocationName, setUserLocationName] = useState<string>('Oakwood Terrace Center');

  // Filter tools by radius and category
  const filteredTools = tools.filter((tool) => {
    const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;
    const matchesRadius = (tool.location.distanceMiles ?? 0.5) <= radiusMiles;
    const matchesNeighborhood = selectedNeighborhood === 'All Neighborhoods' || tool.location.neighborhood === selectedNeighborhood;
    return matchesCategory && matchesRadius && matchesNeighborhood;
  });

  const handleLocateMe = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          setUserLocationName('Current GPS Coordinates');
        },
        () => {
          setIsLocating(false);
          setUserLocationName('Oakwood Terrace (Simulated)');
        },
        { timeout: 5000 }
      );
    } else {
      setTimeout(() => {
        setIsLocating(false);
      }, 600);
    }
  };

  // Convert lat/lng to map SVG coordinates
  // Normalized center: lat 37.7749, lng -122.4194
  const getCoordinates = (lat: number, lng: number) => {
    const scale = 2200;
    const x = 500 + (lng - CURRENT_USER.lng) * scale;
    const y = 320 - (lat - CURRENT_USER.lat) * scale;
    return { x: Math.max(80, Math.min(920, x)), y: Math.max(60, Math.min(560, y)) };
  };

  const userCoords = getCoordinates(CURRENT_USER.lat, CURRENT_USER.lng);

  return (
    <div className="relative w-full h-[650px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* Top Map Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Radius Selector & Status */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-xl flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Compass className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Search Radius:</span>
            <span className="text-amber-400 font-bold">{radiusMiles} miles</span>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 3, 5, 10].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusMiles(r)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                  radiusMiles === r
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {r}m
              </button>
            ))}
          </div>

          <button
            onClick={handleLocateMe}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs"
            title="Update to current GPS location"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span className="hidden md:inline">Recenter</span>
          </button>
        </div>

        {/* Tools Count Tag */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 shadow-xl flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>
            <strong className="text-white">{filteredTools.length} tools</strong> available nearby
          </span>
        </div>
      </div>

      {/* Category Pills Bar inside Map */}
      <div className="absolute top-18 left-4 right-4 z-20 pointer-events-none overflow-x-auto pb-2 scrollbar-none">
        <div className="pointer-events-auto flex items-center gap-2 w-max bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-lg">
          {['All', 'Power Tools', 'Lawn & Garden', 'Woodworking', 'Masonry & Tile', 'Ladders & Safety'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="relative flex-1 bg-[#0b132b] overflow-hidden select-none cursor-grab active:cursor-grabbing">
        <svg viewBox="0 0 1000 650" className="w-full h-full object-cover">
          <defs>
            {/* Map Patterns */}
            <pattern id="streetGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1c2541" strokeWidth="1.2" opacity="0.4" />
            </pattern>
            <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grid background */}
          <rect width="1000" height="650" fill="#0b132b" />
          <rect width="1000" height="650" fill="url(#streetGrid)" />

          {/* Green Parks / Open Areas */}
          <path
            d="M 120,80 Q 220,50 300,120 T 420,240 Q 300,320 180,260 Z"
            fill="#133026"
            opacity="0.6"
          />
          <text x="210" y="160" fill="#2dd4bf" fontSize="12" fontWeight="600" opacity="0.6">
            Willow Glen Park & Trails
          </text>

          <path
            d="M 680,360 Q 840,320 900,440 T 780,580 Q 640,550 620,440 Z"
            fill="#133026"
            opacity="0.5"
          />
          <text x="730" y="470" fill="#2dd4bf" fontSize="12" fontWeight="600" opacity="0.6">
            Creekside Reserve
          </text>

          {/* River / Water Canal */}
          <path
            d="M -20,380 C 180,390 320,440 500,420 C 700,400 820,310 1020,330"
            fill="none"
            stroke="#1d3557"
            strokeWidth="32"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            d="M -20,380 C 180,390 320,440 500,420 C 700,400 820,310 1020,330"
            fill="none"
            stroke="#457b9d"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Main Arterial Roads */}
          <path d="M 0,260 L 1000,260" stroke="#334155" strokeWidth="8" opacity="0.6" />
          <text x="30" y="250" fill="#94a3b8" fontSize="11" fontWeight="500">Oakwood Expressway</text>

          <path d="M 0,460 L 1000,490" stroke="#334155" strokeWidth="6" opacity="0.5" />
          <text x="30" y="450" fill="#94a3b8" fontSize="11" fontWeight="500">Maple Crest Parkway</text>

          <path d="M 450,0 L 520,650" stroke="#334155" strokeWidth="7" opacity="0.6" />
          <text x="460" y="30" fill="#94a3b8" fontSize="11" fontWeight="500">Highland Boulevard</text>

          {/* Secondary streets */}
          <path d="M 220,0 L 220,650" stroke="#1e293b" strokeWidth="3" opacity="0.5" />
          <path d="M 750,0 L 750,650" stroke="#1e293b" strokeWidth="3" opacity="0.5" />
          <path d="M 0,130 L 1000,130" stroke="#1e293b" strokeWidth="3" opacity="0.5" />

          {/* Neighborhood Labels */}
          <g opacity="0.75">
            <text x="280" y="230" fill="#cbd5e1" fontSize="14" fontWeight="700" letterSpacing="1.5">
              OAKWOOD TERRACE
            </text>
            <text x="320" y="440" fill="#cbd5e1" fontSize="14" fontWeight="700" letterSpacing="1.5">
              MAPLE HEIGHTS
            </text>
            <text x="680" y="190" fill="#cbd5e1" fontSize="14" fontWeight="700" letterSpacing="1.5">
              WILLOW GLEN
            </text>
            <text x="710" y="520" fill="#cbd5e1" fontSize="14" fontWeight="700" letterSpacing="1.5">
              SUNSET RIDGE
            </text>
          </g>

          {/* User Location Center & Radius Radar */}
          <g transform={`translate(${userCoords.x}, ${userCoords.y})`}>
            {/* Radius Circle */}
            <circle
              r={radiusMiles * 65}
              fill="url(#radarPulse)"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              opacity="0.8"
            />
            {/* User Pin Pulse */}
            <circle r="18" fill="#3b82f6" opacity="0.2" className="animate-ping" />
            <circle r="10" fill="#3b82f6" stroke="#ffffff" strokeWidth="3" />
            <circle r="3" fill="#ffffff" />
            {/* Label */}
            <rect x="-65" y="16" width="130" height="22" rx="6" fill="#0f172a" stroke="#3b82f6" strokeWidth="1" />
            <text x="0" y="31" fill="#93c5fd" fontSize="10" fontWeight="700" textAnchor="middle">
              You are here ({CURRENT_USER.neighborhood})
            </text>
          </g>

          {/* Tool Map Pins */}
          {filteredTools.map((tool) => {
            const { x, y } = getCoordinates(tool.location.lat, tool.location.lng);
            const isSelected = activePinTool?.id === tool.id;

            return (
              <g
                key={tool.id}
                transform={`translate(${x}, ${y})`}
                className="cursor-pointer transition-transform duration-200 hover:scale-125"
                onClick={() => setActivePinTool(tool)}
              >
                {/* Pin Shadow */}
                <ellipse cx="0" cy="18" rx="8" ry="4" fill="#000000" opacity="0.5" />

                {/* Pin Body */}
                <path
                  d="M 0,0 C -12,-12 -12,-28 0,-38 C 12,-28 12,-12 0,0 Z"
                  fill={isSelected ? '#f59e0b' : '#ea580c'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                />

                {/* Price Label Inside Pin */}
                <text
                  x="0"
                  y="-20"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  ${tool.dailyRate}
                </text>

                {/* Verification Star indicator */}
                <circle cx="8" cy="-34" r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Tool Detail Popup on Pin Click */}
      {activePinTool && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-30 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <button
            onClick={() => setActivePinTool(null)}
            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex gap-3">
            <img
              src={activePinTool.images[0]}
              alt={activePinTool.title}
              className="w-20 h-20 rounded-xl object-cover border border-slate-800 shrink-0"
            />
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-0.5">
                <Sparkles className="w-3 h-3" />
                <span>{activePinTool.conditionGrade.split(' ')[0]}</span>
                <span className="text-slate-400">• {activePinTool.brand}</span>
              </div>
              <h4 className="font-bold text-white text-sm line-clamp-1">
                {activePinTool.title}
              </h4>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{activePinTool.location.address} ({activePinTool.location.distanceMiles ?? 0.4} mi)</span>
              </p>
              
              {/* Walking & Driving Estimate */}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <Footprints className="w-3 h-3 text-emerald-400" />
                  {Math.round((activePinTool.location.distanceMiles ?? 0.4) * 18)} min walk
                </span>
                <span className="flex items-center gap-1">
                  <Car className="w-3 h-3 text-blue-400" />
                  {Math.max(2, Math.round((activePinTool.location.distanceMiles ?? 0.4) * 3))} min drive
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-extrabold text-amber-400">${activePinTool.dailyRate}</span>
                <span className="text-xs text-slate-400">/day</span>
              </div>
              <div className="text-[10px] text-slate-400">
                ${activePinTool.depositAmount} deposit (refunds instantly to credits)
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectTool(activePinTool)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                Inspect
              </button>
              <button
                onClick={() => onRentTool(activePinTool)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1"
              >
                <span>Rent</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
