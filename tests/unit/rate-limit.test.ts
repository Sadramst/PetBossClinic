import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/utils/rate-limit'

describe('Sliding Window Rate Limiter (lib/utils/rate-limit.ts)', () => {
  it('allows requests within limit and throttles excess requests', () => {
    const testKey = `test_ip_${Date.now()}`
    const limit = 5

    // First 5 requests should pass
    for (let i = 1; i <= limit; i++) {
      const result = checkRateLimit(testKey, limit, 3600 * 1000)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(limit - i)
    }

    // 6th request must be throttled
    const blocked = checkRateLimit(testKey, limit, 3600 * 1000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.resetSeconds).toBeGreaterThan(0)
  })
})
