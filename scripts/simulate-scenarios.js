const fs = require('fs');
const path = require('path');

// Load scoring functions directly (mocking imports or using require)
// We will load lib/scoring.js and extract the functions, or write them natively in the test script to make it self-contained.
// Let's read lib/scoring.js to see if we can import it. Since Next.js uses ES modules, we can either use dynamic imports or just replicate the exact logic to make a fast, rock-solid script.
// Let's implement the scoring logic in the script exactly as in lib/scoring.js to be absolutely robust and independent of environment quirks.

const QUANT_BITS = {
  IQ2_XXS: 2.06, IQ2_XS:  2.31, Q2_K:    2.6, IQ3_XXS: 3.06, Q3_K_M:  3.35, Q4_0:    4.5,
  IQ4_XS:  4.25, IQ4_NL:  4.5, Q4_K_M:  4.85, Q4_K_S:  4.37, Q5_K_M:  5.69, Q5_K_S:  5.54,
  Q6_K:    6.57, Q8_0:    8.5, F16:     16, BF16:    16, F32:     32,
};

const BACKEND_EFFICIENCY = {
  cuda:   1.00, mlx:    0.95, metal:  0.88, rocm:   0.82, vulkan: 0.62, cpu:    0.08,
};

const QUANT_BW_EFFICIENCY = {
  IQ2_XXS: 0.88, Q2_K: 0.90, Q3_K_M: 0.92, Q4_0: 0.95, IQ4_XS: 0.95, Q4_K_M: 0.97, Q4_K_S: 0.96,
  Q5_K_M: 0.98, Q5_K_S: 0.98, Q6_K: 0.99, Q8_0: 1.00, F16: 1.00, BF16: 1.00, F32: 0.95,
};

function getBackend(os, gpuLabel) {
  if (!gpuLabel || gpuLabel === 'No GPU (CPU only)') return 'cpu';
  if (gpuLabel.startsWith('Apple')) return 'mlx';
  if (gpuLabel.startsWith('Arc') || gpuLabel.startsWith('Intel Arc')) return 'vulkan';
  const isAMD = gpuLabel.startsWith('RX ') || gpuLabel.startsWith('Radeon');
  if (isAMD) return os === 'Linux' ? 'rocm' : 'vulkan';
  return 'cuda';
}

function weightsVRAM(paramsBillions, bitsPerWeight) {
  return (paramsBillions * bitsPerWeight * 1.05) / 8;
}

function kvCacheVRAM(contextLength, numLayers, numKVHeads, headDim, flashAttn = false) {
  if (numLayers && numKVHeads && headDim) {
    const bytesPerToken = 2 * numLayers * numKVHeads * headDim * 2;
    const gb = (bytesPerToken * contextLength) / 1e9;
    return flashAttn ? gb * 0.70 : gb;
  }
  const CTX_MULTIPLIER = { 2048: 0.06, 4096: 0.10, 8192: 0.18, 32768: 0.55, 131072: 1.80 };
  const nearest = Object.keys(CTX_MULTIPLIER)
    .map(Number)
    .reduce((a, b) => Math.abs(b - contextLength) < Math.abs(a - contextLength) ? b : a);
  return CTX_MULTIPLIER[nearest];
}

