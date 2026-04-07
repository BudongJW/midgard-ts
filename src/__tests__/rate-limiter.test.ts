import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../common/net/rate-limiter.js';

describe('RateLimiter', () => {
  it('should allow requests under limit', () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.check('1.2.3.4')).toBe(true);
    expect(limiter.check('1.2.3.4')).toBe(true);
    expect(limiter.check('1.2.3.4')).toBe(true);
  });

  it('should block requests over limit', () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.check('1.2.3.4')).toBe(true);
    expect(limiter.check('1.2.3.4')).toBe(true);
    expect(limiter.check('1.2.3.4')).toBe(false);
  });

  it('should track different IPs independently', () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('2.2.2.2')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(false);
    expect(limiter.check('2.2.2.2')).toBe(false);
  });
});
