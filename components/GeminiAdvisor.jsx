'use client';
import { useEffect, useState, useRef } from 'react';
import { Zap, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

export default function GeminiAdvisor({ hw, currentModel, allModels }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!hw?.vram && !hw?.unifiedMem) return;
    if (!hw?.ram) return;
    if (!currentModel) return;

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
        if (!res.ok) throw new Error(await res.text());
        setResult(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [hw, currentModel, allModels]);

  if (!currentModel) return null;

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-400">AI Speed Advisor</span>
          <span className="chip bg-yellow-950/30 text-yellow-600 text-xs">Gemini</span>
        </div>
        {loading && <Loader2 size={14} className="text-slate-500 animate-spin" />}
      </div>

      {/* Current model */}
      <div className="text-xs text-slate-500 font-mono">
        Analysing: <span className="text-slate-300">{currentModel.name}</span> on your rig
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 rounded-lg px-3 py-2">
          {error.includes('GEMINI') || error.includes('API') ? 'Gemini API key not configured' : error}
        </div>
      )}

      {loading && !result && (
        <div className="space-y-2 animate-pulse">
          <div className="h-12 bg-[#0F1623] rounded-lg" />
          <div className="h-12 bg-[#0F1623] rounded-lg" />
          <div className="h-12 bg-[#0F1623] rounded-lg" />
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {/* Current speed */}
          <div className="flex items-center justify-between p-3 bg-[#080B12] rounded-lg border border-[#1E2D45]">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Your setup</div>
              <div className="text-sm font-mono font-bold text-sky-300">{result.tokPerSec} tok/s</div>
            </div>
            <div className="text-right text-xs text-slate-600 max-w-[60%]">
              {result.tokPerSecNote}
            </div>
          </div>

          {/* Model UP */}
          {result.modelUp && result.modelUp.name !== 'N/A' && (
            <div className={`p-3 rounded-lg border ${
              result.modelUp.canRun
                ? 'border-green-800/60 bg-green-950/20'
                : 'border-slate-700 bg-[#080B12] opacity-60'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className={result.modelUp.canRun ? 'text-green-400' : 'text-slate-600'} />
                <span className="text-xs text-slate-500">Next model up</span>
                {!result.modelUp.canRun && (
                  <span className="chip bg-red-950/50 text-red-400 text-xs">won&apos;t fit</span>
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
          {result.modelDown && result.modelDown.name !== 'N/A' && (
            <div className="p-3 rounded-lg border border-amber-800/40 bg-amber-950/10">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown size={12} className="text-amber-400" />
                <span className="text-xs text-slate-500">Next model down</span>
              </div>
              <div className="font-mono text-sm text-white">{result.modelDown.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                ~{result.modelDown.tokPerSec} tok/s · {result.modelDown.tradeoff}
              </div>
            </div>
          )}

          {result.cached && (
            <div className="text-xs text-slate-700 text-right">cached response</div>
          )}
        </div>
      )}
    </div>
  );
}
