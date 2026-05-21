// ─── Quant bit-width map ───────────────────────────────────────────────────
export const QUANT_BITS = {
  IQ2_XXS: 2.06,
  IQ2_XS:  2.31,
  Q2_K:    2.6,
  IQ3_XXS: 3.06,
  Q3_K_M:  3.35,
  Q4_0:    4.5,
  IQ4_XS:  4.25,
  IQ4_NL:  4.5,
  Q4_K_M:  4.85,
  Q4_K_S:  4.37,
  Q5_K_M:  5.69,
  Q5_K_S:  5.54,
  Q6_K:    6.57,
  Q8_0:    8.5,
  F16:     16,
  BF16:    16,
  F32:     32,
};

export const QUANTS_ORDERED = Object.keys(QUANT_BITS);

// KV cache context multipliers (fallback when arch constants unknown)
const CTX_MULTIPLIER = {
  2048:   0.06,
  4096:   0.10,
  8192:   0.18,
  32768:  0.55,
  131072: 1.80,
};

// Backend efficiency factors relative to CUDA
// These reflect real-world llama.cpp performance differences
export const BACKEND_EFFICIENCY = {
  cuda:   1.00,  // NVIDIA CUDA — reference
  metal:  0.88,  // Apple Metal — very good, near CUDA for most models
  rocm:   0.82,  // AMD ROCm on Linux — good but slightly behind
  vulkan: 0.62,  // AMD ROCm on Windows / Intel Arc Vulkan — limited
  cpu:    0.08,  // CPU-only — very slow
};

// OS-specific backend determination
export function getBackend(os, gpuLabel) {
  if (!gpuLabel || gpuLabel === 'No GPU (CPU only)') return 'cpu';
  if (gpuLabel.startsWith('Apple')) return 'metal';
  if (gpuLabel.startsWith('Arc') || gpuLabel.startsWith('Intel Arc')) return 'vulkan';

  const isAMD = gpuLabel.startsWith('RX ') || gpuLabel.startsWith('Radeon');
  if (isAMD) return os === 'Linux' ? 'rocm' : 'vulkan';

  return 'cuda'; // NVIDIA
}

// Quant bandwidth efficiency — lower quants are slightly less efficient to load
// due to dequantization overhead
export const QUANT_BW_EFFICIENCY = {
  IQ2_XXS: 0.88, Q2_K: 0.90, Q3_K_M: 0.92,
  Q4_0: 0.95, IQ4_XS: 0.95, Q4_K_M: 0.97, Q4_K_S: 0.96,
  Q5_K_M: 0.98, Q5_K_S: 0.98, Q6_K: 0.99, Q8_0: 1.00,
  F16: 1.00, BF16: 1.00, F32: 0.95,
};

// ─── Core math ─────────────────────────────────────────────────────────────
export function weightsVRAM(paramsBillions, bitsPerWeight) {
  return (paramsBillions * bitsPerWeight * 1.05) / 8; // GB, 5% overhead
}

export function kvCacheVRAM(contextLength, numLayers, numKVHeads, headDim, flashAttn = false) {
  if (numLayers && numKVHeads && headDim) {
    const bytesPerToken = 2 * numLayers * numKVHeads * headDim * 2; // K+V, fp16
    const gb = (bytesPerToken * contextLength) / 1e9;
    return flashAttn ? gb * 0.70 : gb;
  }
  // Fallback: file-size-based estimate
  const nearest = Object.keys(CTX_MULTIPLIER)
    .map(Number)
    .reduce((a, b) => Math.abs(b - contextLength) < Math.abs(a - contextLength) ? b : a);
  return CTX_MULTIPLIER[nearest];
}

export function calculateRequirements(model, quantLevel, contextLength, flashAttn) {
  const bits = QUANT_BITS[quantLevel];
  if (!bits) return null;

  const weights = weightsVRAM(model.params, bits);
  const kv      = kvCacheVRAM(contextLength, model.layers, model.numKVHeads, model.headDim, flashAttn);
  const total   = weights + kv;

  return {
    vramGB:     +total.toFixed(2),
    weightsGB:  +weights.toFixed(2),
    kvCacheGB:  +kv.toFixed(2),
    ramMinGB:   +(total * 1.5).toFixed(1),
    ramComfGB:  +(total * 2.0).toFixed(1),
    fileSizeGB: +(model.params * bits / 8).toFixed(2),
  };
}

