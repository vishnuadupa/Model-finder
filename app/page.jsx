'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HardwareBar   from '@/components/HardwareBar';
import ResultsPanel  from '@/components/ResultsPanel';
import GeminiAdvisor from '@/components/GeminiAdvisor';
import { analyzeHardware } from '@/lib/scoring';
import { GPU_PRESETS }      from '@/lib/gpuPresets';
import { Share2, Cpu, X } from 'lucide-react';
import AutoDetectModal from '@/components/AutoDetectModal';

/* ── GPU preset field re-derivation (used on URL/localStorage load) ── */
function gpuFieldsFromLabel(label) {
  if (!label) return {};

  // 1. Exact match
  let preset = GPU_PRESETS.find(g => g.label === label);

  // 2. Fuzzy match — scripts (WMI / nvidia-smi) return vendor-prefixed names
  //    e.g. "NVIDIA GeForce RTX 3080" → strip prefix → "RTX 3080" → matches "RTX 3080 10GB"
  //         "AMD Radeon RX 6700 XT"   → strip prefix → "RX 6700 XT" → matches "RX 6700 XT 12GB"
  //         "Apple M2 Pro"            → matches "Apple M2 Pro 12c"
  if (!preset) {
    const cleaned = label
      .replace(/^NVIDIA\s+GeForce\s+/i, '')
      .replace(/^AMD\s+Radeon\s+/i, '')
      .replace(/^Intel\s+Arc\s+/i, 'Arc ')
      .replace(/^Intel\s+/i, '')
      .trim();
    preset = GPU_PRESETS.find(g => g.label.startsWith(cleaned));
  }

  if (!preset) return {};
  return {
    gpuLabel:   preset.label,   // normalise to our canonical label
    vram:       preset.vram,
    arch:       preset.arch   || null,
    unifiedMem: !!preset.unified,
    flashAttn:  preset.flashAttn,
    bandwidth:  preset.bandwidth || 0,
    memType:    preset.memType   || null,
    pcie:       preset.pcie      || null,
    maxRam:     preset.maxRam    || null,
  };
}

const DEFAULT_HW = {
  gpuLabel:           '',
  vram:               0,
  unifiedMem:         false,
  ram:                16,
  ramSet:             false,
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
  cpuRamFactor:       0.7,
  ramBandwidthFactor: 0.65,
  ramBandwidthGB:     51,
  ramTypeLabel:       '',
  contextLength:      4096,
  os:                 '',
  useCases:           [],
  speedPref:          'slow',
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
    sp:    hw.speedPref || 'slow',
    uc:    (hw.useCases || []).join(','),
  });
  return `${window.location.origin}?${p}`;
}

function decodeFromURL() {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  if (!p.get('vram') && !p.get('gpu')) return null;
  const rawLabel = p.get('gpu') || '';
  const fields   = gpuFieldsFromLabel(rawLabel);           // fuzzy-matched preset fields
  return {
    ...DEFAULT_HW,
    ...fields,
    // use normalized label if preset matched, else raw label from URL
    gpuLabel:           fields.gpuLabel || rawLabel,
    // use preset VRAM if matched, else fall back to explicit URL param
    vram:               fields.vram != null ? fields.vram : Number(p.get('vram') || 0),
    ram:                Number(p.get('ram')   || 16),
    cpuLabel:           p.get('cpu')    || '',
    cpuTier:            p.get('ctier')  || 'mid',
    ssd:                p.get('ssd')    || 'nvme',
    contextLength:      Number(p.get('ctx')   || 4096),
    numGPUs:            Number(p.get('gpus')  || 1),
    os:                 p.get('os')     || '',
    ramTypeLabel:       p.get('ramt')   || '',
    ramBandwidthGB:     Number(p.get('rambw') || 51),
    ramBandwidthFactor: Number(p.get('rambf') || 0.65),
    speedPref:          p.get('sp')     || 'slow',
    useCases:           p.get('uc') ? p.get('uc').split(',').filter(Boolean) : [],
  };
}

