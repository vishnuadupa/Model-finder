// CPU presets grouped by tier
// ramBandwidthFactor: multiplier on system RAM bandwidth for CPU offload speed
// Faster CPUs with faster cache/IMC = better CPU offload performance
// mobile: true = laptop CPU

export const CPU_PRESETS = [

  // ── Ultra High-end Desktop / Workstation / HEDT ───────────────────
  { label: 'AMD Ryzen 9 9950X',           tier: 'ultra', cores: 16, vendor: 'AMD',   ramBandwidthFactor: 1.05 },
  { label: 'AMD Ryzen 9 9900X',           tier: 'ultra', cores: 12, vendor: 'AMD',   ramBandwidthFactor: 1.02 },
  { label: 'Intel Core i9-14900K / KS',   tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 1.0  },
  { label: 'Intel Core i9-14900',         tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 0.98 },
  { label: 'Intel Core i9-13900K / KS',   tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 1.0  },
  { label: 'Intel Core i9-13900',         tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 0.97 },
  { label: 'AMD Ryzen 9 7950X / X3D',     tier: 'ultra', cores: 32, vendor: 'AMD',   ramBandwidthFactor: 1.0  },
  { label: 'AMD Ryzen 9 7900X / X3D',     tier: 'ultra', cores: 24, vendor: 'AMD',   ramBandwidthFactor: 1.0  },
  { label: 'AMD Ryzen 9 7900',            tier: 'ultra', cores: 12, vendor: 'AMD',   ramBandwidthFactor: 0.96 },
  { label: 'AMD Threadripper 7980X',      tier: 'ultra', cores: 64, vendor: 'AMD',   ramBandwidthFactor: 1.2  },
  { label: 'AMD Threadripper 7970X',      tier: 'ultra', cores: 32, vendor: 'AMD',   ramBandwidthFactor: 1.2  },
  { label: 'AMD Threadripper PRO 5995WX', tier: 'ultra', cores: 64, vendor: 'AMD',   ramBandwidthFactor: 1.3  },
  { label: 'AMD Threadripper PRO 5975WX', tier: 'ultra', cores: 32, vendor: 'AMD',   ramBandwidthFactor: 1.2  },
  { label: 'Intel Xeon W9-3595X',        tier: 'ultra', cores: 60, vendor: 'Intel', ramBandwidthFactor: 1.1  },

  // ── High-end Desktop ──────────────────────────────────────────────
  { label: 'AMD Ryzen 7 9700X',           tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.95 },
  { label: 'Intel Core i9-12900K',        tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.9  },
  { label: 'Intel Core i7-14700K',        tier: 'high',  cores: 20, vendor: 'Intel', ramBandwidthFactor: 0.9  },
  { label: 'Intel Core i7-14700',         tier: 'high',  cores: 20, vendor: 'Intel', ramBandwidthFactor: 0.88 },
  { label: 'Intel Core i7-13700K',        tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.9  },
  { label: 'Intel Core i7-13700',         tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.88 },
  { label: 'Intel Core i7-12700K',        tier: 'high',  cores: 12, vendor: 'Intel', ramBandwidthFactor: 0.85 },
  { label: 'Intel Core i7-12700',         tier: 'high',  cores: 12, vendor: 'Intel', ramBandwidthFactor: 0.83 },
  { label: 'AMD Ryzen 9 5950X',           tier: 'high',  cores: 16, vendor: 'AMD',   ramBandwidthFactor: 0.85 },
  { label: 'AMD Ryzen 9 5900X',           tier: 'high',  cores: 12, vendor: 'AMD',   ramBandwidthFactor: 0.85 },
  { label: 'AMD Ryzen 7 7700X / X3D',     tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.9  },
  { label: 'AMD Ryzen 7 7700',            tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.88 },
  { label: 'AMD Ryzen 7 5800X / X3D',     tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.85 },

  // ── Mid-range Desktop ─────────────────────────────────────────────
  { label: 'AMD Ryzen 5 9600X',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.80 },
  { label: 'Intel Core i5-14600K',        tier: 'mid',   cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.75 },
  { label: 'Intel Core i5-14500',         tier: 'mid',   cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.73 },
  { label: 'Intel Core i5-14400',         tier: 'mid',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.70 },
  { label: 'Intel Core i5-13600K',        tier: 'mid',   cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.75 },
  { label: 'Intel Core i5-13500',         tier: 'mid',   cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.72 },
  { label: 'Intel Core i5-13400',         tier: 'mid',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.70 },
  { label: 'Intel Core i5-12600K',        tier: 'mid',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.70 },
  { label: 'Intel Core i7-11700K',        tier: 'mid',   cores: 8,  vendor: 'Intel', ramBandwidthFactor: 0.70 },
  { label: 'AMD Ryzen 7 5700X',           tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.75 },
  { label: 'AMD Ryzen 7 5700G',           tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.70 },
  { label: 'AMD Ryzen 5 7600X',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.75 },
  { label: 'AMD Ryzen 5 7600',            tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.72 },
  { label: 'AMD Ryzen 5 7500F',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.70 },
  { label: 'AMD Ryzen 5 5600X',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.70 },
  { label: 'AMD Ryzen 5 5600',            tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.68 },
  { label: 'AMD Ryzen 5 5500',            tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.65 },

  // ── Budget Desktop ────────────────────────────────────────────────
  { label: 'Intel Core i5-12400',         tier: 'low',   cores: 6,  vendor: 'Intel', ramBandwidthFactor: 0.62 },
  { label: 'Intel Core i3-14100',         tier: 'low',   cores: 4,  vendor: 'Intel', ramBandwidthFactor: 0.55 },
  { label: 'Intel Core i3-13100',         tier: 'low',   cores: 4,  vendor: 'Intel', ramBandwidthFactor: 0.55 },
  { label: 'Intel Core i3-12100',         tier: 'low',   cores: 4,  vendor: 'Intel', ramBandwidthFactor: 0.55 },
  { label: 'AMD Ryzen 5 4600G',           tier: 'low',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.58 },
  { label: 'AMD Ryzen 3 4300G',           tier: 'low',   cores: 4,  vendor: 'AMD',   ramBandwidthFactor: 0.50 },

  // ── Laptop High-end (HX / flagship) ──────────────────────────────
  { label: 'AMD Ryzen AI 9 HX 370',       tier: 'ultra', cores: 12, vendor: 'AMD',   ramBandwidthFactor: 0.88, mobile: true },
  { label: 'AMD Ryzen 9 7945HX / X3D',   tier: 'ultra', cores: 16, vendor: 'AMD',   ramBandwidthFactor: 0.85, mobile: true },
  { label: 'Intel Core i9-14900HX',       tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 0.82, mobile: true },
  { label: 'Intel Core i9-13980HX',       tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 0.82, mobile: true },
  { label: 'Intel Core Ultra 9 185H',     tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.80, mobile: true },
  { label: 'Intel Core Ultra 7 165H',     tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.78, mobile: true },
  { label: 'Intel Core Ultra 7 155H',     tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.76, mobile: true },
  { label: 'AMD Ryzen 9 7940HS',          tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.76, mobile: true },
  { label: 'AMD Ryzen 7 7745HX',         tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.75, mobile: true },
  { label: 'AMD Ryzen AI 7 360',          tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.80, mobile: true },

  // ── Laptop Mid-range (H-series) ───────────────────────────────────
  { label: 'Intel Core i9-12900H',        tier: 'high',  cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.75, mobile: true },
  { label: 'Intel Core i7-13700H',        tier: 'high',  cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.73, mobile: true },
  { label: 'Intel Core i7-12700H',        tier: 'high',  cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.72, mobile: true },
  { label: 'Intel Core i7-12650H',        tier: 'mid',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.68, mobile: true },
  { label: 'Intel Core Ultra 5 125H',     tier: 'mid',   cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.72, mobile: true },
  { label: 'AMD Ryzen 7 7840HS',          tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.72, mobile: true },
  { label: 'AMD Ryzen 7 6800H',           tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.70, mobile: true },
  { label: 'AMD Ryzen 7 5800H',           tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.68, mobile: true },
  { label: 'Intel Core i5-13500H',        tier: 'mid',   cores: 12, vendor: 'Intel', ramBandwidthFactor: 0.65, mobile: true },
  { label: 'Intel Core i5-12500H',        tier: 'mid',   cores: 12, vendor: 'Intel', ramBandwidthFactor: 0.65, mobile: true },
  { label: 'Intel Core i5-12450H',        tier: 'mid',   cores: 8,  vendor: 'Intel', ramBandwidthFactor: 0.62, mobile: true },
  { label: 'AMD Ryzen 9 6900HX',          tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.72, mobile: true },
  { label: 'AMD Ryzen 9 5900HX',          tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.70, mobile: true },
  { label: 'AMD Ryzen 7 5800HS',          tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.68, mobile: true },
  { label: 'AMD Ryzen 5 7640HS',          tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.65, mobile: true },
  { label: 'AMD Ryzen 5 7535HS',         tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.65, mobile: true },
  { label: 'AMD Ryzen 5 6600H',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.63, mobile: true },
  { label: 'AMD Ryzen 5 5600H',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.62, mobile: true },
  { label: 'Intel Core i7-11800H',        tier: 'mid',   cores: 8,  vendor: 'Intel', ramBandwidthFactor: 0.65, mobile: true },
  { label: 'Intel Core i9-11900H',        tier: 'mid',   cores: 8,  vendor: 'Intel', ramBandwidthFactor: 0.66, mobile: true },
  { label: 'Intel Core i7-10750H',        tier: 'mid',   cores: 6,  vendor: 'Intel', ramBandwidthFactor: 0.58, mobile: true },
  { label: 'Intel Core i9-10980HK',       tier: 'mid',   cores: 8,  vendor: 'Intel', ramBandwidthFactor: 0.62, mobile: true },

  // ── Laptop Budget / Older / U-series ─────────────────────────────
  { label: 'Intel Core i5-11400H',        tier: 'low',   cores: 6,  vendor: 'Intel', ramBandwidthFactor: 0.60, mobile: true },
  { label: 'Intel Core i5-10300H',        tier: 'low',   cores: 4,  vendor: 'Intel', ramBandwidthFactor: 0.55, mobile: true },
  { label: 'Intel Core i7-1365U',         tier: 'low',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.60, mobile: true },
  { label: 'Intel Core i7-1355U',         tier: 'low',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.60, mobile: true },
  { label: 'Intel Core i5-1335U',         tier: 'low',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.58, mobile: true },
  { label: 'Intel Core i7-1255U',         tier: 'low',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.58, mobile: true },
  { label: 'Intel Core i5-1235U',         tier: 'low',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.55, mobile: true },
  { label: 'AMD Ryzen 7 7730U',           tier: 'low',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.60, mobile: true },
  { label: 'AMD Ryzen 5 7530U',           tier: 'low',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.58, mobile: true },

  // ── Apple Silicon (CPU portion — for CPU offload scoring) ─────────
  { label: 'Apple M4 Max (CPU)',          tier: 'ultra', cores: 14, vendor: 'Apple', ramBandwidthFactor: 1.2,  apple: true },
  { label: 'Apple M4 Pro (CPU)',          tier: 'ultra', cores: 12, vendor: 'Apple', ramBandwidthFactor: 1.1,  apple: true },
  { label: 'Apple M4 (CPU)',              tier: 'high',  cores: 10, vendor: 'Apple', ramBandwidthFactor: 1.0,  apple: true },
  { label: 'Apple M3 Max (CPU)',          tier: 'ultra', cores: 16, vendor: 'Apple', ramBandwidthFactor: 1.1,  apple: true },
  { label: 'Apple M3 Pro (CPU)',          tier: 'high',  cores: 12, vendor: 'Apple', ramBandwidthFactor: 1.0,  apple: true },
  { label: 'Apple M3 (CPU)',              tier: 'high',  cores: 8,  vendor: 'Apple', ramBandwidthFactor: 0.95, apple: true },
  { label: 'Apple M2 Ultra (CPU)',        tier: 'ultra', cores: 24, vendor: 'Apple', ramBandwidthFactor: 1.2,  apple: true },
  { label: 'Apple M2 Max (CPU)',          tier: 'high',  cores: 12, vendor: 'Apple', ramBandwidthFactor: 1.0,  apple: true },
  { label: 'Apple M2 Pro (CPU)',          tier: 'high',  cores: 12, vendor: 'Apple', ramBandwidthFactor: 0.98, apple: true },
  { label: 'Apple M2 (CPU)',              tier: 'high',  cores: 8,  vendor: 'Apple', ramBandwidthFactor: 0.92, apple: true },
  { label: 'Apple M1 Ultra (CPU)',        tier: 'ultra', cores: 20, vendor: 'Apple', ramBandwidthFactor: 1.1,  apple: true },
  { label: 'Apple M1 Max (CPU)',          tier: 'high',  cores: 10, vendor: 'Apple', ramBandwidthFactor: 0.95, apple: true },
  { label: 'Apple M1 Pro (CPU)',          tier: 'high',  cores: 10, vendor: 'Apple', ramBandwidthFactor: 0.92, apple: true },
  { label: 'Apple M1 (CPU)',              tier: 'mid',   cores: 8,  vendor: 'Apple', ramBandwidthFactor: 0.85, apple: true },
];

