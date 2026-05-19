'use client';
import ResultCard from './ResultCard';
import { Sparkles, Zap, AlertTriangle, Server } from 'lucide-react';

const TIER_META = {
  recommended: {
    icon: <Sparkles size={14} className="text-green-400" />,
    label: 'Recommended',
    desc: 'Runs fast with room to spare',
    accent: 'text-green-400',
    border: 'border-green-900/50',
    bg: 'bg-green-950/10',
  },
  comfortable: {
    icon: <Zap size={14} className="text-sky-400" />,
    label: 'Comfortable',
    desc: 'Runs well, near optimal',
    accent: 'text-sky-400',
    border: 'border-sky-900/50',
    bg: 'bg-sky-950/10',
  },
  stretch: {
    icon: <AlertTriangle size={14} className="text-amber-400" />,
    label: 'Stretch',
    desc: 'Tight on VRAM or needs CPU offload',
    accent: 'text-amber-400',
    border: 'border-amber-900/50',
    bg: 'bg-amber-950/10',
  },
};

const RUNPOD_URL = 'https://runpod.io?ref=YOURCODE';

function CloudCTA({ modelName }) {
  return (
    <div className="card p-4 border-dashed flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Server size={18} className="text-slate-500" />
        <div>
          <div className="text-sm text-slate-300">Can&apos;t run {modelName} locally?</div>
          <div className="text-xs text-slate-600">Cloud GPU alternative</div>
        </div>
      </div>
      <a
        href={RUNPOD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost shrink-0 text-xs"
      >
        RunPod ~$0.20/hr →
      </a>
    </div>
  );
}

function TierSection({ tier, results, hwVram }) {
  const meta = TIER_META[tier];
  if (!results.length) return null;

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {meta.icon}
          <span className={`font-semibold ${meta.accent}`}>{meta.label}</span>
          <span className="text-xs text-slate-600 font-mono">({results.length})</span>
        </div>
        <span className="text-xs text-slate-600">{meta.desc} · ranked by speed &amp; size</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {results.map((r, i) => (
          <ResultCard key={`${r.model.name}_${r.quant}_${i}`} result={r} hwVram={hwVram} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

export default function ResultsPanel({ results, hw }) {
  const totalCount = (results.recommended?.length || 0)
    + (results.comfortable?.length || 0)
    + (results.stretch?.length || 0);

  const hwVram = hw?.unifiedMem ? hw.ram : (hw?.vram || 0) * (hw?.numGPUs || 1);

  if (totalCount === 0) {
    return (
      <div className="card p-8 text-center space-y-3">
        <div className="text-3xl">😅</div>
        <div className="text-slate-300 font-semibold">No compatible models found</div>
        <div className="text-sm text-slate-600">
          Try reducing context length, enabling Flash Attention, or adding more RAM.
        </div>
        <CloudCTA modelName="any local model" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400">
          <span className="text-white font-semibold">{totalCount}</span> compatible models found
        </div>
        <div className="flex gap-3 text-xs font-mono text-slate-600">
          {results.recommended?.length > 0 && <span className="text-green-500">✓ {results.recommended.length} recommended</span>}
          {results.comfortable?.length > 0 && <span className="text-sky-500">✓ {results.comfortable.length} comfortable</span>}
          {results.stretch?.length > 0 && <span className="text-amber-500">⚠ {results.stretch.length} stretch</span>}
        </div>
      </div>

      <TierSection tier="recommended" results={results.recommended || []} hwVram={hwVram} />
      <TierSection tier="comfortable" results={results.comfortable || []} hwVram={hwVram} />
      <TierSection tier="stretch" results={results.stretch || []} hwVram={hwVram} />

      {/* Cloud CTA when stretch is non-empty */}
      {(results.stretch?.length > 0) && (
        <CloudCTA modelName="larger models" />
      )}
    </div>
  );
}
