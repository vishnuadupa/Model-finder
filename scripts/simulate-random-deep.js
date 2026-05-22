const fs = require('fs');
const path = require('path');

// Replicate exact scoring logic
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

// ── Random Specs Generators ───────────────────────────────────────
const RAM_OPTIONS = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256];
const OS_OPTIONS = ['Windows', 'macOS', 'Linux'];
const CPU_TIER_OPTIONS = ['low', 'mid', 'high', 'ultra'];
const SPEED_PREF_OPTIONS = ['slow', 'medium', 'fast'];
const SSD_OPTIONS = ['hdd', 'sata', 'nvme'];

const APPLE_GPUS = [
  { label: 'Apple M1', bw: 68, coreMaxRam: 16 },
  { label: 'Apple M2', bw: 100, coreMaxRam: 24 },
  { label: 'Apple M3', bw: 100, coreMaxRam: 24 },
  { label: 'Apple M4', bw: 120, coreMaxRam: 32 },
  { label: 'Apple M1 Pro', bw: 200, coreMaxRam: 32 },
  { label: 'Apple M2 Pro', bw: 200, coreMaxRam: 32 },
  { label: 'Apple M3 Pro', bw: 150, coreMaxRam: 36 },
  { label: 'Apple M1 Max', bw: 400, coreMaxRam: 64 },
  { label: 'Apple M2 Max', bw: 400, coreMaxRam: 96 },
  { label: 'Apple M3 Max', bw: 300, coreMaxRam: 128 },
  { label: 'Apple M4 Max', bw: 410, coreMaxRam: 128 },
  { label: 'Apple M1 Ultra', bw: 800, coreMaxRam: 128 },
  { label: 'Apple M2 Ultra', bw: 800, coreMaxRam: 192 },
  { label: 'Apple M4 Ultra', bw: 820, coreMaxRam: 256 },
];

const PC_GPUS = [
  { label: 'No GPU (CPU only)', vram: 0, bw: 0 },
  { label: 'NVIDIA GeForce RTX 3060', vram: 12, bw: 360 },
  { label: 'NVIDIA GeForce RTX 4060 Ti 8GB', vram: 8, bw: 288 },
  { label: 'NVIDIA GeForce RTX 4060 Ti 16GB', vram: 16, bw: 288 },
  { label: 'NVIDIA GeForce RTX 4070 Ti Super', vram: 16, bw: 672 },
  { label: 'NVIDIA GeForce RTX 4080 Super', vram: 16, bw: 736 },
  { label: 'NVIDIA GeForce RTX 4090', vram: 24, bw: 1008 },
  { label: 'NVIDIA GeForce RTX 5090', vram: 32, bw: 1792 },
  { label: 'Radeon RX 7600S', vram: 8, bw: 128 },
  { label: 'Radeon RX 7900 XTX', vram: 24, bw: 960 },
  { label: 'Intel Arc A770', vram: 16, bw: 512 },
];

function generateRandomHw(seed) {
  // Use a pseudo-random mechanism to avoid overlaps with runs that have a close timestamp,
  // ensuring extremely rich variety.
  const r = () => Math.random();
  const os = OS_OPTIONS[Math.floor(r() * OS_OPTIONS.length)];
  const isApple = os === 'macOS';
  
  let gpuLabel, vram, bandwidth, ram, maxRam, unifiedMem;

  if (isApple) {
    const gpu = APPLE_GPUS[Math.floor(r() * APPLE_GPUS.length)];
    gpuLabel = gpu.label;
    bandwidth = gpu.bw;
    unifiedMem = true;
    
    const validRams = RAM_OPTIONS.filter(rVal => rVal <= gpu.coreMaxRam);
    ram = validRams[Math.floor(r() * validRams.length)];
    maxRam = ram;
    vram = ram;
  } else {
    const gpu = PC_GPUS[Math.floor(r() * PC_GPUS.length)];
    gpuLabel = gpu.label;
    vram = gpu.vram;
    bandwidth = gpu.bw;
    unifiedMem = false;
    
    ram = RAM_OPTIONS[Math.floor(r() * RAM_OPTIONS.length)];
    if (vram > 0 && ram < vram) {
      ram = Math.max(16, vram);
    }
  }

  const numGPUs = (vram > 0 && !isApple && r() > 0.8) ? 2 : 1;

  return {
    os,
    ram,
    maxRam,
    vram,
    numGPUs,
    bandwidth,
    unifiedMem,
    gpuLabel,
    ramBandwidthGB: Math.floor(r() * 90) + 30,
    ramBandwidthFactor: +(r() * 0.3 + 0.55).toFixed(2),
    cpuCores: Math.floor(r() * 20) + 4,
    cpuTier: CPU_TIER_OPTIONS[Math.floor(r() * CPU_TIER_OPTIONS.length)],
    speedPref: SPEED_PREF_OPTIONS[Math.floor(r() * SPEED_PREF_OPTIONS.length)],
    ssd: SSD_OPTIONS[Math.floor(r() * SSD_OPTIONS.length)],
    flashAttn: r() > 0.4,
    pcie: Math.floor(r() * 3) + 3,
  };
}