export default function Home() {
  const [hw, setHw]                   = useState(DEFAULT_HW);
  const [models, setModels]           = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [showDetectModal, setShowDetectModal] = useState(false);
  const [summary, setSummary]         = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const lsDebounce = useRef(null);

  /* Load models */
  useEffect(() => {
    fetch('/models.json')
      .then(r => r.json())
      .then(data => { setModels(data); setModelsLoading(false); })
      .catch(() => setModelsLoading(false));
  }, []);

  /* Restore from URL or localStorage */
  useEffect(() => {
    const fromURL = decodeFromURL();
    if (fromURL) { setHw(fromURL); return; }
    try {
      const saved = localStorage.getItem('llm_matcher_hw_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const ALLOWED = Object.keys(DEFAULT_HW);
        const safe    = Object.fromEntries(ALLOWED.map(k => [k, parsed[k]]).filter(([, v]) => v !== undefined));
        setHw({ ...DEFAULT_HW, ...safe, ...gpuFieldsFromLabel(safe.gpuLabel || '') });
      }
    } catch {}
  }, []);

  /* Debounce localStorage writes */
  useEffect(() => {
    clearTimeout(lsDebounce.current);
    lsDebounce.current = setTimeout(() => {
      try { localStorage.setItem('llm_matcher_hw_v2', JSON.stringify(hw)); } catch {}
    }, 400);
    return () => clearTimeout(lsDebounce.current);
  }, [hw]);

  /* Score models */
  const results = useMemo(() => {
    const hasCPUOnly = hw.gpuLabel === 'No GPU (CPU only)';
    if (!hw.ram || (!hw.vram && !hw.unifiedMem && !hasCPUOnly) || !models.length) {
      return { recommended: [], comfortable: [], stretch: [] };
    }
    return analyzeHardware(hw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
  }, [hw, models]);

  /* Auto-select top result */
  useEffect(() => {
    const first = results.recommended?.[0] || results.comfortable?.[0] || results.stretch?.[0];
    if (first) setSelectedModel(first.model);
  }, [results]);

  const shareURL = useCallback(() => {
    navigator.clipboard.writeText(encodeToURL(hw));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, [hw]);

  const onClearUseCases = useCallback(() => {
    setHw(h => ({ ...h, useCases: [] }));
  }, []);

  async function fetchSummary() {
    const topModels = [...(results.recommended || []), ...(results.comfortable || [])].slice(0, 5);
    if (!topModels.length) return;
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res  = await fetch('/api/summarize', {
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
    <div className="min-h-screen bg-[#0D0D11] text-[#F3F3F5]">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-white/5 px-6 py-4 bg-[#0D0D11]/85 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
              <Cpu size={14} className="text-[#8E919A]" />
            </div>
            <span className="font-display font-bold text-white tracking-tight">
              Local LLM Matcher
            </span>
            <span className="hidden sm:inline text-xs text-[#8E919A] font-normal ml-1">
              — which AI models can your hardware run?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetectModal(true)}
              className="btn-ghost text-xs flex items-center gap-1.5 font-semibold"
            >
              <span>Auto-Detect Specs</span>
            </button>
            {hasHardware && (
              <button onClick={shareURL} className="btn-ghost text-xs flex items-center gap-1.5">
                <Share2 size={12} /> {copied ? 'Copied!' : 'Share'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hardware Bar ────────────────────────────────────── */}
      <HardwareBar
        value={hw}
        onChange={setHw}
        geminiEnabled={geminiEnabled}
        onGeminiToggle={() => setGeminiEnabled(e => !e)}
      />

      {/* ── Main content ────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 pt-6 pb-20 text-[#F3F3F5]">

        {/* Empty / loading / results */}
        {!hasHardware ? (
          <div className="card p-12 text-center space-y-4 mt-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-zinc-400">
                <Cpu size={24} className="text-zinc-500" />
              </div>
            </div>
            <div className="text-zinc-300 font-semibold">Configure your hardware above to see results</div>
            <div className="text-zinc-500 text-sm max-w-sm mx-auto space-y-3">
              <p>Use the bar at the top to pick your GPU (or Apple Silicon chip) and set your RAM.</p>
              
              {/* Premium Auto-Detect Callout */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2.5 my-4">
                <p className="text-xs text-zinc-300 font-semibold">Too lazy to select specs manually?</p>
                <button
                  onClick={() => setShowDetectModal(true)}
                  className="btn-primary text-xs py-1.5 px-4 inline-flex items-center gap-1.5 font-semibold"
                >
                  Auto-Detect My Hardware
                </button>
              </div>

              <div className="text-left inline-block space-y-1.5 text-xs text-zinc-400 mt-2">
                <div className="flex items-start gap-2"><span className="text-[#84E1BC] shrink-0">✓</span><span>Works for NVIDIA, AMD, Intel Arc, Apple Silicon, and CPU-only</span></div>
                <div className="flex items-start gap-2"><span className="text-[#84E1BC] shrink-0">✓</span><span>Shows exactly how much VRAM / unified memory each model needs</span></div>
                <div className="flex items-start gap-2"><span className="text-[#84E1BC] shrink-0">✓</span><span>Estimates tokens per second for your specific hardware</span></div>
                <div className="flex items-start gap-2"><span className="text-[#84E1BC] shrink-0">✓</span><span>Explains what each quantization level means in plain English</span></div>
              </div>
            </div>
          </div>
        ) : modelsLoading ? (
          <div className="space-y-3 animate-pulse mt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4 space-y-3">
                <div className="h-4 bg-white/5 rounded w-1/3" />
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-20 bg-white/5 rounded-lg" />
                  ))}
                </div>
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-6 ${geminiEnabled && selectedModel ? 'lg:grid-cols-12' : ''}`}>
            <div className={geminiEnabled && selectedModel ? 'lg:col-span-8' : ''}>
              <ResultsPanel
                results={results}
                hw={hw}
                models={models}
                onApplyHardware={setHw}
                geminiEnabled={geminiEnabled}
                onSelectModel={model => setSelectedModel(prev => prev?.name === model?.name ? null : model)}
                selectedModelName={selectedModel?.name}
                onClearUseCases={onClearUseCases}
              />
            </div>
            
            {geminiEnabled && selectedModel && (
              <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-[128px] h-fit">
                <GeminiAdvisor
                  hw={hw}
                  currentModel={selectedModel}
                  allModels={models}
                  enabled={geminiEnabled}
                  onClose={() => setSelectedModel(null)}
                />
                
                {totalResults > 0 && (
                  <div className="card p-4 space-y-3">
                    <button
                      onClick={fetchSummary}
                      disabled={summaryLoading}
                      className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 text-xs font-semibold"
                    >
                      {summaryLoading ? 'Generating…' : '✨ Gemini AI Summary'}
                    </button>
                    {summary && (
                      <p className="text-xs text-zinc-300 leading-relaxed bg-black/20 border border-white/5 rounded-xl p-3.5">{summary}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-[#8E919A]">
        <div className="max-w-7xl mx-auto space-y-1">
          <div>Speed estimates based on memory bandwidth formula (tok/s ≈ bandwidth / model_size × backend_efficiency). Actual performance varies.</div>
          <div>Affiliate links help keep this free.</div>
        </div>
      </footer>

      {/* ── Auto-Detect Specs Modal ─────────────────────────── */}
      {showDetectModal && (
        <AutoDetectModal onClose={() => setShowDetectModal(false)} />
      )}

    </div>
  );
}
