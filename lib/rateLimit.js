// Simple in-memory IP rate limiter — works across warm Vercel instances
const store = new Map();
const MAX_STORE = 5000;

/** Prune expired entries instead of clearing everything (avoids DoS reset vector) */
function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k);
    if (store.size <= MAX_STORE * 0.8) break; // stop once under 80 % capacity
  }
}

export function rateLimit(ip, { limit = 10, windowMs = 60_000 } = {}) {
  if (store.size >= MAX_STORE) pruneExpired();

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