export function effectiveVRAM(hw) {
  // Apple Silicon / unified memory: entire RAM is the GPU pool, capped by chip's physical max
  if (hw.unifiedMem) {
    const usable = hw.maxRam ? Math.min(hw.ram, hw.maxRam) : hw.ram;
    return { gpuOnly: usable, withOffload: usable };
  }

  // CPU-only (no discrete GPU): entire RAM is available for inference
  if (!hw.vram || hw.vram === 0) {
    return { gpuOnly: 0, withOffload: hw.ram };
  }

  const gpuVRAM = hw.vram * (hw.numGPUs || 1);

  // CPU offload fraction scaled by CPU quality (cpuRamFactor, separate from RAM type speed)
  const cpuFactor = hw.cpuRamFactor || 0.7;
  const cpuOffloadFraction =
    hw.cpuTier === 'ultra' ? 0.30
  : hw.cpuTier === 'high'  ? 0.22
  : hw.cpuTier === 'mid'   ? 0.15
  : 0.08;

  // PCIe gen affects host↔device transfer bandwidth during CPU offload.
  // Gen 3 (16 GB/s) is a meaningful bottleneck; Gen 4+ (32/64 GB/s) is not.
  const pcieFactor = !hw.pcie ? 1.0
    : hw.pcie >= 5 ? 1.10
    : hw.pcie >= 4 ? 1.00
    : 0.80; // PCIe 3 — old Turing/Pascal GPUs suffer slower host-device copies

  // The actual physical limit of offloadable VRAM+RAM is VRAM + RAM.
  // We return `withOffload: gpuVRAM + hw.ram` because llama.cpp can offload any remaining layers to system RAM.
  // Sizing limits are already checked and enforced in scoreModelQuant().
  return { gpuOnly: gpuVRAM, withOffload: gpuVRAM + hw.ram };
}

// ─── Bandwidth-based tok/s estimation ──────────────────────────────────────
// Core: LLM autoregressive decoding is memory-bandwidth-bound for large models.
// tok/s ≈ bandwidth_GBps / model_size_GB * quant_efficiency * backend_efficiency
//
// Small model correction: models < 2 GB become compute-bound or latency-bound
// (overhead of attention ops, memory latency, etc. dominates over pure BW).
// We floor modelGB at 2.0 to prevent tok/s from exploding unrealistically.
const MIN_MODEL_GB_FOR_BW_FORMULA = 2.0;