function calculateRequirements(model, quantLevel, contextLength, flashAttn) {
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

function effectiveVRAM(hw) {
  const pcieFactor = !hw.pcie ? 1.0
    : hw.pcie >= 5 ? 1.15
    : hw.pcie >= 4 ? 1.00
    : hw.pcie === 3 ? 0.75
    : 0.50;

  if (hw.unifiedMem) {
    const usable = hw.maxRam ? Math.min(hw.ram, hw.maxRam) : hw.ram;
    const gpuLimit = usable <= 8 ? usable * 0.66 : usable * 0.75;
    return { gpuOnly: gpuLimit, withOffload: usable, pcieFactor: 1.0 };
  }

  if (!hw.vram || hw.vram === 0) {
    return { gpuOnly: 0, withOffload: hw.ram, pcieFactor: 1.0 };
  }

  const gpuVRAM = hw.vram * (hw.numGPUs || 1);
  return { gpuOnly: gpuVRAM, withOffload: gpuVRAM + hw.ram, pcieFactor };
}

function estimateTokPerSec(hw, model, quant, gpuFits, backend, contextLength = 4096, flashAttn = false) {
  const eff = effectiveVRAM(hw);
  const req = calculateRequirements(model, quant, contextLength, flashAttn);
  
  const rawModelGB = weightsVRAM(model.params, QUANT_BITS[quant] || 4.85);
  const modelGB = Math.max(rawModelGB, 2.0);

  const ramBW    = hw.ramBandwidthGB || 51;
  const ramFactor = hw.ramBandwidthFactor || 0.65;
  const coresFactor = hw.cpuCores
    ? Math.min(1.0 + (hw.cpuCores - 4) * 0.025, 1.30)
    : 1.0;
  const baseCPU = Math.max(0.1, (ramBW * ramFactor * 0.6 * coresFactor) / modelGB);

  if ((!hw.vram || hw.vram === 0) && !hw.unifiedMem) {
    const lo = Math.max(1, Math.round(baseCPU * 0.7));
    const hi = Math.max(2, Math.round(baseCPU * 1.1));
    return `${lo}–${hi}`;
  }

  const bandwidthGBs = hw.bandwidth || 200;
  const quantEff     = QUANT_BW_EFFICIENCY[quant] || 0.95;
  const backendEff   = BACKEND_EFFICIENCY[backend || 'cuda'];
  const numGPUs      = hw.numGPUs || 1;
  const multiGPUEff  = numGPUs === 1 ? 1.0 : numGPUs === 2 ? 1.45 : numGPUs === 4 ? 2.10 : 1.0;
  const effectiveBW  = bandwidthGBs * numGPUs * (multiGPUEff / numGPUs);
  const faBoost      = (flashAttn || hw.flashAttn) ? 1.05 : 1.0;
  const baseGPU      = Math.max(0.1, (effectiveBW * quantEff * backendEff * faBoost) / modelGB);

  const f = gpuFits ? 1.0 : (req ? Math.min(0.95, eff.gpuOnly / req.vramGB) : 0);

  let base;
  if (f <= 0) {
    base = baseCPU;
  } else if (f >= 1.0) {
    base = baseGPU;
  } else {
    base = (1.0 / (f / baseGPU + (1.0 - f) / baseCPU)) * (eff.pcieFactor || 1.0);
  }

  const loFactor = 0.7 + 0.12 * f;
  const hiFactor = 1.1 + 0.08 * f;
  const lo = Math.max(1, Math.round(base * loFactor));
  const hi = Math.max(2, Math.round(base * hiFactor));
  return `${lo}–${hi}`;
}

function scoreModelQuant(hw, model, quant, contextLength, flashAttn, os) {
  const req = calculateRequirements(model, quant, contextLength, flashAttn);
  if (!req) return null;

  const eff = effectiveVRAM(hw);
  const gpuFits     = eff.gpuOnly    >= req.vramGB;
  const offloadFits = eff.withOffload >= req.vramGB;

  let ramFits = false;
  let ramMinGB = req.ramMinGB;
  let ramComfGB = req.ramComfGB;

  if (hw.unifiedMem) {
    ramMinGB = +(req.vramGB + 2.5).toFixed(1);
    ramComfGB = +(req.vramGB + 4.0).toFixed(1);
    ramFits = hw.ram >= ramMinGB;
  } else if (gpuFits) {
    ramMinGB = +Math.max(8, req.weightsGB + 2.0).toFixed(1);
    ramComfGB = +Math.max(16, req.weightsGB + 4.0).toFixed(1);
    ramFits = hw.ram >= ramMinGB;
  } else {
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

function analyzeHardware(hw, contextLength, flashAttn, models, os) {
  const results  = { recommended: [], comfortable: [], stretch: [] };
  const seen     = new Set();
  const speedMin = { fast: 30, medium: 10, slow: 0 }[hw.speedPref] ?? 0;
  const wantedUses = (hw.useCases || []).map(u => u.toLowerCase());

  for (const model of models) {
    if (wantedUses.length > 0) {
      const modelUses = (model.useCases || []).map(u => u.toLowerCase());
      if (!modelUses.some(u => wantedUses.includes(u))) continue;
    }

    for (const q of model.quants) {
      const quant = typeof q === 'string' ? q : q.q;
      const s = scoreModelQuant(hw, model, quant, contextLength, flashAttn, os);
      if (!s) continue;

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

  function rankScore(r) {
    const tps = parseInt(r.tokPerSec, 10) || 0;
    const useCaseMatch = wantedUses.length > 0 && (r.model.useCases || []).some(
      u => wantedUses.includes(u.toLowerCase())
    ) ? 0.12 : 0;
    return r.score * 0.50
         + Math.min(tps / 100, 1) * 0.30
         + Math.min(r.model.params / 100, 1) * 0.20
         + useCaseMatch;
  }

  for (const tier of ['recommended', 'comfortable', 'stretch']) {
    results[tier].sort((a, b) => rankScore(b) - rankScore(a));
  }

  return results;
}

// ── UpgradePlanner Simulation logic ───────────────────────────────
const SPEED_MIN = { fast: 30, medium: 15, slow: 8 };
const REF_MODEL_GB = 5.09;
const REF_MODEL_NAME = 'Llama 3 8B';

function getReferenceSpeed(simHw) {
  const quantEff = 0.97;
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

function getUpgradePlannerData(hw, models) {
  const currentTps = getReferenceSpeed(hw);
  const goalTps    = SPEED_MIN[hw.speedPref] || 8;
  const targetMet  = currentTps >= goalTps;
  const pct        = Math.min(100, Math.round((currentTps / goalTps) * 100));

  const isApple    = hw.unifiedMem || hw.gpuLabel?.startsWith('Apple') || hw.os === 'macOS';
  const backend    = isApple ? 'mlx' : getBackend(hw.os, hw.gpuLabel);
  const backendEff = BACKEND_EFFICIENCY[backend] || 1.0;
  const quantEff   = 0.97;
  const requiredBW = Math.round((goalTps * REF_MODEL_GB) / (quantEff * backendEff));

  const currentTotalVRAM = hw.unifiedMem ? hw.ram : (hw.vram || 0) * (hw.numGPUs || 1);
  const currentBW        = hw.bandwidth || hw.ramBandwidthGB || 0;

  const options = [];

  if (isApple) {
    const doubleRamVal = Math.min(192, hw.ram * 2);
    if (doubleRamVal > hw.ram) {
      const simHw = { ...hw, ram: doubleRamVal, maxRam: doubleRamVal };
      const estTps = getReferenceSpeed(simHw);
      options.push({
        id: 'apple_ram_boost',
        name: `Double RAM Boost (${doubleRamVal}GB)`,
        tag: 'Budget Option',
        estTps,
        goalMet: estTps >= goalTps,
        simulatedHw: simHw,
        desc: `Double unified memory to ${doubleRamVal}GB.`
      });
    }

    const betterApple = APPLE_GPU_LADDER.filter(a => {
      return a.vram > currentTotalVRAM || (a.vram === currentTotalVRAM && a.bw > currentBW);
    });

    betterApple.forEach(a => {
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
      options.push({
        id: a.id,
        name: a.name,
        estTps,
        goalMet: estTps >= goalTps,
        simulatedHw: simHw,
        desc: `${a.vram}GB unified memory at ${a.bw} GB/s.`
      });
    });
  } else {
    const newRam = Math.max(32, hw.ram * 2);
    if (newRam > hw.ram) {
      const simHw = {
        ...hw,
        ram: newRam,
        ramBandwidthGB: Math.max(96, (hw.ramBandwidthGB || 51) * 1.5),
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
        desc: `Upgrade system RAM to ${newRam}GB.`
      });
    }

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
        desc: `${g.vram}GB VRAM at ${g.bw} GB/s.`
      };
    });

    pcUpgrades.sort((a, b) => a.estTps - b.estTps);
    options.push(...pcUpgrades);
  }

  let foundMeetsGoal = false;
  const gpuCards = options.filter(opt => opt.id !== 'pc_ram' && opt.id !== 'apple_ram_boost');
  const fastestGpuId = gpuCards.length > 0 ? gpuCards[gpuCards.length - 1].id : null;

  const labeledOptions = options.map(opt => {
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

  return {
    currentTps,
    goalTps,
    targetMet,
    pct,
    requiredBW,
    upgrades: labeledOptions
  };
}

// ── Loading models ────────────────────────────────────────────────
const modelsPath = path.join(__dirname, '..', 'public', 'models.json');
const models = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));

// ── Defining 20 Scenarios ──────────────────────────────────────────
const scenarios = [
  {
    num: 1,
    name: "MacBook Air M2 8GB (Entry-level Apple)",
    os: "macOS",
    hw: {
      os: "macOS",
      ram: 8,
      maxRam: 8,
      unifiedMem: true,
      bandwidth: 100, // 100 GB/s (M2 base)
      gpuLabel: "Apple M2",
      cpuCores: 8,
      cpuTier: "mid",
      speedPref: "slow",
      ssd: "nvme",
      flashAttn: true
    }
  },
  {
    num: 2,
    name: "MacBook Pro M3 Pro 18GB (Mid-range Apple)",
    os: "macOS",
    hw: {
      os: "macOS",
      ram: 18,
      maxRam: 18,
      unifiedMem: true,
      bandwidth: 150, // 150 GB/s (M3 Pro)
      gpuLabel: "Apple M3 Pro",
      cpuCores: 11,
      cpuTier: "high",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true
    }
  },
  {
    num: 3,
    name: "MacBook Pro M3 Max 48GB (High-end Apple Pro)",
    os: "macOS",
    hw: {
      os: "macOS",
      ram: 48,
      maxRam: 48,
      unifiedMem: true,
      bandwidth: 300, // 300 GB/s (M3 Max 14-core variant)
      gpuLabel: "Apple M3 Max",
      cpuCores: 14,
      cpuTier: "ultra",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true
    }
  },
  {
    num: 4,
    name: "Mac Studio M2 Ultra 128GB (Absolute Peak Apple)",
    os: "macOS",
    hw: {
      os: "macOS",
      ram: 128,
      maxRam: 128,
      unifiedMem: true,
      bandwidth: 800, // 800 GB/s (M2 Ultra)
      gpuLabel: "Apple M2 Ultra",
      cpuCores: 24,
      cpuTier: "ultra",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true
    }
  },
  {
    num: 5,
    name: "Budget PC (Integrated graphics, CPU only)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 8,
      vram: 0,
      bandwidth: 0,
      ramBandwidthGB: 34, // Single/Dual DDR4 2133/2666
      ramBandwidthFactor: 0.50,
      gpuLabel: "No GPU (CPU only)",
      cpuCores: 4,
      cpuTier: "low",
      speedPref: "slow",
      ssd: "sata",
      flashAttn: false
    }
  },
  {
    num: 6,
    name: "Standard Office PC (DDR5, CPU only)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 16,
      vram: 0,
      bandwidth: 0,
      ramBandwidthGB: 56, // Dual DDR5
      ramBandwidthFactor: 0.65,
      gpuLabel: "No GPU (CPU only)",
      cpuCores: 6,
      cpuTier: "mid",
      speedPref: "slow",
      ssd: "nvme",
      flashAttn: false
    }
  },
  {
    num: 7,
    name: "A770 Intel Arc 16GB PC (Intel, Vulkan)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 16,
      vram: 16,
      bandwidth: 512, // Arc A770 bandwidth
      gpuLabel: "Intel Arc A770",
      cpuCores: 8,
      cpuTier: "mid",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 8,
    name: "RX 7900 XTX 24GB PC (AMD Windows, Vulkan)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 32,
      vram: 24,
      bandwidth: 960, // RX 7900 XTX bandwidth
      gpuLabel: "Radeon RX 7900 XTX",
      cpuCores: 8,
      cpuTier: "high",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 9,
    name: "RX 7900 XTX 24GB PC (AMD Linux, ROCm)",
    os: "Linux",
    hw: {
      os: "Linux",
      ram: 32,
      vram: 24,
      bandwidth: 960,
      gpuLabel: "Radeon RX 7900 XTX",
      cpuCores: 12,
      cpuTier: "high",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 10,
    name: "Nvidia RTX 3060 12GB PC (Common mid-range legacy)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 16,
      vram: 12,
      bandwidth: 360,
      gpuLabel: "NVIDIA GeForce RTX 3060",
      cpuCores: 6,
      cpuTier: "mid",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 11,
    name: "Nvidia RTX 4060 Ti 8GB PC (VRAM Bottlenecked PC)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 16,
      vram: 8,
      bandwidth: 288,
      gpuLabel: "NVIDIA GeForce RTX 4060 Ti 8GB",
      cpuCores: 8,
      cpuTier: "mid",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 12,
    name: "Nvidia RTX 4060 Ti 16GB PC (Entry-level High VRAM)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 16,
      vram: 16,
      bandwidth: 288,
      gpuLabel: "NVIDIA GeForce RTX 4060 Ti 16GB",
      cpuCores: 8,
      cpuTier: "mid",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 13,
    name: "Nvidia RTX 4070 Ti Super 16GB PC (Fast 16GB PC)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 32,
      vram: 16,
      bandwidth: 672,
      gpuLabel: "NVIDIA GeForce RTX 4070 Ti Super",
      cpuCores: 8,
      cpuTier: "high",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 14,
    name: "Nvidia RTX 4080 Super 16GB PC (Premium 16GB PC, fast speedPref)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 32,
      vram: 16,
      bandwidth: 736,
      gpuLabel: "NVIDIA GeForce RTX 4080 Super",
      cpuCores: 12,
      cpuTier: "high",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 15,
    name: "Nvidia RTX 4090 24GB PC (Standard High-End Single GPU)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 64,
      vram: 24,
      bandwidth: 1008,
      gpuLabel: "NVIDIA GeForce RTX 4090",
      cpuCores: 16,
      cpuTier: "ultra",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 16,
    name: "Nvidia RTX 5090 32GB PC (Peak Single GPU PC)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 64,
      vram: 32,
      bandwidth: 1792,
      gpuLabel: "NVIDIA GeForce RTX 5090",
      cpuCores: 24,
      cpuTier: "ultra",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true,
      pcie: 5
    }
  },
  {
    num: 17,
    name: "Nvidia Dual RTX 4090 PC (Absolute Peak PC Setup)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 128,
      vram: 24,
      numGPUs: 2,
      bandwidth: 1008,
      gpuLabel: "NVIDIA GeForce RTX 4090",
      cpuCores: 24,
      cpuTier: "ultra",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 18,
    name: "Old PCIe 3.0 Workstation (RTX 3090, PCIe bottlenecked)",
    os: "Linux",
    hw: {
      os: "Linux",
      ram: 64,
      vram: 24,
      bandwidth: 936, // RTX 3090 bandwidth
      gpuLabel: "NVIDIA GeForce RTX 3090",
      cpuCores: 12,
      cpuTier: "mid",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 3 // Gen 3 PCIe offload latency
    }
  },
  {
    num: 19,
    name: "Extreme Threadripper Server (128 Cores, Dual RTX 3090)",
    os: "Linux",
    hw: {
      os: "Linux",
      ram: 256,
      vram: 24,
      numGPUs: 2,
      bandwidth: 936,
      gpuLabel: "NVIDIA GeForce RTX 3090",
      cpuCores: 128,
      cpuTier: "ultra",
      speedPref: "fast",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  },
  {
    num: 20,
    name: "High-End AMD Laptop (RX 7600S 8GB + 32GB RAM)",
    os: "Windows",
    hw: {
      os: "Windows",
      ram: 32,
      vram: 8,
      bandwidth: 128, // Laptop bandwidth limits
      gpuLabel: "Radeon RX 7600S",
      cpuCores: 8,
      cpuTier: "mid",
      speedPref: "medium",
      ssd: "nvme",
      flashAttn: true,
      pcie: 4
    }
  }
];

// ── Execute and Output ─────────────────────────────────────────────
console.log(`================================================================================`);
console.log(`🚀 RUNNING 20 COMPREHENSIVE LLM UPGRADE & SIMULATOR TESTING SCENARIOS`);
console.log(`================================================================================\n`);

const resultsSummary = [];

scenarios.forEach(({ num, name, hw }) => {
  console.log(`--- [Scenario ${num}] ${name} ---`);
  console.log(`   Specs: OS=${hw.os} | GPU=${hw.gpuLabel} (${hw.vram || 0}GBx${hw.numGPUs || 1}, BW=${hw.bandwidth || 0} GB/s) | RAM=${hw.ram}GB | speedPref=${hw.speedPref}`);

  // 1. Current analysis
  const currentResult = analyzeHardware(hw, 4096, hw.flashAttn, models, hw.os);
  const countRec = currentResult.recommended.length;
  const countComf = currentResult.comfortable.length;
  const countStretch = currentResult.stretch.length;
  const totalPlayable = countRec + countComf;

  // 2. Planner Data
  const planner = getUpgradePlannerData(hw, models);

  console.log(`   📊 Current LLM Capabilities:`);
  console.log(`      * Reference Model Speed: ${planner.currentTps} t/s`);
  console.log(`      * Speed Target: ${planner.goalTps} t/s (${hw.speedPref})`);
  console.log(`      * Target Met: ${planner.targetMet ? "✅ YES" : "❌ NO"} (${planner.pct}% of target)`);
  console.log(`      * Model Support: Recommended=${countRec} | Comfortable=${countComf} | Stretch=${countStretch} | Total Playable=${totalPlayable}`);

  console.log(`   💡 Upgrade Suggestions:`);
  if (planner.upgrades.length === 0) {
    console.log(`      * [Peak Rig State Activated] 🏆 Congratulatory empty state. No upgrades found.`);
  } else {
    planner.upgrades.forEach(opt => {
      console.log(`      * [${opt.tag}] ${opt.name} -> ~${opt.estTps} t/s | Goal Met: ${opt.goalMet ? "Yes" : "No"}`);
      
      // Basic simulation check for first non-RAM upgrade
      if (opt.id !== 'pc_ram' && opt.id !== 'apple_ram_boost') {
        // Run simulated analyzeHardware
        const simRes = analyzeHardware(opt.simulatedHw, 4096, hw.flashAttn, models, hw.os);
        const countSimPlayable = simRes.recommended.length + simRes.comfortable.length;
        const unlockedCount = Math.max(0, countSimPlayable - totalPlayable);
        
        // Check for speedups
        const speedupSample = [];
        simRes.recommended.forEach(item => {
          const cur = [...currentResult.recommended, ...currentResult.comfortable].find(
            c => c.model.name === item.model.name && c.quant === item.quant
          );
          if (cur) {
            const curLo = parseInt(cur.tokPerSec, 10) || 0;
            const newLo = parseInt(item.tokPerSec, 10) || 0;
            if (curLo > 0 && newLo > curLo) {
              const boost = Math.round((newLo - curLo) / curLo * 100);
              speedupSample.push(`${item.model.name} (+${boost}%)`);
            }
          }
        });
        
        console.log(`         -> Unlocks: +${unlockedCount} models | Sample Speedups: [${speedupSample.slice(0, 2).join(', ') || 'None'}]`);
      }
    });
  }
  console.log(`\n`);

  const hasGpuUpgrades = planner.upgrades.some(opt => opt.id !== 'pc_ram' && opt.id !== 'apple_ram_boost');

  resultsSummary.push({
    num,
    name,
    os: hw.os,
    gpu: hw.gpuLabel,
    vram: hw.vram || 0,
    ram: hw.ram,
    speedPref: hw.speedPref,
    currentTps: planner.currentTps,
    goalTps: planner.goalTps,
    targetMet: planner.targetMet,
    totalPlayable,
    suggestedCount: planner.upgrades.length,
    peakRig: !hasGpuUpgrades,
    firstUpgrade: planner.upgrades[0] ? `${planner.upgrades[0].tag}: ${planner.upgrades[0].name}` : 'None'
  });
});

console.log(`================================================================================`);
console.log(`📝 GENERAL FINDINGS & SANITY AUDIT`);
console.log(`================================================================================`);
console.log(`1. Total Scenarios Simulated: ${scenarios.length}`);
console.log(`2. Peak Rig States (Congratulations UI Active) Detected: ${resultsSummary.filter(s => s.peakRig).length} / 20`);
console.log(`3. Total Playable Models distribution:`);
resultsSummary.forEach(s => {
  console.log(`   - [S${s.num}] ${s.name}: Current=${s.currentTps} t/s, Target=${s.goalTps} t/s | Upgrades suggested=${s.suggestedCount} | Congratulations UI=${s.peakRig ? "ACTIVE" : "inactive"} | Top suggest=[${s.firstUpgrade}]`);
});
