import React, { useState } from 'react';
import { 
  X, 
  Wrench, 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2, 
  Plus, 
  ArrowRight, 
  ArrowLeft,
  Coins,
  QrCode,
  Tag,
  ScanLine,
  Image as ImageIcon,
  Wand2,
  RefreshCw
} from 'lucide-react';
import { ToolItem, ToolCategory, MachineVisionResult } from '../types';
import { CURRENT_USER, NEIGHBORHOODS } from '../data/mockData';

interface ListToolModalProps {
  onClose: () => void;
  onAddTool: (newTool: ToolItem) => void;
}

const CATEGORIES: ToolCategory[] = [
  'Power Tools',
  'Lawn & Garden',
  'Woodworking',
  'Masonry & Tile',
  'Ladders & Safety',
  'Hand Tools',
  'Plumbing',
  'Automotive',
];

const PRESET_TOOL_IMAGES = [
  {
    name: 'DeWalt Compact Drill (Messy Workbench)',
    url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80',
    type: 'drill',
  },
  {
    name: 'Pancake Air Compressor (Garage Floor)',
    url: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=800&q=80',
    type: 'compressor',
  },
  {
    name: 'Circular Saw (Workshop Bench)',
    url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    type: 'saw',
  },
  {
    name: 'Lawn Mower (Backyard Grass)',
    url: 'https://images.unsplash.com/photo-1592417817098-8f3d69104a49?auto=format&fit=crop&w=800&q=80',
    type: 'mower',
  },
];

