'use client';
import { useState } from 'react';
import { Copy, Check, ExternalLink, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

const QUALITY_COLORS = {
  good:      'text-slate-400  bg-slate-800/60  border-slate-700/50',
  great:     'text-sky-400    bg-sky-900/40    border-sky-800/50',
  excellent: 'text-purple-400 bg-purple-900/40 border-purple-800/50',
};

const USE_CASE_ICONS = {
  chat: '💬', code: '💻', reasoning: '🧠',
  'long-docs': '📄', multilingual: '🌍', vision: '👁️',
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

const TIER_LEFT = {
  recommended: 'border-l-emerald-500',
  comfortable: 'border-l-sky-500',
  stretch:     'border-l-amber-500',
};

function Stars({ count }) {
  return (
    <span className="font-mono text-[11px] tracking-tight">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < count ? 'text-amber-400' : 'text-[#2A3E55]'}>★</span>
      ))}
    </span>
  );
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
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#070B14] border border-[#1B2A40] hover:border-sky-700/60 rounded-lg text-xs text-[#7A94B0] hover:text-sky-400 transition-all font-mono min-w-0"
    >
      {copied
        ? <Check size={11} className="text-emerald-400 shrink-0" />
        : <Copy size={11} className="shrink-0" />}
      <span className="truncate max-w-[140px]">{copied ? 'Copied!' : text}</span>
    </button>
  );
}

