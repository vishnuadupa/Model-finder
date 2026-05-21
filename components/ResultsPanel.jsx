'use client';
import ResultCard from './ResultCard';
import UpgradePlanner from './UpgradePlanner';
import { Sparkles, Zap, AlertTriangle, Server } from 'lucide-react';

const TIER_META = {
  recommended: {
    icon:   <Sparkles size={13} className="text-[#84E1BC]" />,
    label:  'Recommended',
    desc:   'Fits comfortably — fast and reliable',
    accent: 'text-[#F3F3F5]',
    dot:    'bg-[#84E1BC]',
    bar:    'bg-white/[0.02] border-white/5',
  },
  comfortable: {
    icon:   <Zap size={13} className="text-[#8E919A]" />,
    label:  'Comfortable',
    desc:   'Fits well — slightly less headroom',
    accent: 'text-[#F3F3F5]',
    dot:    'bg-zinc-500',
    bar:    'bg-white/[0.02] border-white/5',
  },
  stretch: {
    icon:   <AlertTriangle size={13} className="text-amber-500/60" />,
    label:  'Stretch',
    desc:   'Very tight — may need CPU offload',
    accent: 'text-[#F3F3F5]',
    dot:    'bg-amber-500/60',
    bar:    'bg-white/[0.02] border-white/5',
  },
};

const RUNPOD_URL = 'https://runpod.io?ref=YOURCODE';

function CloudCTA({ modelName }) {
  return (
    <div className="card p-4 border-dashed border-white/5 bg-white/[0.01] flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Server size={16} className="text-[#8E919A] shrink-0" />
        <div>
          <div className="text-sm text-[#F3F3F5]">Can&apos;t run {modelName} locally?</div>
          <div className="text-xs text-[#8E919A]">Rent a cloud GPU instead</div>
        </div>
      </div>
      <a
        href={RUNPOD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 bg-[#15151A] border border-white/5 hover:border-white/20 rounded-lg text-xs text-[#8E919A] hover:text-[#F3F3F5] transition-all shrink-0 font-medium whitespace-nowrap"
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
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.icon}
          <span className={`font-semibold text-sm ${meta.accent}`}>{meta.label}</span>
          <span className="text-xs text-[#8E919A] font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
            {results.length}
          </span>
        </div>
        <span className="text-xs text-[#8E919A] hidden sm:block">{meta.desc}</span>
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

export default function ResultsPanel({ results, hw, models, onApplyHardware, onSelectModel, selectedModelName, geminiEnabled }) {
  const totalCount = (results.recommended?.length || 0)
    + (results.comfortable?.length || 0)
    + (results.stretch?.length || 0);

  const hwVram = hw?.unifiedMem              ? (hw.maxRam ? Math.min(hw.ram, hw.maxRam) : hw.ram)
              : hw?.gpuLabel === 'No GPU (CPU only)' ? hw.ram   // entire RAM is the pool
              : (hw?.vram || 0) * (hw?.numGPUs || 1);

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        <div className="card p-10 text-center space-y-3">
          <div className="text-3xl">😅</div>
          <div className="text-[#F3F3F5] font-semibold">No compatible models found</div>
          <div className="text-sm text-[#8E919A] leading-relaxed">
            Try reducing context length, enabling Flash Attention, or adding more RAM.
          </div>
          <CloudCTA modelName="any local model" />
        </div>
        <UpgradePlanner hw={hw} models={models} onApplyHardware={onApplyHardware} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-[#8E919A]">
          <span className="text-white font-semibold font-mono">{totalCount}</span> models fit your hardware
        </p>
        <div className="flex gap-2 text-[11px] font-mono">
          {results.recommended?.length > 0 && (
            <span className="text-[#84E1BC] bg-[#84E1BC]/5 px-2 py-0.5 rounded border border-[#84E1BC]/10 font-semibold shadow-sm">
              {results.recommended.length} recommended
            </span>
          )}
          {results.comfortable?.length > 0 && (
            <span className="text-[#8E919A] bg-white/5 px-2 py-0.5 rounded border border-white/5 hidden sm:inline font-semibold shadow-sm">
              {results.comfortable.length} comfortable
            </span>
          )}
        </div>
      </div>

      <TierSection tier="recommended" results={results.recommended || []} hwVram={hwVram} onSelectModel={onSelectModel} selectedModelName={selectedModelName} geminiEnabled={geminiEnabled} />
      <TierSection tier="comfortable" results={results.comfortable || []} hwVram={hwVram} onSelectModel={onSelectModel} selectedModelName={selectedModelName} geminiEnabled={geminiEnabled} />
      
      {/* What-If / Hardware Upgrade Planner simulator */}
      <UpgradePlanner hw={hw} models={models} onApplyHardware={onApplyHardware} />

      <TierSection tier="stretch" results={results.stretch || []} hwVram={hwVram} onSelectModel={onSelectModel} selectedModelName={selectedModelName} geminiEnabled={geminiEnabled} />

      {/* Cloud CTA when stretch is non-empty */}
      {(results.stretch?.length > 0) && (
        <CloudCTA modelName="larger models" />
      )}
    </div>
  );
}
