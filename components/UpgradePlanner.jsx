'use client';
import { useState, useMemo } from 'react';
import {
  TrendingUp, Layers, ArrowRight, Zap, RefreshCw,
  Target, CheckCircle2,
} from 'lucide-react';
import {
  analyzeHardware,
  weightsVRAM, QUANT_BITS, QUANT_BW_EFFICIENCY, BACKEND_EFFICIENCY, getBackend,
} from '@/lib/scoring';

/* ── Constants (mirror of scoring.js internals) ─────────────── */
const SPEED_MIN = { fast: 30, medium: 10, slow: 0 };
const SPEED_LABEL = {
  fast:   'Fast (30+ t/s)',
  medium: 'Conversational (10+ t/s)',
  slow:   'Any speed',
};

/* ── Helpers ─────────────────────────────────────────────────── */
/** Parse "lo–hi" or plain number into midpoint */
function parseTps(str) {
  if (!str) return 0;
  const parts = String(str).split(/[–\-]/);
  if (parts.length === 2) return (parseInt(parts[0]) + parseInt(parts[1])) / 2;
  return parseInt(str) || 0;
}

/** Pure bandwidth-formula tok/s estimate for a simulated hw config */
function estimateSimTps(simHw, refModelGB, refQuant) {
  const quantEff   = QUANT_BW_EFFICIENCY[refQuant] || 0.97;
  const backend    = simHw.unifiedMem ? 'mlx' : getBackend(simHw.os, simHw.gpuLabel);
  const backendEff = BACKEND_EFFICIENCY[backend] || 1.0;
  const numGPUs    = simHw.numGPUs || 1;
  const multiEff   = numGPUs === 2 ? 1.85 : numGPUs === 4 ? 3.4 : 1.0;
  const effectiveBW = (simHw.bandwidth || 0) * multiEff;
  const faBoost    = simHw.flashAttn ? 1.05 : 1.0;
  return Math.round((effectiveBW * quantEff * backendEff * faBoost) / Math.max(refModelGB, 2));
}

/* ── GPU Ladders ─────────────────────────────────────────────── */
const PC_GPU_LADDER = [
  { id: 'rtx_4060ti_16', label: 'NVIDIA GeForce RTX 4060 Ti 16GB',  name: 'RTX 4060 Ti (16GB)',        vram: 16, bw: 288,  numGPUs: 1 },
  { id: 'rtx_4070tis',   label: 'NVIDIA GeForce RTX 4070 Ti Super',  name: 'RTX 4070 Ti Super (16GB)', vram: 16, bw: 672,  numGPUs: 1 },
  { id: 'rtx_4080s',     label: 'NVIDIA GeForce RTX 4080 Super',     name: 'RTX 4080 Super (16GB)',    vram: 16, bw: 736,  numGPUs: 1 },
  { id: 'rtx_5080',      label: 'NVIDIA GeForce RTX 5080',            name: 'RTX 5080 (16GB)',          vram: 16, bw: 960,  numGPUs: 1 },
  { id: 'rtx_4090',      label: 'NVIDIA GeForce RTX 4090',            name: 'RTX 4090 (24GB)',          vram: 24, bw: 1008, numGPUs: 1 },
  { id: 'rtx_5090',      label: 'NVIDIA GeForce RTX 5090',            name: 'RTX 5090 (32GB)',          vram: 32, bw: 1792, numGPUs: 1 },
  { id: 'dual_4090',     label: 'NVIDIA GeForce RTX 4090',            name: 'Dual RTX 4090 (2x24GB)',   vram: 24, bw: 1008, numGPUs: 2 },
];

