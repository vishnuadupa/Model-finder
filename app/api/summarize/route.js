import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

let kv = null;
async function getKV() {
  if (!kv && process.env.KV_REST_API_URL) {
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  }
  return kv;
}

const client = new Anthropic();

export async function POST(req) {
  const { hw, topModels, useCase } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const cacheKey = 'summary_' + crypto
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
- GPU: ${hw.gpuLabel} with ${effectiveVram}GB effective VRAM
- RAM: ${hw.ram}GB system RAM
- CPU: ${hw.cpuTier || 'mid'}-end
- Storage: ${hw.ssd || 'nvme'}
- Context length target: ${hw.contextLength || 4096} tokens

Their top compatible models are:
${topModels.slice(0, 5).map((m, i) => `${i + 1}. ${m.name} ${m.quant} (~${m.tokPerSec} tok/s)`).join('\n')}

User's primary use case: ${useCase || 'general chat'}

Write a 2-paragraph plain-English summary:
1. What their hardware is good for overall
2. Your top recommendation for their use case and why

Be direct and specific. No markdown. Under 120 words total.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const summary = message.content[0].text;

  if (store) {
    await store.set(cacheKey, summary, { ex: 86400 }).catch(() => {});
  }

  return Response.json({ summary, cached: false });
}
