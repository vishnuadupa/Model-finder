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
  if (hw.unifiedMem) return { gpuOnly: hw.ram, withOffload: hw.ram };

  const gpuVRAM = hw.vram * (hw.numGPUs || 1);

  // CPU offload: depends on RAM bandwidth (ramType) and CPU tier
  const ramFactor = hw.ramBandwidthFactor || 0.7;
  const cpuOffloadFraction =
    hw.cpuTier === 'ultra' ? 0.30
  : hw.cpuTier === 'high'  ? 0.22
  : hw.cpuTier === 'mid'   ? 0.15
  : 0.08; // low

  const cpuBonus = hw.ram * cpuOffloadFraction * ramFactor;
  return { gpuOnly: gpuVRAM, withOffload: gpuVRAM + cpuBonus };
}

// ─── Bandwidth-based tok/s estimation ──────────────────────────────────────
// Core insight: LLM autoregressive decoding is memory-bandwidth-bound.
// Each token requires reading the entire model weights from VRAM once.
// tok/s ≈ bandwidth_GBps / model_size_GB * quant_efficiency * backend_efficiency
export function estimateTokPerSec(hw, model, quant, gpuFits, backend) {
  if (!gpuFits) {
    // CPU-only: use system RAM bandwidth
    const ramBW = hw.ramBandwidthGB || 51; // default DDR4-3200
    const ramFactor = hw.ramBandwidthFactor || 0.65;
    const modelGB = weightsVRAM(model.params, QUANT_BITS[quant] || 4.85);
    const base = (ramBW * ramFactor * 0.6) / modelGB; // 60% efficiency for CPU
    return `${Math.max(1, Math.round(base * 0.7))}-${Math.max(2, Math.round(base * 1.1))}`;
  }

  const bandwidthGBs = hw.bandwidth || 200; // fallback if not set
  const quantEff     = QUANT_BW_EFFICIENCY[quant] || 0.95;
  const backendEff   = BACKEND_EFFICIENCY[backend || 'cuda'];
  const modelGB      = weightsVRAM(model.params, QUANT_BITS[quant] || 4.85);

  // Multi-GPU: bandwidth scales but with overhead
  const numGPUs      = hw.numGPUs || 1;
  const multiGPUEff  = numGPUs === 1 ? 1.0 : numGPUs === 2 ? 1.85 : numGPUs === 4 ? 3.4 : 1.0;
  const effectiveBW  = bandwidthGBs * numGPUs * (multiGPUEff / numGPUs);

  // Flash Attention reduces KV cache reads → slight tok/s boost for long context
  const faBoost = hw.flashAttn ? 1.05 : 1.0;

  const base = (effectiveBW * quantEff * backendEff * faBoost) / modelGB;

  // Clamp to realistic range
  const lo = Math.max(1, Math.round(base * 0.82));
  const hi = Math.max(2, Math.round(base * 1.18));
  return `${lo}-${hi}`;
}

// ─── Scoring ───────────────────────────────────────────────────────────────
export function scoreModelQuant(hw, model, quant, contextLength, flashAttn, os) {
  const req = calculateRequirements(model, quant, contextLength, flashAttn);
  if (!req) return null;

  const eff = effectiveVRAM(hw);
  const gpuFits     = eff.gpuOnly    >= req.vramGB;
  const offloadFits = eff.withOffload >= req.vramGB;
  const ramFits     = hw.ram         >= req.ramMinGB;

  if (!offloadFits || !ramFits) return null;

  const vramHeadroom = gpuFits ? (eff.gpuOnly - req.vramGB) / eff.gpuOnly : 0;
  const ramHeadroom  = (hw.ram - req.ramMinGB) / hw.ram;

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

  const tokPerSec = estimateTokPerSec(hw, model, quant, gpuFits, backend);

  return {
    tier, score, backend,
    vramRequired:     req.vramGB,
    vramFree:         +(eff.gpuOnly - req.vramGB).toFixed(1),
    ramRequired:      req.ramMinGB,
    ramComfGB:        req.ramComfGB,
    weightsGB:        req.weightsGB,
    kvCacheGB:        req.kvCacheGB,
    tokPerSec,
    cpuOffloadNeeded: !gpuFits,
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
