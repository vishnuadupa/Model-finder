'use client';
import { useState } from 'react';
import { Copy, Check, ExternalLink, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

const QUALITY_STYLE = {
  good:      'bg-slate-800 text-slate-300',
  great:     'bg-blue-900/50 text-blue-300',
  excellent: 'bg-purple-900/50 text-purple-300',
};

const USE_CASE_ICONS = {
  chat: '💬', code: '💻', reasoning: '🧠',
  'long-docs': '📄', multilingual: '🌍', vision: '👁️',
};

// What each quantization level means in plain English (for beginners)
const QUANT_INFO = {
  IQ2_XXS: { label: '2-bit extreme',  quality: '★☆☆☆', note: 'Smallest file, noticeably worse quality' },
  Q2_K:    { label: '2-bit',          quality: '★☆☆☆', note: 'Smallest file, lower quality — use only if VRAM limited' },
  Q3_K_M:  { label: '3-bit medium',   quality: '★★☆☆', note: 'Small file, acceptable quality for most tasks' },
  IQ4_XS:  { label: '4-bit small',    quality: '★★★☆', note: 'Good quality, slightly smaller than Q4_K_M' },
  Q4_K_S:  { label: '4-bit small',    quality: '★★★☆', note: 'Good quality, slightly smaller than Q4_K_M' },
  Q4_K_M:  { label: '4-bit (default)',quality: '★★★☆', note: 'Best balance of quality and VRAM — recommended for most' },
  Q4_0:    { label: '4-bit legacy',   quality: '★★★☆', note: 'Older 4-bit format, prefer Q4_K_M' },
  Q5_K_M:  { label: '5-bit medium',   quality: '★★★★', note: 'High quality, needs ~15% more VRAM than Q4_K_M' },
  Q5_K_S:  { label: '5-bit small',    quality: '★★★★', note: 'High quality, slightly smaller than Q5_K_M' },
  Q6_K:    { label: '6-bit',          quality: '★★★★', note: 'Very high quality, nearly indistinguishable from original' },
  Q8_0:    { label: '8-bit',          quality: '★★★★', note: 'Near-original quality, needs 2× VRAM vs Q4_K_M' },
  F16:     { label: '16-bit (full)',   quality: '★★★★', note: 'Full original quality, needs 4× VRAM vs Q4_K_M' },
  BF16:    { label: '16-bit BF (full)',quality: '★★★★', note: 'Full original quality (brain float format)' },
  F32:     { label: '32-bit (full)',   quality: '★★★★', note: 'Maximum precision, needs 8× VRAM vs Q4_K_M' },
};

function CopyButton({ text, label }) {
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
      className="flex items-center gap-1.5 px-3 py-2 bg-[#080B12] border border-[#1E2D45] hover:border-sky-700 rounded-lg text-xs text-slate-400 hover:text-sky-400 transition-colors font-mono min-w-0 max-w-full"
    >
      {copied ? <Check size={12} className="text-green-400 shrink-0" /> : <Copy size={12} className="shrink-0" />}
      <span className="truncate">{copied ? 'Copied!' : (label || text)}</span>
    </button>
  );
}

function VRAMBar({ used, total }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-sky-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 font-mono whitespace-nowrap">{used}/{total} GB</span>
    </div>
  );
}

