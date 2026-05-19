'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HardwareForm from '@/components/HardwareForm';
import ResultsPanel from '@/components/ResultsPanel';
import GeminiAdvisor from '@/components/GeminiAdvisor';
import { analyzeHardware } from '@/lib/scoring';
import { GPU_PRESETS } from '@/lib/gpuPresets';
import { Share2, BookOpen, Cpu, Settings, LayoutList } from 'lucide-react';

// Re-derive all GPU-preset-derived fields from a label — used on URL/localStorage load
// so fields like maxRam, bandwidth, flashAttn stay consistent with preset data
function gpuFieldsFromLabel(label) {
  if (!label) return {};
  const preset = GPU_PRESETS.find(g => g.label === label);
  if (!preset) return {};
  return {
    vram:       preset.vram,
    arch:       preset.arch || null,
    unifiedMem: !!preset.unified,
    flashAttn:  preset.flashAttn,
    bandwidth:  preset.bandwidth || 0,
    memType:    preset.memType || null,
    pcie:       preset.pcie || null,
    maxRam:     preset.maxRam || null,
  };
}

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
  maxRam:             null,
  cpuLabel:           '',
  cpuTier:            'mid',
  cpuCores:           null,
  cpuVendor:          null,
  cpuRamFactor:       0.7,   // CPU memory-controller efficiency (from CPU preset)
  ramBandwidthFactor: 0.65,  // RAM type speed factor (from RAM type preset) — separate from cpuRamFactor
  ramBandwidthGB:     51,
  ramTypeLabel:       '',
  contextLength:      4096,
  os:                 '',
  useCases:           [],
  speedPref:          'slow', // default: show all speeds; user opts in to filtering
  ssd:                'nvme',
  flashAttn:          false,
  gpuBuyUrl:          null,
};

function encodeToURL(hw) {
  if (typeof window === 'undefined') return '';
  const p = new URLSearchParams({
    gpu:   hw.gpuLabel || '',
    vram:  hw.vram,
    ram:   hw.ram,
    cpu:   hw.cpuLabel || '',
    ctier: hw.cpuTier || 'mid',
    ssd:   hw.ssd || 'nvme',
    ctx:   hw.contextLength || 4096,
    uni:   hw.unifiedMem ? '1' : '0',
    gpus:  hw.numGPUs || 1,
    fa:    hw.flashAttn ? '1' : '0',
    os:    hw.os || '',
    bw:    hw.bandwidth || 0,
    ramt:  hw.ramTypeLabel || '',
    rambw: hw.ramBandwidthGB || 51,
    rambf: hw.ramBandwidthFactor || 0.65,
    sp:    hw.speedPref || 'medium',
  });
  return `${window.location.origin}?${p}`;
}

