// CPU presets grouped by tier
// ramBandwidthFactor: multiplier on system RAM bandwidth for CPU offload speed
// Faster CPUs with faster cache = better CPU offload performance

export const CPU_PRESETS = [
  // ── Ultra High-end Desktop / Workstation ──────────────────────────
  { label: 'Intel Core i9-14900K / KS',   tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 1.0 },
  { label: 'Intel Core i9-13900K / KS',   tier: 'ultra', cores: 24, vendor: 'Intel', ramBandwidthFactor: 1.0 },
  { label: 'AMD Ryzen 9 7950X / X3D',     tier: 'ultra', cores: 32, vendor: 'AMD',   ramBandwidthFactor: 1.0 },
  { label: 'AMD Ryzen 9 7900X / X3D',     tier: 'ultra', cores: 24, vendor: 'AMD',   ramBandwidthFactor: 1.0 },
  { label: 'AMD Threadripper 7980X',       tier: 'ultra', cores: 64, vendor: 'AMD',   ramBandwidthFactor: 1.2 },
  { label: 'AMD Threadripper 7970X',       tier: 'ultra', cores: 32, vendor: 'AMD',   ramBandwidthFactor: 1.2 },
  { label: 'Intel Xeon W9-3595X',         tier: 'ultra', cores: 60, vendor: 'Intel', ramBandwidthFactor: 1.1 },

  // ── High-end Desktop ──────────────────────────────────────────────
  { label: 'Intel Core i9-12900K',        tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.9 },
  { label: 'Intel Core i7-14700K',        tier: 'high',  cores: 20, vendor: 'Intel', ramBandwidthFactor: 0.9 },
  { label: 'Intel Core i7-13700K',        tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.9 },
  { label: 'Intel Core i7-12700K',        tier: 'high',  cores: 12, vendor: 'Intel', ramBandwidthFactor: 0.85 },
  { label: 'AMD Ryzen 9 5950X',           tier: 'high',  cores: 16, vendor: 'AMD',   ramBandwidthFactor: 0.85 },
  { label: 'AMD Ryzen 9 5900X',           tier: 'high',  cores: 12, vendor: 'AMD',   ramBandwidthFactor: 0.85 },
  { label: 'AMD Ryzen 7 7700X / X3D',     tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.9 },
  { label: 'AMD Ryzen 7 5800X / X3D',     tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.85 },

  // ── Mid-range Desktop ─────────────────────────────────────────────
  { label: 'Intel Core i5-14600K',        tier: 'mid',   cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.75 },
  { label: 'Intel Core i5-13600K',        tier: 'mid',   cores: 14, vendor: 'Intel', ramBandwidthFactor: 0.75 },
  { label: 'Intel Core i5-12600K',        tier: 'mid',   cores: 10, vendor: 'Intel', ramBandwidthFactor: 0.70 },
  { label: 'Intel Core i7-11700K',        tier: 'mid',   cores: 8,  vendor: 'Intel', ramBandwidthFactor: 0.70 },
  { label: 'AMD Ryzen 7 5700X',           tier: 'mid',   cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.75 },
  { label: 'AMD Ryzen 5 7600X',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.75 },
  { label: 'AMD Ryzen 5 5600X',           tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.70 },
  { label: 'AMD Ryzen 5 5600',            tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.68 },

  // ── Budget Desktop ────────────────────────────────────────────────
  { label: 'Intel Core i5-12400',         tier: 'low',   cores: 6,  vendor: 'Intel', ramBandwidthFactor: 0.60 },
  { label: 'Intel Core i3-13100',         tier: 'low',   cores: 4,  vendor: 'Intel', ramBandwidthFactor: 0.55 },
  { label: 'Intel Core i3-12100',         tier: 'low',   cores: 4,  vendor: 'Intel', ramBandwidthFactor: 0.55 },
  { label: 'AMD Ryzen 5 4600G',           tier: 'low',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.58 },
  { label: 'AMD Ryzen 3 4300G',           tier: 'low',   cores: 4,  vendor: 'AMD',   ramBandwidthFactor: 0.50 },

  // ── Laptop / Mobile (high-end) ────────────────────────────────────
  { label: 'Intel Core Ultra 9 185H',     tier: 'high',  cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.80, mobile: true },
  { label: 'Intel Core Ultra 7 165H',     tier: 'mid',   cores: 16, vendor: 'Intel', ramBandwidthFactor: 0.75, mobile: true },
  { label: 'Intel Core i9-13980HX',       tier: 'high',  cores: 24, vendor: 'Intel', ramBandwidthFactor: 0.80, mobile: true },
  { label: 'AMD Ryzen 9 7945HX / X3D',   tier: 'ultra', cores: 16, vendor: 'AMD',   ramBandwidthFactor: 0.85, mobile: true },
  { label: 'AMD Ryzen 7 7745HX',         tier: 'high',  cores: 8,  vendor: 'AMD',   ramBandwidthFactor: 0.75, mobile: true },
  { label: 'AMD Ryzen 5 7535HS',         tier: 'mid',   cores: 6,  vendor: 'AMD',   ramBandwidthFactor: 0.65, mobile: true },

  // ── Apple Silicon (CPU portion) ───────────────────────────────────
  { label: 'Apple M4 Max (CPU)',          tier: 'ultra', cores: 14, vendor: 'Apple', ramBandwidthFactor: 1.2, apple: true },
  { label: 'Apple M4 Pro (CPU)',          tier: 'ultra', cores: 12, vendor: 'Apple', ramBandwidthFactor: 1.1, apple: true },
  { label: 'Apple M4 (CPU)',              tier: 'high',  cores: 10, vendor: 'Apple', ramBandwidthFactor: 1.0, apple: true },
  { label: 'Apple M3 Max (CPU)',          tier: 'ultra', cores: 16, vendor: 'Apple', ramBandwidthFactor: 1.1, apple: true },
  { label: 'Apple M3 Pro (CPU)',          tier: 'high',  cores: 12, vendor: 'Apple', ramBandwidthFactor: 1.0, apple: true },
  { label: 'Apple M3 (CPU)',              tier: 'high',  cores: 8,  vendor: 'Apple', ramBandwidthFactor: 0.95, apple: true },
  { label: 'Apple M2 Max (CPU)',          tier: 'high',  cores: 12, vendor: 'Apple', ramBandwidthFactor: 1.0, apple: true },
  { label: 'Apple M1 Max (CPU)',          tier: 'high',  cores: 10, vendor: 'Apple', ramBandwidthFactor: 0.95, apple: true },
];

