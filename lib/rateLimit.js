// Simple in-memory IP rate limiter — works across warm Vercel instances
// Falls back to allowing the request if the Map grows too large (memory safety)
const store = new Map();
const MAX_STORE = 5000;

export function rateLimit(ip, { limit = 10, windowMs = 60_000 } = {}) {
  if (store.size > MAX_STORE) store.clear(); // safety valve

  const now = Date.now();
  const key = `rl:${ip}`;
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  record.count += 1;
  const remaining = Math.max(0, limit - record.count);
  return {
    allowed: record.count <= limit,
    remaining,
    retryAfter: Math.ceil((record.resetAt - now) / 1000),
  };
}
