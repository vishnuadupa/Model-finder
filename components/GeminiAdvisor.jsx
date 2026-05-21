'use client';
import { useEffect, useState, useRef } from 'react';
import { Zap, TrendingUp, TrendingDown, Loader2, AlertCircle } from 'lucide-react';

export default function GeminiAdvisor({ hw, currentModel, allModels, enabled }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const lastKeyRef  = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (!currentModel) return;
    if (!hw?.ram) return;
    if (!hw?.vram && !hw?.unifiedMem) return;

    // Build a key so we only re-fetch when inputs actually change
    // Compute neighbours client-side — don't send full allModels to the server
    const sorted      = [...allModels].sort((a, b) => a.params - b.params);
    const idx         = sorted.findIndex(m => m.name === currentModel.name);
    const modelUpName   = idx < sorted.length - 1 ? sorted[idx + 1].name : null;
    const modelDownName = idx > 0                  ? sorted[idx - 1].name : null;

    const key = JSON.stringify({
      gpu: hw.gpuLabel, vram: hw.vram, ram: hw.ram, bw: hw.bandwidth,
      ctx: hw.contextLength, fa: hw.flashAttn, os: hw.os,
      cpu: hw.cpuLabel, ramType: hw.ramTypeLabel, model: currentModel.name,
    });
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    setError(null);
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/gemini-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hw, currentModel, modelUpName, modelDownName }),
        });
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          const wait = data.retryAfter || 60;
          throw new Error(`rate_limited:${wait}`);
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || 'Request failed');
        }
        setResult(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [enabled, hw, currentModel, allModels]);

  if (!enabled || !currentModel) return null;

  return (
    <div className="card p-4 space-y-3 border-white/5 bg-[#15151A]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Zap size={14} className="text-amber-300 shrink-0" />
          <span className="text-sm font-semibold text-[#F3F3F5] shrink-0">AI Speed Advisor</span>
          <span className="chip bg-amber-500/5 text-amber-300 text-xs border border-amber-500/10 shrink-0">Gemini</span>
          <span className="text-xs text-[#8E919A] font-mono truncate hidden sm:block">· {currentModel.name}</span>
        </div>
        {loading
          ? <Loader2 size={13} className="text-slate-500 animate-spin shrink-0" />
          : <span className="text-[10px] text-[#8E919A] shrink-0 hidden sm:block">click card to switch</span>
        }
      </div>

      {error && (() => {
        const isRateLimit = error.startsWith('rate_limited:');
        const retryAfter  = isRateLimit ? error.split(':')[1] : null;
        return (
          <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
            isRateLimit
              ? 'text-amber-300 bg-amber-500/5 border border-amber-500/10'
              : 'text-red-300 bg-red-500/5 border border-red-500/10'
          }`}>
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>
              {isRateLimit
                ? `Gemini quota reached — retry in ~${retryAfter}s. Enable billing at ai.google.dev for higher limits.`
                : error.includes('GEMINI') || error.includes('API key')
                  ? 'Add GEMINI_API_KEY to env config'
                  : error}
            </span>
          </div>
        );
      })()}

      {loading && !result && (
        <div className="space-y-2 animate-pulse">
          <div className="h-14 bg-black/40 rounded border border-white/5" />
          <div className="h-14 bg-black/40 rounded border border-white/5" />
          <div className="h-14 bg-black/40 rounded border border-white/5" />
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {/* Current model */}
          <div className="flex items-center justify-between p-3 bg-black/20 rounded border border-white/5">
            <div>
              <div className="text-xs text-[#8E919A] mb-0.5">Your setup · {currentModel.name}</div>
              <div className="text-base font-mono font-bold text-[#84E1BC]">{result.tokPerSec} tok/s</div>
            </div>
            <div className="text-right text-xs text-[#8E919A] max-w-[55%] leading-relaxed">
              {result.tokPerSecNote}
            </div>
          </div>

          {/* Model UP */}
          {result.modelUp?.name && result.modelUp.name !== 'N/A' && (
            <div className={`p-3 rounded border ${
              result.modelUp.canRun
                ? 'border-white/5 bg-[#84E1BC]/5'
                : 'border-white/5 bg-black/20 opacity-50'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp size={11} className={result.modelUp.canRun ? 'text-[#84E1BC]' : 'text-[#8E919A]'} />
                <span className="text-xs text-[#8E919A]">Next model up</span>
                {!result.modelUp.canRun && (
                  <span className="chip bg-red-500/5 text-red-300 border border-red-500/10 text-xs">won&apos;t fit</span>
                )}
              </div>
              <div className="font-mono text-sm text-[#F3F3F5]">{result.modelUp.name}</div>
              <div className="text-xs text-[#8E919A] mt-0.5">
                {result.modelUp.canRun
                  ? `~${result.modelUp.tokPerSec} tok/s · ${result.modelUp.tradeoff}`
                  : result.modelUp.tradeoff}
              </div>
            </div>
          )}

          {/* Model DOWN */}
          {result.modelDown?.name && result.modelDown.name !== 'N/A' && (
            <div className="p-3 rounded border border-white/5 bg-black/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingDown size={11} className="text-amber-400/80" />
                <span className="text-xs text-[#8E919A]">Next model down (faster)</span>
              </div>
              <div className="font-mono text-sm text-[#F3F3F5]">{result.modelDown.name}</div>
              <div className="text-xs text-[#8E919A] mt-0.5">
                ~{result.modelDown.tokPerSec} tok/s · {result.modelDown.tradeoff}
              </div>
            </div>
          )}

          {result.cached && (
            <div className="text-xs text-zinc-600 text-right font-mono">cached · 1h TTL</div>
          )}
        </div>
      )}
    </div>
  );
}
