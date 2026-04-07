/**
 * MidgardTS Rate Limiter
 * IP-based rate limiting for login attempts
 */

export class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 10, windowMs: number = 60_000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    setInterval(() => this.cleanup(), windowMs);
  }

  check(ip: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(ip);

    if (!record || now > record.resetAt) {
      this.attempts.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    record.count++;
    return record.count <= this.maxAttempts;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.attempts) {
      if (now > record.resetAt) {
        this.attempts.delete(ip);
      }
    }
  }
}