export function estimateTokPerSec(hw, model, quant, gpuFits, backend, contextLength = 4096, flashAttn = false) {
  const eff = effectiveVRAM(hw);
  const req = calculateRequirements(model, quant, contextLength, flashAttn);
  
  const rawModelGB = weightsVRAM(model.params, QUANT_BITS[quant] || 4.85);
  const modelGB = Math.max(rawModelGB, MIN_MODEL_GB_FOR_BW_FORMULA);

  // CPU speed baseline
  const ramBW    = hw.ramBandwidthGB || 51;
  const ramFactor = hw.ramBandwidthFactor || 0.65;
  // More CPU cores → better parallelism in llama.cpp threading.
  // Effect is sub-linear (bandwidth-bound), capped at ~30% gain above 4 cores.
  const coresFactor = hw.cpuCores
    ? Math.min(1.0 + (hw.cpuCores - 4) * 0.025, 1.30)
    : 1.0;
  const baseCPU = Math.max(0.1, (ramBW * ramFactor * 0.6 * coresFactor) / modelGB);

  // CPU-only (no discrete GPU)
  if (!hw.vram || hw.vram === 0) {
    const lo = Math.max(1, Math.round(baseCPU * 0.7));
    const hi = Math.max(2, Math.round(baseCPU * 1.1));
    return `${lo}–${hi}`;
  }

  // GPU speed baseline
  const bandwidthGBs = hw.bandwidth || 200;
  const quantEff     = QUANT_BW_EFFICIENCY[quant] || 0.95;
  const backendEff   = BACKEND_EFFICIENCY[backend || 'cuda'];
  const numGPUs      = hw.numGPUs || 1;
  const multiGPUEff  = numGPUs === 1 ? 1.0 : numGPUs === 2 ? 1.85 : numGPUs === 4 ? 3.4 : 1.0;
  const effectiveBW  = bandwidthGBs * numGPUs * (multiGPUEff / numGPUs);
  const faBoost      = (flashAttn || hw.flashAttn) ? 1.05 : 1.0;
  const baseGPU      = Math.max(0.1, (effectiveBW * quantEff * backendEff * faBoost) / modelGB);

  // Let's compute f - the fraction of the model loaded in GPU VRAM.
  // If gpuFits is true, f is 1.0. Otherwise it is eff.gpuOnly / req.vramGB, capped at 0.95.
  const f = gpuFits ? 1.0 : (req ? Math.min(0.95, eff.gpuOnly / req.vramGB) : 0);

  let base;
  if (f <= 0) {
    base = baseCPU;
  } else if (f >= 1.0) {
    base = baseGPU;
  } else {
    // Weighted Harmonic Mean (Amdahl's Law) for hybrid memory layouts:
    // 1 / Speed = f / GPU_Speed + (1 - f) / CPU_Speed
    base = 1.0 / (f / baseGPU + (1.0 - f) / baseCPU);
  }

  // Speed ranges are dynamically scaled based on GPU fraction
  const loFactor = 0.7 + 0.12 * f; // transitions smoothly from 0.70 (CPU) to 0.82 (GPU)
  const hiFactor = 1.1 + 0.08 * f; // transitions smoothly from 1.10 (CPU) to 1.18 (GPU)
  const lo = Math.max(1, Math.round(base * loFactor));
  const hi = Math.max(2, Math.round(base * hiFactor));
  return `${lo}–${hi}`;
}

// ─── Scoring ───────────────────────────────────────────────────────────────
export function scoreModelQuant(hw, model, quant, contextLength, flashAttn, os) {
  const req = calculateRequirements(model, quant, contextLength, flashAttn);
  if (!req) return null;

  const eff = effectiveVRAM(hw);
  const gpuFits     = eff.gpuOnly    >= req.vramGB;
  const offloadFits = eff.withOffload >= req.vramGB;

  // Calibrate system RAM requirements depending on hardware configuration
  let ramFits = false;
  let ramMinGB = req.ramMinGB;
  let ramComfGB = req.ramComfGB;

  if (hw.unifiedMem) {
    // Apple Silicon unified RAM: holds weights + KV cache + OS headroom
    ramMinGB = +(req.vramGB + 2.5).toFixed(1);
    ramComfGB = +(req.vramGB + 4.0).toFixed(1);
    ramFits = hw.ram >= ramMinGB;
  } else if (gpuFits) {
    // Fits in VRAM: system RAM only needs OS headroom and loader buffers
    ramMinGB = +Math.max(8, req.weightsGB + 2.0).toFixed(1);
    ramComfGB = +Math.max(16, req.weightsGB + 4.0).toFixed(1);
    ramFits = hw.ram >= ramMinGB;
  } else {
    // CPU offload: system RAM only needs to hold the non-offloaded weights + KV cache plus loader/OS overhead.
    // This fixes the double-RAM bug where host RAM was required to hold the entire model size again!
    const offloadedGB = Math.max(0, req.vramGB - eff.gpuOnly);
    ramMinGB = +(offloadedGB * 1.15 + 3.0).toFixed(1);
    ramComfGB = +(offloadedGB * 1.35 + 6.0).toFixed(1);
    ramFits = hw.ram >= ramMinGB;
  }

  if (!offloadFits || !ramFits) return null;

  const vramHeadroom = gpuFits ? (eff.gpuOnly - req.vramGB) / eff.gpuOnly : 0;
  const ramHeadroom  = (hw.ram - ramMinGB) / hw.ram;

  const ssdBonus   = hw.ssd === 'nvme' ? 0.08 : hw.ssd === 'sata' ? 0 : -0.12;
  const cpuBonus   = hw.cpuTier === 'ultra' ? 0.08
                   : hw.cpuTier === 'high'  ? 0.06
                   : hw.cpuTier === 'mid'   ? 0.02
                   : 0;
  const flashBonus = flashAttn ? 0.05 : 0;
  const ramTypeBonus = (hw.ramBandwidthFactor || 0.65) > 0.85 ? 0.03 : 0;

  // Backend penalty — Vulkan / ROCm-Windows are slower → push models to lower tiers
  const backend = getBackend(os, hw.gpuLabel);
  const backendPenalty = backend === 'vulkan' ? -0.10 : backend === 'rocm' ? -0.03 : 0;

  const score = (vramHeadroom * 0.60) + (ramHeadroom * 0.28)
              + ssdBonus + cpuBonus + flashBonus + ramTypeBonus + backendPenalty;

  let tier;
  if (!gpuFits)          tier = 'stretch';
  else if (score > 0.40) tier = 'recommended';
  else if (score > 0.15) tier = 'comfortable';
  else                   tier = 'stretch';

  const tokPerSec = estimateTokPerSec(hw, model, quant, gpuFits, backend, contextLength, flashAttn);

  return {
    tier, score, backend,
    vramRequired:     req.vramGB,
    vramFree:         +(eff.gpuOnly - req.vramGB).toFixed(1),
    ramRequired:      ramMinGB,
    ramComfGB:        ramComfGB,
    weightsGB:        req.weightsGB,
    kvCacheGB:        req.kvCacheGB,
    tokPerSec,
    cpuOffloadNeeded: !gpuFits,
    cpuOnly:          hw.vram === 0 && !hw.unifiedMem,
    downloadSizeGB:   req.fileSizeGB,
  };
}

