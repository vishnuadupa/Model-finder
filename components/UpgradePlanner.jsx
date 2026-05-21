'use client';
import { useState, useMemo } from 'react';
import {
  TrendingUp, Sparkles, Cpu, Layers,
  CheckCircle2, ArrowRight, Zap, RefreshCw
} from 'lucide-react';
import { analyzeHardware } from '@/lib/scoring';

export default function UpgradePlanner({ hw, models, onApplyHardware }) {
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);

  // 1. Detect active hardware bottlenecks
  const bottleneck = useMemo(() => {
    if (!hw || !models.length) return null;

    const isCPUOnly = !hw.vram && !hw.unifiedMem;
    const totalVRAM = hw.unifiedMem
      ? hw.ram
      : (hw.vram || 0) * (hw.numGPUs || 1);

    if (isCPUOnly) {
      return {
        type: 'No GPU / Bandwidth',
        desc: 'You are running entirely on CPU. Generation speed is strictly limited by CPU RAM bandwidth, causing slow text generation.',
        recommendation: 'Adding a dedicated NVIDIA GPU with high VRAM will boost speeds by up to 10x-20x.',
        severity: 'high',
      };
    }

    if (hw.unifiedMem && hw.ram <= 16) {
      return {
        type: 'Unified Memory Limit',
        desc: `Your Apple Silicon chip is restricted to ${hw.ram}GB unified RAM. Because macOS reserves a portion for the OS, you cannot run models larger than 8B-14B parameter sizes.`,
        recommendation: 'Upgrading to an Apple Silicon device with 36GB-48GB or more unified memory will unlock massive 32B-70B models.',
        severity: 'medium',
      };
    }

    if (!hw.unifiedMem && totalVRAM <= 8) {
      return {
        type: 'Low GPU VRAM',
        desc: `Your GPU has only ${totalVRAM}GB of VRAM. Modern high-quality LLMs (like Llama-3-8B Q8 or Mistral-Large) require more than 10GB-16GB VRAM to run at full speed without slow CPU offloading.`,
        recommendation: 'Upgrading to a 16GB or 24GB VRAM GPU will keep entire high-quality models in graphics memory, maintaining high token speeds.',
        severity: 'high',
      };
    }

    if (!hw.unifiedMem && hw.ram <= 16) {
      return {
        type: 'System RAM (Offload Buffer)',
        desc: `While your GPU has decent VRAM, your host system has only ${hw.ram}GB of RAM. This limits your ability to offload the remaining layers of larger 30B+ models that don't fit entirely on the GPU.`,
        recommendation: 'Upgrading system RAM to 32GB or 64GB provides a comfortable landing pad for hybrid CPU-GPU offloads.',
        severity: 'low',
      };
    }

    return {
      type: 'None (High-End Rig)',
      desc: 'Your hardware setup is highly capable! You have enough VRAM and system RAM to run the majority of modern open-source models comfortably.',
      recommendation: 'If you want to run massive 70B+ or 405B models, consider multi-GPU clustering or specialized cloud instances.',
      severity: 'none',
    };
  }, [hw, models]);

  // 2. Define upgrade options based on platform
  const upgradeOptions = useMemo(() => {
    if (!hw) return [];

    const isApple = hw.unifiedMem || hw.gpuLabel?.startsWith('Apple') || hw.os === 'macOS';

    if (isApple) {
      return [
        {
          id: 'apple_double',
          name: 'Double Memory Boost',
          tag: 'Cost-Effective Upgrade',
          desc: `Double RAM to ${hw.ram * 2}GB with higher system bandwidth.`,
          simulatedHw: {
            ...hw,
            ram: hw.ram * 2,
            maxRam: hw.maxRam ? hw.maxRam * 2 : 128,
            bandwidth: Math.min(400, (hw.bandwidth || 100) * 1.5),
            ramBandwidthGB: Math.min(400, (hw.ramBandwidthGB || 100) * 1.5),
          },
        },
        {
          id: 'apple_max',
          name: 'Macbook M3 Max (48GB)',
          tag: 'Pro AI Machine',
          desc: 'Simulate a premium M3 Max setup with 48GB unified RAM and 300 GB/s bandwidth.',
          simulatedHw: {
            ...hw,
            gpuLabel: 'Apple M3 Max (40-core GPU)',
            vram: 48,
            unifiedMem: true,
            ram: 48,
            bandwidth: 300,
            ramBandwidthGB: 300,
            flashAttn: true,
            cpuTier: 'ultra',
            cpuCores: 16,
          },
        },
        {
          id: 'apple_ultra',
          name: 'Mac Studio M3 Ultra (128GB)',
          tag: 'Local Workstation',
          desc: 'Simulate a massive 128GB unified RAM beast with 800 GB/s bandwidth.',
          simulatedHw: {
            ...hw,
            gpuLabel: 'Apple M3 Ultra (76-core GPU)',
            vram: 128,
            unifiedMem: true,
            ram: 128,
            bandwidth: 800,
            ramBandwidthGB: 800,
            flashAttn: true,
            cpuTier: 'ultra',
            cpuCores: 24,
          },
        },
      ];
    } else {
      // Windows/Linux PC presets
      return [
        {
          id: 'pc_ram',
          name: '32GB RAM Upgrade',
          tag: 'System Upgrade',
          desc: `Keep current GPU, but upgrade system RAM to 32GB (DDR5 6400).`,
          simulatedHw: {
            ...hw,
            ram: Math.max(32, hw.ram),
            ramBandwidthGB: Math.max(64, hw.ramBandwidthGB || 51),
            ramBandwidthFactor: 0.80, // High-speed DDR5
          },
        },
        {
          id: 'pc_gpu_mid',
          name: 'NVIDIA RTX 4070 Ti Super (16GB)',
          tag: 'Sweet Spot VRAM',
          desc: 'Add a 16GB VRAM GPU with 672 GB/s bandwidth and high-speed CUDA cores.',
          simulatedHw: {
            ...hw,
            gpuLabel: 'NVIDIA GeForce RTX 4070 Ti Super',
            vram: 16,
            bandwidth: 672,
            unifiedMem: false,
            ram: Math.max(32, hw.ram), // Assume standard 32GB RAM upgrade with it
            ramBandwidthGB: Math.max(64, hw.ramBandwidthGB || 51),
            flashAttn: true,
          },
        },
        {
          id: 'pc_gpu_high',
          name: 'NVIDIA GeForce RTX 4090 (24GB)',
          tag: 'Ultimate AI Titan',
          desc: 'Simulate the absolute gold standard for local LLM inference: 24GB VRAM, 1008 GB/s bandwidth.',
          simulatedHw: {
            ...hw,
            gpuLabel: 'NVIDIA GeForce RTX 4090',
            vram: 24,
            bandwidth: 1008,
            unifiedMem: false,
            ram: Math.max(32, hw.ram),
            ramBandwidthGB: Math.max(64, hw.ramBandwidthGB || 51),
            flashAttn: true,
          },
        },
      ];
    }
  }, [hw]);

  // 3. Compute baseline results vs upgraded results
  const comparison = useMemo(() => {
    if (!hw || !models.length) return null;

    // Get current counts
    const currentResults = analyzeHardware(hw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
    const countCurrent = (currentResults.recommended?.length || 0) + (currentResults.comfortable?.length || 0);

    const upgradeSelected = upgradeOptions.find(opt => opt.id === selectedUpgrade);
    if (!upgradeSelected) return { countCurrent, countNew: countCurrent, unlockedModels: [], speedups: [] };

    const newResults = analyzeHardware(upgradeSelected.simulatedHw, hw.contextLength || 4096, hw.flashAttn, models, hw.os);
    const countNew = (newResults.recommended?.length || 0) + (newResults.comfortable?.length || 0);

    // Identify unlocked models (models that moved from stretch/incompatible to recommended/comfortable)
    const currentKeys = new Set([
      ...currentResults.recommended.map(r => `${r.model.name}_${r.quant}`),
      ...currentResults.comfortable.map(r => `${r.model.name}_${r.quant}`),
    ]);

    const unlocked = [];
    const speedups = [];

    // Combine recommended and comfortable in new results
    const combinedNew = [...newResults.recommended, ...newResults.comfortable];

    for (const item of combinedNew) {
      const key = `${item.model.name}_${item.quant}`;
      if (!currentKeys.has(key)) {
        unlocked.push({
          name: item.model.name,
          quant: item.quant,
          tier: item.tier,
          vramRequired: item.vramRequired,
          tokPerSec: item.tokPerSec,
        });
      } else {
        // Model was already runnable, let's compare speeds
        // Find current item matching name and quant
        const currentItem = [...currentResults.recommended, ...currentResults.comfortable, ...currentResults.stretch]
          .find(c => c.model.name === item.model.name && c.quant === item.quant);
        if (currentItem) {
          const curAvg = (parseInt(currentItem.tokPerSec.split('–')[0]) + parseInt(currentItem.tokPerSec.split('–')[1])) / 2;
          const newAvg = (parseInt(item.tokPerSec.split('–')[0]) + parseInt(item.tokPerSec.split('–')[1])) / 2;
          if (newAvg > curAvg && curAvg > 0) {
            const factor = +(newAvg / curAvg).toFixed(1);
            if (factor >= 1.2) {
              speedups.push({
                name: item.model.name,
                quant: item.quant,
                before: currentItem.tokPerSec,
                after: item.tokPerSec,
                factor,
              });
            }
          }
        }
      }
    }

    return {
      countCurrent,
      countNew,
      unlockedModels: unlocked.slice(0, 5), // Cap to top 5
      unlockedTotalCount: Math.max(0, countNew - countCurrent),
      speedups: speedups.sort((a, b) => b.factor - a.factor).slice(0, 3), // Top 3 speedups
    };
  }, [hw, models, selectedUpgrade, upgradeOptions]);

  if (!bottleneck) return null;

  const currentOption = upgradeOptions.find(opt => opt.id === selectedUpgrade);

  return (
    <div className="card p-6 border-[#1E2B1E] bg-gradient-to-br from-[#0A100A] via-[#0C140C] to-[#0A0D0A] shadow-[0_4px_30px_rgba(0,0,0,0.8)] relative overflow-hidden my-6">
      
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-sky-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Title */}
      <div className="flex items-center gap-3 mb-5 border-b border-[#1E2B1E]/60 pb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.15)] text-emerald-400">
          <Zap size={15} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white font-mono tracking-tight">
            Hardware Bottleneck Analyser &amp; Planner
          </h3>
          <p className="text-[11px] text-[#4A654A] mt-0.5">
            Simulate system upgrades to see unlocked models and estimated token speeds.
          </p>
        </div>
      </div>

      {/* Active Bottleneck Diagnosis */}
      {bottleneck.severity !== 'none' && (
        <div className="mb-6 rounded-xl border border-amber-950/40 bg-amber-950/10 p-4 flex gap-3">
          <div className="text-lg select-none">⚠️</div>
          <div>
            <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <span>{bottleneck.type} Bottleneck Detected</span>
              <span className={`w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping`} />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              {bottleneck.desc}
            </p>
            <p className="text-[11px] text-[#A6C4A6] mt-2 font-medium">
              💡 <span className="underline decoration-emerald-800 underline-offset-2">Recommendation:</span> {bottleneck.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* Upgrade Options List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
        {upgradeOptions.map((opt) => {
          const isActive = selectedUpgrade === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelectedUpgrade(isActive ? null : opt.id)}
              className={`text-left rounded-xl p-4 border transition-all duration-300 flex flex-col justify-between group relative overflow-hidden
                ${isActive
                  ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'border-[#1E2B1E] bg-[#0E150E]/40 hover:border-emerald-800/80 hover:bg-emerald-950/5'
                }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-[#4A654A] font-mono group-hover:text-emerald-500 transition-colors">
                    {opt.tag}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                  )}
                </div>
                <h4 className="text-xs font-bold text-white mt-1 group-hover:text-emerald-400 transition-colors">
                  {opt.name}
                </h4>
                <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#7EAF7E] font-mono mt-4 border-t border-[#1E2B1E]/40 pt-2.5 w-full">
                <span>Simulate Upgrade</span>
                <ArrowRight size={10} className="transform group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Simulation Result Area */}
      {selectedUpgrade && currentOption && (
        <div className="rounded-xl border border-emerald-900/30 bg-[#070D07]/60 p-5 space-y-4 animate-fadeIn">
          
          <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-[#1E2B1E]/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#7EAF7E]">Active Simulation:</span>
              <span className="text-xs font-bold text-white font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60">
                {currentOption.name}
              </span>
            </div>
            <button
              onClick={() => onApplyHardware(currentOption.simulatedHw)}
              className="btn-primary text-[10px] py-1 px-3 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
            >
              <RefreshCw size={10} /> Apply Specs to Calculator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            
            {/* Column 1: Unlocked Models */}
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase font-bold tracking-widest text-[#4A654A] flex items-center gap-1.5">
                <Layers size={11} className="text-emerald-500" />
                <span>Unlocked Models ({comparison.unlockedTotalCount})</span>
              </h5>
              
              {comparison.unlockedTotalCount === 0 ? (
                <div className="text-xs text-zinc-500 italic py-2">
                  No new model tiers unlocked, but existing ones will run much faster!
                </div>
              ) : (
                <div className="space-y-2">
                  {comparison.unlockedModels.map((m, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[#0B100B]/80 p-2.5 rounded-lg border border-[#1E2B1E]/30 text-xs">
                      <div>
                        <div className="font-semibold text-white">{m.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Quant: {m.quant} • Size: {m.vramRequired}GB</div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-900/50 px-2 py-0.5 rounded-full font-mono">
                        {m.tokPerSec} t/s
                      </span>
                    </div>
                  ))}
                  {comparison.unlockedTotalCount > 5 && (
                    <div className="text-[10px] text-[#4A654A] font-mono text-center pt-1">
                      + {comparison.unlockedTotalCount - 5} more quants unlocked
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column 2: Speedup Metrics */}
            <div className="space-y-3">
              <h5 className="text-[10px] uppercase font-bold tracking-widest text-[#4A654A] flex items-center gap-1.5">
                <TrendingUp size={11} className="text-[#38BDF8]" />
                <span>Speed Gains &amp; Performance</span>
              </h5>

              {comparison.speedups.length === 0 ? (
                <div className="text-xs text-zinc-500 italic py-2">
                  Already running at maximum bandwidth capability.
                </div>
              ) : (
                <div className="space-y-2">
                  {comparison.speedups.map((s, idx) => (
                    <div key={idx} className="bg-[#0B100B]/80 p-2.5 rounded-lg border border-[#1E2B1E]/30 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-white text-xs">{s.name} ({s.quant})</span>
                        <span className="text-[10px] font-bold text-sky-400 bg-sky-950/30 border border-sky-900/50 px-1.5 py-0.2 rounded font-mono">
                          +{Math.round((s.factor - 1) * 100)}% Speed
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span>Current: {s.before} t/s</span>
                        <ArrowRight size={10} className="text-zinc-600" />
                        <span className="text-emerald-400 font-bold">Upgraded: {s.after} t/s</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bandwidth increase callout */}
              <div className="rounded-lg bg-emerald-950/10 border border-emerald-950/60 p-3 text-[11px] text-zinc-400 leading-relaxed font-sans">
                ⭐ <strong className="text-white">Bandwidth Leap:</strong> Upgrading memory speed or loading fully into VRAM bypasses the system RAM bus bottleneck, giving you consistent, lag-free streaming tokens.
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
