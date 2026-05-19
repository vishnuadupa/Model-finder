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
          body: JSON.stringify({ hw, currentModel, allModels }),
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
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [enabled, hw, currentModel]);

  if (!enabled || !currentModel) return null;

  return (
    <div className="card p-4 space-y-3 border-yellow-900/40">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-400">AI Speed Advisor</span>
          <span className="chip bg-yellow-950/40 text-yellow-600 text-xs border border-yellow-900/40">Gemini</span>
        </div>
        {loading && <Loader2 size={13} className="text-slate-500 animate-spin" />}
      </div>

      <div className="text-xs text-slate-600 font-mono">
        {hw.gpuLabel} · {hw.bandwidth > 0 ? `${hw.bandwidth} GB/s · ` : ''}{currentModel.name}
      </div>

      {error && (() => {
        const isRateLimit = error.startsWith('rate_limited:');
        const retryAfter  = isRateLimit ? error.split(':')[1] : null;
        return (
          <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
            isRateLimit
              ? 'text-amber-400 bg-amber-950/20 border border-amber-900/40'
              : 'text-red-400 bg-red-950/20 border border-red-900/40'
          }`}>
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>
              {isRateLimit
                ? `Gemini quota reached — retry in ~${retryAfter}s. Enable billing at ai.google.dev for higher limits.`
                : error.includes('GEMINI') || error.includes('API key')
                  ? 'Add GEMINI_API_KEY to Vercel env vars'
                  : error}
            </span>
          </div>
        );
      })()}

      {loading && !result && (
        <div className="space-y-2 animate-pulse">
          <div className="h-14 bg-[#080B12] rounded-lg" />
          <div className="h-14 bg-[#080B12] rounded-lg" />
          <div className="h-14 bg-[#080B12] rounded-lg" />
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {/* Current model */}
          <div className="flex items-center justify-between p-3 bg-[#080B12] rounded-lg border border-[#1E2D45]">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Your setup · {currentModel.name}</div>
              <div className="text-base font-mono font-bold text-sky-300">{result.tokPerSec} tok/s</div>
            </div>
            <div className="text-right text-xs text-slate-600 max-w-[55%] leading-relaxed">
              {result.tokPerSecNote}
            </div>
          </div>

          {/* Model UP */}
          {result.modelUp?.name && result.modelUp.name !== 'N/A' && (
            <div className={`p-3 rounded-lg border ${
              result.modelUp.canRun
                ? 'border-green-800/50 bg-green-950/15'
                : 'border-slate-700/50 bg-[#080B12] opacity-55'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp size={11} className={result.modelUp.canRun ? 'text-green-400' : 'text-slate-600'} />
                <span className="text-xs text-slate-500">Next model up</span>
                {!result.modelUp.canRun && (
                  <span className="chip bg-red-950/50 text-red-400 border border-red-900/40 text-xs">won&apos;t fit</span>
                )}
              </div>
              <div className="font-mono text-sm text-white">{result.modelUp.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {result.modelUp.canRun
                  ? `~${result.modelUp.tokPerSec} tok/s · ${result.modelUp.tradeoff}`
                  : result.modelUp.tradeoff}
              </div>
            </div>
          )}

          {/* Model DOWN */}
          {result.modelDown?.name && result.modelDown.name !== 'N/A' && (
            <div className="p-3 rounded-lg border border-amber-800/40 bg-amber-950/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingDown size={11} className="text-amber-400" />
                <span className="text-xs text-slate-500">Next model down (faster)</span>
              </div>
              <div className="font-mono text-sm text-white">{result.modelDown.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                ~{result.modelDown.tokPerSec} tok/s · {result.modelDown.tradeoff}
              </div>
            </div>
          )}

          {result.cached && (
            <div className="text-xs text-slate-700 text-right font-mono">cached · 1h TTL</div>
          )}
        </div>
      )}
    </div>
  );
}
