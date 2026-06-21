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

const VALID_OS      = ['Windows', 'Linux', 'macOS', ''];
const VALID_SSDs    = ['nvme', 'sata', 'hdd', ''];
const MAX_STR       = 120;

function validateHw(hw) {
  if (!hw || typeof hw !== 'object') return false;
  const strFields = ['gpuLabel', 'os', 'ramTypeLabel', 'cpuLabel', 'memType', 'arch', 'ssd'];
  for (const f of strFields) {
    if (hw[f] != null && (typeof hw[f] !== 'string' || hw[f].length > MAX_STR)) return false;
  }
  const numFields = ['vram', 'ram', 'bandwidth', 'contextLength', 'numGPUs', 'ramBandwidthGB'];
  for (const f of numFields) {
    if (hw[f] != null && (typeof hw[f] !== 'number' || !isFinite(hw[f]) || hw[f] < 0)) return false;
  }
  if (hw.os && !VALID_OS.includes(hw.os)) return false;
  if (hw.ssd && !VALID_SSDs.includes(hw.ssd)) return false;
  return true;
}

function validateModel(m) {
  return m && typeof m === 'object'
    && typeof m.name === 'string' && m.name.length <= MAX_STR
    && typeof m.params === 'number' && isFinite(m.params);
}

function sanitizeNeighbour(m) {
  if (!m) return null;
  return {
    name:     String(m.name ?? '').slice(0, MAX_STR),
    canRun:   Boolean(m.canRun),
    tokPerSec:String(m.tokPerSec ?? '').slice(0, 20),
    tradeoff: String(m.tradeoff ?? '').slice(0, 300),
  };
}

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

  // Rate limit: 10 req / 60s per IP
  const ip = req.headers.get('x-vercel-forwarded-for')
          ?? req.headers.get('x-forwarded-for')?.split(',').pop()?.trim()
          ?? 'unknown';
  const { allowed, retryAfter } = rateLimit(ip, { limit: 10, windowMs: 60_000 });
  if (!allowed) {
    return Response.json({ error: 'rate_limited', retryAfter }, { status: 429 });
  }

  // Body size guard
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 10_240) {
    return Response.json({ error: 'Request too large' }, { status: 413 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });
  }

  let hw, currentModel, modelUpName, modelDownName;
  try {
    ({ hw, currentModel, modelUpName, modelDownName } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!validateHw(hw))          return Response.json({ error: 'Invalid hw'           }, { status: 400 });
  if (!validateModel(currentModel)) return Response.json({ error: 'Invalid model'     }, { status: 400 });
  if (modelUpName   != null && (typeof modelUpName   !== 'string' || modelUpName.length   > MAX_STR))
    return Response.json({ error: 'Invalid modelUpName'   }, { status: 400 });
  if (modelDownName != null && (typeof modelDownName !== 'string' || modelDownName.length > MAX_STR))
    return Response.json({ error: 'Invalid modelDownName' }, { status: 400 });

  const cacheKey = 'gemini_v3_' + crypto
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

  const effectiveVram = hw.unifiedMem ? hw.ram : (hw.vram * (hw.numGPUs || 1));
  let backend = 'CUDA';
  if (hw.gpuLabel?.startsWith('Apple'))                                          backend = 'Metal';
  else if (hw.gpuLabel?.startsWith('RX ') || hw.gpuLabel?.startsWith('Radeon')) backend = hw.os === 'Linux' ? 'ROCm' : 'Vulkan';
  else if (hw.gpuLabel?.startsWith('Arc'))                                        backend = 'Vulkan/SYCL';
  else if (!hw.gpuLabel || hw.gpuLabel === 'No GPU (CPU only)')                  backend = 'CPU only';

  const prompt = `You are an expert on local LLM inference performance.

HARDWARE:
- GPU: ${hw.gpuLabel || 'None'} — ${effectiveVram}GB effective VRAM, ${hw.bandwidth || '?'} GB/s bandwidth
- Backend: ${backend} on ${hw.os || 'Windows'}
- CPU: ${hw.cpuLabel || hw.cpuTier + '-end'}, ${hw.cpuCores || '?'} cores
- RAM: ${hw.ram}GB ${hw.ramTypeLabel || 'DDR4'} (~${hw.ramBandwidthGB || 51} GB/s)
- Flash Attention: ${hw.flashAttn ? 'yes' : 'no'}, Context: ${hw.contextLength || 4096} tokens

CURRENT MODEL: ${currentModel.name} (${currentModel.params}B params, Q4_K_M)
UP:   ${modelUpName   || 'none'}
DOWN: ${modelDownName || 'none'}

Return ONLY valid JSON:
{
  "tokPerSec": "65-80",
  "tokPerSecNote": "one sentence citing bandwidth and backend",
  "modelUp":   { "name": "${modelUpName   || 'N/A'}", "canRun": true,  "tokPerSec": "30-45",  "tradeoff": "one sentence" },
  "modelDown": { "name": "${modelDownName || 'N/A'}", "canRun": true,  "tokPerSec": "110-140","tradeoff": "one sentence" }
}`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const TIMEOUT_MS = 8_000;
  let text;
  let lastErr;
  for (const modelId of MODELS) {
    try {
      const m = genAI.getGenerativeModel({ model: modelId });
      // Race against a hard timeout so we never hang the serverless function
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('timeout'), { status: 503 })), TIMEOUT_MS)
      );
      const result = await Promise.race([m.generateContent(prompt), timeoutPromise]);
      text = result.response.text().replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? 0;
      // 429 = quota, 404 = model not found, 503 = overloaded/timeout — all: try next
      if (status === 429 || status === 404 || status === 503) continue;
      throw err;
    }
  }
  if (lastErr) {
    const is429 = lastErr?.status === 429 || lastErr?.message?.includes('429');
    if (is429) return Response.json({ error: 'rate_limited', retryAfter: 60 }, { status: 429 });
    return Response.json({ error: 'Gemini unavailable — check your API key project settings' }, { status: 503 });
  }

  let raw;
  try { raw = JSON.parse(text); }
  catch { return Response.json({ error: 'Unparseable Gemini response' }, { status: 500 }); }

  // Allowlist output fields — never forward arbitrary LLM-generated keys
  const data = {
    tokPerSec:    typeof raw.tokPerSec    === 'string' ? raw.tokPerSec.slice(0, 20)    : null,
    tokPerSecNote:typeof raw.tokPerSecNote=== 'string' ? raw.tokPerSecNote.slice(0, 300): null,
    modelUp:   sanitizeNeighbour(raw.modelUp),
    modelDown: sanitizeNeighbour(raw.modelDown),
  };

  if (store) await store.set(cacheKey, data, { ex: 3600 }).catch(() => {});
  return Response.json({ ...data, cached: false });
}
