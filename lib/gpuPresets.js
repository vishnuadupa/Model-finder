// bandwidth: memory bandwidth in GB/s — primary driver of tok/s in LLM inference
// memType: GDDR6 / GDDR6X / GDDR7 / HBM2e / LPDDR5 / unified
// cudaCap: CUDA compute capability (null for non-NVIDIA)
// flashAttn: supports Flash Attention 2
// pcie: PCIe generation (affects multi-GPU and CPU-offload speed)

export const GPU_PRESETS = [
  // ── NVIDIA Blackwell (5xxx) ──────────────────────────────────────
  { label: 'RTX 5090 32GB',       vram: 32, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true,  bandwidth: 1792, memType: 'GDDR7',  pcie: 5, buyUrl: 'https://amzn.to/rtx5090' },
  { label: 'RTX 5080 16GB',       vram: 16, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true,  bandwidth: 960,  memType: 'GDDR7',  pcie: 5, buyUrl: 'https://amzn.to/rtx5080' },
  { label: 'RTX 5070 Ti 16GB',    vram: 16, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true,  bandwidth: 896,  memType: 'GDDR7',  pcie: 5, buyUrl: 'https://amzn.to/rtx5070ti' },
  { label: 'RTX 5070 12GB',       vram: 12, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true,  bandwidth: 672,  memType: 'GDDR7',  pcie: 5, buyUrl: 'https://amzn.to/rtx5070' },
  { label: 'RTX 5060 Ti 16GB',    vram: 16, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true,  bandwidth: 608,  memType: 'GDDR7',  pcie: 5, buyUrl: null },
  { label: 'RTX 5060 8GB',        vram: 8,  arch: 'Blackwell', cudaCap: 10.0, flashAttn: true,  bandwidth: 448,  memType: 'GDDR7',  pcie: 5, buyUrl: null },

  // ── NVIDIA Ada Lovelace (4xxx) ───────────────────────────────────
  { label: 'RTX 4090 24GB',       vram: 24, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 1008, memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx4090' },
  { label: 'RTX 4080 Super 16GB', vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 736,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx4080s' },
  { label: 'RTX 4080 16GB',       vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 717,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx4080' },
  { label: 'RTX 4070 Ti Super 16GB', vram: 16, arch: 'Ada', cudaCap: 8.9, flashAttn: true,  bandwidth: 672,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx4070tis' },
  { label: 'RTX 4070 Ti 12GB',    vram: 12, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 504,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx4070ti' },
  { label: 'RTX 4070 Super 12GB', vram: 12, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 504,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx4070s' },
  { label: 'RTX 4070 12GB',       vram: 12, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 504,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx4070' },
  { label: 'RTX 4060 Ti 16GB',    vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 288,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx4060ti16' },
  { label: 'RTX 4060 Ti 8GB',     vram: 8,  arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 288,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx4060ti' },
  { label: 'RTX 4060 8GB',        vram: 8,  arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 272,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx4060' },
  { label: 'RTX 4050 6GB (Laptop)',vram: 6,  arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 192,  memType: 'GDDR6',  pcie: 4, buyUrl: null },

  // ── NVIDIA Workstation Ada ───────────────────────────────────────
  { label: 'RTX 6000 Ada 48GB',   vram: 48, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 960,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx6000ada' },
  { label: 'RTX 4000 Ada 20GB',   vram: 20, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 432,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 2000 Ada 16GB',   vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 224,  memType: 'GDDR6',  pcie: 4, buyUrl: null },

  // ── NVIDIA Ampere (3xxx) ─────────────────────────────────────────
  { label: 'RTX 3090 Ti 24GB',    vram: 24, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 1008, memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx3090ti' },
  { label: 'RTX 3090 24GB',       vram: 24, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 936,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx3090' },
  { label: 'RTX 3080 Ti 12GB',    vram: 12, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 912,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx3080ti' },
  { label: 'RTX 3080 12GB',       vram: 12, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 912,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx3080-12' },
  { label: 'RTX 3080 10GB',       vram: 10, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 760,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx3080' },
  { label: 'RTX 3070 Ti 8GB',     vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 608,  memType: 'GDDR6X', pcie: 4, buyUrl: 'https://amzn.to/rtx3070ti' },
  { label: 'RTX 3070 8GB',        vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 448,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx3070' },
  { label: 'RTX 3060 Ti 8GB',     vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 448,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx3060ti' },
  { label: 'RTX 3060 12GB',       vram: 12, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 360,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx3060' },
  { label: 'RTX 3060 8GB',        vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 360,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 3050 8GB',        vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: false, bandwidth: 224,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtx3050' },

  // ── NVIDIA Workstation Ampere ────────────────────────────────────
  { label: 'RTX A6000 48GB',      vram: 48, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 768,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rtxa6000' },
  { label: 'RTX A5000 24GB',      vram: 24, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 768,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX A4000 16GB',      vram: 16, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 448,  memType: 'GDDR6',  pcie: 4, buyUrl: null },

  // ── NVIDIA Turing (2xxx) ─────────────────────────────────────────
  { label: 'RTX 2080 Ti 11GB',    vram: 11, arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 616,  memType: 'GDDR6',  pcie: 3, buyUrl: 'https://amzn.to/rtx2080ti' },
  { label: 'RTX 2080 Super 8GB',  vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 496,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'RTX 2080 8GB',        vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 448,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'RTX 2070 Super 8GB',  vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 448,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'RTX 2070 8GB',        vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 448,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'RTX 2060 Super 8GB',  vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 448,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'RTX 2060 6GB',        vram: 6,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 336,  memType: 'GDDR6',  pcie: 3, buyUrl: null },

  // ── NVIDIA GTX 16xx (Turing, no RT cores) ───────────────────────
  { label: 'GTX 1660 Ti 6GB',     vram: 6,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 288,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'GTX 1660 Super 6GB',  vram: 6,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 336,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'GTX 1660 6GB',        vram: 6,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 192,  memType: 'GDDR5',  pcie: 3, buyUrl: null },
  { label: 'GTX 1650 Super 4GB',  vram: 4,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 192,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'GTX 1650 4GB',        vram: 4,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 128,  memType: 'GDDR5',  pcie: 3, buyUrl: null },

  // ── NVIDIA Laptop GPUs ───────────────────────────────────────────
  // Blackwell Laptop
  { label: 'RTX 5090 Laptop 24GB', vram: 24, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true, bandwidth: 576,  memType: 'GDDR7',  pcie: 5, buyUrl: null },
  { label: 'RTX 5080 Laptop 16GB', vram: 16, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true, bandwidth: 384,  memType: 'GDDR7',  pcie: 5, buyUrl: null },
  { label: 'RTX 5070 Ti Laptop 12GB', vram: 12, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true, bandwidth: 288, memType: 'GDDR7', pcie: 5, buyUrl: null },
  { label: 'RTX 5070 Laptop 8GB',  vram: 8,  arch: 'Blackwell', cudaCap: 10.0, flashAttn: true, bandwidth: 224,  memType: 'GDDR7',  pcie: 5, buyUrl: null },
  { label: 'RTX 5060 Ti Laptop 8GB', vram: 8, arch: 'Blackwell', cudaCap: 10.0, flashAttn: true, bandwidth: 192,  memType: 'GDDR7',  pcie: 5, buyUrl: null },
  { label: 'RTX 5060 Laptop 8GB',  vram: 8,  arch: 'Blackwell', cudaCap: 10.0, flashAttn: true, bandwidth: 192,  memType: 'GDDR7',  pcie: 5, buyUrl: null },
  // Ada Laptop
  { label: 'RTX 4090 Laptop 16GB', vram: 16, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 432,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 4080 Laptop 12GB', vram: 12, arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 432,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 4070 Ti Laptop 16GB', vram: 16, arch: 'Ada', cudaCap: 8.9, flashAttn: true,  bandwidth: 256,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 4070 Laptop 8GB',  vram: 8,  arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 256,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 4060 Laptop 8GB',  vram: 8,  arch: 'Ada',    cudaCap: 8.9, flashAttn: true,  bandwidth: 192,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 3080 Laptop 16GB', vram: 16, arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 448,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 3080 Laptop 8GB',  vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 448,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 3070 Laptop 8GB',  vram: 8,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 256,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 3060 Laptop 6GB',  vram: 6,  arch: 'Ampere', cudaCap: 8.6, flashAttn: true,  bandwidth: 192,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 3050 Ti Laptop 4GB', vram: 4, arch: 'Ampere', cudaCap: 8.6, flashAttn: false, bandwidth: 192,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RTX 3050 Laptop 4GB',  vram: 4,  arch: 'Ampere', cudaCap: 8.6, flashAttn: false, bandwidth: 128,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  // Turing Laptop
  { label: 'RTX 2080 Laptop 8GB',  vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 256,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'RTX 2070 Laptop 8GB',  vram: 8,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 256,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'RTX 2060 Laptop 6GB',  vram: 6,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 192,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'GTX 1660 Ti Laptop 6GB', vram: 6, arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 192,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'GTX 1650 Ti Laptop 4GB', vram: 4, arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 160,  memType: 'GDDR6',  pcie: 3, buyUrl: null },
  { label: 'GTX 1650 Laptop 4GB',  vram: 4,  arch: 'Turing', cudaCap: 7.5, flashAttn: false, bandwidth: 128,  memType: 'GDDR5',  pcie: 3, buyUrl: null },

  // ── NVIDIA Pascal (1xxx) ─────────────────────────────────────────
  { label: 'GTX 1080 Ti 11GB',    vram: 11, arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 484,  memType: 'GDDR5X', pcie: 3, buyUrl: 'https://amzn.to/gtx1080ti' },
  { label: 'GTX 1080 8GB',        vram: 8,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 320,  memType: 'GDDR5X', pcie: 3, buyUrl: null },
  { label: 'GTX 1070 Ti 8GB',     vram: 8,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 256,  memType: 'GDDR5',  pcie: 3, buyUrl: null },
  { label: 'GTX 1070 8GB',        vram: 8,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 256,  memType: 'GDDR5',  pcie: 3, buyUrl: null },
  { label: 'GTX 1060 6GB',        vram: 6,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 192,  memType: 'GDDR5',  pcie: 3, buyUrl: 'https://amzn.to/gtx1060' },
  { label: 'GTX 1060 3GB',        vram: 3,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 192,  memType: 'GDDR5',  pcie: 3, buyUrl: null },
  { label: 'GTX 1050 Ti 4GB',     vram: 4,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 112,  memType: 'GDDR5',  pcie: 3, buyUrl: null },
  { label: 'GTX 1050 4GB',        vram: 4,  arch: 'Pascal', cudaCap: 6.1, flashAttn: false, bandwidth: 112,  memType: 'GDDR5',  pcie: 3, buyUrl: null },

  // ── AMD RDNA 4 / RDNA 3 (9xxx / 7xxx) ──────────────────────────
  { label: 'RX 9070 XT 16GB',     vram: 16, arch: 'RDNA4',  cudaCap: null, flashAttn: true,  bandwidth: 672,  memType: 'GDDR6',  pcie: 5, buyUrl: 'https://amzn.to/rx9070xt' },
  { label: 'RX 9070 16GB',        vram: 16, arch: 'RDNA4',  cudaCap: null, flashAttn: true,  bandwidth: 576,  memType: 'GDDR6',  pcie: 5, buyUrl: null },
  { label: 'RX 7900 XTX 24GB',    vram: 24, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 960,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rx7900xtx' },
  { label: 'RX 7900 XT 20GB',     vram: 20, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 800,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rx7900xt' },
  { label: 'RX 7900 GRE 16GB',    vram: 16, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 576,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 7800 XT 16GB',     vram: 16, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 624,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rx7800xt' },
  { label: 'RX 7700 XT 12GB',     vram: 12, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 432,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rx7700xt' },
  { label: 'RX 7600 8GB',         vram: 8,  arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 288,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 7600 XT 16GB',     vram: 16, arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 288,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 7500 XT 8GB',      vram: 8,  arch: 'RDNA3',  cudaCap: null, flashAttn: true,  bandwidth: 240,  memType: 'GDDR6',  pcie: 4, buyUrl: null },

  // ── AMD RDNA 2 (6xxx) ────────────────────────────────────────────
  { label: 'RX 6950 XT 16GB',     vram: 16, arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 576,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6900 XT 16GB',     vram: 16, arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 512,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rx6900xt' },
  { label: 'RX 6800 XT 16GB',     vram: 16, arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 512,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rx6800xt' },
  { label: 'RX 6800 16GB',        vram: 16, arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 512,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6750 XT 12GB',     vram: 12, arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 432,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6700 XT 12GB',     vram: 12, arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 384,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/rx6700xt' },
  { label: 'RX 6700 10GB',        vram: 10, arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 320,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6650 XT 8GB',      vram: 8,  arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 280,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6600 XT 8GB',      vram: 8,  arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 256,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6600 8GB',         vram: 8,  arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 224,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6500 XT 4GB',      vram: 4,  arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 144,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 6400 4GB',         vram: 4,  arch: 'RDNA2',  cudaCap: null, flashAttn: false, bandwidth: 128,  memType: 'GDDR6',  pcie: 4, buyUrl: null },

  // ── AMD RDNA 1 (5xxx) ────────────────────────────────────────────
  { label: 'RX 5700 XT 8GB',      vram: 8,  arch: 'RDNA1',  cudaCap: null, flashAttn: false, bandwidth: 448,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 5700 8GB',         vram: 8,  arch: 'RDNA1',  cudaCap: null, flashAttn: false, bandwidth: 448,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 5600 XT 6GB',      vram: 6,  arch: 'RDNA1',  cudaCap: null, flashAttn: false, bandwidth: 288,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 5500 XT 8GB',      vram: 8,  arch: 'RDNA1',  cudaCap: null, flashAttn: false, bandwidth: 224,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'RX 5500 XT 4GB',      vram: 4,  arch: 'RDNA1',  cudaCap: null, flashAttn: false, bandwidth: 112,  memType: 'GDDR6',  pcie: 4, buyUrl: null },

  // ── AMD GCN (Polaris / RX 500 / RX 400) ─────────────────────────
  { label: 'RX 580 8GB',          vram: 8,  arch: 'GCN4',   cudaCap: null, flashAttn: false, bandwidth: 256,  memType: 'GDDR5',  pcie: 3, buyUrl: null },
  { label: 'RX 570 8GB',          vram: 8,  arch: 'GCN4',   cudaCap: null, flashAttn: false, bandwidth: 224,  memType: 'GDDR5',  pcie: 3, buyUrl: null },
  { label: 'RX 570 4GB',          vram: 4,  arch: 'GCN4',   cudaCap: null, flashAttn: false, bandwidth: 224,  memType: 'GDDR5',  pcie: 3, buyUrl: null },

  // ── Intel Arc ────────────────────────────────────────────────────
  { label: 'Arc B580 12GB',       vram: 12, arch: 'Xe2-HPG', cudaCap: null, flashAttn: false, bandwidth: 456,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/arcb580' },
  { label: 'Arc B570 10GB',       vram: 10, arch: 'Xe2-HPG', cudaCap: null, flashAttn: false, bandwidth: 380,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'Arc A770 16GB',       vram: 16, arch: 'Xe-HPG',  cudaCap: null, flashAttn: false, bandwidth: 560,  memType: 'GDDR6',  pcie: 4, buyUrl: 'https://amzn.to/arca770' },
  { label: 'Arc A770 8GB',        vram: 8,  arch: 'Xe-HPG',  cudaCap: null, flashAttn: false, bandwidth: 512,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'Arc A750 8GB',        vram: 8,  arch: 'Xe-HPG',  cudaCap: null, flashAttn: false, bandwidth: 512,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'Arc A380 6GB',        vram: 6,  arch: 'Xe-HPG',  cudaCap: null, flashAttn: false, bandwidth: 186,  memType: 'GDDR6',  pcie: 4, buyUrl: null },
  { label: 'Arc A310 4GB',        vram: 4,  arch: 'Xe-HPG',  cudaCap: null, flashAttn: false, bandwidth: 128,  memType: 'GDDR6',  pcie: 4, buyUrl: null },

  // ── Apple Silicon — unified memory ───────────────────────────────
  { label: 'Apple M1',            vram: 0, unified: true, maxRam: 16,  flashAttn: true, bandwidth: 68,  memType: 'LPDDR4X', pcie: null, buyUrl: null },
  { label: 'Apple M1 Pro 16c',    vram: 0, unified: true, maxRam: 32,  flashAttn: true, bandwidth: 200, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M1 Max 32c',    vram: 0, unified: true, maxRam: 64,  flashAttn: true, bandwidth: 400, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M1 Ultra 64c',  vram: 0, unified: true, maxRam: 128, flashAttn: true, bandwidth: 800, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M2',            vram: 0, unified: true, maxRam: 24,  flashAttn: true, bandwidth: 100, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M2 Pro 12c',    vram: 0, unified: true, maxRam: 32,  flashAttn: true, bandwidth: 200, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M2 Max 38c',    vram: 0, unified: true, maxRam: 96,  flashAttn: true, bandwidth: 400, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M2 Ultra',      vram: 0, unified: true, maxRam: 192, flashAttn: true, bandwidth: 800, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M3',            vram: 0, unified: true, maxRam: 24,  flashAttn: true, bandwidth: 100, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M3 Pro 18c',    vram: 0, unified: true, maxRam: 36,  flashAttn: true, bandwidth: 150, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M3 Max 40c',    vram: 0, unified: true, maxRam: 128, flashAttn: true, bandwidth: 300, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M3 Ultra',      vram: 0, unified: true, maxRam: 192, flashAttn: true, bandwidth: 600, memType: 'LPDDR5',  pcie: null, buyUrl: null },
  { label: 'Apple M4',            vram: 0, unified: true, maxRam: 32,  flashAttn: true, bandwidth: 120, memType: 'LPDDR5X', pcie: null, buyUrl: null },
  { label: 'Apple M4 Pro 20c',    vram: 0, unified: true, maxRam: 64,  flashAttn: true, bandwidth: 273, memType: 'LPDDR5X', pcie: null, buyUrl: null },
  { label: 'Apple M4 Max 40c',    vram: 0, unified: true, maxRam: 128, flashAttn: true, bandwidth: 546, memType: 'LPDDR5X', pcie: null, buyUrl: null },

  // ── CPU only ─────────────────────────────────────────────────────
  { label: 'No GPU (CPU only)',    vram: 0, unified: false, flashAttn: false, bandwidth: 0,   memType: null, pcie: null, buyUrl: null },
];

export function findGPUByLabel(label) {
  return GPU_PRESETS.find(g => g.label === label);
}

export function findGPUBySlug(slug) {
  return GPU_PRESETS.find(
    g => gpuToSlug(g.label) === slug
  );
}

export function gpuToSlug(label) {
  return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Derive backend from OS + GPU vendor
export function getBackend(os, gpuLabel) {
  if (!gpuLabel || gpuLabel === 'No GPU (CPU only)') return 'cpu';
  if (gpuLabel.startsWith('Apple')) return 'mlx'; // MLX is preferred over Metal for LLMs
  if (gpuLabel.startsWith('Arc')) return 'vulkan';

  const isAMD = gpuLabel.startsWith('RX') || gpuLabel.startsWith('Radeon') || gpuLabel.startsWith('HD ');
  if (isAMD) {
    return os === 'Linux' ? 'rocm' : 'vulkan'; // ROCm works well only on Linux
  }
  return 'cuda'; // NVIDIA
}