/* ── Main Component ──────────────────────────────────────────── */
export default function UpgradePlanner({ hw, models, onApplyHardware }) {
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);

  /* 1 -- Current performance assessment ───────────────────────── */
  const perf = useMemo(() => {
    if (!hw || !models.length) return null;

    const curResults = analyzeHardware(hw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
    const topResult  = curResults.recommended?.[0] || curResults.comfortable?.[0] || curResults.stretch?.[0];
    const currentTps = topResult ? parseTps(topResult.tokPerSec) : 0;
    const targetTps  = SPEED_MIN[hw.speedPref] || 0;
    const targetMet  = targetTps === 0 || currentTps >= targetTps;
    const pct        = targetTps > 0 ? Math.min(100, Math.round((currentTps / targetTps) * 100)) : 100;

    // Reference model for bandwidth math
    const refModel   = topResult?.model || null;
    const refQuant   = topResult?.quant || 'Q4_K_M';
    const refModelGB = refModel
      ? Math.max(2, weightsVRAM(refModel.params, QUANT_BITS[refQuant] || 4.85))
      : Math.max(2, weightsVRAM(7, 4.85)); // fallback 7B

    return {
      topResult, curResults,
      currentTps, targetTps, targetMet, pct,
      refModel, refQuant, refModelGB,
      speedPrefLabel: SPEED_LABEL[hw.speedPref] || 'Any speed',
    };
  }, [hw, models]);

  /* 2 -- Goal-driven upgrade options ──────────────────────────── */
  const upgradeOptions = useMemo(() => {
    if (!hw || !models.length || !perf) return [];

    const { currentTps, targetTps, targetMet, refModelGB, refQuant, refModel } = perf;
    const isApple          = hw.unifiedMem || hw.gpuLabel?.startsWith('Apple') || hw.os === 'macOS';
    const currentTotalVRAM = hw.unifiedMem ? hw.ram : (hw.vram || 0) * (hw.numGPUs || 1);
    const currentBW        = hw.bandwidth || hw.ramBandwidthGB || 0;
    const backend          = getBackend(hw.os, hw.gpuLabel);
    const backendEff       = BACKEND_EFFICIENCY[backend] || 1.0;
    const quantEff         = QUANT_BW_EFFICIENCY[refQuant] || 0.97;
    const refName          = refModel?.name || '7B model';

    // What tok/s should the upgrade aim for?
    let goalTps;
    if (!targetMet && targetTps > 0) {
      goalTps = targetTps * 1.15;                           // 15% headroom above target
    } else {
      const nextTier = hw.speedPref === 'slow'   ? SPEED_MIN.medium
                     : hw.speedPref === 'medium' ? SPEED_MIN.fast
                     : SPEED_MIN.fast * 2;                  // fast -> aim for 60+
      goalTps = Math.max(currentTps * 1.75, nextTier);
    }

    // Required bandwidth to hit goalTps on the reference model
    const requiredBW = goalTps > 0
      ? (goalTps * Math.max(refModelGB, 2)) / (quantEff * backendEff)
      : 0;

    /* -- Apple path ---------------------------------------------- */
    if (isApple) {
      const APPLE_LADDER = [
        { id: 'm3_max_48', gpuLabel: 'Apple M3 Max (40-core GPU)', name: 'MacBook Pro M3 Max (48GB)',   vram: 48,  bw: 300 },
        { id: 'm4_max_48', gpuLabel: 'Apple M4 Max',               name: 'MacBook Pro M4 Max (48GB)',   vram: 48,  bw: 410 },
        { id: 'm4_ultra',  gpuLabel: 'Apple M4 Ultra',             name: 'Mac Studio M4 Ultra (192GB)', vram: 192, bw: 820 },
      ];
      const APPLE_TAGS = ['Upgrade', 'Balanced', 'Maximum'];

      return APPLE_LADDER
        .filter(a => a.vram > currentTotalVRAM || a.bw > currentBW)
        .map((a, i) => {
          const simHw = {
            ...hw, gpuLabel: a.gpuLabel, vram: a.vram, unifiedMem: true,
            ram: a.vram, bandwidth: a.bw, ramBandwidthGB: a.bw,
            flashAttn: true, cpuTier: 'ultra',
          };
          const estTps = estimateSimTps(simHw, refModelGB, refQuant);
          return {
            id: a.id, name: a.name, simulatedHw: simHw,
            tag: APPLE_TAGS[i] || 'Upgrade',
            estTps, goalMet: estTps >= goalTps,
            desc: `${a.vram}GB unified memory at ${a.bw} GB/s -- ~${estTps} tok/s on ${refName}.`,
          };
        });
    }

    /* -- PC path ------------------------------------------------- */
    // Filter: only GPUs strictly better than current in VRAM or bandwidth
    const betterGPUs = PC_GPU_LADDER.filter(g => {
      const effVRAM = g.vram * (g.numGPUs || 1);
      const effBW   = g.bw * (g.numGPUs > 1 ? 1.85 : 1);
      return effVRAM > currentTotalVRAM || effBW > currentBW;
    });

    // Compute simulated tok/s for each candidate
    const gpusWithTps = betterGPUs.map(g => {
      const simHw = {
        ...hw,
        gpuLabel: g.label, vram: g.vram, numGPUs: g.numGPUs || 1,
        bandwidth: g.bw, unifiedMem: false,
        ram: Math.max(32, hw.ram), flashAttn: true,
      };
      const estTps = estimateSimTps(simHw, refModelGB, refQuant);
      return { ...g, simHw, estTps };
    }).sort((a, b) => a.estTps - b.estTps); // ascending

    // Pick 3: minimum-that-meets-goal | balanced | maximum
    const maxGpu = gpusWithTps[gpusWithTps.length - 1];
    const minGpu = gpusWithTps.find(g => {
      const effBW = g.bw * (g.numGPUs > 1 ? 1.85 : 1);
      return effBW >= requiredBW * 0.85;
    }) || gpusWithTps[0];

    const remaining   = gpusWithTps.filter(g => g.id !== minGpu?.id && g.id !== maxGpu?.id);
    const balancedGpu = remaining.length > 0
      ? remaining[Math.floor(remaining.length / 2)]
      : null;

    const makeCard = (g, tag) => ({
      id: g.id,
      name: g.name,
      tag,
      estTps:  g.estTps,
      goalMet: g.estTps >= goalTps,
      simulatedHw: g.simHw,
      desc: g.numGPUs > 1
        ? `${g.vram * g.numGPUs}GB combined (${g.numGPUs}x${g.vram}GB) at ${g.bw} GB/s each -- ~${g.estTps} tok/s on ${refName}.`
        : `${g.vram}GB VRAM at ${g.bw} GB/s -- ~${g.estTps} tok/s on ${refName}.`,
    });

    const options = [];
    if (minGpu)      options.push(makeCard(minGpu,      targetMet ? 'Go Further' : 'Meets Goal'));
    if (balancedGpu) options.push(makeCard(balancedGpu, 'Balanced'));
    if (maxGpu && maxGpu.id !== minGpu?.id)
                     options.push(makeCard(maxGpu,      'Maximum'));

    // RAM upgrade: always available as a budget option on PC
    const newRam = Math.max(32, hw.ram * 2);
    options.push({
      id: 'pc_ram',
      name: `${newRam}GB System RAM`,
      tag: 'Budget Upgrade',
      estTps: null,
      goalMet: false,
      simulatedHw: {
        ...hw,
        ram: newRam,
        ramBandwidthGB:     Math.max(96, (hw.ramBandwidthGB || 51) * 1.5),
        ramBandwidthFactor: 0.80,
      },
      desc: `Keep current GPU, upgrade system RAM to ${newRam}GB -- better CPU-offload capacity for models too large for VRAM alone.`,
    });

    return options;
  }, [hw, models, perf]);

  /* 3 -- Simulate selected upgrade ────────────────────────────── */
  const comparison = useMemo(() => {
    if (!hw || !models.length || !perf) return null;

    const countCurrent =
      (perf.curResults.recommended?.length || 0) +
      (perf.curResults.comfortable?.length || 0);

    const sel = upgradeOptions.find(o => o.id === selectedUpgrade);
    if (!sel) return { countCurrent, countNew: countCurrent, unlockedModels: [], speedups: [] };

    const newResults = analyzeHardware(sel.simulatedHw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
    const countNew   = (newResults.recommended?.length || 0) + (newResults.comfortable?.length || 0);

    const currentKeys = new Set([
      ...perf.curResults.recommended.map(r => `${r.model.name}_${r.quant}`),
      ...perf.curResults.comfortable.map(r => `${r.model.name}_${r.quant}`),
    ]);
    const allCurrent = [
      ...perf.curResults.recommended,
      ...perf.curResults.comfortable,
      ...perf.curResults.stretch,
    ];

    const unlocked = [];
    const speedups = [];

    for (const item of [...newResults.recommended, ...newResults.comfortable]) {
      const key = `${item.model.name}_${item.quant}`;
      if (!currentKeys.has(key)) {
        unlocked.push({
          name: item.model.name, quant: item.quant,
          tier: item.tier, vramRequired: item.vramRequired, tokPerSec: item.tokPerSec,
        });
      } else {
        const cur    = allCurrent.find(c => c.model.name === item.model.name && c.quant === item.quant);
        if (cur) {
          const curAvg = parseTps(cur.tokPerSec);
          const newAvg = parseTps(item.tokPerSec);
          const factor = curAvg > 0 ? +(newAvg / curAvg).toFixed(1) : 0;
          if (factor >= 1.2)
            speedups.push({ name: item.model.name, quant: item.quant, before: cur.tokPerSec, after: item.tokPerSec, factor });
        }
      }
    }

    return {
      countCurrent, countNew,
      unlockedModels:     unlocked.slice(0, 5),
      unlockedTotalCount: Math.max(0, countNew - countCurrent),
      speedups:           speedups.sort((a, b) => b.factor - a.factor).slice(0, 3),
    };
  }, [hw, models, selectedUpgrade, upgradeOptions, perf]);

  if (!perf) return null;

  const { currentTps, targetTps, targetMet, pct, speedPrefLabel, refModel, refQuant } = perf;
  const currentOption = upgradeOptions.find(o => o.id === selectedUpgrade);

  return (
    <div className="card p-6 relative overflow-hidden my-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
        <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[#84E1BC]">
          <Zap size={15} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white font-mono tracking-tight">
            Hardware Upgrade Planner
          </h3>
          <p className="text-[11px] text-[#8E919A] mt-0.5">
            Goal-based suggestions -- see exactly which upgrade hits your speed target.
          </p>
        </div>
      </div>

      {/* Performance Status Banner */}
      <div className={`mb-6 rounded-lg border p-4 ${
        targetMet
          ? 'border-[#84E1BC]/15 bg-[#84E1BC]/5'
          : 'border-amber-500/15 bg-amber-500/5'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 ${targetMet ? 'text-[#84E1BC]' : 'text-amber-400'}`}>
            {targetMet ? <CheckCircle2 size={17} /> : <Target size={17} />}
          </div>
          <div className="flex-1 min-w-0">

            <div className={`text-xs font-semibold flex items-center flex-wrap gap-2 ${targetMet ? 'text-[#84E1BC]' : 'text-amber-400'}`}>
              {targetMet
                ? <>Target met -- ~{Math.round(currentTps)} tok/s <span className="text-[#8E919A] font-normal">({speedPrefLabel})</span></>
                : <>{Math.round(currentTps)} tok/s vs {targetTps}+ tok/s goal <span className="text-[#8E919A] font-normal">({speedPrefLabel})</span></>
              }
            </div>

            {refModel && (
              <p className="text-[11px] text-[#8E919A] mt-1.5">
                Reference:{' '}
                <span className="text-white font-medium">{refModel.name}</span>
                <span className="text-zinc-600 font-mono ml-1 text-[10px]">{refQuant}</span>
              </p>
            )}

            {targetTps > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[9px] font-mono text-[#565961] mb-1.5">
                  <span>0 tok/s</span>
                  <span>Target: {targetTps}+ tok/s</span>
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${targetMet ? 'bg-[#84E1BC]' : 'bg-amber-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className={`text-[10px] font-mono mt-1.5 ${targetMet ? 'text-[#84E1BC]' : 'text-amber-400'}`}>
                  {pct}% of target
                  {targetMet
                    ? ` (+${Math.round(currentTps - targetTps)} tok/s above)`
                    : ` -- need ${Math.round(targetTps - currentTps)} more tok/s`}
                </p>
              </div>
            )}

            <p className="text-[11px] text-[#8E919A] mt-2.5">
              {!targetMet
                ? (hw.gpuLabel === 'No GPU (CPU only)'
                    ? '💡 Adding a dedicated GPU will dramatically increase generation speed.'
                    : '💡 Pick an upgrade below -- cards marked "Meets Goal" will hit your target.')
                : '🚀 Already hitting your goal! See how much further you can push.'}
            </p>
          </div>
        </div>
      </div>

      {/* Upgrade Option Cards */}
      {upgradeOptions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {upgradeOptions.map((opt) => {
            const isActive = selectedUpgrade === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedUpgrade(isActive ? null : opt.id)}
                className={`text-left rounded-lg p-4 border transition-all duration-200 flex flex-col group relative
                  ${isActive
                    ? 'border-[#84E1BC]/30 bg-[#84E1BC]/5'
                    : 'border-white/5 bg-black/20 hover:border-white/10 hover:bg-white/[0.02]'
                  }`}
              >
                <div className="flex justify-between items-start gap-1 mb-1.5">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-[#8E919A] font-mono group-hover:text-white transition-colors">
                    {opt.tag}
                  </span>
                  {opt.goalMet && (
                    <span className="shrink-0 text-[9px] text-[#84E1BC] font-bold bg-[#84E1BC]/10 border border-[#84E1BC]/20 px-1.5 py-0.5 rounded font-mono">
                      Goal
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-semibold text-white group-hover:text-[#84E1BC] transition-colors leading-tight">
                  {opt.name}
                </h4>

                <p className="text-[11px] text-[#8E919A] mt-2 leading-relaxed flex-1">
                  {opt.desc}
                </p>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                  {opt.estTps != null ? (
                    <span className={`text-[11px] font-bold font-mono ${opt.goalMet ? 'text-[#84E1BC]' : 'text-zinc-400'}`}>
                      ~{opt.estTps} t/s
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#565961] font-mono">offload boost</span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-[#8E919A] font-mono">
                    Simulate <ArrowRight size={9} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-white/5 bg-black/20 p-5 text-center">
          <div className="text-2xl mb-2">🏆</div>
          <div className="text-sm font-semibold text-white">You are at the top of consumer hardware</div>
          <p className="text-[12px] text-[#8E919A] mt-1 max-w-sm mx-auto">
            No consumer upgrade exceeds your current specs. Consider multi-GPU workstations or cloud inference for 70B+ models.
          </p>
        </div>
      )}

      {/* Simulation Result Area */}
      {selectedUpgrade && currentOption && comparison && (
        <div className="rounded-lg border border-white/5 bg-black/20 p-5 space-y-4">

          <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#8E919A]">Simulating:</span>
              <span className="text-xs font-medium text-white font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {currentOption.name}
              </span>
            </div>
            <button
              onClick={() => onApplyHardware(currentOption.simulatedHw)}
              className="px-3 py-1 bg-[#84E1BC] hover:bg-[#a2ecd2] text-[#0D0D11] text-[10px] font-semibold rounded flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={10} /> Apply to Calculator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">

            {/* Unlocked Models */}
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase font-bold tracking-widest text-[#8E919A] flex items-center gap-1.5">
                <Layers size={11} className="text-[#84E1BC]" />
                Unlocked Models ({comparison.unlockedTotalCount})
              </h5>

              {comparison.unlockedTotalCount === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">
                  No new tiers unlocked -- but existing models will run faster!
                </p>
              ) : (
                <div className="space-y-2">
                  {comparison.unlockedModels.map((m, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-2.5 rounded-lg border border-white/5 text-xs">
                      <div>
                        <div className="font-semibold text-white">{m.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{m.quant} · {m.vramRequired}GB</div>
                      </div>
                      <span className="shrink-0 ml-2 text-[10px] text-[#84E1BC] font-semibold bg-[#84E1BC]/5 border border-[#84E1BC]/10 px-2 py-0.5 rounded font-mono">
                        {m.tokPerSec} t/s
                      </span>
                    </div>
                  ))}
                  {comparison.unlockedTotalCount > 5 && (
                    <p className="text-[10px] text-[#8E919A] font-mono text-center pt-1">
                      +{comparison.unlockedTotalCount - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Speed Gains */}
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase font-bold tracking-widest text-[#8E919A] flex items-center gap-1.5">
                <TrendingUp size={11} className="text-sky-400" />
                Speed Gains
              </h5>

              {comparison.speedups.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">
                  Already at peak bandwidth for loaded models.
                </p>
              ) : (
                <div className="space-y-2">
                  {comparison.speedups.map((s, idx) => (
                    <div key={idx} className="bg-black/40 p-2.5 rounded-lg border border-white/5 text-xs space-y-1.5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-white truncate">
                          {s.name} <span className="font-mono text-zinc-500 font-normal">({s.quant})</span>
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-sky-300 bg-sky-500/5 border border-sky-500/10 px-1.5 py-0.5 rounded font-mono">
                          +{Math.round((s.factor - 1) * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span>{s.before} t/s</span>
                        <ArrowRight size={9} className="text-zinc-700 shrink-0" />
                        <span className="text-[#84E1BC] font-semibold">{s.after} t/s</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded bg-white/[0.01] border border-white/5 p-3 text-[11px] text-[#8E919A] leading-relaxed">
                ⭐ <strong className="text-white">Why bandwidth matters:</strong> LLM decoding is memory-bandwidth-bound -- more GB/s = directly more tokens per second.
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