export const ListToolModal: React.FC<ListToolModalProps> = ({ onClose, onAddTool }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ToolCategory>('Power Tools');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [description, setDescription] = useState('');
  const [accessoryInput, setAccessoryInput] = useState('');
  const [accessories, setAccessories] = useState<string[]>(['Heavy-Duty Carrying Bag']);
  const [selectedImage, setSelectedImage] = useState(PRESET_TOOL_IMAGES[0].url);

  // AI Autofill & Studio Background state
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [studioBgApplied, setStudioBgApplied] = useState(true);
  const [conditionGrade, setConditionGrade] = useState('Grade A (Excellent)');
  const [wearLevel, setWearLevel] = useState('Light cosmetic wear; mechanical components pristine');
  const [replacementValue, setReplacementValue] = useState(180);
  const [depositAmount, setDepositAmount] = useState(45);
  const [dailyRate, setDailyRate] = useState(12);

  // Logistics state
  const [pickupMethod, setPickupMethod] = useState<'Smart Lockbox' | 'Porch Pickup' | 'Direct Handoff'>('Smart Lockbox');
  const [pickupInstructions, setPickupInstructions] = useState('Front porch lockbox code shared upon booking confirmation.');
  const [neighborhood, setNeighborhood] = useState('Oakwood Terrace');

  const handleScanAndAutofill = async (sampleHint?: string) => {
    setIsAutofilling(true);
    try {
      const response = await fetch('/api/scan-and-autofill-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleHint: sampleHint || 'drill',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.toolData) {
          const d = data.toolData;
          setTitle(d.title || title);
          setCategory(d.category || category);
          setBrand(d.brand || brand);
          setModelNumber(d.modelNumber || modelNumber);
          setSerialNumber(d.serialNumber || serialNumber);
          setDescription(d.description || description);
          setConditionGrade(d.conditionGrade || conditionGrade);
          setWearLevel(d.wearLevel || wearLevel);
          setReplacementValue(d.estimatedReplacementValue || replacementValue);
          setDailyRate(d.recommendedDailyRate || dailyRate);
          setDepositAmount(d.recommendedDeposit || depositAmount);
          if (d.includedAccessories) {
            setAccessories(d.includedAccessories);
          }
          setStudioBgApplied(true);
          setIsAutofilling(false);
          return;
        }
      }
      throw new Error('Static fallback');
    } catch (err) {
      console.info('Using client-side autofill and studio background generator (GitHub Pages static mode)');
      await new Promise((r) => setTimeout(r, 500));
      if (sampleHint === 'saw') {
        setTitle('Milwaukee M18 FUEL 7-1/4" Circular Saw');
        setCategory('Woodworking');
        setBrand('Milwaukee');
        setModelNumber('2732-20');
        setSerialNumber(`MLW-724-${Math.floor(1000 + Math.random() * 9000)}`);
        setDescription('Brushless POWERSTATE motor cuts up to 2-1/2" at 90 degrees. Includes magnesium shoe, LED work light, and carbide framing blade.');
        setConditionGrade('Grade A (Excellent)');
        setWearLevel('Light cosmetic sawdust residue; blade razor sharp');
        setReplacementValue(249);
        setDailyRate(15);
        setDepositAmount(60);
        setAccessories(['Installed 24T Framing Blade', 'Blade Wrench', 'Canvas Tool Bag']);
      } else if (sampleHint === 'compressor') {
        setTitle('DeWalt 6-Gallon 165 PSI Pancake Air Compressor');
        setCategory('Power Tools');
        setBrand('DeWalt');
        setModelNumber('DWFP55126');
        setSerialNumber(`DW-551-${Math.floor(1000 + Math.random() * 9000)}`);
        setDescription('High-efficiency motor starts easily in cold weather. 165 max PSI 6.0 gallon tank and 2.6 SCFM delivered at 90 PSI pump.');
        setConditionGrade('Grade A+ (Like New)');
        setWearLevel('Pristine pressure tank; regulator knobs turn smoothly');
        setReplacementValue(199);
        setDailyRate(14);
        setDepositAmount(50);
        setAccessories(['50ft PVC Air Hose', 'Quick Connect Fittings', 'Tire Inflator Chuck']);
      } else if (sampleHint === 'mower') {
        setTitle('Honda 21" Self-Propelled Gas Lawn Mower');
        setCategory('Lawn & Garden');
        setBrand('Honda');
        setModelNumber('HRN216VKA');
        setSerialNumber(`HND-216-${Math.floor(1000 + Math.random() * 9000)}`);
        setDescription('Twin-blade MicroCut mulching system with Honda GCV170 engine. Variable speed Smart Drive.');
        setConditionGrade('Grade A (Excellent)');
        setWearLevel('Normal cosmetic grass stain on deck underside; blades freshly balanced');
        setReplacementValue(469);
        setDailyRate(22);
        setDepositAmount(80);
        setAccessories(['Mulching Plug', 'Grass Collection Bag', 'Fuel Safety Can']);
      } else {
        setTitle('DeWalt 20V MAX XR Brushless Compact Drill');
        setCategory('Power Tools');
        setBrand('DeWalt');
        setModelNumber('DCD791B');
        setSerialNumber(`DW-791-${Math.floor(1000 + Math.random() * 9000)}`);
        setDescription('XR Li-Ion brushless motor delivers up to 57% more run time over brushed. 3-mode LED work light with spotlight mode.');
        setConditionGrade('Grade A (Excellent)');
        setWearLevel('Minor scuff on base bumper; chuck and gears in mint condition');
        setReplacementValue(169);
        setDailyRate(10);
        setDepositAmount(40);
        setAccessories(['2x 20V 2.0Ah Lithium Batteries', 'Multi-voltage Fast Charger', 'Belt Hook', 'Contractor Bag']);
      }
      setStudioBgApplied(true);
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleAddAccessory = () => {
    if (accessoryInput.trim()) {
      setAccessories([...accessories, accessoryInput.trim()]);
      setAccessoryInput('');
    }
  };

  const handleRemoveAccessory = (index: number) => {
    setAccessories(accessories.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const newTool: ToolItem = {
      id: `tool_${Date.now()}`,
      title: title || `${brand || 'Workshop'} Equipment`,
      category,
      brand: brand || 'Verified Manufacturer',
      modelNumber: modelNumber || 'DIY-2026',
      serialNumber: serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      barcode: `NG-${(brand || 'TLS').substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      description: description || 'High-performance homeowner equipment available for neighborhood rental.',
      dailyRate: Number(dailyRate),
      weeklyDiscountPct: 20,
      replacementValue: Number(replacementValue),
      depositAmount: Number(depositAmount),
      conditionGrade,
      wearLevel,
      opticalInspectionNotes: `Neighborhood Garage certified: ${conditionGrade}. Housing and assemblies inspected under optical sweep.`,
      lastVisionInspection: new Date().toISOString().split('T')[0],
      images: [selectedImage],
      owner: {
        id: CURRENT_USER.id,
        name: CURRENT_USER.name,
        avatar: CURRENT_USER.avatar,
        rating: CURRENT_USER.rating,
        reviewCount: CURRENT_USER.reviewsCount,
        neighborhood: neighborhood,
        badges: ['Neighborhood Lender', 'Identity Verified'],
        responseTime: 'Under 10 mins',
        joinedYear: CURRENT_USER.joinedYear,
        phoneVerified: true,
        idVerified: true,
        ownerRank: 'Master Workshop',
        platformMarginPct: 5.0,
      },
      location: {
        lat: CURRENT_USER.lat + (Math.random() - 0.5) * 0.005,
        lng: CURRENT_USER.lng + (Math.random() - 0.5) * 0.005,
        address: `${Math.floor(100 + Math.random() * 900)} Oakridge Way`,
        neighborhood,
        distanceMiles: 0.4,
        pickupMethod,
        pickupInstructions,
      },
      availability: 'available',
      specifications: {
        'Condition': conditionGrade,
        'Serial': serialNumber,
        'Brand': brand,
        'Power Source': 'Standard Spec',
      },
      includedAccessories: accessories,
      safetyNotes: [
        'Always wear eye and ear protection when using power equipment.',
        'Return in clean, dry condition.',
      ],
      insurance: {
        included: true,
        planName: 'Neighborhood Garage Shield',
        coverageLimit: 1500,
        deductible: 0,
        description: 'Zero deductible. Covers accidental motor burn-out or mechanical jamming.',
      },
      reviews: [],
      studioBackgroundApplied: studioBgApplied,
    };

    onAddTool(newTool);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">List Equipment in Neighborhood Garage</h3>
              <p className="text-[11px] text-slate-400">Step {step} of 4 • 1-Click Scan Autofill &amp; Studio Backdrop</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-4 bg-slate-950 px-6 py-2 border-b border-slate-800 text-[11px] font-semibold text-center">
          <span className={step >= 1 ? 'text-amber-400' : 'text-slate-600'}>1. Scan &amp; Autofill</span>
          <span className={step >= 2 ? 'text-amber-400' : 'text-slate-600'}>2. Specs &amp; Wear</span>
          <span className={step >= 3 ? 'text-amber-400' : 'text-slate-600'}>3. Rates &amp; Pickup</span>
          <span className={step >= 4 ? 'text-amber-400' : 'text-slate-600'}>4. Barcode Tag</span>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* STEP 1: Scan & Autofill with Studio Backdrop */}
          {step === 1 && (
            <div className="space-y-4 text-xs">
              {/* Highlight AI Scan & Background Remover Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-800 to-slate-800 border border-amber-500/30 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Wand2 className="w-4 h-4 text-amber-400" />
                    <span>Instant AI Scan &amp; Auto Background Removal</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Take or select a photo of your tool. AI detects brand, model, serial, and sets up a clean workbench backdrop!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleScanAndAutofill('drill')}
                  disabled={isAutofilling}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  {isAutofilling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>Scan &amp; Autofill</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Garage Photos */}
              <div>
                <label className="text-slate-300 font-bold block mb-1.5">
                  Select Tool Photo (Driveway or Workbench)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_TOOL_IMAGES.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedImage(img.url);
                        handleScanAndAutofill(img.type);
                      }}
                      className={`p-1.5 rounded-xl border text-left transition ${
                        selectedImage === img.url
                          ? 'border-amber-400 bg-slate-800'
                          : 'border-slate-800 bg-slate-900/60 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="aspect-video rounded-lg overflow-hidden mb-1">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium block truncate">
                        {img.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tool Image with Studio Backdrop Badge */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
                <img src={selectedImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                
                {studioBgApplied && (
                  <div className="absolute top-3 left-3 bg-emerald-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-emerald-500/50 text-[10px] text-emerald-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Studio Workbench Backdrop Applied (Background Cleaned)</span>
                  </div>
                )}
              </div>

              {/* Autofilled Fields */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Tool Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. DeWalt 20V MAX XR Brushless Compact Drill"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ToolCategory)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-400"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. DeWalt"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Model / Part Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. DCD791B"
                      value={modelNumber}
                      onChange={(e) => setModelNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Serial Number (for Barcode) *</label>
                    <input
                      type="text"
                      placeholder="e.g. DW-791-8921"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Wear Level & Deposit Specs */}
          {step === 2 && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Description &amp; DIY Use Cases</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Initial Condition Grade</label>
                  <input
                    type="text"
                    value={conditionGrade}
                    onChange={(e) => setConditionGrade(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Observed Wear</label>
                  <input
                    type="text"
                    value={wearLevel}
                    onChange={(e) => setWearLevel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
              </div>

              {/* Deposit & Replacement Financial Values */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Replacement Value</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      value={replacementValue}
                      onChange={(e) => setReplacementValue(Number(e.target.value))}
                      className="w-full bg-transparent font-black text-white text-base focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Safety Deposit Hold</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-emerald-400">$</span>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full bg-transparent font-black text-emerald-400 text-base focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Daily Rental Rate</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-amber-400">$</span>
                    <input
                      type="number"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(Number(e.target.value))}
                      className="w-full bg-transparent font-black text-amber-400 text-base focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">/d</span>
                  </div>
                </div>
              </div>

              {/* Accessories Checklist */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Included Accessories</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. 2x 20V Batteries, Rapid Charger"
                    value={accessoryInput}
                    onChange={(e) => setAccessoryInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAccessory())}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddAccessory}
                    className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {accessories.map((acc, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1.5"
                    >
                      <span>{acc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAccessory(idx)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Rates, Profit Estimation & Pickup Logistics */}
          {step === 3 && (
            <div className="space-y-4 text-xs">
              {/* Owner Expected Profit Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-800 to-slate-800 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <span>Your Expected Profit (At ${dailyRate}/day):</span>
                  </span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700/50">
                    Low 5% Platform Margin
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">4 Days / Month Rental</span>
                    <strong className="text-white text-sm">
                      ${(dailyRate * 4 * 0.95).toFixed(2)}/mo net
                    </strong>
                    <span className="text-[10px] text-emerald-400 block">
                      ${(dailyRate * 4 * 12 * 0.95).toFixed(0)}/year
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">8 Days / Month Rental</span>
                    <strong className="text-white text-sm">
                      ${(dailyRate * 8 * 0.95).toFixed(2)}/mo net
                    </strong>
                    <span className="text-[10px] text-emerald-400 block">
                      ${(dailyRate * 8 * 12 * 0.95).toFixed(0)}/year
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Neighborhood</label>
                <select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                >
                  {NEIGHBORHOODS.filter(n => n.name !== 'All Neighborhoods').map((n) => (
                    <option key={n.name} value={n.name}>{n.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Pickup &amp; Handoff Option</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Smart Lockbox', 'Porch Pickup', 'Direct Handoff'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPickupMethod(method)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        pickupMethod === method
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Handoff Instructions for Neighbors</label>
                <textarea
                  rows={2}
                  value={pickupInstructions}
                  onChange={(e) => setPickupInstructions(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Certified Barcode Tag Preview */}
          {step === 4 && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white text-slate-950 border-4 border-amber-500 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-black text-xs tracking-wider">NEIGHBORHOOD GARAGE CERTIFIED</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    SHIELD INSURED ($1.5k)
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm">{title || `${brand} ${modelNumber}`}</h4>
                  <p className="text-[11px] text-slate-600">
                    Brand: {brand} • Model: {modelNumber} • SN: {serialNumber}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2 rounded-lg text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Daily Rate:</span>
                    <strong className="text-slate-900">${dailyRate}/day</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Safety Deposit:</span>
                    <strong className="text-slate-900">${depositAmount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Condition:</span>
                    <strong className="text-emerald-700">{conditionGrade.split(' ')[0]}</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-[10px] text-slate-500">
                    TAG ID: NG-{(brand || 'TLS').substring(0, 3).toUpperCase()}-9821
                  </span>
                  <QrCode className="w-8 h-8 text-slate-900" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Ready to publish to {neighborhood}!</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Neighbors will be able to discover your tool on the radar map, reserve dates, and pay with damage deposits held securely in escrow.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as any)}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish Tool to Neighborhood Garage</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
