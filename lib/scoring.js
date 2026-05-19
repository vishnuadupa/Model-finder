// ─── Quant bit-width map ───────────────────────────────────────────────────
export const QUANT_BITS = {
  IQ2_XXS: 2.06,
  Q2_K:    2.6,
  Q3_K_M:  3.35,
  Q4_0:    4.5,
  IQ4_XS:  4.25,
  Q4_K_M:  4.85,
  Q5_K_M:  5.69,
  Q6_K:    6.57,
  Q8_0:    8.5,
  F16:     16,
  F32:     32,
};

export const QUANTS_ORDERED = Object.keys(QUANT_BITS);

// KV cache multiplier fallback when arch constants unknown
const CTX_MULTIPLIER = {
  2048:   0.06,
  4096:   0.10,
  8192:   0.18,
  32768:  0.55,
  131072: 1.80,
};

// ─── Core math ────────────────────────────────────────────────────────────
export function weightsVRAM(paramsBillions, bitsPerWeight) {
  return (paramsBillions * bitsPerWeight * 1.05) / 8; // GB
}

export function kvCacheVRAM(contextLength, numLayers, numKVHeads, headDim, flashAttn = false) {
  if (numLayers && numKVHeads && headDim) {
    const bytesPerToken = 2 * numLayers * numKVHeads * headDim * 2;
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
  const bits    = QUANT_BITS[quantLevel];
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

  const gpuVRAM = hw.vram * hw.numGPUs;
  const cpuBonus = hw.cpuTier === 'high' ? hw.ram * 0.25
                 : hw.cpuTier === 'mid'  ? hw.ram * 0.15
                 : 0;
  return { gpuOnly: gpuVRAM, withOffload: gpuVRAM + cpuBonus };
}

// ─── GPU speed index (tok/s base, community benchmarks) ───────────────────
const GPU_SPEED = {
  'RTX 4090': 150, 'RTX 4080': 110, 'RTX 4070 Ti': 90,
  'RTX 4070':  75, 'RTX 4060 Ti': 60, 'RTX 4060': 50,
  'RTX 3090': 100, 'RTX 3080': 80, 'RTX 3070': 65, 'RTX 3060': 45,
  'RTX 2080 Ti': 55, 'GTX 1080 Ti': 35, 'GTX 1060': 20,
  'RX 7900 XTX': 90, 'RX 7800 XT': 65, 'RX 6700 XT': 40,
  'Apple M4': 90, 'Apple M3': 80, 'Apple M2': 65, 'Apple M1': 50,
};

const QUANT_MULT = {
  Q2_K: 1.15, IQ2_XXS: 1.20, Q4_K_M: 1.0, IQ4_XS: 1.05,
  Q5_K_M: 0.92, Q6_K: 0.85, Q8_0: 0.75, F16: 0.55, F32: 0.35,
};

export function estimateTokPerSec(hw, model, quant, gpuFits) {
  if (!gpuFits) return hw.cpuTier === 'high' ? '3-8' : '1-4';

  const gpuKey   = Object.keys(GPU_SPEED).find(k => hw.gpuLabel?.includes(k)) || '';
  const gpuBase  = (GPU_SPEED[gpuKey] || 40) * hw.numGPUs;
  const qMult    = QUANT_MULT[quant] || 1.0;
  const sizeMult = model.params <= 4  ? 2.0
                 : model.params <= 9  ? 1.4
                 : model.params <= 14 ? 1.0
                 : model.params <= 32 ? 0.6
                 : model.params <= 70 ? 0.3
                 : 0.15;

  const base = gpuBase * qMult * sizeMult;
  return `${Math.round(base * 0.8)}-${Math.round(base * 1.2)}`;
}

// ─── Scoring ──────────────────────────────────────────────────────────────
export function scoreModelQuant(hw, model, quant, contextLength, flashAttn) {
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
  const cpuBonus   = hw.cpuTier === 'high' ? 0.06 : hw.cpuTier === 'mid' ? 0.02 : 0;
  const flashBonus = flashAttn ? 0.05 : 0;

  const score = (vramHeadroom * 0.6) + (ramHeadroom * 0.3) + ssdBonus + cpuBonus + flashBonus;

  let tier;
  if (!gpuFits)          tier = 'stretch';
  else if (score > 0.40) tier = 'recommended';
  else if (score > 0.15) tier = 'comfortable';
  else                   tier = 'stretch';

  const tokPerSec = estimateTokPerSec(hw, model, quant, gpuFits);

  return {
    tier, score,
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

// ─── Main analysis ────────────────────────────────────────────────────────
export function analyzeHardware(hw, contextLength, flashAttn, models) {
  const results = { recommended: [], comfortable: [], stretch: [] };
  const seen    = new Set();

  for (const model of models) {
    for (const q of model.quants) {
      const quant = typeof q === 'string' ? q : q.q;
      const s = scoreModelQuant(hw, model, quant, contextLength, flashAttn);
      if (!s) continue;

      const key = `${model.name}_${s.tier}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results[s.tier].push({ model, quant, ...s });
    }
  }

  for (const tier of ['recommended', 'comfortable', 'stretch']) {
    results[tier].sort((a, b) => b.score - a.score);
  }

  return results;
}