// RAM type bandwidth multipliers — affects CPU offload speed
export const RAM_TYPES = [
  { label: 'DDR5-7200+',    type: 'DDR5', speedMHz: 7200, bandwidthGBs: 115, factor: 1.0,  desc: 'High-end DDR5 (Ryzen 9000 / Intel Ultra)' },
  { label: 'DDR5-6400',     type: 'DDR5', speedMHz: 6400, bandwidthGBs: 102, factor: 0.95, desc: 'Fast DDR5' },
  { label: 'DDR5-4800',     type: 'DDR5', speedMHz: 4800, bandwidthGBs: 76,  factor: 0.85, desc: 'Standard DDR5' },
  { label: 'DDR4-3600',     type: 'DDR4', speedMHz: 3600, bandwidthGBs: 57,  factor: 0.70, desc: 'Fast DDR4 (most gaming PCs)' },
  { label: 'DDR4-3200',     type: 'DDR4', speedMHz: 3200, bandwidthGBs: 51,  factor: 0.65, desc: 'Standard DDR4' },
  { label: 'DDR4-2666',     type: 'DDR4', speedMHz: 2666, bandwidthGBs: 42,  factor: 0.58, desc: 'Budget DDR4 / older systems' },
  { label: 'LPDDR5X (Apple Silicon)', type: 'LPDDR5X', speedMHz: 8533, bandwidthGBs: 120, factor: 1.05, desc: 'M4 / M4 Pro / M4 Max' },
  { label: 'LPDDR5 (Apple Silicon)',  type: 'LPDDR5',  speedMHz: 6400, bandwidthGBs: 102, factor: 1.0,  desc: 'M1/M2/M3 series' },
];

export const CPU_TIERS = ['ultra', 'high', 'mid', 'low'];

export function getCPUByLabel(label) {
  return CPU_PRESETS.find(c => c.label === label);
}

export function getRamTypeByLabel(label) {
  return RAM_TYPES.find(r => r.label === label);
}
