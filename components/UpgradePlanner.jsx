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
const SPEED_MIN = { fast: 30, medium: 15, slow: 8 };
const SPEED_LABEL = {
  fast:   'Fast (30+ t/s)',
  medium: 'Conversational (15+ t/s)',
  slow:   'Baseline (8+ t/s)',
};

const REF_MODEL_GB = 5.09;
const REF_MODEL_NAME = 'Llama 3 8B';
const REF_QUANT = 'Q4_K_M';

/* ── Helpers ─────────────────────────────────────────────────── */
/** Parse "lo–hi" or plain number into midpoint */
function parseTps(str) {
  if (!str) return 0;
  const parts = String(str).split(/[–\-]/);
  if (parts.length === 2) return (parseInt(parts[0]) + parseInt(parts[1])) / 2;
  return parseInt(str) || 0;
}

/** High-precision reference speed formula */
function getReferenceSpeed(simHw) {
  const quantEff = 0.97; // QUANT_BW_EFFICIENCY['Q4_K_M']
  const backend = simHw.unifiedMem ? 'mlx' : getBackend(simHw.os, simHw.gpuLabel);
  const backendEff = BACKEND_EFFICIENCY[backend] || 1.0;
  const numGPUs = simHw.numGPUs || 1;
  const multiEff = numGPUs === 2 ? 1.85 : numGPUs === 4 ? 3.4 : 1.0;
  const effectiveBW = (simHw.bandwidth || 0) * multiEff;
  const faBoost = simHw.flashAttn ? 1.05 : 1.0;

  if (simHw.gpuLabel === 'No GPU (CPU only)' || !simHw.gpuLabel || simHw.bandwidth === 0) {
    const ramBW = simHw.ramBandwidthGB || 51;
    const ramFactor = simHw.ramBandwidthFactor || 0.65;
    const cpuTps = Math.round((ramBW * ramFactor * quantEff) / REF_MODEL_GB);
    return Math.max(1, cpuTps);
  }

  return Math.round((effectiveBW * quantEff * backendEff * faBoost) / REF_MODEL_GB);
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

const APPLE_GPU_LADDER = [
  { id: 'm4_max_64', label: 'Apple M4 Max', name: 'MacBook Pro M4 Max (64GB)', vram: 64, bw: 410 },
  { id: 'm4_ultra_128', label: 'Apple M4 Ultra', name: 'Mac Studio M4 Ultra (128GB)', vram: 128, bw: 820 },
];

/* ── Main Component ──────────────────────────────────────────── */
export default function UpgradePlanner({ hw, models, onApplyHardware }) {
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);

  /* 1 -- Current performance assessment ───────────────────────── */
  const perf = useMemo(() => {
    if (!hw || !models.length) return null;

    const curResults = analyzeHardware(hw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
    const topResult  = curResults.recommended?.[0] || curResults.comfortable?.[0] || curResults.stretch?.[0];
    
    // High-precision reference current speed calculation
    const currentTps = getReferenceSpeed(hw);
    const goalTps    = SPEED_MIN[hw.speedPref] || 8;
    const targetMet  = currentTps >= goalTps;
    const pct        = Math.min(100, Math.round((currentTps / goalTps) * 100));

    // Dynamic bandwidth target matching user goalTps
    const isApple    = hw.unifiedMem || hw.gpuLabel?.startsWith('Apple') || hw.os === 'macOS';
    const backend    = isApple ? 'mlx' : getBackend(hw.os, hw.gpuLabel);
    const backendEff = BACKEND_EFFICIENCY[backend] || 1.0;
    const quantEff   = 0.97;
    const requiredBW = Math.round((goalTps * REF_MODEL_GB) / (quantEff * backendEff));

    return {
      topResult, curResults,
      currentTps, goalTps, targetMet, pct, requiredBW,
      speedPrefLabel: SPEED_LABEL[hw.speedPref] || 'Baseline (8+ t/s)',
    };
  }, [hw, models]);

  /* 2 -- Goal-driven upgrade options ──────────────────────────── */
  const upgradeOptions = useMemo(() => {
    if (!hw || !models.length || !perf) return [];

    const { currentTps, goalTps, targetMet, requiredBW } = perf;
    const isApple          = hw.unifiedMem || hw.gpuLabel?.startsWith('Apple') || hw.os === 'macOS';
    const currentTotalVRAM = hw.unifiedMem ? hw.ram : (hw.vram || 0) * (hw.numGPUs || 1);
    const currentBW        = hw.bandwidth || hw.ramBandwidthGB || 0;

    const options = [];

    if (isApple) {
      // 1. Budget Option: Double RAM Boost
      const doubleRamVal = Math.min(192, hw.ram * 2);
      if (doubleRamVal > hw.ram) {
        const simHw = {
          ...hw,
          ram: doubleRamVal,
          maxRam: doubleRamVal,
        };
        const estTps = getReferenceSpeed(simHw);
        options.push({
          id: 'apple_ram_boost',
          name: `Double RAM Boost (${doubleRamVal}GB)`,
          tag: 'Budget Option',
          estTps,
          goalMet: estTps >= goalTps,
          simulatedHw: simHw,
          desc: `Double system unified memory to ${doubleRamVal}GB without changing SoC class. Extends capability to load larger models.`,
        });
      }

      // 2. Apple SoC Upgrades (strictly better)
      const betterApple = APPLE_GPU_LADDER.filter(a => {
        return a.vram > currentTotalVRAM || (a.vram === currentTotalVRAM && a.bw > currentBW);
      });

      // Calculate speeds and add to options
      const appleUpgrades = betterApple.map(a => {
        const simHw = {
          ...hw,
          gpuLabel: a.label,
          vram: a.vram,
          unifiedMem: true,
          ram: a.vram,
          bandwidth: a.bw,
          ramBandwidthGB: a.bw,
          flashAttn: true,
          cpuTier: 'ultra',
        };
        const estTps = getReferenceSpeed(simHw);
        return {
          id: a.id,
          name: a.name,
          estTps,
          goalMet: estTps >= goalTps,
          simulatedHw: simHw,
          desc: `${a.vram}GB unified memory at ${a.bw} GB/s -- estimated ~${estTps} tok/s on ${REF_MODEL_NAME}.`,
        };
      });

      options.push(...appleUpgrades);

    } else {
      // PC path
      // 1. Budget Option: System RAM Upgrade
      const newRam = Math.max(32, hw.ram * 2);
      if (newRam > hw.ram) {
        const simHw = {
          ...hw,
          ram: newRam,
          ramBandwidthGB:     Math.max(96, (hw.ramBandwidthGB || 51) * 1.5),
          ramBandwidthFactor: 0.80,
        };
        const estTps = getReferenceSpeed(simHw);
        options.push({
          id: 'pc_ram',
          name: `${newRam}GB System RAM`,
          tag: 'Budget Option',
          estTps,
          goalMet: estTps >= goalTps,
          simulatedHw: simHw,
          desc: `Keep current GPU, upgrade system RAM to ${newRam}GB for improved CPU offload capacity for large models.`,
        });
      }

      // 2. GPU Upgrades (strictly better)
      const betterGPUs = PC_GPU_LADDER.filter(g => {
        const effVRAM = g.vram * (g.numGPUs || 1);
        return effVRAM > currentTotalVRAM || (effVRAM === currentTotalVRAM && g.bw > currentBW);
      });

      const pcUpgrades = betterGPUs.map(g => {
        const simHw = {
          ...hw,
          gpuLabel: g.label,
          vram: g.vram,
          numGPUs: g.numGPUs || 1,
          bandwidth: g.bw,
          unifiedMem: false,
          ram: Math.max(32, hw.ram),
          flashAttn: true,
        };
        const estTps = getReferenceSpeed(simHw);
        return {
          id: g.id,
          name: g.name,
          estTps,
          goalMet: estTps >= goalTps,
          simulatedHw: simHw,
          desc: g.numGPUs > 1
            ? `${g.vram * g.numGPUs}GB combined (${g.numGPUs}x${g.vram}GB) at ${g.bw} GB/s each -- estimated ~${estTps} tok/s on ${REF_MODEL_NAME}.`
            : `${g.vram}GB VRAM at ${g.bw} GB/s -- estimated ~${estTps} tok/s on ${REF_MODEL_NAME}.`,
        };
      });

      // Sort upgrades by speed ascending so labeling is consistent
      pcUpgrades.sort((a, b) => a.estTps - b.estTps);
      options.push(...pcUpgrades);
    }

    // Dynamic labeling for all options
    let foundMeetsGoal = false;
    const gpuCards = options.filter(opt => opt.id !== 'pc_ram' && opt.id !== 'apple_ram_boost');
    const fastestGpuId = gpuCards.length > 0 ? gpuCards[gpuCards.length - 1].id : null;

    return options.map(opt => {
      // RAM/Budget is always "Budget Option"
      if (opt.id === 'pc_ram' || opt.id === 'apple_ram_boost') {
        return { ...opt, tag: 'Budget Option' };
      }

      let tag = 'Balanced';
      if (targetMet) {
        tag = 'Go Further';
      } else {
        if (opt.estTps >= goalTps) {
          if (!foundMeetsGoal) {
            tag = 'Meets Goal';
            foundMeetsGoal = true;
          } else {
            tag = 'Maximum';
          }
        } else {
          if (opt.id === fastestGpuId && !foundMeetsGoal) {
            tag = 'Maximum';
          } else {
            tag = 'Balanced';
          }
        }
      }
      return { ...opt, tag };
    });

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

  const { currentTps, goalTps: targetTps, targetMet, pct, speedPrefLabel, requiredBW } = perf;
  const currentOption = upgradeOptions.find(o => o.id === selectedUpgrade);
  const hasGpuUpgrades = upgradeOptions.some(opt => opt.id !== 'pc_ram' && opt.id !== 'apple_ram_boost');

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
      <div className={`mb-6 rounded-xl border p-5 transition-all relative overflow-hidden ${
        targetMet
          ? 'border-[#84E1BC]/20 bg-gradient-to-r from-[#84E1BC]/5 via-transparent to-transparent'
          : 'border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            targetMet ? 'bg-[#84E1BC]/10 text-[#84E1BC] border border-[#84E1BC]/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {targetMet ? <CheckCircle2 size={18} /> : <Target size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Performance Status vs Goal
                </h4>
                <div className={`text-sm font-bold mt-1 font-mono flex items-center gap-2 ${targetMet ? 'text-[#84E1BC]' : 'text-amber-400'}`}>
                  {Math.round(currentTps)} tok/s
                  <span className="text-[11px] text-[#8E919A] font-normal">
                    vs {targetTps} tok/s target ({speedPrefLabel})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#8E919A]">Required Bandwidth</span>
                <div className="text-xs font-bold text-white font-mono mt-0.5">{requiredBW} GB/s</div>
              </div>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-[#8E919A]">Reference Benchmark Model:</span>
              <span className="text-[10px] font-semibold text-white font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                Llama 3 8B (Q4_K_M)
              </span>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-[9px] font-mono text-[#565961] mb-1.5">
                <span>0 tok/s</span>
                <span>Goal: {targetTps} tok/s</span>
              </div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${targetMet ? 'bg-gradient-to-r from-[#84E1BC]/50 to-[#84E1BC]' : 'bg-gradient-to-r from-amber-500/50 to-amber-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className={`text-[10px] font-mono font-bold ${targetMet ? 'text-[#84E1BC]' : 'text-amber-400'}`}>
                  {pct}% of target goal
                </span>
                <span className={`text-[10px] font-mono ${targetMet ? 'text-[#84E1BC] font-semibold' : 'text-amber-400'}`}>
                  {targetMet
                    ? `Performance goal met! 🎉 (+${Math.round(currentTps - targetTps)} tok/s headroom)`
                    : `Need ${Math.round(targetTps - currentTps)} more tok/s to meet target`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Option Cards */}
      {hasGpuUpgrades ? (
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
        <div className="mb-6 rounded-xl border border-[#84E1BC]/20 bg-gradient-to-br from-[#84E1BC]/10 via-transparent to-[#84E1BC]/5 p-6 text-center shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#84E1BC]/10 via-transparent to-transparent opacity-50 pointer-events-none" />
          <div className="text-3xl mb-3 animate-bounce">🏆</div>
          <h4 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
            You Are At The Peak of Consumer Hardware!
          </h4>
          <p className="text-[12px] text-[#8E919A] mt-2 max-w-md mx-auto leading-relaxed">
            Your current hardware configuration matches or exceeds the absolute top-tier consumer hardware limits available today. No further local GPU upgrades are recommended.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-mono text-[#84E1BC] bg-[#84E1BC]/5 border border-[#84E1BC]/10 px-3 py-1 rounded-full w-max mx-auto">
            <span>Next step: Cloud multi-GPU clustering or Enterprise rigs</span>
          </div>
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
