'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HardwareBar   from '@/components/HardwareBar';
import ResultsPanel  from '@/components/ResultsPanel';
import GeminiAdvisor from '@/components/GeminiAdvisor';
import { analyzeHardware } from '@/lib/scoring';
import { GPU_PRESETS }      from '@/lib/gpuPresets';
import { Share2, Cpu, X } from 'lucide-react';

/* ── GPU preset field re-derivation (used on URL/localStorage load) ── */
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
  const gpuLabel = p.get('gpu') || '';
  return {
    ...DEFAULT_HW,
    ...gpuFieldsFromLabel(gpuLabel),
    gpuLabel,
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
  const [copiedCmd, setCopiedCmd]     = useState(null);
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
    setTimeout(() => setCopied(false), 2000);
  }, [hw]);

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
      <header className="border-b border-white/5 px-6 py-4 bg-[#0D0D11]/95 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
              <Cpu size={14} className="text-[#8E919A]" />
            </div>
            <span className="font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-inter)' }}>
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
              <span>🔌</span> Auto-Detect Specs
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

        {/* Gemini AI inline advisor */}
        {geminiEnabled && hasHardware && selectedModel && (
          <div className="mb-4">
            <GeminiAdvisor
              hw={hw}
              currentModel={selectedModel}
              allModels={models}
              enabled={geminiEnabled}
            />
          </div>
        )}

        {/* Gemini text summary */}
        {geminiEnabled && hasHardware && totalResults > 0 && (
          <div className="card p-4 space-y-3 mb-4">
            <button
              onClick={fetchSummary}
              disabled={summaryLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {summaryLoading ? 'Generating…' : '✨ Gemini AI Summary'}
            </button>
            {summary && (
              <p className="text-sm text-zinc-300 leading-relaxed">{summary}</p>
            )}
          </div>
        )}

        {/* Empty / loading / results */}
        {!hasHardware ? (
          <div className="card p-12 text-center space-y-4 mt-4">
            <div className="text-4xl">🖥️</div>
            <div className="text-zinc-300 font-semibold">Configure your hardware above to see results</div>
            <div className="text-zinc-500 text-sm max-w-sm mx-auto space-y-3">
              <p>Use the bar at the top to pick your GPU (or Apple Silicon chip) and set your RAM.</p>
              
              {/* Premium Auto-Detect Callout */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2.5 my-4">
                <p className="text-xs text-zinc-300 font-semibold">🔌 Too lazy to select specs manually?</p>
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
          <ResultsPanel
            results={results}
            hw={hw}
            models={models}
            onApplyHardware={setHw}
            geminiEnabled={geminiEnabled}
            onSelectModel={model => setSelectedModel(model)}
            selectedModelName={selectedModel?.name}
          />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#15151A] p-6 shadow-2xl space-y-5">
            
            {/* Close Button */}
            <button
              onClick={() => setShowDetectModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300">
                <span>🔌</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Hardware Auto-Detection
                </h3>
                <p className="text-[11px] text-[#8E919A] mt-0.5">
                  Auto-populate the LLM Matcher with your exact local specs.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Paste this one-line command into your terminal. It will scan your CPU cores, RAM bandwidth, GPU VRAM, OS, and drive type, then reload this page with the parameters pre-filled.
            </p>

            {/* Terminal Command Boxes */}
            <div className="space-y-4">
              
              {/* Windows Tab */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold">
                  <span>🪟 Windows (PowerShell)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('powershell -c "irm https://llm-matcher.vercel.app/detect-specs.ps1 | iex"');
                      setCopiedCmd('win');
                      setTimeout(() => setCopiedCmd(null), 2000);
                    }}
                    className="text-[10px] text-zinc-300 hover:text-white transition-colors uppercase font-sans font-semibold"
                  >
                    {copiedCmd === 'win' ? '✓ Copied!' : 'Copy Command'}
                  </button>
                </div>
                <div className="relative rounded-lg bg-black/40 border border-white/5 p-3 text-xs font-mono text-zinc-300 select-all overflow-x-auto whitespace-nowrap">
                  powershell -c &quot;irm https://llm-matcher.vercel.app/detect-specs.ps1 | iex&quot;
                </div>
              </div>

              {/* macOS / Linux Tab */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold">
                  <span>🍎 macOS / 🐧 Linux (Bash)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('curl -s https://llm-matcher.vercel.app/detect-specs.sh | bash');
                      setCopiedCmd('unix');
                      setTimeout(() => setCopiedCmd(null), 2000);
                    }}
                    className="text-[10px] text-zinc-300 hover:text-white transition-colors uppercase font-sans font-semibold"
                  >
                    {copiedCmd === 'unix' ? '✓ Copied!' : 'Copy Command'}
                  </button>
                </div>
                <div className="relative rounded-lg bg-black/40 border border-white/5 p-3 text-xs font-mono text-zinc-300 select-all overflow-x-auto whitespace-nowrap">
                  curl -s https://llm-matcher.vercel.app/detect-specs.sh | bash
                </div>
              </div>

            </div>

            {/* Note & Security Disclaimer */}
            <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3.5 text-[10px] text-zinc-500 leading-relaxed font-sans">
              🔒 <strong className="text-white">Privacy &amp; Security:</strong> The script is completely open-source and runs strictly on your machine. No telemetry or hardware statistics are uploaded or saved to any server—they are simply encoded into the local URL query parameters.
            </div>

            {/* Done button */}
            <button
              onClick={() => setShowDetectModal(false)}
              className="btn-ghost w-full py-2 text-xs text-zinc-400 hover:text-white"
            >
              Done / Close
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
