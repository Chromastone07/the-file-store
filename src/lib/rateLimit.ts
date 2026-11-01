/**
 * In-memory sliding-window rate limiter for Next.js API Routes.
 * Protects endpoints from DDoS, brute-force probing, and connection flooding.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (record.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    }
  }, 30_000);
}

export interface RateLimitOptions {
  limit: number;       // Maximum requests allowed in window
  windowMs: number;    // Window duration in milliseconds
}

export function checkRateLimit(
  identifier: string, 
  optionsOrLimit: RateLimitOptions | number,
  optionalWindowMs?: number
): { success: boolean; allowed: boolean; remaining: number; reset: number; retryAfter: number } {
  const options: RateLimitOptions = typeof optionsOrLimit === 'number'
    ? { limit: optionsOrLimit, windowMs: optionalWindowMs || 60_000 }
    : optionsOrLimit;

  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.resetAt <= now) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    const resetSec = Math.ceil(options.windowMs / 1000);
    return {
      success: true,
      allowed: true,
      remaining: options.limit - 1,
      reset: resetSec,
      retryAfter: 0,
    };
  }

  if (record.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      success: false,
      allowed: false,
      remaining: 0,
      reset: retryAfter,
      retryAfter,
    };
  }

  record.count += 1;
  const resetSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    success: true,
    allowed: true,
    remaining: options.limit - record.count,
    reset: resetSec,
    retryAfter: 0,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
