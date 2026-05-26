import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('rateLimit', () => {
  let rateLimit;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    // Dynamic import to get a fresh `store` Map for each test
    const module = await import('../lib/rateLimit.js');
    rateLimit = module.rateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Core Functionality', () => {
    it('should allow requests under the limit', () => {
      const res1 = rateLimit('192.168.1.1', { limit: 2, windowMs: 1000 });
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(1);

      const res2 = rateLimit('192.168.1.1', { limit: 2, windowMs: 1000 });
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(0);
    });

    it('should block requests over the limit and return correct retryAfter', () => {
      rateLimit('192.168.1.2', { limit: 1, windowMs: 5000 });

      // Time moves forward slightly
      vi.advanceTimersByTime(1000);

      const res = rateLimit('192.168.1.2', { limit: 1, windowMs: 5000 });
      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.retryAfter).toBe(4); // 4 seconds remaining
    });

    it('should allow requests again after the window expires', () => {
      rateLimit('192.168.1.3', { limit: 1, windowMs: 1000 });

      // Exhausted
      expect(rateLimit('192.168.1.3', { limit: 1, windowMs: 1000 }).allowed).toBe(false);

      // Wait for the window to pass
      vi.advanceTimersByTime(1001);

      const res = rateLimit('192.168.1.3', { limit: 1, windowMs: 1000 });
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(0);
    });
  });

  describe('Eviction Logic (pruneExpired)', () => {
    it('should evict expired items when store reaches MAX_STORE', () => {
      const deleteSpy = vi.spyOn(Map.prototype, 'delete');

      // Fill the store up to MAX_STORE (5000)
      for (let i = 0; i < 5000; i++) {
        rateLimit(`ip-${i}`, { limit: 10, windowMs: 1000 });
      }

      // Advance time to expire all items
      vi.advanceTimersByTime(2000);

      // Add one more to trigger pruneExpired()
      rateLimit('trigger-prune', { limit: 10, windowMs: 1000 });

      // It should delete exactly 1000 items (stopping when size drops to <= 4000, which is 80% of 5000)
      expect(deleteSpy).toHaveBeenCalledTimes(1000);
    });

    it('should not prune unexpired items even if store reaches MAX_STORE', () => {
      const deleteSpy = vi.spyOn(Map.prototype, 'delete');

      // Fill the store up to MAX_STORE (5000)
      for (let i = 0; i < 5000; i++) {
        rateLimit(`ip-${i}`, { limit: 10, windowMs: 10000 });
      }

      // Advance time, but not enough to expire
      vi.advanceTimersByTime(1000);

      // Add one more to trigger pruneExpired()
      rateLimit('trigger-prune', { limit: 10, windowMs: 10000 });

      // No items should be deleted since nothing is expired
      expect(deleteSpy).toHaveBeenCalledTimes(0);
    });
  });
});
