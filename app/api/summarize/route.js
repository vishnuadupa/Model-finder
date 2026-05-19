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
  const { hw, topModels, useCase } = await req.json();

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

  const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  const summary = result.response.text().trim();

  if (store) {
    await store.set(cacheKey, summary, { ex: 86400 }).catch(() => {});
  }

  return Response.json({ summary, cached: false });
}
