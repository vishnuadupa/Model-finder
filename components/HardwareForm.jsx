'use client';
import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Cpu, HardDrive, Zap, ToggleLeft, ToggleRight, ChevronRight, X } from 'lucide-react';
import { GPU_PRESETS } from '@/lib/gpuPresets';
import { CPU_PRESETS, RAM_TYPES } from '@/lib/cpuPresets';

const RAM_OPTIONS = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
const CTX_OPTIONS = [
  { label: '2k',   value: 2048 },
  { label: '4k',   value: 4096 },
  { label: '8k',   value: 8192 },
  { label: '16k',  value: 16384 },
  { label: '32k',  value: 32768 },
  { label: '128k', value: 131072 },
];
const USE_CASES = ['Chat', 'Code', 'Reasoning', 'Long Docs', 'Multilingual', 'Vision'];
const SPEED_OPTIONS = [
  { label: 'Fast 30+',    value: 'fast' },
  { label: 'Medium 10-30', value: 'medium' },
  { label: 'Slow <10',    value: 'slow' },
];

const BACKEND_LABELS = {
  cuda:   { label: 'CUDA',     color: 'text-green-400',  bg: 'bg-green-950/30 border-green-800/50' },
  metal:  { label: 'Metal',    color: 'text-purple-400', bg: 'bg-purple-950/30 border-purple-800/50' },
  rocm:   { label: 'ROCm',     color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/50' },
  vulkan: { label: 'Vulkan',   color: 'text-amber-400',  bg: 'bg-amber-950/30 border-amber-800/50' },
  cpu:    { label: 'CPU only', color: 'text-slate-400',  bg: 'bg-slate-900/30 border-slate-700' },
};

// OS → available vendors
const OS_VENDORS = {
  Windows: [
    { id: 'nvidia', label: 'NVIDIA',       icon: '🟢', desc: 'GeForce RTX / GTX' },
    { id: 'amd',   label: 'AMD',           icon: '🔴', desc: 'Radeon RX' },
    { id: 'intel', label: 'Intel Arc',     icon: '🔵', desc: 'Arc B/A series' },
    { id: 'none',  label: 'No GPU',        icon: '⚙️',  desc: 'CPU only' },
  ],
  Linux: [
    { id: 'nvidia', label: 'NVIDIA',       icon: '🟢', desc: 'GeForce RTX / GTX' },
    { id: 'amd',   label: 'AMD',           icon: '🔴', desc: 'Radeon RX — ROCm' },
    { id: 'intel', label: 'Intel Arc',     icon: '🔵', desc: 'Arc series' },
    { id: 'none',  label: 'No GPU',        icon: '⚙️',  desc: 'CPU only' },
  ],
  macOS: [
    { id: 'apple', label: 'Apple Silicon', icon: '🍎', desc: 'M1 / M2 / M3 / M4' },
    { id: 'none',  label: 'No GPU',        icon: '⚙️',  desc: 'CPU only' },
  ],
};

// Vendor → GPU list filter
function getGPUsForVendor(vendor) {
  switch (vendor) {
    case 'nvidia': return GPU_PRESETS.filter(g =>
      g.label.startsWith('RTX') || g.label.startsWith('GTX'));
    case 'amd':    return GPU_PRESETS.filter(g =>
      g.label.startsWith('RX '));
    case 'intel':  return GPU_PRESETS.filter(g =>
      g.label.startsWith('Arc'));
    case 'apple':  return GPU_PRESETS.filter(g =>
      g.label.startsWith('Apple'));
    case 'none':   return GPU_PRESETS.filter(g =>
      g.label === 'No GPU (CPU only)');
    default: return [];
  }
}

// Group NVIDIA GPUs by generation for display
function groupNvidiaGPUs(gpus) {
  const groups = [
    { label: 'Blackwell (50 series)', prefix: 'RTX 5' },
    { label: 'Ada (40 series)',        prefix: 'RTX 4' },
    { label: 'Workstation',            match: g => g.label.startsWith('RTX 6000') || g.label.startsWith('RTX A') || g.label.startsWith('RTX 2000') || g.label.startsWith('RTX 4000 Ada') },
    { label: 'Ampere (30 series)',     prefix: 'RTX 3' },
    { label: 'Turing (20 series)',     prefix: 'RTX 2' },
    { label: 'Pascal / older',         match: g => g.label.startsWith('GTX') },
  ];
  return groups.map(g => ({
    label: g.label,
    gpus: gpus.filter(gpu => g.match ? g.match(gpu) : gpu.label.startsWith(g.prefix)),
  })).filter(g => g.gpus.length > 0);
}

function SegBtn({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(o => (
        <button
          key={o.value ?? o}
          onClick={() => onChange(o.value ?? o)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
            value === (o.value ?? o)
              ? 'bg-sky-600 border-sky-500 text-white'
              : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
          }`}
        >
          {o.label ?? o}
        </button>
      ))}
    </div>
  );
}

// ── GPU Wizard (3-step) ────────────────────────────────────────────────────
function GPUWizard({ hw, os, onSelect, onOSChange }) {
  const [vendor, setVendor] = useState(null);

  // Auto-set vendor from existing selection
  useEffect(() => {
    if (!hw.gpuLabel) { setVendor(null); return; }
    if (hw.gpuLabel.startsWith('RTX') || hw.gpuLabel.startsWith('GTX')) setVendor('nvidia');
    else if (hw.gpuLabel.startsWith('RX ')) setVendor('amd');
    else if (hw.gpuLabel.startsWith('Arc')) setVendor('intel');
    else if (hw.gpuLabel.startsWith('Apple')) setVendor('apple');
    else if (hw.gpuLabel === 'No GPU (CPU only)') setVendor('none');
  }, [hw.gpuLabel]);

  function reset() {
    setVendor(null);
    onSelect(null);
  }

  const vendors = OS_VENDORS[os] || OS_VENDORS.Windows;
  const filteredGPUs = useMemo(() => vendor ? getGPUsForVendor(vendor) : [], [vendor]);
  const groupedGPUs  = useMemo(() => vendor === 'nvidia' ? groupNvidiaGPUs(filteredGPUs) : null, [vendor, filteredGPUs]);

  // ── If GPU already selected, show a summary chip with reset ──
  if (hw.gpuLabel) {
    const backend = (() => {
      if (hw.gpuLabel === 'No GPU (CPU only)') return 'cpu';
      if (hw.gpuLabel.startsWith('Apple')) return 'metal';
      if (hw.gpuLabel.startsWith('Arc')) return 'vulkan';
      if (hw.gpuLabel.startsWith('RX ')) return os === 'Linux' ? 'rocm' : 'vulkan';
      return 'cuda';
    })();
    const bMeta = BACKEND_LABELS[backend];

    return (
      <div className={`rounded-lg border px-3 py-2.5 ${bMeta.bg} flex items-center justify-between gap-3`}>
        <div>
          <div className="text-sm font-semibold text-white">{hw.gpuLabel}</div>
          <div className="flex gap-3 mt-0.5 text-xs">
            <span className={bMeta.color}>{bMeta.label}</span>
            {hw.bandwidth > 0 && <span className="text-slate-500">{hw.bandwidth} GB/s</span>}
            {hw.memType && <span className="text-slate-600">{hw.memType}</span>}
          </div>
        </div>
        <button onClick={reset} className="text-slate-600 hover:text-slate-400 transition-colors">
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── Step 1: OS ────────────────────────────────────────────────
  if (!os) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-slate-500 mb-2">What OS are you on?</div>
        {['Windows', 'Linux', 'macOS'].map(o => (
          <button
            key={o}
            onClick={() => onOSChange(o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#1E2D45] hover:border-sky-700 hover:bg-sky-950/20 transition-all text-left"
          >
            <span className="text-sm text-slate-200">
              {o === 'Windows' ? '🪟' : o === 'Linux' ? '🐧' : '🍎'} {o}
            </span>
            <ChevronRight size={14} className="text-slate-600" />
          </button>
        ))}
      </div>
    );
  }

  // ── Step 2: Vendor ────────────────────────────────────────────
  if (!vendor) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-500">GPU brand?</div>
          <button onClick={() => onOSChange('')} className="text-xs text-slate-600 hover:text-sky-400 transition-colors">
            ← {os}
          </button>
        </div>
        {vendors.map(v => (
          <button
            key={v.id}
            onClick={() => {
              if (v.id === 'none') {
                // Immediately select CPU-only
                const preset = GPU_PRESETS.find(g => g.label === 'No GPU (CPU only)');
                onSelect(preset);
              } else {
                setVendor(v.id);
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#1E2D45] hover:border-sky-700 hover:bg-sky-950/20 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{v.icon}</span>
              <div>
                <div className="text-sm text-slate-200">{v.label}</div>
                <div className="text-xs text-slate-600">{v.desc}</div>
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-600" />
          </button>
        ))}
      </div>
    );
  }

  // ── Step 3: GPU model ─────────────────────────────────────────
  const groups = groupedGPUs ?? [{ label: null, gpus: filteredGPUs }];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Select your GPU</div>
        <button onClick={() => setVendor(null)} className="text-xs text-slate-600 hover:text-sky-400 transition-colors">
          ← Back
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-1.5 px-1">{group.label}</div>
            )}
            <div className="space-y-1">
              {group.gpus.map(g => (
                <button
                  key={g.label}
                  onClick={() => onSelect(g)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#1E2D45] hover:border-sky-700 hover:bg-sky-950/20 transition-all text-left"
                >
                  <span className="text-sm text-slate-200">{g.label}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
                    {g.bandwidth > 0 && <span>{g.bandwidth} GB/s</span>}
                    {g.memType && <span className="hidden sm:inline">{g.memType}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Form ──────────────────────────────────────────────────────────────
export default function HardwareForm({ value, onChange, geminiEnabled, onGeminiToggle }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [importantOpen, setImportantOpen] = useState(true);
  const hw = value;

  // Auto-detect OS on mount
  useEffect(() => {
    if (hw.os) return;
    const ua = navigator.userAgent;
    let detectedOS = 'Windows';
    if (ua.includes('Mac')) detectedOS = 'macOS';
    else if (ua.includes('Linux')) detectedOS = 'Linux';
    onChange({ ...hw, os: detectedOS });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch) {
    onChange({ ...hw, ...patch });
  }

  function onGPUSelect(preset) {
    if (!preset) {
      update({ gpuLabel: '', vram: 0, arch: null, unifiedMem: false, flashAttn: false, bandwidth: 0, memType: null, pcie: null, gpuBuyUrl: null });
      return;
    }
    update({
      gpuLabel:   preset.label,
      vram:       preset.vram,
      arch:       preset.arch || null,
      unifiedMem: !!preset.unified,
      flashAttn:  preset.flashAttn,
      bandwidth:  preset.bandwidth || 0,
      memType:    preset.memType || null,
      pcie:       preset.pcie || null,
      gpuBuyUrl:  preset.buyUrl || null,
    });
  }

  function onCPUChange(label) {
    const cpu = CPU_PRESETS.find(c => c.label === label);
    if (!cpu) return;
    update({ cpuLabel: label, cpuTier: cpu.tier, cpuCores: cpu.cores, cpuVendor: cpu.vendor, ramBandwidthFactor: cpu.ramBandwidthFactor });
  }

  function onRAMTypeChange(label) {
    const rt = RAM_TYPES.find(r => r.label === label);
    if (!rt) return;
    update({ ramTypeLabel: label, ramBandwidthGB: rt.bandwidthGBs, ramBandwidthFactor: rt.factor });
  }

  function toggleUseCase(uc) {
    const current = hw.useCases || [];
    update({ useCases: current.includes(uc) ? current.filter(c => c !== uc) : [...current, uc] });
  }

  return (
    <div className="space-y-4">
      {/* ── Hardware card ─────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Cpu size={15} className="text-sky-400" />
          <span className="text-sm font-semibold text-sky-400">Hardware</span>
        </div>

        {/* GPU Wizard */}
        <div>
          <label className="label">GPU</label>
          <GPUWizard
            hw={hw}
            os={hw.os || ''}
            onSelect={onGPUSelect}
            onOSChange={os => update({ os, gpuLabel: '', vram: 0, unifiedMem: false, bandwidth: 0 })}
          />
        </div>

        {/* VRAM override (only after GPU selected, non-unified) */}
        {hw.gpuLabel && !hw.unifiedMem && hw.gpuLabel !== 'No GPU (CPU only)' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">VRAM (GB)</label>
              <input
                type="number" min={1} max={256}
                className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
                value={hw.vram || ''}
                onChange={e => update({ vram: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Number of GPUs</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => update({ numGPUs: n })}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-colors ${
                      hw.numGPUs === n ? 'bg-sky-600 border-sky-500 text-white' : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
                    }`}>{n}×</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CPU */}
        <div>
          <label className="label">CPU</label>
          <select
            className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
            value={hw.cpuLabel || ''}
            onChange={e => onCPUChange(e.target.value)}
          >
            <option value="">— Select CPU —</option>
            {['ultra', 'high', 'mid', 'low'].map(tier => {
              const label = tier === 'ultra' ? 'Ultra / Workstation' : tier.charAt(0).toUpperCase() + tier.slice(1) + '-end';
              return (
                <optgroup key={tier} label={label}>
                  {CPU_PRESETS.filter(c => c.tier === tier && !c.apple).map(c => (
                    <option key={c.label} value={c.label}>{c.label} ({c.cores}c)</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        {/* RAM */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">System RAM (GB)</label>
            <select
              className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
              value={hw.ram || ''}
              onChange={e => update({ ram: Number(e.target.value) })}
            >
              <option value="">— RAM —</option>
              {RAM_OPTIONS.map(r => <option key={r} value={r}>{r} GB</option>)}
            </select>
          </div>
          <div>
            <label className="label">RAM Type</label>
            <select
              className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
              value={hw.ramTypeLabel || ''}
              onChange={e => onRAMTypeChange(e.target.value)}
            >
              <option value="">— Type —</option>
              {RAM_TYPES.map(r => (
                <option key={r.label} value={r.label}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Performance settings ──────────────────────────────── */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-300 hover:text-white"
          onClick={() => setImportantOpen(o => !o)}
        >
          <span className="flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            Performance Settings
          </span>
          {importantOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {importantOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-[#1E2D45] pt-4">
            <div>
              <label className="label">Context Length</label>
              <SegBtn options={CTX_OPTIONS} value={hw.contextLength} onChange={v => update({ contextLength: v })} />
            </div>
            <div>
              <label className="label">Use Cases</label>
              <div className="flex flex-wrap gap-2">
                {USE_CASES.map(uc => (
                  <button key={uc} onClick={() => toggleUseCase(uc)}
                    className={`chip border transition-colors ${
                      (hw.useCases || []).includes(uc)
                        ? 'bg-sky-900/50 border-sky-600 text-sky-300'
                        : 'border-[#1E2D45] text-slate-500 hover:border-slate-500'
                    }`}>{uc}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Acceptable Speed</label>
              <SegBtn options={SPEED_OPTIONS} value={hw.speedPref} onChange={v => update({ speedPref: v })} />
            </div>
          </div>
        )}
      </div>

      {/* ── Advanced ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-500 hover:text-slate-300"
          onClick={() => setAdvancedOpen(o => !o)}
        >
          <span className="flex items-center gap-2">
            <HardDrive size={14} className="text-slate-500" />
            Advanced
          </span>
          {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {advancedOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-[#1E2D45] pt-4">
            <div>
              <label className="label">Storage Type</label>
              <SegBtn
                options={[
                  { label: 'NVMe PCIe 4+', value: 'nvme' },
                  { label: 'SATA SSD', value: 'sata' },
                  { label: 'HDD', value: 'hdd' },
                ]}
                value={hw.ssd}
                onChange={v => update({ ssd: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-300">Flash Attention</div>
                <div className="text-xs text-slate-600">Reduces KV cache VRAM ~30%</div>
              </div>
              <button
                onClick={() => update({ flashAttn: !hw.flashAttn })}
                className={`relative w-11 h-6 rounded-full transition-colors ${hw.flashAttn ? 'bg-sky-600' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${hw.flashAttn ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {(hw.arch || hw.pcie || hw.memType || hw.bandwidth) && (
              <div className="space-y-1 pt-2 border-t border-[#1E2D45]">
                {[
                  ['Architecture', hw.arch],
                  ['VRAM Type', hw.memType],
                  ['PCIe Gen', hw.pcie ? `PCIe ${hw.pcie}.0` : null],
                  ['Mem Bandwidth', hw.bandwidth > 0 ? `${hw.bandwidth} GB/s` : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-slate-600">{k}</span>
                    <span className="text-slate-400 font-mono">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Gemini Toggle ─────────────────────────────────────── */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span className="text-yellow-400">⚡</span>
            Gemini AI Advisor
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            {geminiEnabled ? 'Analysing your full config for speed estimates' : 'Enable for AI tok/s estimates + model suggestions'}
          </div>
        </div>
        <button onClick={onGeminiToggle}>
          {geminiEnabled
            ? <ToggleRight size={32} className="text-yellow-400" />
            : <ToggleLeft size={32} className="text-slate-600" />}
        </button>
      </div>
    </div>
  );
}
