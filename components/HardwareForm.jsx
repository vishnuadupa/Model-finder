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
  { label: 'Show all',    value: 'slow',   tip: 'Show every model, even slow ones' },
  { label: '10+ tok/s',   value: 'medium', tip: 'Conversational speed minimum' },
  { label: '30+ tok/s',   value: 'fast',   tip: 'Fast enough to feel instant' },
];

const BACKEND_LABELS = {
  cuda:   { label: 'CUDA (NVIDIA)',   color: 'text-green-400',  bg: 'bg-green-950/30 border-green-800/50' },
  metal:  { label: 'Metal (Apple)',   color: 'text-purple-400', bg: 'bg-purple-950/30 border-purple-800/50' },
  rocm:   { label: 'ROCm (AMD Linux)',color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/50' },
  vulkan: { label: 'Vulkan (AMD/Arc)',color: 'text-amber-400',  bg: 'bg-amber-950/30 border-amber-800/50' },
  cpu:    { label: 'CPU only',        color: 'text-slate-400',  bg: 'bg-slate-900/30 border-slate-700' },
};

// OS → available vendors
const OS_VENDORS = {
  Windows: [
    { id: 'nvidia', label: 'NVIDIA',       icon: '🟢', desc: 'GeForce RTX / GTX series' },
    { id: 'amd',   label: 'AMD',           icon: '🔴', desc: 'Radeon RX series' },
    { id: 'intel', label: 'Intel Arc',     icon: '🔵', desc: 'Arc B / A series' },
    { id: 'none',  label: 'No GPU',        icon: '⚙️',  desc: 'CPU-only inference' },
  ],
  Linux: [
    { id: 'nvidia', label: 'NVIDIA',       icon: '🟢', desc: 'GeForce RTX / GTX series' },
    { id: 'amd',   label: 'AMD',           icon: '🔴', desc: 'Radeon RX — ROCm backend' },
    { id: 'intel', label: 'Intel Arc',     icon: '🔵', desc: 'Arc series' },
    { id: 'none',  label: 'No GPU',        icon: '⚙️',  desc: 'CPU-only inference' },
  ],
  macOS: [
    { id: 'apple', label: 'Apple Silicon', icon: '🍎', desc: 'M1 / M2 / M3 / M4 — unified memory' },
    { id: 'none',  label: 'Intel Mac',     icon: '⚙️',  desc: 'No discrete GPU / CPU only' },
  ],
};

function getGPUsForVendor(vendor) {
  switch (vendor) {
    case 'nvidia': return GPU_PRESETS.filter(g => g.label.startsWith('RTX') || g.label.startsWith('GTX'));
    case 'amd':    return GPU_PRESETS.filter(g => g.label.startsWith('RX '));
    case 'intel':  return GPU_PRESETS.filter(g => g.label.startsWith('Arc'));
    case 'apple':  return GPU_PRESETS.filter(g => g.label.startsWith('Apple'));
    case 'none':   return GPU_PRESETS.filter(g => g.label === 'No GPU (CPU only)');
    default: return [];
  }
}

function groupNvidiaGPUs(gpus) {
  const groups = [
    { label: 'Blackwell (50 series)', prefix: 'RTX 5' },
    { label: 'Ada Lovelace (40 series)', prefix: 'RTX 4' },
    { label: 'Workstation', match: g => g.label.startsWith('RTX 6000') || g.label.startsWith('RTX A') || g.label.startsWith('RTX 2000') || g.label.startsWith('RTX 4000 Ada') },
    { label: 'Ampere (30 series)', prefix: 'RTX 3' },
    { label: 'Turing (20 series)', prefix: 'RTX 2' },
    { label: 'Pascal / older', match: g => g.label.startsWith('GTX') },
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
          title={o.tip || ''}
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

function HelpText({ children }) {
  return <p className="text-xs text-slate-600 mt-0.5 leading-snug">{children}</p>;
}

// ── GPU Wizard (3-step) ────────────────────────────────────────────────────
function GPUWizard({ hw, os, onSelect, onOSChange }) {
  const [vendor, setVendor] = useState(null);
  // osConfirmed tracks whether the user has EXPLICITLY clicked an OS button.
  // We always show Step 1 until they click, even if hw.os was auto-detected —
  // otherwise auto-detection skips Step 1 entirely and the OS buttons never appear.
  const [osConfirmed, setOsConfirmed] = useState(() => !!os);

  useEffect(() => {
    if (!hw.gpuLabel) { setVendor(null); return; }
    if (hw.gpuLabel.startsWith('RTX') || hw.gpuLabel.startsWith('GTX')) setVendor('nvidia');
    else if (hw.gpuLabel.startsWith('RX ')) setVendor('amd');
    else if (hw.gpuLabel.startsWith('Arc')) setVendor('intel');
    else if (hw.gpuLabel.startsWith('Apple')) setVendor('apple');
    else if (hw.gpuLabel === 'No GPU (CPU only)') setVendor('none');
  }, [hw.gpuLabel]);

  // When a GPU is loaded from localStorage/URL (gpuLabel already set), mark os as confirmed
  useEffect(() => {
    if (hw.gpuLabel && os) setOsConfirmed(true);
  }, [hw.gpuLabel, os]);

  function reset() {
    setVendor(null);
    setOsConfirmed(false);
    onSelect(null);
  }

  const vendors = OS_VENDORS[os] || OS_VENDORS.Windows;
  const filteredGPUs = useMemo(() => vendor ? getGPUsForVendor(vendor) : [], [vendor]);
  const groupedGPUs  = useMemo(() => vendor === 'nvidia' ? groupNvidiaGPUs(filteredGPUs) : null, [vendor, filteredGPUs]);

  // Selected — show summary chip
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
          <div className="flex gap-3 mt-0.5 text-xs flex-wrap">
            <span className={bMeta.color}>{bMeta.label}</span>
            {hw.bandwidth > 0 && <span className="text-slate-500">{hw.bandwidth} GB/s memory bandwidth</span>}
            {hw.memType && !hw.unifiedMem && <span className="text-slate-600">{hw.memType}</span>}
            {hw.unifiedMem && hw.vram > 0 && <span className="text-slate-500">{hw.vram} GB unified</span>}
          </div>
        </div>
        <button onClick={reset} title="Change GPU" className="text-slate-600 hover:text-slate-400 transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  // Step 1: OS
  if (!os) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-slate-500 mb-2">Step 1 of 3 — What operating system are you on?</div>
        {['Windows', 'Linux', 'macOS'].map(o => (
          <button
            key={o}
            onClick={() => { onOSChange(o); setStep(2); }}
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

  // Step 2: Vendor
  if (!vendor) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-500">Step 2 of 3 — What GPU brand?</div>
          <button onClick={() => { onOSChange(''); setStep(1); }} className="text-xs text-slate-600 hover:text-sky-400 transition-colors">
            ← {os}
          </button>
        </div>
        {vendors.map(v => (
          <button
            key={v.id}
            onClick={() => {
              if (v.id === 'none') {
                const preset = GPU_PRESETS.find(g => g.label === 'No GPU (CPU only)');
                onSelect(preset);
              } else {
                setVendor(v.id);
                setStep(3);
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

  // Step 3: GPU model
  const groups = groupedGPUs ?? [{ label: null, gpus: filteredGPUs }];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Step 3 of 3 — Select your exact GPU</div>
        <button onClick={() => { setVendor(null); setStep(2); }} className="text-xs text-slate-600 hover:text-sky-400 transition-colors">
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
                    {g.vram > 0 && <span>{g.vram} GB</span>}
                    {g.bandwidth > 0 && <span className="hidden sm:inline">{g.bandwidth} GB/s</span>}
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

  // True when an Apple Silicon chip is selected (M1/M2/M3/M4)
  const isApple = !!hw.unifiedMem;
  // True when CPU-only (no discrete GPU, no Apple Silicon)
  const isCPUOnly = hw.gpuLabel === 'No GPU (CPU only)';

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
      update({ gpuLabel: '', vram: 0, arch: null, unifiedMem: false, flashAttn: false,
               bandwidth: 0, memType: null, pcie: null, gpuBuyUrl: null, maxRam: null });
      return;
    }

    const fields = {
      gpuLabel:   preset.label,
      vram:       preset.vram,
      arch:       preset.arch || null,
      unifiedMem: !!preset.unified,
      flashAttn:  preset.flashAttn,
      bandwidth:  preset.bandwidth || 0,
      memType:    preset.memType || null,
      pcie:       preset.pcie || null,
      gpuBuyUrl:  preset.buyUrl || null,
      maxRam:     preset.maxRam || null,
    };

    if (preset.unified) {
      // Apple Silicon: CPU and GPU are the same chip.
      // Infer cpuTier from chip name — affects CPU-offload scoring even though
      // effectiveVRAM already uses the full RAM pool for Apple Silicon.
      const lbl = preset.label;
      const tier = lbl.includes('Ultra') ? 'ultra'
                 : lbl.includes('Max') || lbl.includes('Pro') ? 'high'
                 : 'mid';
      const cpuRamFactor = tier === 'ultra' ? 1.0 : tier === 'high' ? 0.9 : 0.75;
      // Apple Silicon uses unified LPDDR5X — set RAM bandwidth to match preset
      // ramBandwidthFactor for Apple is effectively 1.0 (on-chip, no PCIe bottleneck)
      fields.cpuTier = tier;
      fields.cpuRamFactor = cpuRamFactor;
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

  function toggleUseCase(uc) {
    const current = hw.useCases || [];
    update({ useCases: current.includes(uc) ? current.filter(c => c !== uc) : [...current, uc] });
  }

  return (
    <div className="space-y-4">
      {/* ── Hardware card ─────────────────────────────────────── */}
      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Cpu size={15} className="text-sky-400" />
          <span className="text-sm font-semibold text-sky-400">Your Hardware</span>
        </div>

        {/* GPU Wizard */}
        <div>
          <label className="label">GPU / Chip</label>
          <HelpText>Select your graphics card or Apple Silicon chip</HelpText>
          <div className="mt-2">
            <GPUWizard
              hw={hw}
              os={hw.os || ''}
              onSelect={onGPUSelect}
              onOSChange={os => update({ os, gpuLabel: '', vram: 0, unifiedMem: false, bandwidth: 0 })}
            />
          </div>
        </div>

        {/* VRAM override — discrete GPU only, not Apple Silicon, not CPU-only */}
        {hw.gpuLabel && !isApple && !isCPUOnly && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">VRAM (GB)</label>
              <HelpText>Video memory on your GPU card</HelpText>
              <input
                type="number" min={1} max={256}
                className="mt-1.5 w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
                value={hw.vram || ''}
                onChange={e => { const v = Number(e.target.value); if (v >= 1) update({ vram: v }); }}
              />
            </div>
            <div>
              <label className="label">Number of GPUs</label>
              <HelpText>Multi-GPU setups only</HelpText>
              <div className="flex gap-1.5 mt-1.5">
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

        {/* Apple Silicon info — replaces CPU + RAM type fields */}
        {isApple && (
          <div className="rounded-lg border border-purple-800/40 bg-purple-950/20 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base">🍎</span>
              <span className="text-xs font-semibold text-purple-300">Apple Silicon — Unified Memory</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              The CPU, GPU, and RAM are all one chip. No separate CPU or RAM type needed — memory bandwidth is already included from your chip selection.
            </p>
          </div>
        )}

        {/* CPU — hidden for Apple Silicon (same chip) */}
        {!isApple && (
          <div>
            <label className="label">CPU</label>
            <HelpText>
              {isCPUOnly
                ? 'Your CPU handles all inference — pick the closest match'
                : 'Used to estimate CPU offload speed when VRAM is tight'}
            </HelpText>
            <select
              className="mt-1.5 w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
              value={hw.cpuLabel || ''}
              onChange={e => onCPUChange(e.target.value)}
            >
              <option value="">— Select your CPU —</option>
              {['ultra', 'high', 'mid', 'low'].map(tier => {
                const label = tier === 'ultra' ? 'Ultra / Workstation'
                            : tier === 'high'  ? 'High-end Desktop / Laptop'
                            : tier === 'mid'   ? 'Mid-range Desktop / Laptop'
                            : 'Budget / Older';
                return (
                  <optgroup key={tier} label={label}>
                    {CPU_PRESETS.filter(c => c.tier === tier && !c.apple).map(c => (
                      <option key={c.label} value={c.label}>{c.label} ({c.cores}-core)</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
        )}

        {/* RAM */}
        <div className={`grid gap-3 ${isApple ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div>
            <label className="label">
              {isApple ? 'Unified Memory (GB)' : 'System RAM (GB)'}
            </label>
            <HelpText>
              {isApple
                ? 'The total RAM on your Mac — also acts as GPU memory'
                : 'Total installed RAM in your PC or laptop'}
            </HelpText>
            <select
              className="mt-1.5 w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
              value={hw.ram || ''}
              onChange={e => update({ ram: Number(e.target.value) })}
            >
              <option value="">— Select RAM —</option>
              {RAM_OPTIONS.filter(r => !hw.maxRam || r <= hw.maxRam).map(r => (
                <option key={r} value={r}>{r} GB</option>
              ))}
            </select>
          </div>

          {/* RAM Type — hidden for Apple Silicon */}
          {!isApple && (
            <div>
              <label className="label">RAM Type</label>
              <HelpText>Affects CPU-offload speed when VRAM is full</HelpText>
              <select
                className="mt-1.5 w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
                value={hw.ramTypeLabel || ''}
                onChange={e => onRAMTypeChange(e.target.value)}
              >
                <option value="">— RAM type —</option>
                {RAM_TYPES.map(r => (
                  <option key={r.label} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── What do you need? ─────────────────────────────────── */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-300 hover:text-white"
          onClick={() => setImportantOpen(o => !o)}
        >
          <span className="flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            What do you need?
          </span>
          {importantOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {importantOpen && (
          <div className="px-5 pb-5 space-y-5 border-t border-[#1E2D45] pt-4">
            {/* Context length */}
            <div>
              <label className="label">Context Length</label>
              <HelpText>How much text the model can see at once. 4k handles normal chats; 32k+ for long documents.</HelpText>
              <div className="mt-2">
                <SegBtn options={CTX_OPTIONS} value={hw.contextLength} onChange={v => update({ contextLength: v })} />
              </div>
            </div>

            {/* Use cases */}
            <div>
              <label className="label">Use Cases <span className="text-slate-600 font-normal">(optional)</span></label>
              <HelpText>Select what you want to do — matching models are ranked higher in results.</HelpText>
              <div className="flex flex-wrap gap-2 mt-2">
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

            {/* Speed filter */}
            <div>
              <label className="label">Minimum Speed</label>
              <HelpText>Filters out models that are too slow for comfortable use. &ldquo;Show all&rdquo; includes CPU-offload models.</HelpText>
              <div className="mt-2">
                <SegBtn options={SPEED_OPTIONS} value={hw.speedPref} onChange={v => update({ speedPref: v })} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Advanced (optional) ───────────────────────────────── */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-500 hover:text-slate-300"
          onClick={() => setAdvancedOpen(o => !o)}
        >
          <span className="flex items-center gap-2">
            <HardDrive size={14} className="text-slate-500" />
            Advanced Settings
            <span className="text-xs font-normal text-slate-700">— most users skip this</span>
          </span>
          {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {advancedOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-[#1E2D45] pt-4">
            <div>
              <label className="label">Storage Type</label>
              <HelpText>NVMe is fastest for loading models. Only matters if you have less RAM than the model size.</HelpText>
              <div className="mt-2">
                <SegBtn
                  options={[
                    { label: 'NVMe SSD', value: 'nvme' },
                    { label: 'SATA SSD', value: 'sata' },
                    { label: 'HDD',      value: 'hdd' },
                  ]}
                  value={hw.ssd}
                  onChange={v => update({ ssd: v })}
                />
              </div>
            </div>

            {/* Flash Attention — relevant for all backends */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-300">Flash Attention</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Reduces KV cache VRAM by ~30%, especially at long context lengths. Supported in llama.cpp by default.
                </div>
              </div>
              <button
                onClick={() => update({ flashAttn: !hw.flashAttn })}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${hw.flashAttn ? 'bg-sky-600' : 'bg-slate-700'}`}
                title={hw.flashAttn ? 'Flash Attention enabled' : 'Flash Attention disabled'}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${hw.flashAttn ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {/* GPU tech details (auto-filled from preset) */}
            {(hw.arch || hw.pcie || hw.memType || hw.bandwidth > 0) && (
              <div className="space-y-1 pt-2 border-t border-[#1E2D45]">
                <div className="text-xs text-slate-600 mb-1.5">Auto-filled from GPU selection</div>
                {[
                  ['Architecture', hw.arch],
                  ['VRAM Type', hw.memType],
                  ['PCIe Gen', hw.pcie ? `PCIe ${hw.pcie}.0` : null],
                  ['Memory Bandwidth', hw.bandwidth > 0 ? `${hw.bandwidth} GB/s` : null],
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

      {/* ── Gemini AI Advisor Toggle ───────────────────────────── */}
      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span className="text-yellow-400">⚡</span>
            Gemini AI Advisor
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            {geminiEnabled
              ? 'AI-powered speed estimates and next/previous model suggestions'
              : 'Enable for AI-powered speed tips and model comparisons'}
          </div>
        </div>
        <button onClick={onGeminiToggle} title={geminiEnabled ? 'Disable Gemini AI' : 'Enable Gemini AI'}>
          {geminiEnabled
            ? <ToggleRight size={32} className="text-yellow-400" />
            : <ToggleLeft  size={32} className="text-slate-600" />}
        </button>
      </div>
    </div>
  );
}
