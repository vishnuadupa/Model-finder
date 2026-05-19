'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HardwareForm from '@/components/HardwareForm';
import ResultsPanel from '@/components/ResultsPanel';
import GeminiAdvisor from '@/components/GeminiAdvisor';
import { analyzeHardware } from '@/lib/scoring';
import { Share2, BookOpen, Cpu } from 'lucide-react';

const DEFAULT_HW = {
  gpuLabel:           '',
  vram:               0,
  unifiedMem:         false,
  ram:                16,
  numGPUs:            1,
  bandwidth:          0,
  memType:            null,
  arch:               null,
  pcie:               null,
  cpuLabel:           '',
  cpuTier:            'mid',
  cpuCores:           null,
  cpuVendor:          null,
  ramBandwidthFactor: 0.65,
  ramBandwidthGB:     51,
  ramTypeLabel:       '',
  contextLength:      4096,
  os:                 '',
  useCases:           [],
  speedPref:          'medium',
  ssd:                'nvme',
  flashAttn:          false,
  gpuBuyUrl:          null,
};

function encodeToURL(hw) {
  if (typeof window === 'undefined') return '';
  const p = new URLSearchParams({
    gpu:  hw.gpuLabel || '',
    vram: hw.vram,
    ram:  hw.ram,
    cpu:  hw.cpuLabel || hw.cpuTier || 'mid',
    ssd:  hw.ssd || 'nvme',
    ctx:  hw.contextLength || 4096,
    uni:  hw.unifiedMem ? '1' : '0',
    gpus: hw.numGPUs || 1,
    fa:   hw.flashAttn ? '1' : '0',
    os:   hw.os || '',
    bw:   hw.bandwidth || 0,
  });
  return `${window.location.origin}?${p}`;
}

function decodeFromURL() {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  if (!p.get('vram') && !p.get('gpu')) return null;
  return {
    ...DEFAULT_HW,
    gpuLabel:      p.get('gpu') || '',
    vram:          Number(p.get('vram') || 0),
    ram:           Number(p.get('ram') || 16),
    cpuLabel:      p.get('cpu') || '',
    cpuTier:       'mid',
    ssd:           p.get('ssd') || 'nvme',
    contextLength: Number(p.get('ctx') || 4096),
    unifiedMem:    p.get('uni') === '1',
    numGPUs:       Number(p.get('gpus') || 1),
    flashAttn:     p.get('fa') === '1',
    os:            p.get('os') || '',
    bandwidth:     Number(p.get('bw') || 0),
  };
}

export default function Home() {
  const [hw, setHw] = useState(DEFAULT_HW);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const lsDebounce = useRef(null);

  useEffect(() => {
    fetch('/models.json')
      .then(r => r.json())
      .then(data => { setModels(data); setModelsLoading(false); })
      .catch(() => setModelsLoading(false));
  }, []);

  useEffect(() => {
    const fromURL = decodeFromURL();
    if (fromURL) { setHw(fromURL); return; }
    try {
      const saved = localStorage.getItem('llm_matcher_hw_v2');
      if (saved) setHw({ ...DEFAULT_HW, ...JSON.parse(saved) });
    } catch {}
  }, []);

  // Debounce localStorage writes — don't hammer storage on every keystroke
  useEffect(() => {
    clearTimeout(lsDebounce.current);
    lsDebounce.current = setTimeout(() => {
      try { localStorage.setItem('llm_matcher_hw_v2', JSON.stringify(hw)); } catch {}
    }, 400);
    return () => clearTimeout(lsDebounce.current);
  }, [hw]);

  const results = useMemo(() => {
    if (!hw.ram || (!hw.vram && !hw.unifiedMem) || !models.length) {
      return { recommended: [], comfortable: [], stretch: [] };
    }
    return analyzeHardware(hw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
  }, [hw, models]);

  useEffect(() => {
    const first = results.recommended?.[0] || results.comfortable?.[0] || results.stretch?.[0];
    if (first) setSelectedModel(first.model);
  }, [results]);

  const shareURL = useCallback(() => {
    navigator.clipboard.writeText(encodeToURL(hw));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [hw]);

  async function fetchSummary() {
    const topModels = [...(results.recommended || []), ...(results.comfortable || [])].slice(0, 5);
    if (!topModels.length) return;
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hw, topModels, useCase: hw.useCases?.[0] }),
      });
      const data = await res.json();
      setSummary(data.summary || data.error);
    } finally {
      setSummaryLoading(false);
    }
  }

  const totalResults = (results.recommended?.length || 0)
    + (results.comfortable?.length || 0)
    + (results.stretch?.length || 0);

  const hasHardware = hw.ram && (hw.vram > 0 || hw.unifiedMem);

  return (
    <div className="min-h-screen bg-[#080B12]">
      <header className="border-b border-[#1E2D45] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-sky-500 rounded flex items-center justify-center">
              <Cpu size={14} className="text-white" />
            </div>
            <span className="font-bold text-white" style={{ fontFamily: 'var(--font-syne)' }}>
              Local LLM Matcher
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/gpu/rtx-4090-24gb" className="btn-ghost text-xs hidden sm:flex items-center gap-1.5">
              <BookOpen size={12} /> GPU Index
            </a>
            {hasHardware && (
              <button onClick={shareURL} className="btn-ghost text-xs flex items-center gap-1.5">
                <Share2 size={12} /> {copied ? 'Copied!' : 'Share Rig'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
            Which LLMs can your <span className="text-sky-400">GPU</span> run?
          </h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Enter your full hardware config. Scores use memory bandwidth, OS backend, RAM type, and CPU offload capacity for accurate results.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* Left column */}
          <div className="space-y-4 lg:sticky lg:top-6">
            <HardwareForm
              value={hw}
              onChange={setHw}
              geminiEnabled={geminiEnabled}
              onGeminiToggle={() => setGeminiEnabled(e => !e)}
            />

            {geminiEnabled && hasHardware && (
              <GeminiAdvisor
                hw={hw}
                currentModel={selectedModel}
                allModels={models}
                enabled={geminiEnabled}
              />
            )}

            {hasHardware && totalResults > 0 && (
              <div className="card p-4 space-y-3">
                <button
                  onClick={fetchSummary}
                  disabled={summaryLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {summaryLoading ? 'Generating...' : '✨ Gemini AI Summary'}
                </button>
                {summary && (
                  <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            {modelsLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="card p-4 space-y-3">
                    <div className="h-4 bg-slate-800 rounded w-1/3" />
                    <div className="grid grid-cols-3 gap-3">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="h-20 bg-slate-800 rounded-lg" />
                      ))}
                    </div>
                    <div className="h-3 bg-slate-800 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : !hasHardware ? (
              <div className="card p-12 text-center space-y-4">
                <div className="text-4xl">🖥️</div>
                <div className="text-slate-400 font-semibold">Select your GPU and RAM to see results</div>
                <div className="text-slate-600 text-sm max-w-sm mx-auto">
                  Scoring uses GPU memory bandwidth, OS backend efficiency, RAM type, and CPU offload capacity — not just VRAM size.
                </div>
              </div>
            ) : (
              <ResultsPanel results={results} hw={hw} />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1E2D45] mt-16 px-6 py-8 text-center text-xs text-slate-700">
        <div className="max-w-7xl mx-auto space-y-1">
          <div>Speed estimates based on memory bandwidth formula (tok/s ≈ bandwidth / model_size × backend_efficiency). Actual performance varies.</div>
          <div>Affiliate links help keep this free.</div>
        </div>
      </footer>
    </div>
  );
}
