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

  const { hw, topModels, useCase } = payload;

  if (!hw || typeof hw !== 'object' || !Array.isArray(topModels)) {
    return Response.json({ error: 'Invalid input format' }, { status: 400 });
  }

  // Basic payload size check to mitigate DoS
  if (topModels.length > 100) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });
  }

  const cacheKey = 'summary_v2_' + crypto
    .createHash('md5')
    .update(JSON.stringify({ hw, topModels: topModels.map(m => m.name), useCase }))
    .digest('hex');

  const store = await getKV();
  if (store) {
    const cached = await store.get(cacheKey).catch(() => null);
    if (cached) return Response.json({ summary: cached, cached: true });
  }

  const effectiveVram = hw.unifiedMem ? hw.ram : (hw.vram * (hw.numGPUs || 1));

  const prompt = `You are an expert on running local LLMs. A user has this hardware:
- GPU: ${hw.gpuLabel} — ${effectiveVram}GB effective VRAM, ${hw.bandwidth || '?'} GB/s bandwidth
- RAM: ${hw.ram}GB (${hw.ramTypeLabel || 'DDR4'})
- CPU: ${hw.cpuLabel || hw.cpuTier + '-end'}
- OS: ${hw.os || 'Windows'} — backend: ${hw.gpuLabel?.startsWith('Apple') ? 'Metal' : hw.gpuLabel?.startsWith('RX') && hw.os === 'Linux' ? 'ROCm' : 'CUDA'}
- Storage: ${hw.ssd || 'nvme'}
- Context length target: ${hw.contextLength || 4096} tokens

Their top compatible models:
${topModels.slice(0, 5).map((m, i) => `${i + 1}. ${m.name} ${m.quant} (~${m.tokPerSec} tok/s)`).join('\n')}

Primary use case: ${useCase || 'general chat'}

Write a 2-paragraph plain-English summary:
1. What their hardware is good for overall (mention the bandwidth and what model sizes that enables)
2. Top recommendation for their use case and why

Direct and specific. No markdown. Under 120 words total.`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  let summary;
  for (const modelId of ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest']) {
    try {
      const m = genAI.getGenerativeModel({ model: modelId });
      const result = await m.generateContent(prompt);
      summary = result.response.text().trim();
      break;
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429');
      if (is429 && modelId !== 'gemini-1.5-flash-latest') continue;
      if (is429) {
        const retryAfter = err?.message?.match(/(\d+)s/)?.[1];
        return Response.json(
          { error: `Gemini quota exceeded. Retry in ${retryAfter || 60}s.` },
          { status: 429 }
        );
      }
      // Securely handle unhandled exceptions from Gemini API without leaking stack trace
      console.error('Gemini API Error:', err.message || err);
      return Response.json({ error: 'Internal server error during summarization' }, { status: 500 });
    }
  }

  if (!summary) {
    return Response.json({ error: 'Summarization failed' }, { status: 500 });
  }

  if (store) {
    await store.set(cacheKey, summary, { ex: 86400 }).catch(() => {});
  }

  return Response.json({ summary, cached: false });
}
