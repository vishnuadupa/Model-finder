import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { rateLimit } from '@/lib/rateLimit';

let kv = null;
async function getKV() {
  if (!kv && process.env.KV_REST_API_URL) {
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  }
  return kv;
}

const VALID_USE_CASES = new Set(['chat', 'code', 'reasoning', 'long-docs', 'multilingual', 'vision', 'general chat', '']);

export async function POST(req) {
  // Strict origin header checking to prevent cross-origin quota theft
  const origin = req.headers.get('origin');
  if (process.env.NODE_ENV === 'production' && !origin) {
    return Response.json({ error: 'Origin header required' }, { status: 403 });
  }
  if (origin) {
    let isAllowed = false;
    try {
      const parsed = new URL(origin);
      isAllowed = ['llmmatcher.app', 'localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.hostname.endsWith('.vercel.app');
    } catch {}
    if (!isAllowed) {
      return Response.json({ error: 'Unauthorized origin' }, { status: 403 });
    }
  }

  const ip = req.headers.get('x-vercel-forwarded-for')
          ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? 'unknown';
  const { allowed, retryAfter } = rateLimit(ip, { limit: 5, windowMs: 60_000 });
  if (!allowed) {
    return Response.json({ error: `Quota exceeded. Retry in ${retryAfter}s.` }, { status: 429 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 20_480) {
    return Response.json({ error: 'Request too large' }, { status: 413 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });
  }

  let hw, topModels, useCase;
  try {
    ({ hw, topModels, useCase } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!hw || typeof hw !== 'object') return Response.json({ error: 'Invalid hw' }, { status: 400 });
  if (!Array.isArray(topModels) || topModels.length === 0) return Response.json({ error: 'Invalid topModels' }, { status: 400 });

  // Allowlist useCase — no arbitrary strings into the prompt
  const safeUseCase = VALID_USE_CASES.has(useCase) ? useCase : 'general chat';

  // Sanitize model list — only safe fields, bounded lengths
  const safeModels = topModels.slice(0, 5).map(m => ({
    name:     String(m.name     ?? '').slice(0, 100).replace(/[<>"]/g, ''),
    quant:    String(m.quant    ?? '').slice(0, 20).replace(/[^A-Za-z0-9_.]/g, ''),
    tokPerSec:typeof m.tokPerSec === 'number' && isFinite(m.tokPerSec)
              ? Math.round(m.tokPerSec) : 0,
  }));

  const effectiveVram = hw.unifiedMem ? (hw.ram || 0) : ((hw.vram || 0) * (hw.numGPUs || 1));
  const gpuLabel  = String(hw.gpuLabel  || '').slice(0, 100);
  const ramType   = String(hw.ramTypeLabel || 'DDR4').slice(0, 30);
  const cpuLabel  = String(hw.cpuLabel  || hw.cpuTier || 'mid-end').slice(0, 100);
  const osLabel   = String(hw.os        || 'Windows').slice(0, 20);
  const backend = gpuLabel.startsWith('Apple') ? 'Metal'
                : (gpuLabel.startsWith('RX ') || gpuLabel.startsWith('Radeon') || gpuLabel.startsWith('HD ')) && osLabel === 'Linux' ? 'ROCm'
                : (gpuLabel.startsWith('RX ') || gpuLabel.startsWith('Radeon') || gpuLabel.startsWith('HD ')) ? 'Vulkan'
                : (gpuLabel.startsWith('Arc') || gpuLabel.startsWith('Intel Arc')) ? 'Vulkan/SYCL'
                : gpuLabel === 'No GPU (CPU only)' || !gpuLabel ? 'CPU only'
                : 'CUDA';

  const cacheKey = 'summary_v3_' + crypto
    .createHash('md5')
    .update(JSON.stringify({ gpuLabel, vram: effectiveVram, ram: hw.ram, bw: hw.bandwidth,
                              ctx: hw.contextLength, models: safeModels.map(m => m.name), safeUseCase }))
    .digest('hex');

  const store = await getKV();
  if (store) {
    const cached = await store.get(cacheKey).catch(() => null);
    if (cached) return Response.json({ summary: cached, cached: true });
  }

  const prompt = `You are an expert on running local LLMs. A user has this hardware:
- GPU: ${gpuLabel} — ${effectiveVram}GB effective VRAM, ${hw.bandwidth || '?'} GB/s bandwidth
- RAM: ${hw.ram}GB (${ramType})
- CPU: ${cpuLabel}
- OS: ${osLabel} — backend: ${backend}
- Context: ${hw.contextLength || 4096} tokens

Top compatible models:
${safeModels.map((m, i) => `${i + 1}. ${m.name} ${m.quant} (~${m.tokPerSec} tok/s)`).join('\n')}

Use case: ${safeUseCase}

Write a 2-paragraph plain-English summary:
1. What their hardware is good for (mention bandwidth)
2. Top recommendation for their use case and why

Direct and specific. No markdown. Under 120 words.`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const TIMEOUT_MS = 8_000;
  let summary;
  let lastErr;
  for (const modelId of MODELS) {
    try {
      const m = genAI.getGenerativeModel({ model: modelId });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('timeout'), { status: 503 })), TIMEOUT_MS)
      );
      const result = await Promise.race([m.generateContent(prompt), timeoutPromise]);
      summary = result.response.text().trim().slice(0, 1000);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? 0;
      if (status === 429 || status === 404 || status === 503) continue;
      throw err;
    }
  }
  if (lastErr) {
    const is429 = lastErr?.status === 429 || lastErr?.message?.includes('429');
    if (is429) return Response.json({ error: 'Gemini quota exceeded. Retry in 60s.' }, { status: 429 });
    return Response.json({ error: 'Gemini unavailable — check your API key project settings' }, { status: 503 });
  }

  if (store) await store.set(cacheKey, summary, { ex: 86400 }).catch(() => {});
  return Response.json({ summary, cached: false });
}
