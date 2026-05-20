import { GPU_PRESETS, findGPUBySlug, gpuToSlug } from '@/lib/gpuPresets';
import models from '@/public/models.json';
import { analyzeHardware } from '@/lib/scoring';
import Link from 'next/link';

export async function generateStaticParams() {
  return GPU_PRESETS.map(g => ({ slug: gpuToSlug(g.label) }));
}

export function generateMetadata({ params }) {
  const gpu = findGPUBySlug(params.slug);
  if (!gpu) return { title: 'GPU not found' };

  return {
    title: `What LLMs can ${gpu.label} run? — Local LLM Matcher`,
    description: `Complete list of local AI models compatible with ${gpu.label} (${gpu.unified ? 'Unified Memory' : `${gpu.vram}GB VRAM`}). Includes quantization levels, speed estimates, and RAM requirements.`,
    openGraph: {
      images: [`/api/og?gpu=${encodeURIComponent(gpu.label)}`],
    },
  };
}

export default function GPUPage({ params }) {
  const gpu = findGPUBySlug(params.slug);
  if (!gpu) return <div className="p-8 text-red-400">GPU not found</div>;

  const hw = {
    gpuLabel:    gpu.label,
    vram:        gpu.vram,
    unifiedMem:  !!gpu.unified,
    ram:         gpu.unified ? (gpu.maxRam || 16) : Math.max(gpu.vram * 2, 16),
    numGPUs:     1,
    cpuTier:     'mid',
    ssd:         'nvme',
    flashAttn:   gpu.flashAttn,
    contextLength: 4096,
  };

  const results = analyzeHardware(hw, 4096, gpu.flashAttn, models);
  const all = [
    ...(results.recommended || []),
    ...(results.comfortable || []),
    ...(results.stretch || []),
  ];

  return (
    <main className="min-h-screen bg-[#0A0F0A] text-[#E2F0E2] p-6 max-w-4xl mx-auto">
      <Link href="/" className="text-emerald-500 hover:text-emerald-400 text-sm mb-6 inline-block">
        ← Back to matcher
      </Link>

      <h1 className="font-bold text-2xl text-white mb-1">
        What LLMs can <span className="text-emerald-400">{gpu.label}</span> run?
      </h1>
      <p className="text-[#4A654A] text-sm mb-6">
        {gpu.unified
          ? `Apple Silicon with up to ${gpu.maxRam}GB unified memory`
          : `${gpu.vram}GB VRAM · ${gpu.arch} architecture`}
        {' · '}{all.length} compatible models at 4k context
      </p>

      <div className="space-y-3">
        {all.map((r, i) => (
          <div key={i} className="card p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-white text-sm">
                {r.model.name}
                <span className="ml-2 text-emerald-400 text-xs font-mono">{r.quant}</span>
              </div>
              <div className="text-xs text-[#4A654A] mt-0.5">
                {r.vramRequired} GB VRAM · {r.tokPerSec} tok/s · {r.downloadSizeGB} GB download
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`chip text-xs ${
                r.tier === 'recommended' ? 'bg-green-900/50 text-green-300' :
                r.tier === 'comfortable' ? 'bg-teal-900/50 text-teal-300' :
                'bg-amber-900/50 text-amber-300'
              }`}>{r.tier}</span>
              <span className="text-xs text-slate-600">{r.model.quality}</span>
            </div>
          </div>
        ))}
      </div>

      {gpu.buyUrl && (
        <div className="mt-8 card p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-300">Want a {gpu.label}?</div>
            <div className="text-xs text-slate-600">Check current prices on Amazon</div>
          </div>
          <a
            href={gpu.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            View on Amazon →
          </a>
        </div>
      )}
    </main>
  );
}
