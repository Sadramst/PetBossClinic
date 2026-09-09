/**
 * @file rate-limit.ts
 * @description Best-effort in-memory sliding window rate limiter for public forms.
 *
 * ARCHITECTURAL NOTICE:
 * This limiter maintains state in local process memory. On horizontally scaled serverless
 * environments (e.g. Vercel Serverless Functions), memory is isolated per lambda instance.
 * It serves as an immediate, zero-dependency stopgap against bot spam and local bursts.
 * Production-wide distributed enforcement requires centralized storage (Upstash Redis / Vercel KV),
 * tracked for WS-4/WS-5.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Clean up stale entries every 15 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > oneHourAgo);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 15 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Checks if an IP is within the rate limit.
 * @param key Identifier (e.g. IP address + action)
 * @param limit Max allowed requests within window
 * @param windowMs Window in milliseconds (default 1 hour = 3600000ms)
 */
export function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 3600 * 1000
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetSeconds: Math.ceil(windowMs / 1000),
  };
}
