import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit } from '../lib/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows the first request and sets remaining', () => {
    const result = rateLimit('ip1', { limit: 5, windowMs: 1000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('decreases remaining on subsequent requests', () => {
    rateLimit('ip2', { limit: 3, windowMs: 1000 });
    const result = rateLimit('ip2', { limit: 3, windowMs: 1000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('blocks requests exceeding the limit', () => {
    rateLimit('ip3', { limit: 2, windowMs: 1000 });
    rateLimit('ip3', { limit: 2, windowMs: 1000 });
    const result = rateLimit('ip3', { limit: 2, windowMs: 1000 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('resets the limit after windowMs has passed', () => {
    rateLimit('ip4', { limit: 1, windowMs: 1000 });

    // Should be blocked
    let result = rateLimit('ip4', { limit: 1, windowMs: 1000 });
    expect(result.allowed).toBe(false);

    // Advance time past windowMs
    vi.advanceTimersByTime(1001);

    // Should be allowed again
    result = rateLimit('ip4', { limit: 1, windowMs: 1000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('tracks different IPs separately', () => {
    rateLimit('ip5', { limit: 1, windowMs: 1000 });

    const resultIp5 = rateLimit('ip5', { limit: 1, windowMs: 1000 });
    expect(resultIp5.allowed).toBe(false);

    const resultIp6 = rateLimit('ip6', { limit: 1, windowMs: 1000 });
    expect(resultIp6.allowed).toBe(true);
  });

  it('triggers pruning when store reaches MAX_STORE', () => {
    // We add 5005 entries to ensure we trigger pruning logic at size 5000
    for (let i = 0; i < 5005; i++) {
      rateLimit(`ip_prune_${i}`, { limit: 1, windowMs: 1000 });
    }

    // Advance time to expire the entries
    vi.advanceTimersByTime(1001);

    // This call triggers pruning again since store size is still > MAX_STORE
    const result = rateLimit('ip_prune_new', { limit: 1, windowMs: 1000 });
    expect(result.allowed).toBe(true);

    // Original entries should be reset due to expiration/pruning
    const resetResult = rateLimit('ip_prune_0', { limit: 1, windowMs: 1000 });
    expect(resetResult.allowed).toBe(true);
  });
});