// RAM type bandwidth multipliers — affects CPU offload speed
export const RAM_TYPES = [
  // ── DDR5 ─────────────────────────────────────────────────────────
  { label: 'DDR5-7200+',    type: 'DDR5',    speedMHz: 7200, bandwidthGBs: 115, factor: 1.00, desc: 'OC DDR5 (Ryzen 9000 / Intel Core Ultra)' },
  { label: 'DDR5-6400',     type: 'DDR5',    speedMHz: 6400, bandwidthGBs: 102, factor: 0.95, desc: 'Fast DDR5' },
  { label: 'DDR5-6000',     type: 'DDR5',    speedMHz: 6000, bandwidthGBs: 96,  factor: 0.92, desc: 'Popular Ryzen 7000 speed' },
  { label: 'DDR5-5600',     type: 'DDR5',    speedMHz: 5600, bandwidthGBs: 89,  factor: 0.88, desc: 'Standard DDR5 (Intel 12th/13th gen)' },
  { label: 'DDR5-4800',     type: 'DDR5',    speedMHz: 4800, bandwidthGBs: 76,  factor: 0.82, desc: 'Baseline DDR5' },

  // ── DDR4 ─────────────────────────────────────────────────────────
  { label: 'DDR4-3600',     type: 'DDR4',    speedMHz: 3600, bandwidthGBs: 57,  factor: 0.70, desc: 'Fast DDR4 (most gaming PCs)' },
  { label: 'DDR4-3200',     type: 'DDR4',    speedMHz: 3200, bandwidthGBs: 51,  factor: 0.65, desc: 'Standard DDR4' },
  { label: 'DDR4-2666',     type: 'DDR4',    speedMHz: 2666, bandwidthGBs: 42,  factor: 0.58, desc: 'Budget DDR4 / OEM systems' },
  { label: 'DDR4-2400',     type: 'DDR4',    speedMHz: 2400, bandwidthGBs: 38,  factor: 0.52, desc: 'Older / entry DDR4' },
  { label: 'DDR4-2133',     type: 'DDR4',    speedMHz: 2133, bandwidthGBs: 34,  factor: 0.46, desc: 'Minimum spec DDR4' },

  // ── DDR3 ─────────────────────────────────────────────────────────
  { label: 'DDR3-1866',     type: 'DDR3',    speedMHz: 1866, bandwidthGBs: 29,  factor: 0.38, desc: 'Fast DDR3 (Sandy/Ivy Bridge OC)' },
  { label: 'DDR3-1600',     type: 'DDR3',    speedMHz: 1600, bandwidthGBs: 25,  factor: 0.33, desc: 'Standard DDR3 (older systems)' },

  // ── LPDDR (laptop) ───────────────────────────────────────────────
  { label: 'LPDDR5X',       type: 'LPDDR5X', speedMHz: 8533, bandwidthGBs: 102, factor: 0.90, desc: 'High-end laptop DDR5X (Meteor Lake / Phoenix)' },
  { label: 'LPDDR5',        type: 'LPDDR5',  speedMHz: 6400, bandwidthGBs: 77,  factor: 0.82, desc: 'Modern laptop DDR5 (AMD 6000/7000H)' },
  { label: 'LPDDR4X',       type: 'LPDDR4X', speedMHz: 4267, bandwidthGBs: 68,  factor: 0.65, desc: 'Common laptop DDR4X (Intel 10th/11th)' },
  { label: 'LPDDR4',        type: 'LPDDR4',  speedMHz: 3200, bandwidthGBs: 51,  factor: 0.58, desc: 'Older laptop DDR4' },

  // ── Apple Silicon (unified — no PCIe overhead) ───────────────────
  { label: 'LPDDR5X (Apple Silicon)', type: 'LPDDR5X', speedMHz: 8533, bandwidthGBs: 120, factor: 1.05, desc: 'M4 / M4 Pro / M4 Max' },
  { label: 'LPDDR5 (Apple Silicon)',  type: 'LPDDR5',  speedMHz: 6400, bandwidthGBs: 102, factor: 1.0,  desc: 'M1 / M2 / M3 series' },
];

export const CPU_TIERS = ['ultra', 'high', 'mid', 'low'];

export function getCPUByLabel(label) {
  return CPU_PRESETS.find(c => c.label === label);
}

export function getRamTypeByLabel(label) {
  return RAM_TYPES.find(r => r.label === label);
}