function VRAMBar({ used, total, cpuOnly }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = pct > 92 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-sky-500';
  const glowColor = pct > 92 ? 'rgba(239,68,68,0.3)' : pct > 75 ? 'rgba(245,158,11,0.3)' : 'rgba(14,165,233,0.3)';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#4A6280] uppercase tracking-wider text-[10px] font-semibold">
          {cpuOnly ? 'RAM Usage' : 'VRAM Usage'}
        </span>
        <span className="font-mono text-[#8096B2]">{used} / {total} GB</span>
      </div>
      <div className="h-2 bg-[#0A1220] rounded-full overflow-hidden border border-[#141F30]">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%`, boxShadow: `0 0 6px ${glowColor}` }}
        />
      </div>
    </div>
  );
}

export default function ResultCard({ result, hwVram, rank, onSelect, isSelected, geminiEnabled }) {
  const {
    model, quant, tier, tokPerSec, vramRequired, vramFree,
    ramRequired, downloadSizeGB, cpuOffloadNeeded, cpuOnly,
    weightsGB, kvCacheGB,
  } = result;

  const effectiveVram = hwVram || (vramRequired + (vramFree > 0 ? vramFree : 0));
  const qi = QUANT_INFO[quant];
  const tierBorder = TIER_LEFT[tier] || 'border-l-slate-600';

  return (
    <div
      className={`card border-l-[3px] ${tierBorder} p-5 flex flex-col gap-3 transition-all duration-200 cursor-pointer
        ${isSelected && geminiEnabled ? 'ring-1 ring-yellow-500/40 border-t-[#263D5C]' : 'hover:border-t-[#263D5C]'}`}
      style={{ '--tw-shadow': '0 4px 20px rgba(0,0,0,0.45)' }}
      onClick={() => onSelect?.(result.model)}
    >

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {rank && (
            <span className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-[#0A1220] text-[#3D5270] text-[10px] font-mono font-bold border border-[#141F30]">
              {rank}
            </span>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-[#E4ECF7] text-sm leading-snug truncate">{model.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Quant badge */}
              <span className="font-mono text-xs text-sky-400 bg-sky-950/40 border border-sky-900/30 px-1.5 py-0.5 rounded-md">
                {quant}
              </span>
              {qi && <Stars count={qi.stars} />}
              {qi && <span className="text-[11px] text-[#4A6280]">{qi.label}</span>}
            </div>
            <div className="text-[11px] text-[#3D5270] mt-0.5 font-mono">
              {model.params}B params
              {model.maxCtx && (
                <span className="ml-2 text-[#2A3E57]">
                  · {model.maxCtx >= 131072 ? '128k' : model.maxCtx >= 32768 ? '32k' : model.maxCtx >= 8192 ? '8k' : '4k'} ctx
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quality + verified */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {isSelected && geminiEnabled && (
            <span className="chip bg-yellow-950/30 text-yellow-500/80 border border-yellow-900/30 text-[10px] font-mono">
              ⚡ AI insights
            </span>
          )}
          <span className={`chip border text-[11px] ${QUALITY_COLORS[model.quality] || QUALITY_COLORS.good}`}>
            {model.quality}
          </span>
          {model.verified
            ? <span className="flex items-center gap-1 text-[11px] text-emerald-500/80"><CheckCircle size={9} />verified</span>
            : <span className="flex items-center gap-1 text-[11px] text-amber-500/60"><AlertCircle size={9} />unverified</span>}
        </div>
      </div>

      {/* ── Quant note ── */}
      {qi && (
        <p className="text-[11px] text-[#3D5270] bg-[#080C1A] rounded-lg px-3 py-1.5 border border-[#141F30] leading-relaxed">
          {qi.note}
        </p>
      )}

      {/* ── VRAM bar ── */}
      <VRAMBar used={vramRequired} total={effectiveVram} cpuOnly={cpuOnly} />
      <div className="flex gap-2 text-[11px] text-[#3D5270] font-mono -mt-1 overflow-hidden">
        <span className="whitespace-nowrap">Weights {weightsGB} GB</span>
        <span>·</span>
        <span className="whitespace-nowrap">KV {kvCacheGB} GB</span>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* tok/s — each box fixed height so all cards align */}
        <div className="bg-[#080C1A] rounded-xl p-3 text-center border border-[#141F30] h-[58px] flex flex-col justify-center">
          <div className="text-sky-400 font-bold font-mono text-sm leading-none whitespace-nowrap">{tokPerSec}</div>
          <div className="text-[10px] text-[#3D5270] mt-1 uppercase tracking-wider">tok/s</div>
        </div>
        <div className="bg-[#080C1A] rounded-xl p-3 text-center border border-[#141F30] h-[58px] flex flex-col justify-center">
          <div className="text-[#C8D8EA] font-bold font-mono text-sm leading-none whitespace-nowrap">{ramRequired} GB</div>
          <div className="text-[10px] text-[#3D5270] mt-1 uppercase tracking-wider">min RAM</div>
        </div>
        <div className="bg-[#080C1A] rounded-xl p-3 text-center border border-[#141F30] h-[58px] flex flex-col justify-center">
          <div className="text-[#C8D8EA] font-bold font-mono text-sm leading-none whitespace-nowrap">{downloadSizeGB} GB</div>
          <div className="text-[10px] text-[#3D5270] mt-1 uppercase tracking-wider">download</div>
        </div>
      </div>

      {/* ── Warnings — fixed min-height so cards without warnings stay aligned ── */}
      {cpuOnly ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/20 border border-amber-800/30 rounded-lg">
          <AlertTriangle size={11} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-300/80">CPU-only inference — expect 2–8 tok/s</span>
        </div>
      ) : cpuOffloadNeeded ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/20 border border-amber-800/30 rounded-lg">
          <AlertTriangle size={11} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-300/80">Needs CPU offload — VRAM too small, slower</span>
        </div>
      ) : <div />}

      {/* ── Use cases — flex-1 pushes actions to bottom ── */}
      <div className="flex flex-wrap gap-1.5 flex-1">
        {model.useCases?.map(uc => (
          <span key={uc} className="chip bg-[#0A1220] text-[#4A6280] border border-[#141F30] text-[11px] self-start">
            {USE_CASE_ICONS[uc] || '·'} {uc}
          </span>
        ))}
      </div>

      {/* ── Actions — mt-auto pins to bottom of every card ── */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#131E2F] mt-auto">
        {model.ollamaTag && <CopyButton text={`ollama run ${model.ollamaTag}`} />}
        {model.ollamaTag && (
          <a
            href={`https://ollama.com/library/${model.ollamaTag.split(':')[0]}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#070B14] border border-[#1B2A40] hover:border-sky-700/60 rounded-lg text-xs text-[#7A94B0] hover:text-sky-400 transition-all whitespace-nowrap"
          >
            <ExternalLink size={11} /> Ollama
          </a>
        )}
        {model.hfRepo && (
          <a
            href={`https://huggingface.co/${model.hfRepo}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#070B14] border border-[#1B2A40] hover:border-sky-700/60 rounded-lg text-xs text-[#7A94B0] hover:text-sky-400 transition-all whitespace-nowrap"
          >
            <ExternalLink size={11} /> HuggingFace
          </a>
        )}
        {model.hfRepo && (
          <a
            href={`https://huggingface.co/${model.hfRepo}/tree/main`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#070B14] border border-emerald-900/40 hover:border-emerald-600/60 rounded-lg text-xs text-[#7A94B0] hover:text-emerald-400 transition-all whitespace-nowrap"
          >
            <ExternalLink size={11} /> Download GGUF
          </a>
        )}
      </div>
    </div>
  );
}
