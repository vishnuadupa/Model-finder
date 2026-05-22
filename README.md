# Local LLM Matcher

**Which AI models can your hardware actually run?**

Paste in your GPU, RAM, and CPU — get a ranked list of every local LLM that fits, with VRAM usage, estimated tokens/sec, quantization recommendations, and Ollama/HuggingFace download links.

🌐 **Live:** [llm-matcher.vercel.app](https://llm-matcher.vercel.app)

---

## Features

### Hardware Matching
- Supports **NVIDIA** (Blackwell / Ada / Ampere / Turing / Pascal), **AMD** (RDNA4 / RDNA3 / RDNA2 / RDNA1 / GCN4), **Intel Arc** (Xe2 / Xe), and **Apple Silicon** (M1–M4 all variants)
- **170+ GPU presets** with real memory bandwidth figures, PCIe gen, and memory type
- **90+ CPU presets** across Intel (10th–14th gen, Core Ultra) and AMD (Zen 2–5, Threadripper, laptop series), all with per-CPU RAM bandwidth factors
- **19 RAM type presets** — DDR5-7200 down to DDR3-1600, plus LPDDR5X/5/4X/4 for laptops and Apple Silicon
- Multi-GPU support (1–4× scaling with real NVLink/PCIe efficiency factors)
- CPU-only inference mode

### Scoring Engine
- **Memory-bandwidth formula:** `tok/s ≈ (bandwidth × quant_efficiency × backend_efficiency) / model_size`
- Per-backend efficiency: CUDA 1.00 · Metal 0.88 · ROCm 0.82 · Vulkan 0.62 · CPU 0.08
- **PCIe gen penalty** on CPU offload: PCIe 3 gets −20% offload headroom vs PCIe 4 baseline (reflects real host↔device transfer limits)
- **CPU cores scaling** on CPU-path tok/s: +2.5% per core above 4, capped at +30%
- Flash Attention 2: KV cache VRAM ×0.70 + tok/s ×1.05
- RAM type bonus: high-bandwidth RAM (DDR5-6000+, LPDDR5X) adds +3% tier score
- Three tiers: **Recommended** (≥40% VRAM headroom) · **Comfortable** · **Stretch** (needs CPU offload)

### Filtering & UI
- **Sticky horizontal hardware bar** — GPU · RAM · CPU · Context length, always visible
- **Permanent Row 2** — Use case chips + speed filter, always one click away
- **Use case hard filter** — selecting Chat/Code/Reasoning/etc. removes non-matching models entirely (not just reorders)
- **Speed filter** — All · 10+ tok/s · 30+ tok/s
- **3-step GPU wizard** — OS → brand → model with grouped sections per architecture
- OS auto-detected from user agent on first load (Windows / Linux / macOS)
- Context length: 2k · 4k · 8k · 16k · 32k · 128k
- Advanced settings: Flash Attention toggle · Storage type · GPU count · RAM type · VRAM override
- Settings badge shows active non-default options (FA · HDD/SATA · 2×)

### AI Features
- **Gemini Speed Advisor** — real-time tok/s estimate for the selected model with next-model-up and next-model-down suggestions
- **Gemini AI Summary** — plain-English paragraph summarising your top 5 compatible models
- Both gated behind a toggle (off by default, opt-in)
- Rate-limited with Vercel KV caching to prevent abuse

### Suggestion Planner & Goal-Driven Upgrades
- **Interactive Performance Status Banner:** Benchmarks your system against a reference **Llama 3 8B Q4_K_M** model (5.09GB size), rendering current throughput vs. target throughput, an active progress bar, and a gap indicator (e.g. `"need 8 more tok/s"`).
- **Dynamic Goal-Based Card Labeling:** Hardware options are dynamically labeled according to target speed matching:
  - **Meets Goal:** The most cost-effective GPU that bridges the performance gap to satisfy your speed preference.
  - **Balanced / Maximum:** Advanced upgrades providing additional headroom.
  - **Go Further:** Triggered if your current system already satisfies the target speed, presenting ultra-enthusiast paths.
  - **Budget Option:** Cost-effective system RAM upgrades (e.g. doubling system memory or unified memory pool).
- **Strict Non-Downgrade Filtering:** Candidates are hidden unless they strictly exceed your baseline VRAM capacity or memory bandwidth, ensuring you are never prompted to downgrade.
- **Up-to-Date Consumer Ladders:**
  - *macOS Path:* Double RAM Boost, MacBook Pro M4 Max (64GB), and Mac Studio M4 Ultra (128GB).
  - *Windows/Linux Path:* System RAM Boost, RTX 4060 Ti 16GB, RTX 4070 Ti Super 16GB, RTX 4080 Super 16GB, RTX 5080 16GB, RTX 4090 24GB, RTX 5090 32GB, and Dual RTX 4090 (2x24GB).
- **Peak Rig Congratulations UI:** If your system is already at the absolute limits of consumer hardware, the planner renders a premium congratulatory state acknowledging that no local consumer GPU upgrades can surpass your setup.

### Robust Mathematical Validation Framework
- **Two-Stage Multi-OS Testing Suite:** Features advanced testing scripts (`scripts/simulate-random.js` and `scripts/simulate-random-deep.js`) to generate and verify completely random hardware configurations.
- **Strict Analytical Auditing:** Re-validates memory consumption bounds across 80+ randomized scenarios. It ensures that every playable model in the *Recommended* tier fits entirely within dedicated VRAM, and every *Comfortable/Stretch* model fits within the combined unified or offloaded memory budget.

### SEO & Sharing
- **138 static pages** — one per GPU (`/gpu/rtx-4090-24gb`, `/gpu/apple-m3-max-40c`, etc.)
- Dynamic OG image per GPU via `next/og` (no edge runtime required)
- Twitter card + canonical URL metadata
- Shareable URL — encodes all hardware settings including use cases and speed preference

### Data Pipeline
- `scripts/update-models.js` — HuggingFace GGUF scraper that keeps `public/models.json` fresh
- `scripts/scrape-ollama.js` — Ollama library scraper for `ollamaTag` fields
- GitHub Action runs daily at 02:00 UTC, commits updated model data automatically
- Optional Discord webhook alert when new models are found

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| AI | Google Gemini (`gemini-1.5-flash`) |
| Caching | Vercel KV |
| Analytics | Vercel Analytics |
| OG Images | `next/og` (built-in, Node runtime) |
| Fonts | IBM Plex Mono · Syne · Inter |
| Deployment | Vercel |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes (for AI features) | Gemini advisor + summary. Free tier: 1500 req/day at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `KV_REST_API_URL` | Yes (for AI features) | Vercel KV — caches AI responses |
| `KV_REST_API_TOKEN` | Yes (for AI features) | Vercel KV token |
| `HF_TOKEN` | Yes (for scraper) | HuggingFace read-only token for model scraper |
| `DISCORD_WEBHOOK` | No | New-model alerts via Discord |
| `NEXT_PUBLIC_ADSENSE` | No | Google AdSense publisher ID |

The app runs fully without any env vars — Gemini features just won't activate.

---

## Project Structure

```
app/
  page.jsx              # Main page — hardware state, scoring call, results
  layout.js             # Root layout, fonts, metadata, Analytics
  globals.css           # Slate+emerald design tokens, card/chip/btn classes
  gpu/[slug]/page.jsx   # Static SEO page per GPU (138 pages)
  api/
    gemini-suggest/     # Gemini Speed Advisor endpoint
    summarize/          # Gemini AI Summary endpoint
    og/                 # Dynamic OG image (next/og)

components/
  HardwareBar.jsx       # Sticky 2-row hardware bar — GPU wizard, RAM, CPU, ctx, settings
  ResultsPanel.jsx      # Three-tier results layout with cloud CTA
  ResultCard.jsx        # Individual model card — VRAM bar, stats, actions
  GeminiAdvisor.jsx     # Inline AI tok/s advisor with model navigation

lib/
  scoring.js            # Core math — VRAM, KV cache, tok/s, tier scoring
  gpuPresets.js         # 170+ GPU entries with bandwidth, arch, PCIe, buyUrl
  cpuPresets.js         # 90+ CPU entries + 19 RAM type configs
  rateLimit.js          # In-memory rate limiter for AI API routes

public/
  models.json           # ~200 GGUF models with quants, use cases, Ollama tags

scripts/
  update-models.js      # HuggingFace scraper
  scrape-ollama.js      # Ollama library scraper
  fix-models.js         # Data normaliser / deduplicator

.github/workflows/
  update-models.yml     # Daily cron — scrape → commit → push
```

---

## Scoring Formula

```
// VRAM required
weights_GB = params_B × bits_per_weight × 1.05 / 8
kv_cache_GB = f(context_length, layers, kv_heads, head_dim)   // Flash Attn: ×0.70
total_vram = weights_GB + kv_cache_GB

// Fits check
gpu_fits     = total_vram ≤ gpu_vram × num_gpus
offload_fits = total_vram ≤ gpu_vram + (ram × offload_fraction × cpu_factor × pcie_factor)
ram_fits     = system_ram ≥ total_vram × 1.5

// Tier score (0–1)
score = vram_headroom × 0.60
      + ram_headroom  × 0.28
      + ssd_bonus              // NVMe +0.08, HDD −0.12
      + cpu_bonus              // ultra +0.08 … low 0
      + flash_bonus            // +0.05
      + ram_type_bonus         // +0.03 for DDR5-6000+ / LPDDR5X
      + backend_penalty        // Vulkan −0.10, ROCm −0.03

// tok/s (GPU path)
tok_s = (bandwidth_GBs × quant_efficiency × backend_efficiency × fa_boost) / model_size_GB

// tok/s (CPU offload path)
tok_s = (ram_bandwidth × ram_factor × 0.6 × cores_factor) / model_size_GB
```

---

## License

MIT
