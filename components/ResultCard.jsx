'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Copy, Check, ExternalLink, AlertTriangle, CheckCircle, AlertCircle,
  Star, MessageSquare, Code2, Brain, FileText, Globe, Eye
} from 'lucide-react';

const QUALITY_COLORS = {
  good:      'text-[#8E919A] bg-white/[0.01] border-white/5',
  great:     'text-[#84E1BC] bg-[#84E1BC]/5 border-[#84E1BC]/10',
  excellent: 'text-purple-300 bg-purple-500/5 border-purple-500/10',
};

const USE_CASE_ICONS = {
  chat: <MessageSquare size={11} className="text-zinc-400 shrink-0" />,
  code: <Code2 size={11} className="text-zinc-400 shrink-0" />,
  reasoning: <Brain size={11} className="text-zinc-400 shrink-0" />,
  'long-docs': <FileText size={11} className="text-zinc-400 shrink-0" />,
  multilingual: <Globe size={11} className="text-zinc-400 shrink-0" />,
  vision: <Eye size={11} className="text-zinc-400 shrink-0" />,
};

const QUANT_INFO = {
  IQ2_XXS: { label: '2-bit XS',      stars: 1, note: 'Smallest file, noticeably worse quality' },
  Q2_K:    { label: '2-bit',         stars: 1, note: 'Smallest file — use only if very VRAM-limited' },
  Q3_K_M:  { label: '3-bit',         stars: 2, note: 'Small file, acceptable quality for most tasks' },
  IQ4_XS:  { label: '4-bit XS',      stars: 3, note: 'Good quality, slightly smaller than Q4_K_M' },
  Q4_K_S:  { label: '4-bit small',   stars: 3, note: 'Good quality, slightly smaller than Q4_K_M' },
  Q4_K_M:  { label: '4-bit',         stars: 3, note: 'Best balance of quality and size — recommended' },
  Q4_0:    { label: '4-bit legacy',  stars: 3, note: 'Older format — prefer Q4_K_M' },
  Q5_K_M:  { label: '5-bit',         stars: 4, note: 'High quality, ~15% more VRAM than Q4_K_M' },
  Q5_K_S:  { label: '5-bit small',   stars: 4, note: 'High quality, slightly smaller than Q5_K_M' },
  Q6_K:    { label: '6-bit',         stars: 4, note: 'Very high quality, nearly indistinguishable' },
  Q8_0:    { label: '8-bit',         stars: 5, note: 'Near-original quality, 2× VRAM of Q4_K_M' },
  F16:     { label: 'Full 16-bit',   stars: 5, note: 'Full original quality, 4× VRAM of Q4_K_M' },
  BF16:    { label: 'BF 16-bit',     stars: 5, note: 'Full original quality (brain float format)' },
  F32:     { label: 'Full 32-bit',   stars: 5, note: 'Max precision, 8× VRAM of Q4_K_M' },
};

const TIER_BORDER = {
  recommended: 'border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/[0.02]',
  comfortable: 'border-zinc-500/20 hover:border-zinc-500/40 bg-zinc-500/[0.01]',
  stretch:     'border-amber-500/20 hover:border-amber-500/40 bg-amber-500/[0.01]',
};

const TIER_BORDER_SELECTED = {
  recommended: 'ring-1 ring-[#84E1BC]/30 border-[#84E1BC]/40 bg-[#84E1BC]/5',
  comfortable: 'ring-1 ring-zinc-500/30 border-zinc-500/40 bg-zinc-500/10',
  stretch:     'ring-1 ring-amber-500/30 border-amber-500/40 bg-amber-500/10',
};

const TIER_DOT = {
  recommended: 'bg-[#84E1BC]',
  comfortable: 'bg-zinc-500',
  stretch:     'bg-amber-500/60',
};

/* ── useCountUp — animates a number from 0 → target on mount ── */
function useCountUp(target, duration = 750) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const start = performance.now();
    function tick(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

/* Qualitative speed label */
function tokSpeedLabel(tps) {
  if (tps >= 40) return { label: 'Real-time',     color: 'text-[#84E1BC]' };
  if (tps >= 20) return { label: 'Fast',          color: 'text-[#84E1BC]/70' };
  if (tps >= 8)  return { label: 'Conversational', color: 'text-amber-400/80' };
  return                { label: 'Very slow',     color: 'text-zinc-500' };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      title={text}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15151A] border border-white/5 hover:border-white/20 rounded-lg text-xs text-[#8E919A] hover:text-[#F3F3F5] transition-colors font-mono min-w-0"
    >
      {copied
        ? <Check size={11} className="text-[#84E1BC] shrink-0" />
        : <Copy size={11} className="shrink-0" />}
      <span className="truncate max-w-[140px]">{copied ? 'Copied!' : text}</span>
    </button>
  );
}

function Stars({ count }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={11}
          className={i < count ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}
        />
      ))}
    </div>
  );
}