// ─── Main analysis ──────────────────────────────────────────────────────────
// speedPref → minimum tok/s lower-bound to include a result
const SPEED_MIN = { fast: 30, medium: 10, slow: 0 };

export function analyzeHardware(hw, contextLength, flashAttn, models, os) {
  const results  = { recommended: [], comfortable: [], stretch: [] };
  const seen     = new Set();
  const speedMin = SPEED_MIN[hw.speedPref] ?? 0;

  // Normalise useCases to lowercase for comparison
  const wantedUses = (hw.useCases || []).map(u => u.toLowerCase());

  for (const model of models) {
    // Hard use-case filter: if user selected use cases, only show models that match at least one.
    // If nothing selected, show everything.
    if (wantedUses.length > 0) {
      const modelUses = (model.useCases || []).map(u => u.toLowerCase());
      if (!modelUses.some(u => wantedUses.includes(u))) continue;
    }

    for (const q of model.quants) {
      const quant = typeof q === 'string' ? q : q.q;
      const s = scoreModelQuant(hw, model, quant, contextLength, flashAttn, os);
      if (!s) continue;

      // speedPref filter — drop results that can't hit the user's minimum speed
      if (speedMin > 0) {
        const tpsLo = parseInt(s.tokPerSec, 10) || 0;
        if (tpsLo < speedMin) continue;
      }

      const key = `${model.name}_${s.tier}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results[s.tier].push({ model, quant, ...s });
    }
  }

  // Composite rank: VRAM fit score (50%) + tok/s speed (30%) + model size/quality (20%)
  // tokPerSec can be a number or a "65-80" string from Gemini — parseInt handles both
  // Use-case match gives a tie-breaking boost (+0.12) for models that match selected use cases
  function rankScore(r) {
    const tps = parseInt(r.tokPerSec, 10) || 0;
    const useCaseMatch = wantedUses.length > 0 && (r.model.useCases || []).some(
      u => wantedUses.includes(u.toLowerCase())
    ) ? 0.12 : 0;
    return r.score * 0.50
         + Math.min(tps / 500, 1) * 0.30
         + Math.min(r.model.params / 100, 1) * 0.20
         + useCaseMatch;
  }

  for (const tier of ['recommended', 'comfortable', 'stretch']) {
    results[tier].sort((a, b) => rankScore(b) - rankScore(a));
  }

  return results;
}