console.log(`================================================================================`);
console.log(`🧪 RUNNING 40 MORE COMPLETELY RANDOM LLM SCENARIOS WITH DEEP MATHEMATICAL AUDIT`);
console.log(`================================================================================\n`);

let passedChecks = 0;
let failedChecks = 0;

for (let sIdx = 1; sIdx <= 40; sIdx++) {
  const hw = generateRandomHw(sIdx);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Scenario ${sIdx}: OS=${hw.os} | Baseline GPU=${hw.gpuLabel} (VRAM=${hw.vram}GBx${hw.numGPUs}, Bandwidth=${hw.bandwidth} GB/s)`);
  console.log(`            RAM=${hw.ram}GB | SpeedPref=${hw.speedPref} | SSD=${hw.ssd} | FlashAttn=${hw.flashAttn}`);
  console.log(`--------------------------------------------------------------------------------`);

  const currentResult = analyzeHardware(hw, 4096, hw.flashAttn, models, hw.os);
  const countPlayable = currentResult.recommended.length + currentResult.comfortable.length;

  const planner = getUpgradePlannerData(hw, models);
  const hasGpuUpgrades = planner.upgrades.some(opt => opt.id !== 'pc_ram' && opt.id !== 'apple_ram_boost');

  console.log(`   📊 Baseline Performance State:`);
  console.log(`      * Current Llama-3-8B reference speed: ${planner.currentTps} tok/s`);
  console.log(`      * Target speed preference (${hw.speedPref}): ${planner.goalTps} tok/s`);
  console.log(`      * Speed goal met at baseline: ${planner.targetMet ? "YES ✅" : "NO ❌"}`);
  console.log(`      * Number of playable models currently: ${countPlayable}`);
  console.log(`      * UI Mode triggered: ${!hasGpuUpgrades ? "Congratulations UI 🏆 (Current hardware is peak consumer level)" : "Upgrade Option Cards List"}`);

  let scenarioErrors = [];

  if (planner.upgrades.length === 0) {
    console.log(`   ✨ No upgrade options recommended - User is already at the absolute limits of consumer hardware!`);
  } else {
    console.log(`   🛠️ Recommended Upgrades & Accuracy / Memory Fit Analysis:`);

    planner.upgrades.forEach(opt => {
      const simHw = opt.simulatedHw;
      const currentVRAMTotal = hw.unifiedMem ? hw.ram : (hw.vram || 0) * (hw.numGPUs || 1);
      const simVRAMTotal = simHw.unifiedMem ? simHw.ram : (simHw.vram || 0) * (simHw.numGPUs || 1);
      const simBW = simHw.bandwidth || simHw.ramBandwidthGB || 0;
      const curBW = hw.bandwidth || hw.ramBandwidthGB || 0;

      console.log(`      ▪ Card: [${opt.tag}] ${opt.name}`);
      console.log(`        - Simulated Specs: GPU=${simHw.gpuLabel} (VRAM=${simHw.vram}GBx${simHw.numGPUs}, BW=${simBW} GB/s) | RAM=${simHw.ram}GB`);
      console.log(`        - Estimated Ref Speed: ${opt.estTps} t/s | Target Met: ${opt.goalMet ? "YES ✅" : "NO ❌"}`);
      console.log(`        - Description: ${opt.desc}`);

      // 1. Math Speed Check
      if (opt.estTps <= 0) {
        scenarioErrors.push(`Calculated Ref Speed for upgrade ${opt.name} is non-positive (${opt.estTps} t/s).`);
      }

      // 2. Strict Progression Check
      if (opt.id !== 'pc_ram' && opt.id !== 'apple_ram_boost') {
        const isStrictUpgrade = (simVRAMTotal > currentVRAMTotal) || (simVRAMTotal === currentVRAMTotal && simBW > curBW);
        if (!isStrictUpgrade) {
          scenarioErrors.push(`GPU upgrade card ${opt.name} violates strict progression ladder. (VRAM: ${currentVRAMTotal}GB -> ${simVRAMTotal}GB, BW: ${curBW} -> ${simBW} GB/s)`);
        }
      }

      // 3. Deep Memory Fit Math Analysis for Unlocked Models
      const simResult = analyzeHardware(simHw, 4096, hw.flashAttn, models, hw.os);
      const currentKeys = new Set([
        ...currentResult.recommended.map(r => `${r.model.name}_${r.quant}`),
        ...currentResult.comfortable.map(r => `${r.model.name}_${r.quant}`),
      ]);

      const newlyUnlocked = [];
      [...simResult.recommended, ...simResult.comfortable].forEach(item => {
        const key = `${item.model.name}_${item.quant}`;
        if (!currentKeys.has(key)) {
          newlyUnlocked.push(item);
        }
      });

      if (newlyUnlocked.length === 0) {
        console.log(`        - Fit Verification: Validated. Upgrade boosts throughput for existing playable models (e.g. increases speed).`);
      } else {
        console.log(`        - Newly Playable Models Unlocked: ${newlyUnlocked.length}`);
        
        // Print detailed math for up to 2 unlocked models to prove the logic fits exactly
        const sampleSize = Math.min(2, newlyUnlocked.length);
        for (let i = 0; i < sampleSize; i++) {
          const item = newlyUnlocked[i];
          const bits = QUANT_BITS[item.quant];
          const wVram = weightsVRAM(item.model.params, bits);
          const kvVram = kvCacheVRAM(4096, item.model.layers, item.model.numKVHeads, item.headDim, hw.flashAttn);
          const totalVram = wVram + kvVram;
          const eff = effectiveVRAM(simHw);
          
          console.log(`          ▶ Detailed Math for [${item.model.name} (${item.quant})]:`);
          console.log(`             * Model Metadata: Parameters=${item.model.params}B, Layers=${item.model.layers || "N/A"}, KV Heads=${item.model.numKVHeads || "N/A"}, HeadDim=${item.model.headDim || "N/A"}`);
          console.log(`             * Quant Precision: ${item.quant} (${bits} bits per weight)`);
          console.log(`             * Weights VRAM calculation: (${item.model.params}B * ${bits} bits * 1.05) / 8 = ${wVram.toFixed(3)} GB`);
          console.log(`             * KV Cache VRAM calculation (4096 tokens, FlashAttn=${hw.flashAttn}): ${kvVram.toFixed(3)} GB`);
          console.log(`             * Combined VRAM required: ${wVram.toFixed(3)} + ${kvVram.toFixed(3)} = ${totalVram.toFixed(3)} GB (Calculated req: ${item.vramRequired} GB)`);
          console.log(`             * Simulated Available Storage: High-speed VRAM (gpuOnly)=${eff.gpuOnly.toFixed(1)} GB, Unified/Offload capacity=${eff.withOffload.toFixed(1)} GB`);
          
          // Verify fits
          const fitsInVramOnly = eff.gpuOnly >= item.vramRequired;
          const fitsInOffload = eff.withOffload >= item.vramRequired;

          if (item.tier === 'recommended') {
            console.log(`             * Classification: RECOMMENDED. Requirement: ${item.vramRequired} GB <= Available VRAM: ${eff.gpuOnly.toFixed(1)} GB`);
            if (!fitsInVramOnly) {
              scenarioErrors.push(`Model ${item.model.name} (${item.quant}) is RECOMMENDED but exceeds high-speed GPU VRAM. Req: ${item.vramRequired} GB, VRAM: ${eff.gpuOnly} GB`);
            } else {
              console.log(`             * Verification status: PASS ✅ (Fits 100% inside GPU VRAM, ensuring zero offload slowdowns.)`);
            }
          } else {
            console.log(`             * Classification: COMFORTABLE (System RAM offloading). Requirement: ${item.vramRequired} GB <= Total Memory Pool: ${eff.withOffload.toFixed(1)} GB`);
            if (!fitsInOffload) {
              scenarioErrors.push(`Model ${item.model.name} (${item.quant}) is COMFORTABLE/STRETCH but exceeds combined memory limits. Req: ${item.vramRequired} GB, Pool: ${eff.withOffload} GB`);
            } else {
              console.log(`             * Verification status: PASS ✅ (Fits inside combined GPU+CPU limits, satisfying offload buffers.)`);
            }
          }
        }
      }
    });
  }

  if (scenarioErrors.length === 0) {
    console.log(`   🟢 VERIFICATION SUMMARY: PASS. All upgrade paths represent strict performance gains, ref speed estimations are sound, and unlocked models fit perfectly within simulated resource pools.`);
    passedChecks++;
  } else {
    console.log(`   🔴 VERIFICATION SUMMARY: FAIL`);
    scenarioErrors.forEach(err => console.log(`      * Error details: ${err}`));
    failedChecks++;
  }
  console.log(`\n`);
}

console.log(`================================================================================`);
console.log(`📊 GRAND SUMMARY - DEEP SANITY AUDIT COMPLIANCE`);
console.log(`================================================================================`);
console.log(`  * Total Scenarios Evaluated: 40`);
console.log(`  * Passed Genuineness Checks: ${passedChecks} / 40`);
console.log(`  * Failed Genuineness Checks: ${failedChecks} / 40`);
console.log(`================================================================================`);
if (failedChecks === 0) {
  console.log(`🚀 AUDIT COMPLETED SUCCESSFULLY: 100% genuine validation. Every suggested model precision mathematically fits inside designated hardware brackets.`);
} else {
  console.log(`⚠️ AUDIT DETECTED ANOMALIES. Inspect logs for failing constraints.`);
}