/* ── VRAM bar with mount-fill animation + hybrid GPU/RAM split ── */
function VRAMBar({ used, total, cpuOnly, cpuOffloadNeeded, gpuOnlyVram }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const solidPct  = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const gpuPct    = total > 0 && gpuOnlyVram ? Math.min((gpuOnlyVram / total) * 100, 100) : solidPct;
  const ramPct    = total > 0 && cpuOffloadNeeded && gpuOnlyVram && used > gpuOnlyVram
    ? Math.min(((used - gpuOnlyVram) / total) * 100, 100 - gpuPct)
    : 0;

  const showSplit = cpuOffloadNeeded && !cpuOnly && gpuOnlyVram && ramPct > 0;
  const singleColor = cpuOnly ? 'bg-zinc-500/80' : 'bg-[#84E1BC]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8E919A] uppercase tracking-wider text-[10px] font-semibold">
          {cpuOnly ? 'RAM Usage' : cpuOffloadNeeded ? 'Hybrid VRAM/RAM' : 'VRAM Usage'}
        </span>
        <span className="font-mono text-[#8E919A]">{used} / {total} GB</span>
      </div>
      <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
        {showSplit ? (
          <>
            <div
              className="absolute top-0 left-0 h-full bg-[#84E1BC] rounded-l-full"
              style={{
                width: mounted ? `${gpuPct}%` : '0%',
                transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
              }}
            />
            <div
              className="absolute top-0 h-full bg-amber-500/60"
              style={{
                left: `${gpuPct}%`,
                width: mounted ? `${ramPct}%` : '0%',
                transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1) 0.05s',
              }}
            />
          </>
        ) : (
          <div
            className={`h-full ${singleColor} rounded-full`}
            style={{
              width: mounted ? `${solidPct}%` : '0%',
              transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function ResultCard({ result, hw, rank, onSelect, isSelected, geminiEnabled }) {
  const {
    model, quant, tier, tokPerSec, vramRequired, vramFree,
    ramRequired, downloadSizeGB, cpuOffloadNeeded, cpuOnly,
    weightsGB, kvCacheGB,
  } = result;

  // Compute exact gpuOnlyVram and totalMemPool
  let gpuOnlyVram = 0;
  let totalMemPool = 0;

  if (hw) {
    if (hw.unifiedMem) {
      const usable = hw.maxRam ? Math.min(hw.ram, hw.maxRam) : hw.ram;
      gpuOnlyVram = usable <= 8 ? usable * 0.66 : usable * 0.75;
      totalMemPool = usable;
    } else if (!hw.vram || hw.vram === 0) {
      gpuOnlyVram = 0;
      totalMemPool = hw.ram;
    } else {
      gpuOnlyVram = (hw.vram || 0) * (hw.numGPUs || 1);
      totalMemPool = gpuOnlyVram + hw.ram;
    }
  } else {
    gpuOnlyVram = result.cpuOnly ? 0 : (vramRequired + (vramFree > 0 ? vramFree : 0));
    totalMemPool = gpuOnlyVram;
  }

  const effectiveVram = (cpuOffloadNeeded || cpuOnly) ? totalMemPool : gpuOnlyVram;
  const qi = QUANT_INFO[quant];

  const animatedTok = useCountUp(tokPerSec || 0);
  const speedInfo   = tokSpeedLabel(tokPerSec || 0);

  return (
    <div
      className={`card p-5 flex flex-col gap-3 overflow-hidden transition-all duration-200
        ${geminiEnabled ? 'cursor-pointer' : ''}
        ${isSelected && geminiEnabled ? TIER_BORDER_SELECTED[tier] : TIER_BORDER[tier]}`}
      style={{ '--tw-shadow': '0 4px 20px rgba(0,0,0,0.45)' }}
      onClick={geminiEnabled ? () => onSelect?.(result.model) : undefined}
    >

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {rank && (
            <span
              title="Ranked by VRAM headroom + speed score"
              className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 text-[#8E919A] text-[10px] font-mono font-bold border border-white/5 cursor-help"
            >
              {rank}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[tier]} shrink-0`} />
              <div className="font-semibold text-zinc-100 text-sm leading-snug truncate">{model.name}</div>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Quant badge */}
              <span className="font-mono text-xs text-[#84E1BC] bg-[#84E1BC]/5 border border-[#84E1BC]/10 px-1.5 py-0.5 rounded">
                {quant}
              </span>
              {qi && <Stars count={qi.stars} />}
              {qi && <span className="text-[11px] text-[#8E919A]">{qi.label}</span>}
            </div>
            <div className="text-[11px] text-zinc-600 mt-0.5 font-mono">
              {model.params}B params
              {model.maxCtx && (
                <span className="ml-2 text-zinc-700">
                  · {model.maxCtx >= 131072 ? '128k' : model.maxCtx >= 32768 ? '32k' : model.maxCtx >= 8192 ? '8k' : '4k'} ctx
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quality + verified */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {isSelected && geminiEnabled && (
            <span className="chip bg-amber-500/5 text-amber-300 border border-amber-500/10 text-[10px] font-mono">
              ⚡ AI insights
            </span>
          )}
          <span className={`chip border text-[11px] ${QUALITY_COLORS[model.quality] || QUALITY_COLORS.good}`}>
            {model.quality}
          </span>
          {model.verified
            ? <span className="flex items-center gap-1 text-[11px] text-[#84E1BC]/80"><CheckCircle size={9} />verified</span>
            : <span className="flex items-center gap-1 text-[11px] text-amber-500/60"><AlertCircle size={9} />unverified</span>}
        </div>
      </div>

      {/* ── Quant note ── */}
      {qi && (
        <p className="text-[11px] text-[#8E919A] bg-black/20 rounded-lg px-3 py-1.5 border border-white/5 leading-relaxed">
          {qi.note}
        </p>
      )}

      {/* ── VRAM bar ── */}
      <VRAMBar
        used={vramRequired}
        total={effectiveVram}
        cpuOnly={cpuOnly}
        cpuOffloadNeeded={cpuOffloadNeeded}
        gpuOnlyVram={gpuOnlyVram}
      />
      <div className="flex gap-2 text-[11px] text-zinc-600 font-mono -mt-1 overflow-hidden">
        <span className="whitespace-nowrap">Weights {weightsGB} GB</span>
        <span>·</span>
        <span className="whitespace-nowrap">KV {kvCacheGB} GB</span>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* tok/s with count-up + speed label */}
        <div className="bg-[#15151A] rounded-lg p-3 text-center border border-white/5 h-[58px] flex flex-col justify-center">
          <div className="text-[#84E1BC] font-semibold font-mono text-sm leading-none whitespace-nowrap">{animatedTok}</div>
          <div className={`text-[9px] mt-1 uppercase tracking-wider ${speedInfo.color}`}>{speedInfo.label}</div>
        </div>
        <div className="bg-[#15151A] rounded-lg p-3 text-center border border-white/5 h-[58px] flex flex-col justify-center">
          <div className="text-[#F3F3F5] font-semibold font-mono text-sm leading-none whitespace-nowrap">{ramRequired} GB</div>
          <div className="text-[10px] text-zinc-600 mt-1 uppercase tracking-wider">min RAM</div>
        </div>
        <div className="bg-[#15151A] rounded-lg p-3 text-center border border-white/5 h-[58px] flex flex-col justify-center">
          <div className="text-[#F3F3F5] font-semibold font-mono text-sm leading-none whitespace-nowrap">{downloadSizeGB} GB</div>
          <div className="text-[10px] text-zinc-600 mt-1 uppercase tracking-wider">download</div>
        </div>
      </div>

      {/* ── Warnings ── */}
      {cpuOnly ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
          <AlertTriangle size={11} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-300">CPU-only inference — expect 2–8 tok/s</span>
        </div>
      ) : cpuOffloadNeeded ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
          <AlertTriangle size={11} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-300">Needs CPU offload — VRAM too small, slower</span>
        </div>
      ) : <div />}

      {/* ── Use cases ── */}
      <div className="flex flex-wrap gap-1.5 flex-1">
        {model.useCases?.map(uc => (
          <span key={uc} className="chip bg-black/20 text-[#8E919A] border border-white/5 text-[11px] self-start">
            {USE_CASE_ICONS[uc] || '·'} {uc}
          </span>
        ))}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5 mt-auto">
        {model.ollamaTag && <CopyButton text={`ollama run ${model.ollamaTag}`} />}
        {model.ollamaTag && (
          <a
            href={`https://ollama.com/library/${model.ollamaTag.split(':')[0]}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15151A] border border-white/5 hover:border-white/20 rounded-lg text-xs text-[#8E919A] hover:text-[#F3F3F5] transition-colors whitespace-nowrap"
          >
            <ExternalLink size={11} aria-hidden="true" /> Ollama
          </a>
        )}
        {model.hfRepo && (
          <a
            href={`https://huggingface.co/${model.hfRepo}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15151A] border border-white/5 hover:border-white/20 rounded-lg text-xs text-[#8E919A] hover:text-[#F3F3F5] transition-colors whitespace-nowrap"
          >
            <ExternalLink size={11} aria-hidden="true" /> HuggingFace
          </a>
        )}
        {model.hfRepo && (
          <a
            href={`https://huggingface.co/${model.hfRepo}/tree/main`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15151A] border border-white/5 hover:border-white/20 rounded-lg text-xs text-[#8E919A] hover:text-[#F3F3F5] transition-colors whitespace-nowrap"
          >
            <ExternalLink size={11} aria-hidden="true" /> Download GGUF
          </a>
        )}
      </div>
    </div>
  );
}
