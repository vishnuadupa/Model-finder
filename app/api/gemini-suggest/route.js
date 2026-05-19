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
  const { hw, currentModel, allModels } = await req.json();

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });
  }

  const cacheKey = 'gemini_' + crypto
    .createHash('md5')
    .update(JSON.stringify({ hw, model: currentModel.name }))
    .digest('hex');

  const store = await getKV();
  if (store) {
    const cached = await store.get(cacheKey).catch(() => null);
    if (cached) return Response.json({ ...cached, cached: true });
  }

  // Sort models by params to find neighbors
  const sorted = [...allModels].sort((a, b) => a.params - b.params);
  const idx = sorted.findIndex(m => m.name === currentModel.name);
  const modelUp   = idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const modelDown = idx > 0 ? sorted[idx - 1] : null;

  const effectiveVram = hw.unifiedMem ? hw.ram : (hw.vram * (hw.numGPUs || 1));

  const prompt = `You are an expert on local LLM performance benchmarks.

User hardware:
- GPU: ${hw.gpuLabel}, effective VRAM: ${effectiveVram}GB${hw.unifiedMem ? ' (unified memory)' : ''}
- RAM: ${hw.ram}GB system RAM
- CPU: ${hw.cpuTier || 'mid'}-end
- Storage: ${hw.ssd || 'nvme'}
- Flash Attention: ${hw.flashAttn ? 'yes' : 'no'}
- Context length: ${hw.contextLength || 4096} tokens

Current model being viewed: ${currentModel.name} (${currentModel.params}B params, Q4_K_M quant)
Model one step UP in size: ${modelUp ? `${modelUp.name} (${modelUp.params}B)` : 'none — already largest'}
Model one step DOWN in size: ${modelDown ? `${modelDown.name} (${modelDown.params}B)` : 'none — already smallest'}

Return valid JSON only (no markdown, no explanation outside JSON):
{
  "tokPerSec": "65-80",
  "tokPerSecNote": "one sentence explaining why based on GPU bandwidth and model size",
  "modelUp": {
    "name": "${modelUp?.name || 'N/A'}",
    "canRun": true,
    "tokPerSec": "30-45",
    "tradeoff": "one sentence — quality gain vs speed/VRAM cost"
  },
  "modelDown": {
    "name": "${modelDown?.name || 'N/A'}",
    "canRun": true,
    "tokPerSec": "110-140",
    "tradeoff": "one sentence — speed gain vs quality loss"
  }
}`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const gemResult = await model.generateContent(prompt);
  const text = gemResult.response.text()
    .replace(/```json\n?/g, '')
    .replace(/\n?```/g, '')
    .trim();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return Response.json({ error: 'Failed to parse Gemini response' }, { status: 500 });
  }

  if (store) {
    await store.set(cacheKey, data, { ex: 3600 }).catch(() => {});
  }

  return Response.json({ ...data, cached: false });
}