export default function ResultCard({ result, hwVram, rank }) {
  const { model, quant, tier, tokPerSec, vramRequired, vramFree,
          ramRequired, downloadSizeGB, cpuOffloadNeeded, cpuOnly, weightsGB, kvCacheGB } = result;

  const tierAccent = tier === 'recommended' ? 'border-l-green-500'
                   : tier === 'comfortable' ? 'border-l-sky-500'
                   : 'border-l-amber-500';

  const effectiveVram = hwVram || (vramRequired + (vramFree > 0 ? vramFree : 0));

  return (
    <div className={`card border-l-2 ${tierAccent} p-4 space-y-3 hover:border-opacity-100 transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {rank && (
            <span className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-slate-800 text-slate-500 text-xs font-mono font-bold">
              {rank}
            </span>
          )}
          <div>
            <div className="font-semibold text-white text-sm leading-tight">
              {model.name}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="font-mono text-xs text-sky-400 bg-sky-950/40 border border-sky-900/40 px-1.5 py-0.5 rounded">{quant}</span>
              {QUANT_INFO[quant] && (
                <span className="text-xs text-slate-500" title={QUANT_INFO[quant].note}>
                  {QUANT_INFO[quant].quality} {QUANT_INFO[quant].label}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {model.params}B params
              {model.maxCtx && <span className="ml-2">· max {model.maxCtx >= 131072 ? '128k' : model.maxCtx >= 32768 ? '32k' : model.maxCtx >= 8192 ? '8k' : '4k'} ctx</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`chip ${QUALITY_STYLE[model.quality] || QUALITY_STYLE.good}`}>
            {model.quality}
          </span>
          {model.verified ? (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle size={10} /> verified
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <AlertCircle size={10} /> unverified
            </span>
          )}
        </div>
      </div>

      {/* Quant explanation for beginners */}
      {QUANT_INFO[quant] && (
        <div className="text-xs text-slate-600 bg-slate-900/40 rounded px-2 py-1 border border-slate-800/50">
          {QUANT_INFO[quant].note}
        </div>
      )}

      {/* VRAM / RAM bar */}
      <div>
        <div className="label">{cpuOnly ? 'RAM Usage' : 'VRAM Usage'}</div>
        <VRAMBar used={vramRequired} total={effectiveVram} />
        <div className="flex gap-3 mt-1 text-xs text-slate-600 font-mono">
          <span>Weights: {weightsGB} GB</span>
          <span>KV Cache: {kvCacheGB} GB</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#080B12] rounded-lg p-2">
          <div className="text-sky-300 font-bold font-mono text-sm">{tokPerSec}</div>
          <div className="text-xs text-slate-600">tok/s</div>
        </div>
        <div className="bg-[#080B12] rounded-lg p-2">
          <div className="text-slate-300 font-bold font-mono text-sm">{ramRequired} GB</div>
          <div className="text-xs text-slate-600">min RAM</div>
        </div>
        <div className="bg-[#080B12] rounded-lg p-2">
          <div className="text-slate-300 font-bold font-mono text-sm">{downloadSizeGB} GB</div>
          <div className="text-xs text-slate-600">download</div>
        </div>
      </div>

      {/* CPU offload / CPU-only warning */}
      {cpuOnly ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/30 border border-amber-800/50 rounded-lg">
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">CPU-only inference — expect 2–8 tok/s</span>
        </div>
      ) : cpuOffloadNeeded ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/30 border border-amber-800/50 rounded-lg">
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">Needs CPU offload — VRAM too small, slower inference</span>
        </div>
      ) : null}

      {/* Use case chips */}
      {model.useCases?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.useCases.map(uc => (
            <span key={uc} className="chip bg-slate-800/50 text-slate-400 text-xs">
              {USE_CASE_ICONS[uc] || '·'} {uc}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#1E2D45]">
        {model.ollamaTag && (
          <CopyButton
            text={`ollama run ${model.ollamaTag}`}
            label={`ollama run ${model.ollamaTag}`}
          />
        )}
        {model.ollamaTag && (
          <a
            href={`https://ollama.com/library/${model.ollamaTag.split(':')[0]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#080B12] border border-[#1E2D45] hover:border-sky-700 rounded-lg text-xs text-slate-400 hover:text-sky-400 transition-colors whitespace-nowrap"
          >
            <ExternalLink size={12} /> Ollama
          </a>
        )}
        {model.hfRepo && (
          <a
            href={`https://huggingface.co/${model.hfRepo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#080B12] border border-[#1E2D45] hover:border-sky-700 rounded-lg text-xs text-slate-400 hover:text-sky-400 transition-colors whitespace-nowrap"
          >
            <ExternalLink size={12} /> HuggingFace
          </a>
        )}
        {model.hfRepo && (
          <a
            href={`https://huggingface.co/${model.hfRepo}/tree/main`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#080B12] border border-emerald-900/50 hover:border-emerald-600 rounded-lg text-xs text-slate-400 hover:text-emerald-400 transition-colors whitespace-nowrap"
          >
            <ExternalLink size={12} /> Download GGUF
          </a>
        )}
      </div>
    </div>
  );
}
