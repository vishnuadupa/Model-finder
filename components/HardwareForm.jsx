'use client';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Cpu, HardDrive, Zap, Monitor, ToggleLeft, ToggleRight } from 'lucide-react';
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
  { label: 'Fast 30+',   value: 'fast' },
  { label: 'Medium 10-30', value: 'medium' },
  { label: 'Slow <10',   value: 'slow' },
];

const BACKEND_LABELS = {
  cuda:   { label: 'CUDA',    color: 'text-green-400',  bg: 'bg-green-950/30 border-green-800/50' },
  metal:  { label: 'Metal',   color: 'text-purple-400', bg: 'bg-purple-950/30 border-purple-800/50' },
  rocm:   { label: 'ROCm',    color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/50' },
  vulkan: { label: 'Vulkan',  color: 'text-amber-400',  bg: 'bg-amber-950/30 border-amber-800/50' },
  cpu:    { label: 'CPU only',color: 'text-slate-400',  bg: 'bg-slate-900/30 border-slate-700' },
};

function SegBtn({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`}>
      {options.map(o => (
        <button
          key={o.value ?? o}
          onClick={() => onChange(o.value ?? o)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
            (value === (o.value ?? o))
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

export default function HardwareForm({ value, onChange, geminiEnabled, onGeminiToggle }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [importantOpen, setImportantOpen] = useState(true);
  const hw = value;

  // Auto-detect OS on mount
  useEffect(() => {
    if (hw.os) return;
    const ua = navigator.userAgent;
    const platform = navigator.platform || '';
    let detectedOS = 'Windows';
    if (ua.includes('Mac') || platform.includes('Mac')) detectedOS = 'macOS';
    else if (ua.includes('Linux')) detectedOS = 'Linux';
    onChange({ ...hw, os: detectedOS });
  }, []);

  function update(patch) {
    onChange({ ...hw, ...patch });
  }

  function onGPUChange(label) {
    const preset = GPU_PRESETS.find(g => g.label === label);
    if (!preset) return;
    update({
      gpuLabel:        preset.label,
      vram:            preset.vram,
      arch:            preset.arch || null,
      unifiedMem:      !!preset.unified,
      flashAttn:       preset.flashAttn,
      bandwidth:       preset.bandwidth || 0,
      memType:         preset.memType || null,
      pcie:            preset.pcie || null,
      gpuBuyUrl:       preset.buyUrl || null,
    });
  }

  function onCPUChange(label) {
    const cpu = CPU_PRESETS.find(c => c.label === label);
    if (!cpu) return;
    update({
      cpuLabel:   label,
      cpuTier:    cpu.tier,
      cpuCores:   cpu.cores,
      cpuVendor:  cpu.vendor,
      ramBandwidthFactor: cpu.ramBandwidthFactor,
    });
  }

  function onRAMTypeChange(label) {
    const rt = RAM_TYPES.find(r => r.label === label);
    if (!rt) return;
    update({
      ramTypeLabel:       label,
      ramBandwidthGB:     rt.bandwidthGBs,
      ramBandwidthFactor: rt.factor,
    });
  }

  function toggleUseCase(uc) {
    const current = hw.useCases || [];
    const next = current.includes(uc) ? current.filter(c => c !== uc) : [...current, uc];
    update({ useCases: next });
  }

  // Derive backend for display
  const backend = (() => {
    if (!hw.gpuLabel || hw.gpuLabel === 'No GPU (CPU only)') return 'cpu';
    if (hw.gpuLabel.startsWith('Apple')) return 'metal';
    if (hw.gpuLabel.startsWith('Arc')) return 'vulkan';
    const isAMD = hw.gpuLabel.startsWith('RX ');
    if (isAMD) return hw.os === 'Linux' ? 'rocm' : 'vulkan';
    return 'cuda';
  })();

  const backendMeta = BACKEND_LABELS[backend] || BACKEND_LABELS.cpu;
  const gpuGroups = [
    { label: 'NVIDIA Blackwell (5xxx)', prefix: 'RTX 5' },
    { label: 'NVIDIA Ada (4xxx)',        prefix: 'RTX 4' },
    { label: 'NVIDIA Workstation Ada',   prefix: 'RTX 6000 Ada' },
    { label: 'NVIDIA Ampere (3xxx)',     prefix: 'RTX 3' },
    { label: 'NVIDIA Workstation Ampere',prefix: 'RTX A' },
    { label: 'NVIDIA Turing (2xxx)',     prefix: 'RTX 2' },
    { label: 'NVIDIA Pascal (1xxx)',     prefix: 'GTX' },
    { label: 'AMD RDNA 4',              prefix: 'RX 90' },
    { label: 'AMD RDNA 3',              prefix: 'RX 7' },
    { label: 'AMD RDNA 2',              prefix: 'RX 6' },
    { label: 'Intel Arc',               prefix: 'Arc' },
    { label: 'Apple Silicon',           prefix: 'Apple' },
    { label: 'CPU Only',                prefix: 'No GPU' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Tier 1: Hardware ─────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Cpu size={15} className="text-sky-400" />
            <span className="text-sm font-semibold text-sky-400">Hardware</span>
          </div>
          {/* OS selector */}
          <div className="flex items-center gap-1.5">
            <Monitor size={12} className="text-slate-500" />
            <select
              className="bg-transparent text-xs text-slate-400 border-none focus:outline-none cursor-pointer"
              value={hw.os || 'Windows'}
              onChange={e => update({ os: e.target.value })}
            >
              <option>Windows</option>
              <option>Linux</option>
              <option>macOS</option>
            </select>
          </div>
        </div>

        {/* GPU */}
        <div>
          <label className="label">GPU Model</label>
          <select
            className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
            value={hw.gpuLabel || ''}
            onChange={e => onGPUChange(e.target.value)}
          >
            <option value="">— Select GPU —</option>
            {gpuGroups.map(group => {
              const gpus = GPU_PRESETS.filter(g => g.label.startsWith(group.prefix));
              if (!gpus.length) return null;
              return (
                <optgroup key={group.label} label={group.label}>
                  {gpus.map(g => (
                    <option key={g.label} value={g.label}>{g.label}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        {/* GPU info row */}
        {hw.gpuLabel && hw.gpuLabel !== 'No GPU (CPU only)' && (
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${backendMeta.bg}`}>
            <div className="flex items-center gap-3 text-xs">
              <span className={`font-semibold ${backendMeta.color}`}>{backendMeta.label}</span>
              {hw.bandwidth > 0 && (
                <span className="text-slate-500">{hw.bandwidth} GB/s</span>
              )}
              {hw.memType && (
                <span className="text-slate-600">{hw.memType}</span>
              )}
              {hw.pcie && (
                <span className="text-slate-700">PCIe {hw.pcie}.0</span>
              )}
            </div>
            {hw.unifiedMem && (
              <span className="chip bg-purple-900/50 text-purple-300 text-xs">Unified Memory</span>
            )}
          </div>
        )}

        {/* VRAM override */}
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
                  <button
                    key={n}
                    onClick={() => update({ numGPUs: n })}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-colors ${
                      hw.numGPUs === n
                        ? 'bg-sky-600 border-sky-500 text-white'
                        : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
                    }`}
                  >{n}×</button>
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
              const cpus = CPU_PRESETS.filter(c => c.tier === tier && !c.apple);
              const label = tier === 'ultra' ? 'Ultra / Workstation' : tier.charAt(0).toUpperCase() + tier.slice(1) + '-end';
              return (
                <optgroup key={tier} label={label}>
                  {cpus.map(c => (
                    <option key={c.label} value={c.label}>{c.label} ({c.cores}c)</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        {/* System RAM */}
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
            <label className="label">RAM Type / Speed</label>
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

        {hw.ramBandwidthGB && (
          <div className="text-xs text-slate-600 font-mono">
            RAM bandwidth: ~{hw.ramBandwidthGB} GB/s — affects CPU offload speed
          </div>
        )}
      </div>

      {/* ── Tier 2: Performance ───────────────────────────────────── */}
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
            {/* Context Length */}
            <div>
              <label className="label">Context Length</label>
              <SegBtn
                options={CTX_OPTIONS}
                value={hw.contextLength}
                onChange={v => update({ contextLength: v })}
              />
            </div>

            {/* Use Cases */}
            <div>
              <label className="label">Use Cases</label>
              <div className="flex flex-wrap gap-2">
                {USE_CASES.map(uc => (
                  <button
                    key={uc}
                    onClick={() => toggleUseCase(uc)}
                    className={`chip border transition-colors ${
                      (hw.useCases || []).includes(uc)
                        ? 'bg-sky-900/50 border-sky-600 text-sky-300'
                        : 'border-[#1E2D45] text-slate-500 hover:border-slate-500'
                    }`}
                  >
                    {uc}
                  </button>
                ))}
              </div>
            </div>

            {/* Acceptable Speed */}
            <div>
              <label className="label">Acceptable Speed</label>
              <SegBtn
                options={SPEED_OPTIONS}
                value={hw.speedPref}
                onChange={v => update({ speedPref: v })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Tier 3: Advanced ──────────────────────────────────────── */}
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
            {/* Storage */}
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

            {/* Flash Attention */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-300">Flash Attention</div>
                <div className="text-xs text-slate-600">
                  Reduces KV cache VRAM ~30%.
                  {hw.flashAttn !== undefined && !hw.flashAttn && hw.arch && (
                    <span className="text-amber-600 ml-1">Not supported on {hw.arch}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => update({ flashAttn: !hw.flashAttn })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  hw.flashAttn ? 'bg-sky-600' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  hw.flashAttn ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Read-only info */}
            {(hw.arch || hw.pcie || hw.memType) && (
              <div className="space-y-1 pt-2 border-t border-[#1E2D45]">
                {hw.arch && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Architecture</span>
                    <span className="text-slate-400 font-mono">{hw.arch}</span>
                  </div>
                )}
                {hw.memType && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">VRAM Type</span>
                    <span className="text-slate-400 font-mono">{hw.memType}</span>
                  </div>
                )}
                {hw.pcie && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">PCIe Gen</span>
                    <span className="text-slate-400 font-mono">PCIe {hw.pcie}.0</span>
                  </div>
                )}
                {hw.bandwidth > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Mem Bandwidth</span>
                    <span className="text-slate-400 font-mono">{hw.bandwidth} GB/s</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Gemini AI Toggle ──────────────────────────────────────── */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span className="text-yellow-400">⚡</span>
            Gemini AI Advisor
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            {geminiEnabled
              ? 'AI analyses your full config for accurate speed estimates'
              : 'Enable for AI-powered tok/s estimates and model suggestions'}
          </div>
        </div>
        <button
          onClick={onGeminiToggle}
          className="flex items-center gap-2 transition-colors"
        >
          {geminiEnabled
            ? <ToggleRight size={32} className="text-yellow-400" />
            : <ToggleLeft size={32} className="text-slate-600" />
          }
        </button>
      </div>
    </div>
  );
}
