import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

let kv = null;
async function getKV() {
  if (!kv && process.env.KV_REST_API_URL) {
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  }
  return kv;
}

export async function POST(req) {
  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { hw, currentModel, allModels } = payload;

  if (!hw || typeof hw !== 'object' || !currentModel || typeof currentModel !== 'object' || !Array.isArray(allModels)) {
    return Response.json({ error: 'Invalid input format' }, { status: 400 });
  }

  // Basic payload size check to mitigate DoS (e.g. allModels too large)
  if (allModels.length > 1000) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });
  }

  const cacheKey = 'gemini_v2_' + crypto
    .createHash('md5')
    .update(JSON.stringify({
      gpu: hw.gpuLabel, vram: hw.vram, ram: hw.ram,
      bw: hw.bandwidth, ctx: hw.contextLength, fa: hw.flashAttn,
      os: hw.os, cpu: hw.cpuLabel, ramType: hw.ramTypeLabel,
      model: currentModel.name,
    }))
    .digest('hex');

  const store = await getKV();
  if (store) {
    const cached = await store.get(cacheKey).catch(() => null);
    if (cached) return Response.json({ ...cached, cached: true });
  }

  // Sort by params to find neighbours
  const sorted = [...allModels].sort((a, b) => a.params - b.params);
  const idx    = sorted.findIndex(m => m.name === currentModel.name);
  const modelUp   = idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const modelDown = idx > 0 ? sorted[idx - 1] : null;

  const effectiveVram = hw.unifiedMem ? hw.ram : (hw.vram * (hw.numGPUs || 1));

  // Derive backend
  let backend = 'CUDA';
  if (hw.gpuLabel?.startsWith('Apple')) backend = 'Metal';
  else if (hw.gpuLabel?.startsWith('RX ') || hw.gpuLabel?.startsWith('Radeon')) {
    backend = hw.os === 'Linux' ? 'ROCm' : 'Vulkan';
  } else if (hw.gpuLabel?.startsWith('Arc')) backend = 'Vulkan/SYCL';
  else if (!hw.gpuLabel || hw.gpuLabel === 'No GPU (CPU only)') backend = 'CPU only';

  const prompt = `You are an expert on local LLM inference performance.

HARDWARE CONFIGURATION:
- GPU: ${hw.gpuLabel || 'None'}
- Effective VRAM: ${effectiveVram} GB${hw.unifiedMem ? ' (unified — all RAM is VRAM)' : ''}
- GPU Memory Bandwidth: ${hw.bandwidth || 'unknown'} GB/s
- GPU Memory Type: ${hw.memType || 'unknown'}
- GPU Architecture: ${hw.arch || 'unknown'}
- Number of GPUs: ${hw.numGPUs || 1}
- Inference backend: ${backend}
- OS: ${hw.os || 'Windows'}
- CPU: ${hw.cpuLabel || hw.cpuTier + '-end'}
- CPU cores: ${hw.cpuCores || 'unknown'}
- System RAM: ${hw.ram} GB
- RAM type: ${hw.ramTypeLabel || 'DDR4'} (~${hw.ramBandwidthGB || 51} GB/s bandwidth)
- Storage: ${hw.ssd || 'nvme'}
- Flash Attention: ${hw.flashAttn ? 'enabled' : 'disabled'}
- Target context length: ${hw.contextLength || 4096} tokens

CURRENT MODEL BEING ANALYSED:
${currentModel.name} (${currentModel.params}B params, Q4_K_M quant)
Model VRAM requirement at this context: approximately ${
  ((currentModel.params * 4.85 * 1.05) / 8).toFixed(1)
} GB

NEIGHBOURING MODELS FOR COMPARISON:
- One size UP: ${modelUp ? `${modelUp.name} (${modelUp.params}B)` : 'none — this is the largest'}
- One size DOWN: ${modelDown ? `${modelDown.name} (${modelDown.params}B)` : 'none — this is the smallest'}

IMPORTANT CONTEXT:
- Memory bandwidth (${hw.bandwidth || '?'} GB/s) is the primary bottleneck for autoregressive decoding
- Formula: tok/s ≈ bandwidth_GB_s / model_vram_GB * backend_efficiency
- Backend efficiencies: CUDA=100%, Metal=88%, ROCm=82%, Vulkan=62%, CPU=8%
- Multi-GPU adds bandwidth linearly with small overhead
- Flash Attention helps with long contexts but not raw tok/s at short context
- Apple Metal is very efficient for unified memory — factor in full RAM bandwidth

Return ONLY valid JSON (no markdown, no explanation):
{
  "tokPerSec": "65-80",
  "tokPerSecNote": "precise one sentence: cite the bandwidth figure and why",
  "modelUp": {
    "name": "${modelUp?.name || 'N/A'}",
    "canRun": true,
    "tokPerSec": "30-45",
    "tradeoff": "one sentence — quality/capability gain vs speed and VRAM cost"
  },
  "modelDown": {
    "name": "${modelDown?.name || 'N/A'}",
    "canRun": true,
    "tokPerSec": "110-140",
    "tradeoff": "one sentence — speed gain vs quality trade-off"
  }
}`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Try flash first, fall back to flash-lite on quota errors
  let text;
  for (const modelId of ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest']) {
    try {
      const m = genAI.getGenerativeModel({ model: modelId });
      const result = await m.generateContent(prompt);
      text = result.response.text()
        .replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
      break;
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429');
      if (is429 && modelId !== 'gemini-1.5-flash-latest') continue; // try next model
      if (is429) {
        const retryAfter = err?.message?.match(/(\d+)s/)?.[1];
        return Response.json(
          { error: 'rate_limited', retryAfter: retryAfter ? Number(retryAfter) : 60 },
          { status: 429 }
        );
      }
      // Securely handle unhandled exceptions from Gemini API without leaking stack trace
      console.error('Gemini API Error:', err.message || err);
      return Response.json({ error: 'Internal server error during generation' }, { status: 500 });
    }
  }

  if (!text) {
    return Response.json({ error: 'Generation failed' }, { status: 500 });
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return Response.json({ error: 'Gemini returned unparseable response' }, { status: 500 });
  }

  if (store) {
    await store.set(cacheKey, data, { ex: 3600 }).catch(() => {});
  }

  return Response.json({ ...data, cached: false });
}
