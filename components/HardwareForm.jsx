'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, HardDrive, Zap } from 'lucide-react';
import { GPU_PRESETS } from '@/lib/gpuPresets';

const RAM_OPTIONS = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
const CTX_OPTIONS = [
  { label: '2k',   value: 2048 },
  { label: '4k',   value: 4096 },
  { label: '8k',   value: 8192 },
  { label: '32k',  value: 32768 },
  { label: '128k', value: 131072 },
];
const USE_CASES = ['Chat', 'Code', 'Reasoning', 'Long Docs', 'Multilingual', 'Vision'];
const SPEED_OPTIONS = [
  { label: 'Fast 30+ tok/s',  value: 'fast' },
  { label: 'Medium 10-30',    value: 'medium' },
  { label: 'Slow <10',        value: 'slow' },
];

export default function HardwareForm({ value, onChange }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [importantOpen, setImportantOpen] = useState(true);

  const hw = value;

  function update(patch) {
    onChange({ ...hw, ...patch });
  }

  function onGPUChange(label) {
    const preset = GPU_PRESETS.find(g => g.label === label);
    if (!preset) return;
    update({
      gpuLabel:   preset.label,
      vram:       preset.vram,
      arch:       preset.arch || null,
      unifiedMem: !!preset.unified,
      flashAttn:  preset.flashAttn,
    });
  }

  function toggleUseCase(uc) {
    const current = hw.useCases || [];
    const next = current.includes(uc) ? current.filter(c => c !== uc) : [...current, uc];
    update({ useCases: next });
  }

  return (
    <div className="space-y-6">
      {/* ── Tier 1: Required ─────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={16} className="text-sky-400" />
          <span className="text-sm font-semibold text-sky-400">Hardware</span>
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
            {GPU_PRESETS.map(g => (
              <option key={g.label} value={g.label}>{g.label}</option>
            ))}
          </select>
        </div>

        {/* Custom VRAM override when Custom is selected */}
        {hw.gpuLabel && !hw.unifiedMem && (
          <div>
            <label className="label">VRAM (GB)</label>
            <input
              type="number"
              min={1} max={256}
              className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
              value={hw.vram || ''}
              onChange={e => update({ vram: Number(e.target.value) })}
            />
          </div>
        )}

        {/* Unified Memory toggle for Apple */}
        {hw.unifiedMem && (
          <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-800/50 rounded-lg">
            <span className="text-sm text-purple-300">Unified Memory (Apple Silicon)</span>
            <span className="chip bg-purple-900/50 text-purple-300">All RAM = VRAM</span>
          </div>
        )}

        {/* System RAM */}
        <div>
          <label className="label">System RAM (GB)</label>
          <select
            className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
            value={hw.ram || ''}
            onChange={e => update({ ram: Number(e.target.value) })}
          >
            <option value="">— Select RAM —</option>
            {RAM_OPTIONS.map(r => <option key={r} value={r}>{r} GB</option>)}
          </select>
        </div>

        {/* Number of GPUs */}
        {!hw.unifiedMem && hw.vram > 0 && (
          <div>
            <label className="label">Number of GPUs</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => update({ numGPUs: n })}
                  className={`flex-1 py-2 rounded-lg text-sm font-mono border transition-colors ${
                    hw.numGPUs === n
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Tier 2: Important ─────────────────────────────────────── */}
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
          <div className="px-5 pb-5 space-y-4 border-t border-[#1E2D45]">
            {/* Context Length */}
            <div className="pt-4">
              <label className="label">Context Length</label>
              <div className="flex gap-2 flex-wrap">
                {CTX_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => update({ contextLength: o.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                      hw.contextLength === o.value
                        ? 'bg-sky-600 border-sky-500 text-white'
                        : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* OS + Backend */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">OS</label>
                <select
                  className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
                  value={hw.os || ''}
                  onChange={e => update({ os: e.target.value })}
                >
                  <option value="">—</option>
                  <option>Windows</option>
                  <option>Linux</option>
                  <option>macOS</option>
                </select>
              </div>
              <div>
                <label className="label">GPU Vendor</label>
                <select
                  className="w-full bg-[#080B12] border border-[#1E2D45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
                  value={hw.vendor || ''}
                  onChange={e => update({ vendor: e.target.value })}
                >
                  <option value="">—</option>
                  <option>NVIDIA</option>
                  <option>AMD</option>
                  <option>Apple</option>
                </select>
              </div>
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

            {/* Speed preference */}
            <div>
              <label className="label">Acceptable Speed</label>
              <div className="flex gap-2 flex-wrap">
                {SPEED_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => update({ speedPref: s.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                      hw.speedPref === s.value
                        ? 'bg-sky-600 border-sky-500 text-white'
                        : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
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
          <div className="px-5 pb-5 space-y-4 border-t border-[#1E2D45]">
            {/* CPU Tier */}
            <div className="pt-4">
              <label className="label">CPU Tier</label>
              <div className="flex gap-2">
                {['low', 'mid', 'high'].map(t => (
                  <button
                    key={t}
                    onClick={() => update({ cpuTier: t })}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-colors capitalize ${
                      hw.cpuTier === t
                        ? 'bg-sky-600 border-sky-500 text-white'
                        : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
                    }`}
                  >
                    {t === 'low' ? 'Low (i3/R3)' : t === 'mid' ? 'Mid (i5-7/R5-7)' : 'High (i9/TR)'}
                  </button>
                ))}
              </div>
            </div>

            {/* SSD Type */}
            <div>
              <label className="label">Storage Type</label>
              <div className="flex gap-2">
                {['nvme', 'sata', 'hdd'].map(s => (
                  <button
                    key={s}
                    onClick={() => update({ ssd: s })}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono border uppercase transition-colors ${
                      hw.ssd === s
                        ? 'bg-sky-600 border-sky-500 text-white'
                        : 'border-[#1E2D45] text-slate-400 hover:border-sky-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Flash Attention */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-300">Flash Attention</div>
                <div className="text-xs text-slate-600">Reduces KV cache VRAM ~30%</div>
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

            {/* GPU Architecture (read-only) */}
            {hw.arch && (
              <div className="flex items-center justify-between py-2 border-t border-[#1E2D45]">
                <span className="text-xs text-slate-500">GPU Architecture</span>
                <span className="chip bg-slate-800 text-slate-400">{hw.arch}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
