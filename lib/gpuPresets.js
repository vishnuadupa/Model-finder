export const GPU_PRESETS = [
  // NVIDIA Ada Lovelace (4xxx)
  { label: 'RTX 4090 24GB',    vram: 24, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4090' },
  { label: 'RTX 4080 Super 16GB', vram: 16, arch: 'Ada', cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4080s' },
  { label: 'RTX 4080 16GB',    vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4080' },
  { label: 'RTX 4070 Ti 16GB', vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4070ti' },
  { label: 'RTX 4070 Super 12GB', vram: 12, arch: 'Ada', cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4070s' },
  { label: 'RTX 4070 12GB',    vram: 12, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4070' },
  { label: 'RTX 4060 Ti 16GB', vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4060ti16' },
  { label: 'RTX 4060 Ti 8GB',  vram: 8,  arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4060ti' },
  { label: 'RTX 4060 8GB',     vram: 8,  arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  buyUrl: 'https://amzn.to/rtx4060' },

  // NVIDIA Ampere (3xxx)
  { label: 'RTX 3090 24GB',    vram: 24, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  buyUrl: 'https://amzn.to/rtx3090' },
  { label: 'RTX 3080 Ti 12GB', vram: 12, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  buyUrl: 'https://amzn.to/rtx3080ti' },
  { label: 'RTX 3080 10GB',    vram: 10, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  buyUrl: 'https://amzn.to/rtx3080' },
  { label: 'RTX 3070 Ti 8GB',  vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  buyUrl: 'https://amzn.to/rtx3070ti' },
  { label: 'RTX 3070 8GB',     vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  buyUrl: 'https://amzn.to/rtx3070' },
  { label: 'RTX 3060 Ti 8GB',  vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  buyUrl: 'https://amzn.to/rtx3060ti' },
  { label: 'RTX 3060 12GB',    vram: 12, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  buyUrl: 'https://amzn.to/rtx3060' },

  // NVIDIA Turing / Pascal (legacy)
  { label: 'RTX 2080 Ti 11GB', vram: 11, arch: 'Turing', cudaCap: 7.5, flashAttn: false, buyUrl: 'https://amzn.to/rtx2080ti' },
  { label: 'RTX 2070 8GB',     vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, buyUrl: 'https://amzn.to/rtx2070' },
  { label: 'GTX 1080 Ti 11GB', vram: 11, arch: 'Pascal', cudaCap: 6.1, flashAttn: false, buyUrl: 'https://amzn.to/gtx1080ti' },
  { label: 'GTX 1060 6GB',     vram: 6,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, buyUrl: 'https://amzn.to/gtx1060' },

  // AMD RDNA 3
  { label: 'RX 7900 XTX 24GB', vram: 24, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  buyUrl: 'https://amzn.to/rx7900xtx' },
  { label: 'RX 7900 XT 20GB',  vram: 20, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  buyUrl: 'https://amzn.to/rx7900xt' },
  { label: 'RX 7800 XT 16GB',  vram: 16, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  buyUrl: 'https://amzn.to/rx7800xt' },
  { label: 'RX 7700 XT 12GB',  vram: 12, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  buyUrl: 'https://amzn.to/rx7700xt' },

  // AMD RDNA 2
  { label: 'RX 6900 XT 16GB',  vram: 16, arch: 'RDNA2',  cudaCap: null, flashAttn: false, buyUrl: 'https://amzn.to/rx6900xt' },
  { label: 'RX 6800 XT 16GB',  vram: 16, arch: 'RDNA2',  cudaCap: null, flashAttn: false, buyUrl: 'https://amzn.to/rx6800xt' },
  { label: 'RX 6700 XT 12GB',  vram: 12, arch: 'RDNA2',  cudaCap: null, flashAttn: false, buyUrl: 'https://amzn.to/rx6700xt' },

  // Apple Silicon (unified memory)
  { label: 'Apple M1',          vram: 0, unified: true, maxRam: 16,  flashAttn: true, buyUrl: null },
  { label: 'Apple M1 Pro',      vram: 0, unified: true, maxRam: 32,  flashAttn: true, buyUrl: null },
  { label: 'Apple M1 Max',      vram: 0, unified: true, maxRam: 64,  flashAttn: true, buyUrl: null },
  { label: 'Apple M2',          vram: 0, unified: true, maxRam: 24,  flashAttn: true, buyUrl: null },
  { label: 'Apple M2 Pro',      vram: 0, unified: true, maxRam: 32,  flashAttn: true, buyUrl: null },
  { label: 'Apple M2 Max',      vram: 0, unified: true, maxRam: 96,  flashAttn: true, buyUrl: null },
  { label: 'Apple M3',          vram: 0, unified: true, maxRam: 24,  flashAttn: true, buyUrl: null },
  { label: 'Apple M3 Pro',      vram: 0, unified: true, maxRam: 36,  flashAttn: true, buyUrl: null },
  { label: 'Apple M3 Max',      vram: 0, unified: true, maxRam: 128, flashAttn: true, buyUrl: null },
  { label: 'Apple M4',          vram: 0, unified: true, maxRam: 32,  flashAttn: true, buyUrl: null },
  { label: 'Apple M4 Pro',      vram: 0, unified: true, maxRam: 64,  flashAttn: true, buyUrl: null },
  { label: 'Apple M4 Max',      vram: 0, unified: true, maxRam: 128, flashAttn: true, buyUrl: null },

  // CPU only
  { label: 'No GPU (CPU only)', vram: 0, unified: false, flashAttn: false, buyUrl: null },
];

export function findGPUBySlug(slug) {
  return GPU_PRESETS.find(
    g => g.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === slug
  );
}

export function gpuToSlug(label) {
  return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
