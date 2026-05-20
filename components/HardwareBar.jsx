'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronDown, ChevronRight, X, Settings2,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { GPU_PRESETS } from '@/lib/gpuPresets';
import { CPU_PRESETS, RAM_TYPES } from '@/lib/cpuPresets';

/* ── Constants ──────────────────────────────────────────────── */
const RAM_OPTIONS = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
const CTX_OPTIONS = [
  { label: '2k',   value: 2048  },
  { label: '4k',   value: 4096  },
  { label: '8k',   value: 8192  },
  { label: '16k',  value: 16384 },
  { label: '32k',  value: 32768 },
  { label: '128k', value: 131072 },
];
const SPEED_OPTIONS = [
  { label: 'All',    value: 'slow',   tip: 'Show every model, even slow ones' },
  { label: '10+ t/s', value: 'medium', tip: 'Conversational speed minimum' },
  { label: '30+ t/s', value: 'fast',   tip: 'Fast enough to feel instant' },
];
const USE_CASES = ['Chat', 'Code', 'Reasoning', 'Long Docs', 'Multilingual', 'Vision'];
const CPU_TIER_LABELS = {
  ultra: 'Ultra / Workstation',
  high:  'High-end',
  mid:   'Mid-range',
  low:   'Budget / Older',
};
const BACKEND_LABELS = {
  cuda:   { label: 'CUDA (NVIDIA)',    color: 'text-green-400',  bg: 'bg-green-950/30 border-green-800/50'   },
  metal:  { label: 'Metal (Apple)',    color: 'text-purple-400', bg: 'bg-purple-950/30 border-purple-800/50' },
  rocm:   { label: 'ROCm (AMD Linux)', color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/50'       },
  vulkan: { label: 'Vulkan (AMD/Arc)', color: 'text-amber-400',  bg: 'bg-amber-950/30 border-amber-800/50'   },
  cpu:    { label: 'CPU only',         color: 'text-[#7EAF7E]',   bg: 'bg-[#111811]/50 border-[#2A3D2A]'        },
};
const OS_VENDORS = {
  Windows: [
    { id: 'nvidia', label: 'NVIDIA',       icon: '🟢', desc: 'GeForce RTX / GTX series' },
    { id: 'amd',   label: 'AMD',           icon: '🔴', desc: 'Radeon RX series'          },
    { id: 'intel', label: 'Intel Arc',     icon: '🔵', desc: 'Arc B / A series'          },
    { id: 'none',  label: 'No GPU',        icon: '⚙️',  desc: 'CPU-only inference'        },
  ],
  Linux: [
    { id: 'nvidia', label: 'NVIDIA',       icon: '🟢', desc: 'GeForce RTX / GTX series'  },
    { id: 'amd',   label: 'AMD',           icon: '🔴', desc: 'Radeon RX — ROCm backend'  },
    { id: 'intel', label: 'Intel Arc',     icon: '🔵', desc: 'Arc series'                 },
    { id: 'none',  label: 'No GPU',        icon: '⚙️',  desc: 'CPU-only inference'         },
  ],
  macOS: [
    { id: 'apple', label: 'Apple Silicon', icon: '🍎', desc: 'M1 / M2 / M3 / M4 — unified memory' },
    { id: 'none',  label: 'Intel Mac',     icon: '⚙️',  desc: 'No discrete GPU / CPU only'          },
  ],
};

function getGPUsForVendor(vendor) {
  switch (vendor) {
    case 'nvidia': return GPU_PRESETS.filter(g => g.label.startsWith('RTX') || g.label.startsWith('GTX'));
    case 'amd':    return GPU_PRESETS.filter(g => g.label.startsWith('RX '));
    case 'intel':  return GPU_PRESETS.filter(g => g.label.startsWith('Arc'));
    case 'apple':  return GPU_PRESETS.filter(g => g.label.startsWith('Apple'));
    case 'none':   return GPU_PRESETS.filter(g => g.label === 'No GPU (CPU only)');
    default:       return [];
  }
}

function groupNvidiaGPUs(gpus) {
  const groups = [
    { label: 'Blackwell (50 series)',    prefix: 'RTX 5' },
    { label: 'Ada Lovelace (40 series)', prefix: 'RTX 4' },
    { label: 'Workstation',              match: g => g.label.startsWith('RTX 6000') || g.label.startsWith('RTX A') || g.label.startsWith('RTX 2000') || g.label.startsWith('RTX 4000 Ada') },
    { label: 'Ampere (30 series)',       prefix: 'RTX 3' },
    { label: 'Turing (20 series)',       prefix: 'RTX 2' },
    { label: 'GTX 16 series',            match: g => g.label.startsWith('GTX 16') },
    { label: 'Laptop (Ada / Ampere)',    match: g => g.label.includes('Laptop') },
    { label: 'Pascal (10 series)',       match: g => g.label.startsWith('GTX 1') && !g.label.startsWith('GTX 16') && !g.label.includes('Laptop') },
  ];
  return groups.map(g => ({
    label: g.label,
    gpus:  gpus.filter(gpu => g.match ? g.match(gpu) : gpu.label.startsWith(g.prefix)),
  })).filter(g => g.gpus.length > 0);
}

/* ── BarChip ────────────────────────────────────────────────── */
function BarChip({ label, isSet, active, onClick, onClear }) {
  return (
    <div className={`flex items-center rounded-lg border transition-all shrink-0 overflow-hidden text-xs font-medium
      ${active
        ? 'border-emerald-600 bg-emerald-950/30'
        : isSet
          ? 'border-[#2A3D2A] bg-[#111811] hover:border-zinc-500'
          : 'border-[#1E2B1E] bg-[#111811] hover:border-[#2A3D2A]'
      }`}
    >
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap transition-none
          ${active ? 'text-sky-300' : isSet ? 'text-[#E2F0E2]' : 'text-[#4A654A]'}`}
      >
        <span>{label}</span>
        {!isSet && (
          <ChevronDown
            size={10}
            className={`text-[#354835] transition-transform ${active ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {isSet && onClear && (
        <button
          onClick={e => { e.stopPropagation(); onClear(); }}
          className="px-2 py-1.5 text-[#354835] hover:text-[#C8E0C8] border-l border-[#1E2B1E] transition-colors"
        >
          <X size={10} />
        </button>
      )}
      {isSet && !onClear && (
        <button
          onClick={onClick}
          className={`px-2 py-1.5 transition-colors ${active ? 'text-emerald-400' : 'text-[#354835] hover:text-[#7EAF7E]'}`}
        >
          <ChevronDown size={10} className={`transition-transform ${active ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

/* ── PanelWrap: consistent padded dropdown panel ─────────────── */
function PanelSection({ title, children }) {
  return (
    <div className="space-y-2.5">
      {title && (
        <div className="text-[10px] text-[#4A654A] uppercase tracking-widest font-semibold">{title}</div>
      )}
      {children}
    </div>
  );
}

/* ── GPUWizard panel ────────────────────────────────────────── */
function GPUWizardPanel({ hw, os, onSelect, onOSChange, onClose }) {
  const [vendor, setVendor] = useState(null);
  const [osConfirmed, setOsConfirmed] = useState(() => !!os);

  useEffect(() => {
    if (!hw.gpuLabel) { setVendor(null); return; }
    if (hw.gpuLabel.startsWith('RTX') || hw.gpuLabel.startsWith('GTX')) setVendor('nvidia');
    else if (hw.gpuLabel.startsWith('RX '))  setVendor('amd');
    else if (hw.gpuLabel.startsWith('Arc'))  setVendor('intel');
    else if (hw.gpuLabel.startsWith('Apple')) setVendor('apple');
    else if (hw.gpuLabel === 'No GPU (CPU only)') setVendor('none');
  }, [hw.gpuLabel]);

  useEffect(() => {
    if (hw.gpuLabel && os) setOsConfirmed(true);
  }, [hw.gpuLabel, os]);

  const vendors      = OS_VENDORS[os] || OS_VENDORS.Windows;
  const filteredGPUs = useMemo(() => vendor ? getGPUsForVendor(vendor) : [], [vendor]);
  const groupedGPUs  = useMemo(() => vendor === 'nvidia' ? groupNvidiaGPUs(filteredGPUs) : null, [vendor, filteredGPUs]);

  // Selected GPU summary
  if (hw.gpuLabel) {
    const backend = hw.gpuLabel === 'No GPU (CPU only)' ? 'cpu'
      : hw.gpuLabel.startsWith('Apple') ? 'metal'
      : hw.gpuLabel.startsWith('Arc')   ? 'vulkan'
      : hw.gpuLabel.startsWith('RX ')   ? (os === 'Linux' ? 'rocm' : 'vulkan')
      : 'cuda';
    const bMeta = BACKEND_LABELS[backend];
    return (
      <div className="flex items-center gap-4 flex-wrap">
        <div className={`rounded-lg border px-4 py-2.5 ${bMeta.bg} flex items-center gap-4`}>
          <div>
            <div className="text-sm font-semibold text-white">{hw.gpuLabel}</div>
            <div className="flex gap-3 mt-0.5 text-xs flex-wrap">
              <span className={bMeta.color}>{bMeta.label}</span>
              {hw.bandwidth > 0 && <span className="text-[#4A654A]">{hw.bandwidth} GB/s</span>}
              {hw.memType && !hw.unifiedMem && <span className="text-[#354835]">{hw.memType}</span>}
              {hw.unifiedMem && hw.vram > 0 && <span className="text-[#4A654A]">{hw.vram} GB unified</span>}
            </div>
          </div>
        </div>
        <button
          onClick={() => { onSelect(null); setVendor(null); setOsConfirmed(false); }}
          className="text-xs text-[#4A654A] hover:text-emerald-400 transition-colors whitespace-nowrap"
        >
          ← Change GPU
        </button>
      </div>
    );
  }

  // Step 1: OS
  if (!osConfirmed) {
    return (
      <PanelSection title="Step 1 of 3 — Operating system">
        <div className="flex gap-2">
          {['Windows', 'Linux', 'macOS'].map(o => (
            <button
              key={o}
              onClick={() => { onOSChange(o); setOsConfirmed(true); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-sm
                ${os === o ? 'border-emerald-600 bg-emerald-950/30 text-[#E2F0E2]' : 'border-[#1E2B1E] hover:border-emerald-700 hover:bg-emerald-950/20 text-[#7EAF7E]'}`}
            >
              <span>{o === 'Windows' ? '🪟' : o === 'Linux' ? '🐧' : '🍎'}</span>
              <span>{o}</span>
              {os === o && <span className="text-[10px] text-emerald-500">auto</span>}
            </button>
          ))}
        </div>
      </PanelSection>
    );
  }

  // Step 2: Vendor
  if (!vendor) {
    return (
      <PanelSection>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[#4A654A] uppercase tracking-widest font-semibold">Step 2 of 3 — GPU brand</span>
          <button
            onClick={() => { onOSChange(''); setOsConfirmed(false); }}
            className="text-xs text-[#354835] hover:text-emerald-400 transition-colors"
          >
            ← {os}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {vendors.map(v => (
            <button
              key={v.id}
              onClick={() => {
                if (v.id === 'none') {
                  const preset = GPU_PRESETS.find(g => g.label === 'No GPU (CPU only)');
                  onSelect(preset);
                } else {
                  setVendor(v.id);
                }
              }}
              className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg border border-[#1E2B1E] hover:border-emerald-700 hover:bg-emerald-950/20 transition-all text-center"
            >
              <span className="text-xl">{v.icon}</span>
              <span className="text-xs text-[#C8E0C8] font-medium">{v.label}</span>
              <span className="text-[10px] text-[#354835] leading-snug">{v.desc}</span>
            </button>
          ))}
        </div>
      </PanelSection>
    );
  }

  // Step 3: GPU model
  const groups = groupedGPUs ?? [{ label: null, gpus: filteredGPUs }];
  return (
    <PanelSection>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#4A654A] uppercase tracking-widest font-semibold">Step 3 of 3 — Select your GPU</span>
        <button onClick={() => setVendor(null)} className="text-xs text-[#354835] hover:text-emerald-400 transition-colors">← Back</button>
      </div>
      <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="text-[10px] text-[#354835] uppercase tracking-wider mb-1.5 px-1">{group.label}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
              {group.gpus.map(g => (
                <button
                  key={g.label}
                  onClick={() => { onSelect(g); onClose?.(); }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#1E2B1E] hover:border-emerald-700 hover:bg-emerald-950/20 transition-all text-left"
                >
                  <span className="text-sm text-[#C8E0C8]">{g.label}</span>
                  <span className="text-xs text-[#354835] font-mono shrink-0 ml-2">
                    {g.vram > 0 ? `${g.vram}GB` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

/* ── CPU panel ──────────────────────────────────────────────── */
function CPUListPanel({ value, onChange, onClose }) {
  return (
    <PanelSection title="Select your CPU">
      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
        {['ultra', 'high', 'mid', 'low'].map(tier => {
          const cpus = CPU_PRESETS.filter(c => c.tier === tier && !c.apple);
          if (!cpus.length) return null;
          return (
            <div key={tier}>
              <div className="text-[10px] text-[#354835] uppercase tracking-wider mb-1 px-1">
                {CPU_TIER_LABELS[tier]}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                {cpus.map(c => (
                  <button
                    key={c.label}
                    onClick={() => { onChange(c.label); onClose?.(); }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left
                      ${value === c.label
                        ? 'border-emerald-600 bg-emerald-950/30'
                        : 'border-[#1E2B1E] hover:border-emerald-700 hover:bg-emerald-950/20'}`}
                  >
                    <span className="text-sm text-[#C8E0C8]">{c.label}</span>
                    <span className="text-xs text-[#354835] font-mono shrink-0 ml-2">{c.cores}c</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PanelSection>
  );
}

/* ── Advanced panel ─────────────────────────────────────────── */
function AdvancedPanel({ hw, update, onRAMTypeChange }) {
  const isApple   = !!hw.unifiedMem;
  const isCPUOnly = hw.gpuLabel === 'No GPU (CPU only)';
  const hasDiscreteGPU = hw.gpuLabel && !isApple && !isCPUOnly;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Flash Attention */}
        <PanelSection title="Flash Attention">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#7EAF7E] leading-snug">Reduces KV cache VRAM ~30% at long contexts</span>
            <button
              onClick={() => update({ flashAttn: !hw.flashAttn })}
              className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${hw.flashAttn ? 'bg-emerald-600' : 'bg-zinc-700'}`}
              title={hw.flashAttn ? 'Flash Attention on' : 'Flash Attention off'}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${hw.flashAttn ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </PanelSection>

        {/* Storage */}
        <PanelSection title="Storage">
          <div className="flex gap-2">
            {[{ label: 'NVMe', value: 'nvme' }, { label: 'SATA', value: 'sata' }, { label: 'HDD', value: 'hdd' }].map(o => (
              <button
                key={o.value}
                onClick={() => update({ ssd: o.value })}
                title={o.value === 'nvme' ? 'Fastest model loading' : o.value === 'sata' ? 'Medium speed' : 'Slowest — expect long load times'}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors
                  ${hw.ssd === o.value
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'border-[#1E2B1E] text-[#7EAF7E] hover:border-emerald-700'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </PanelSection>

        {/* Min Speed */}
        <PanelSection title="Min Speed">
          <div className="flex gap-2">
            {SPEED_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => update({ speedPref: o.value })}
                title={o.tip}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors
                  ${hw.speedPref === o.value
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'border-[#1E2B1E] text-[#7EAF7E] hover:border-emerald-700'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </PanelSection>

        {/* GPU count */}
        {hasDiscreteGPU && (
          <PanelSection title="GPU Count">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => update({ numGPUs: n })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors
                    ${hw.numGPUs === n
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-[#1E2B1E] text-[#7EAF7E] hover:border-emerald-700'}`}
                >
                  {n}×
                </button>
              ))}
            </div>
          </PanelSection>
        )}
      </div>

      {/* RAM type — only for non-Apple */}
      {!isApple && (
        <div className="pt-4 border-t border-[#1E2B1E]">
          <PanelSection title="RAM Type (affects CPU offload speed)">
            <div className="flex flex-wrap gap-2">
              {RAM_TYPES.map(r => (
                <button
                  key={r.label}
                  onClick={() => onRAMTypeChange(r.label)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors
                    ${hw.ramTypeLabel === r.label
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-[#1E2B1E] text-[#7EAF7E] hover:border-emerald-700'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </PanelSection>
        </div>
      )}

      {/* Use cases */}
      <div className="pt-4 border-t border-[#1E2B1E]">
        <PanelSection title="Use Cases (optional — boosts matching models in results)">
          <div className="flex flex-wrap gap-2">
            {USE_CASES.map(uc => (
              <button
                key={uc}
                onClick={() => {
                  const cur = hw.useCases || [];
                  update({ useCases: cur.includes(uc) ? cur.filter(c => c !== uc) : [...cur, uc] });
                }}
                className={`chip border transition-colors
                  ${(hw.useCases || []).includes(uc)
                    ? 'bg-sky-900/50 border-emerald-600 text-sky-300'
                    : 'border-[#1E2B1E] text-[#4A654A] hover:border-[#2A3D2A]'}`}
              >
                {uc}
              </button>
            ))}
          </div>
        </PanelSection>
      </div>

      {/* VRAM override + GPU tech details */}
      {hasDiscreteGPU && (
        <div className="pt-4 border-t border-[#1E2B1E] flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#354835]">Override VRAM:</span>
            <input
              type="number" min={1} max={256}
              className="w-20 bg-[#0C110C] border border-[#1E2B1E] rounded-lg px-2.5 py-1.5 text-xs text-[#C8E0C8] font-mono focus:border-emerald-600 focus:outline-none"
              value={hw.vram || ''}
              onChange={e => { const v = Number(e.target.value); if (v >= 1) update({ vram: v }); }}
            />
            <span className="text-xs text-[#354835]">GB</span>
          </div>
          {[['Arch', hw.arch], ['VRAM type', hw.memType], ['PCIe', hw.pcie ? `Gen ${hw.pcie}` : null], ['Bandwidth', hw.bandwidth > 0 ? `${hw.bandwidth} GB/s` : null]]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-[#354835]">{k}: </span>
                <span className="text-[#7EAF7E] font-mono">{v}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HardwareBar — main export
══════════════════════════════════════════════════════════════ */
export default function HardwareBar({ value: hw, onChange, geminiEnabled, onGeminiToggle }) {
  const [openPanel, setOpenPanel] = useState(null);
  const ref = useRef(null);

  /* Click-outside to close */
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpenPanel(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Auto-detect OS once */
  useEffect(() => {
    if (hw.os) return;
    const ua = navigator.userAgent;
    let os = 'Windows';
    if (ua.includes('Mac'))   os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    onChange({ ...hw, os });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch)    { onChange({ ...hw, ...patch }); }
  function toggle(name)     { setOpenPanel(p => p === name ? null : name); }
  function closePanel()     { setOpenPanel(null); }

  function onGPUSelect(preset) {
    if (!preset) {
      update({ gpuLabel: '', vram: 0, arch: null, unifiedMem: false, flashAttn: false,
               bandwidth: 0, memType: null, pcie: null, gpuBuyUrl: null, maxRam: null });
      return;
    }
    const fields = {
      gpuLabel:   preset.label,
      vram:       preset.vram,
      arch:       preset.arch   || null,
      unifiedMem: !!preset.unified,
      flashAttn:  preset.flashAttn,
      bandwidth:  preset.bandwidth || 0,
      memType:    preset.memType   || null,
      pcie:       preset.pcie      || null,
      gpuBuyUrl:  preset.buyUrl    || null,
      maxRam:     preset.maxRam    || null,
    };
    if (preset.unified) {
      const lbl  = preset.label;
      const tier = lbl.includes('Ultra') ? 'ultra'
                 : lbl.includes('Max') || lbl.includes('Pro') ? 'high'
                 : 'mid';
      fields.cpuTier          = tier;
      fields.cpuRamFactor     = tier === 'ultra' ? 1.0 : tier === 'high' ? 0.9 : 0.75;
      fields.ramBandwidthFactor = 1.0;
    }
    update(fields);
  }

  function onCPUChange(label) {
    const cpu = CPU_PRESETS.find(c => c.label === label);
    if (!cpu) return;
    update({ cpuLabel: label, cpuTier: cpu.tier, cpuCores: cpu.cores,
             cpuVendor: cpu.vendor, cpuRamFactor: cpu.ramBandwidthFactor });
  }

  function onRAMTypeChange(label) {
    const rt = RAM_TYPES.find(r => r.label === label);
    if (!rt) return;
    update({ ramTypeLabel: label, ramBandwidthGB: rt.bandwidthGBs, ramBandwidthFactor: rt.factor });
  }

  const isApple  = !!hw.unifiedMem;
  const ctxLabel = CTX_OPTIONS.find(c => c.value === hw.contextLength)?.label || `${hw.contextLength}`;
  const advBadge = [
    hw.flashAttn && 'FA',
    hw.ssd !== 'nvme' && hw.ssd?.toUpperCase(),
    hw.speedPref !== 'slow' && (hw.speedPref === 'fast' ? '30+' : '10+'),
    (hw.useCases?.length > 0) && `${hw.useCases.length} UC`,
  ].filter(Boolean);

  return (
    <div ref={ref} className="sticky top-[57px] z-30 bg-[#0A0F0A]/98 backdrop-blur-md border-b border-[#1E2B1E]">
      {/* ── Chips row ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4">
        <div
          className="overflow-x-auto py-2.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex items-center gap-2 w-max min-w-full">

            {/* GPU */}
            <BarChip
              label={hw.gpuLabel || 'Select GPU'}
              isSet={!!hw.gpuLabel}
              active={openPanel === 'gpu'}
              onClick={() => toggle('gpu')}
              onClear={hw.gpuLabel ? () => { onGPUSelect(null); closePanel(); } : undefined}
            />

            {/* RAM */}
            <BarChip
              label={hw.ram ? `${hw.ram} GB ${isApple ? 'unified' : 'RAM'}` : 'RAM'}
              isSet={!!hw.ram}
              active={openPanel === 'ram'}
              onClick={() => toggle('ram')}
              onClear={undefined}
            />

            {/* CPU — hidden for Apple Silicon */}
            {!isApple && (
              <BarChip
                label={hw.cpuLabel || 'CPU'}
                isSet={!!hw.cpuLabel}
                active={openPanel === 'cpu'}
                onClick={() => toggle('cpu')}
                onClear={hw.cpuLabel ? () => update({ cpuLabel: '', cpuTier: 'mid', cpuRamFactor: 0.7 }) : undefined}
              />
            )}

            {/* Context length */}
            <BarChip
              label={`${ctxLabel} ctx`}
              isSet={true}
              active={openPanel === 'ctx'}
              onClick={() => toggle('ctx')}
              onClear={undefined}
            />

            {/* Divider */}
            <div className="w-px h-5 bg-zinc-800 mx-1 shrink-0" />

            {/* Gemini toggle */}
            <button
              onClick={onGeminiToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0
                ${geminiEnabled
                  ? 'border-yellow-700/60 bg-yellow-950/30 text-yellow-400'
                  : 'border-[#1E2B1E] bg-[#111811] text-[#354835] hover:border-[#2A3D2A] hover:text-[#7EAF7E]'}`}
            >
              ⚡ Gemini
            </button>

            {/* Advanced / Settings */}
            <button
              onClick={() => toggle('adv')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0
                ${openPanel === 'adv'
                  ? 'border-emerald-600 bg-emerald-950/30 text-sky-300'
                  : 'border-[#1E2B1E] bg-[#111811] text-[#4A654A] hover:border-[#2A3D2A] hover:text-[#C8E0C8]'}`}
            >
              <Settings2 size={12} />
              <span>Settings</span>
              {advBadge.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-900/60 text-emerald-400 text-[10px] font-mono -mr-0.5">
                  {advBadge.join(' · ')}
                </span>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* ── Dropdown panel area ─────────────────────────────── */}
      {openPanel && (
        <div className="absolute left-0 right-0 top-full bg-[#0C110C] border-b border-[#1E2B1E] shadow-2xl z-50">
          <div className="max-w-7xl mx-auto px-4 py-4">

            {openPanel === 'gpu' && (
              <GPUWizardPanel
                hw={hw}
                os={hw.os || ''}
                onSelect={g => { onGPUSelect(g); if (g) closePanel(); }}
                onOSChange={os => update({ os, gpuLabel: '', vram: 0, unifiedMem: false, bandwidth: 0 })}
                onClose={closePanel}
              />
            )}

            {openPanel === 'ram' && (
              <div className="space-y-4">
                <PanelSection title={isApple ? 'Unified Memory' : 'System RAM'}>
                  <div className="flex flex-wrap gap-2">
                    {RAM_OPTIONS
                      .filter(r => !hw.maxRam || r <= hw.maxRam)
                      .map(r => (
                        <button
                          key={r}
                          onClick={() => { update({ ram: r }); closePanel(); }}
                          className={`px-4 py-2 rounded-lg text-sm font-mono border transition-colors
                            ${hw.ram === r
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'border-[#1E2B1E] text-[#C8E0C8] hover:border-emerald-700 hover:bg-emerald-950/20'}`}
                        >
                          {r} GB
                        </button>
                      ))}
                  </div>
                </PanelSection>
              </div>
            )}

            {openPanel === 'cpu' && !isApple && (
              <CPUListPanel
                value={hw.cpuLabel || ''}
                onChange={onCPUChange}
                onClose={closePanel}
              />
            )}

            {openPanel === 'ctx' && (
              <PanelSection title="Context length — how much text the model sees at once">
                <div className="flex flex-wrap gap-2">
                  {CTX_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => { update({ contextLength: o.value }); closePanel(); }}
                      className={`px-4 py-2 rounded-lg text-sm font-mono border transition-colors
                        ${hw.contextLength === o.value
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-[#1E2B1E] text-[#C8E0C8] hover:border-emerald-700 hover:bg-emerald-950/20'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#354835] mt-1">4k = normal chat · 32k+ = long documents</p>
              </PanelSection>
            )}

            {openPanel === 'adv' && (
              <AdvancedPanel hw={hw} update={update} onRAMTypeChange={onRAMTypeChange} />
            )}

          </div>
        </div>
      )}
    </div>
  );
}
