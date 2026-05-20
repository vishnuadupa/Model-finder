'use client';
import ResultCard from './ResultCard';
import { Sparkles, Zap, AlertTriangle, Server } from 'lucide-react';

const TIER_META = {
  recommended: {
    icon:   <Sparkles size={13} className="text-emerald-400" />,
    label:  'Recommended',
    desc:   'Fits comfortably — fast and reliable',
    accent: 'text-emerald-400',
    dot:    'bg-emerald-400',
    bar:    'bg-emerald-500/20 border-emerald-900/30',
  },
  comfortable: {
    icon:   <Zap size={13} className="text-teal-400" />,
    label:  'Comfortable',
    desc:   'Fits well — slightly less headroom',
    accent: 'text-teal-400',
    dot:    'bg-teal-400',
    bar:    'bg-teal-500/10 border-teal-900/30',
  },
  stretch: {
    icon:   <AlertTriangle size={13} className="text-amber-400" />,
    label:  'Stretch',
    desc:   'Very tight — may need CPU offload',
    accent: 'text-amber-400',
    dot:    'bg-amber-400',
    bar:    'bg-amber-500/10 border-amber-900/30',
  },
};

const RUNPOD_URL = 'https://runpod.io?ref=YOURCODE';

function CloudCTA({ modelName }) {
  return (
    <div className="card p-4 border-dashed border-zinc-700/50 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Server size={16} className="text-[#354835] shrink-0" />
        <div>
          <div className="text-sm text-[#C8E0C8]">Can&apos;t run {modelName} locally?</div>
          <div className="text-xs text-[#354835]">Rent a cloud GPU instead</div>
        </div>
      </div>
      <a
        href={RUNPOD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost shrink-0 text-xs whitespace-nowrap"
      >
        RunPod ~$0.20/hr →
      </a>
    </div>
  );
}

function TierSection({ tier, results, hwVram, onSelectModel, selectedModelName, geminiEnabled }) {
  const meta = TIER_META[tier];
  if (!results.length) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${meta.bar}`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} shadow-[0_0_6px_currentColor]`} />
          {meta.icon}
          <span className={`font-semibold text-sm ${meta.accent}`}>{meta.label}</span>
          <span className="text-xs text-[#354835] font-mono bg-[#0C110C] px-1.5 py-0.5 rounded-md border border-[#1E2B1E]/60">
            {results.length}
          </span>
        </div>
        <span className="text-xs text-[#3D5270] hidden sm:block">{meta.desc}</span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {results.map((r, i) => (
          <ResultCard
            key={`${r.model.name}_${r.quant}`}
            result={r}
            hwVram={hwVram}
            rank={i + 1}
            onSelect={onSelectModel}
            isSelected={selectedModelName === r.model.name}
            geminiEnabled={geminiEnabled}
          />
        ))}
      </div>
    </div>
  );
}

export default function ResultsPanel({ results, hw, onSelectModel, selectedModelName, geminiEnabled }) {
  const totalCount = (results.recommended?.length || 0)
    + (results.comfortable?.length || 0)
    + (results.stretch?.length || 0);

  const hwVram = hw?.unifiedMem              ? (hw.maxRam ? Math.min(hw.ram, hw.maxRam) : hw.ram)
              : hw?.gpuLabel === 'No GPU (CPU only)' ? hw.ram   // entire RAM is the pool
              : (hw?.vram || 0) * (hw?.numGPUs || 1);

  if (totalCount === 0) {
    return (
      <div className="card p-10 text-center space-y-3">
        <div className="text-3xl">😅</div>
        <div className="text-[#C8E0C8] font-semibold">No compatible models found</div>
        <div className="text-sm text-zinc-500 leading-relaxed">
          Try reducing context length, enabling Flash Attention, or adding more RAM.
        </div>
        <CloudCTA modelName="any local model" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-[#7EAF7E]">
          <span className="text-white font-semibold font-mono">{totalCount}</span> models fit your hardware
        </p>
        <div className="flex gap-2 text-[11px] font-mono">
          {results.recommended?.length > 0 && (
            <span className="text-emerald-500/80 bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-900/30">
              {results.recommended.length} recommended
            </span>
          )}
          {results.comfortable?.length > 0 && (
            <span className="text-teal-500/80 bg-teal-950/30 px-2 py-0.5 rounded-full border border-teal-900/30 hidden sm:inline">
              {results.comfortable.length} comfortable
            </span>
          )}
        </div>
      </div>

      <TierSection tier="recommended" results={results.recommended || []} hwVram={hwVram} onSelectModel={onSelectModel} selectedModelName={selectedModelName} geminiEnabled={geminiEnabled} />
      <TierSection tier="comfortable" results={results.comfortable || []} hwVram={hwVram} onSelectModel={onSelectModel} selectedModelName={selectedModelName} geminiEnabled={geminiEnabled} />
      <TierSection tier="stretch" results={results.stretch || []} hwVram={hwVram} onSelectModel={onSelectModel} selectedModelName={selectedModelName} geminiEnabled={geminiEnabled} />

      {/* Cloud CTA when stretch is non-empty */}
      {(results.stretch?.length > 0) && (
        <CloudCTA modelName="larger models" />
      )}
    </div>
  );
}