function decodeFromURL() {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  if (!p.get('vram') && !p.get('gpu')) return null;
  const gpuLabel = p.get('gpu') || '';
  return {
    ...DEFAULT_HW,
    ...gpuFieldsFromLabel(gpuLabel), // re-derive vram/bandwidth/flashAttn/maxRam from preset
    gpuLabel,
    ram:                Number(p.get('ram') || 16),
    cpuLabel:           p.get('cpu') || '',
    cpuTier:            p.get('ctier') || 'mid',
    ssd:                p.get('ssd') || 'nvme',
    contextLength:      Number(p.get('ctx') || 4096),
    numGPUs:            Number(p.get('gpus') || 1),
    os:                 p.get('os') || '',
    ramTypeLabel:       p.get('ramt') || '',
    ramBandwidthGB:     Number(p.get('rambw') || 51),
    ramBandwidthFactor: Number(p.get('rambf') || 0.65),
    speedPref:          p.get('sp') || 'slow',
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
  const [mobileTab, setMobileTab] = useState('hardware'); // 'hardware' | 'results'
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
      if (saved) {
        const parsed = JSON.parse(saved);
        const ALLOWED_KEYS = Object.keys(DEFAULT_HW);
        const safe = Object.fromEntries(
          ALLOWED_KEYS.map(k => [k, parsed[k]]).filter(([, v]) => v !== undefined)
        );
        // Re-derive GPU preset fields so maxRam/bandwidth/flashAttn stay in sync with preset data
        const gpuDerived = gpuFieldsFromLabel(safe.gpuLabel || '');
        setHw({ ...DEFAULT_HW, ...safe, ...gpuDerived });
      }
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
    const hasCPUOnly = hw.gpuLabel === 'No GPU (CPU only)';
    if (!hw.ram || (!hw.vram && !hw.unifiedMem && !hasCPUOnly) || !models.length) {
      return { recommended: [], comfortable: [], stretch: [] };
    }
    return analyzeHardware(hw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
  }, [hw, models]);

  useEffect(() => {
    const first = results.recommended?.[0] || results.comfortable?.[0] || results.stretch?.[0];
    if (first) {
      setSelectedModel(first.model);
      setMobileTab('results'); // auto-switch to results on mobile when they appear
    }
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

  const hasHardware = hw.ram && (hw.vram > 0 || hw.unifiedMem || hw.gpuLabel === 'No GPU (CPU only)');

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

      {/* ── Mobile tab bar — only visible on small screens when hardware is selected ── */}
      {hasHardware && (
        <div className="lg:hidden sticky top-0 z-30 bg-[#080B12]/95 backdrop-blur border-b border-[#1E2D45]">
          <div className="flex">
            <button
              onClick={() => setMobileTab('hardware')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                mobileTab === 'hardware'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Settings size={14} /> Hardware
            </button>
            <button
              onClick={() => setMobileTab('results')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                mobileTab === 'results'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <LayoutList size={14} />
              Results
              {totalResults > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-sky-900 text-sky-300 font-mono">
                  {totalResults}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
            Which AI models can your <span className="text-sky-400">hardware</span> run?
          </h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Pick your GPU (or Apple Silicon chip), RAM, and what you want to do — we&apos;ll show you every model that fits, ranked by speed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* Left column — hardware form
              On mobile: hidden when results tab is active (and hardware is selected) */}
          <div className={`space-y-4 lg:block lg:sticky lg:top-6 lg:self-start ${
            hasHardware && mobileTab !== 'hardware' ? 'hidden' : ''
          }`}>
            <HardwareForm
              value={hw}
              onChange={v => { setHw(v); setMobileTab('hardware'); }}
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

            {geminiEnabled && hasHardware && totalResults > 0 && (
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

            {/* Mobile: nudge to results after form is filled */}
            {hasHardware && mobileTab === 'hardware' && totalResults > 0 && (
              <button
                onClick={() => setMobileTab('results')}
                className="lg:hidden w-full btn-primary flex items-center justify-center gap-2"
              >
                <LayoutList size={14} /> View {totalResults} results →
              </button>
            )}
          </div>

          {/* Right column — results
              On mobile: hidden when hardware tab is active (and hardware is selected) */}
          <div className={`lg:block ${hasHardware && mobileTab !== 'results' ? 'hidden' : ''}`}>
            {!hasHardware ? (
              <div className="card p-12 text-center space-y-4">
                <div className="text-4xl">🖥️</div>
                <div className="text-slate-400 font-semibold">Select your hardware to see results</div>
                <div className="text-slate-600 text-sm max-w-sm mx-auto space-y-3">
                  <p>Use the form above to pick your GPU (or Apple Silicon chip) and RAM.</p>
                  <div className="text-left inline-block space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-start gap-2"><span className="text-green-500 shrink-0">✓</span><span>Works for NVIDIA, AMD, Intel Arc, Apple Silicon, and CPU-only</span></div>
                    <div className="flex items-start gap-2"><span className="text-green-500 shrink-0">✓</span><span>Shows exactly how much VRAM / unified memory each model needs</span></div>
                    <div className="flex items-start gap-2"><span className="text-green-500 shrink-0">✓</span><span>Estimates tokens per second for your specific hardware</span></div>
                    <div className="flex items-start gap-2"><span className="text-green-500 shrink-0">✓</span><span>Explains what each quantization level means in plain English</span></div>
                  </div>
                </div>
              </div>
            ) : modelsLoading ? (
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
