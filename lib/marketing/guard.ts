import 'server-only'
import { headers } from 'next/headers'
import { checkRateLimit, isUnderRateLimit } from '@/lib/utils/rate-limit'

/**
 * Client address for rate limiting. The proxy's own header wins; with a forwarded chain we take the
 * LAST hop (the one our proxy appended), never the first, which a client can set to anything.
 */
export async function clientIp(): Promise<string> {
  let h: Awaited<ReturnType<typeof headers>>
  try {
    h = await headers()
  } catch {
    return 'unknown' // outside a request (scripts, tests)
  }
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  const chain = (h.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return chain[chain.length - 1] || 'unknown'
}

export const COUPON_RATE_MESSAGE = 'تلاش‌های زیادی برای وارد کردن کد انجام شده است. چند دقیقه دیگر دوباره امتحان کنید.'

const LIMIT = 30
const WINDOW = 600_000

async function bucket(customerId: string | null): Promise<string> {
  return customerId ? `coupon:c:${customerId}` : `coupon:ip:${await clientIp()}`
}

/**
 * One shared bucket for every path that evaluates a TYPED coupon code (coupon box, cart quote,
 * order placement). Only misses are counted, so a customer re-validating a good code is never throttled,
 * while a guesser is cut off after a handful of wrong tries.
 */
export async function couponGuessAllowed(customerId: string | null): Promise<boolean> {
  return isUnderRateLimit(await bucket(customerId), LIMIT, WINDOW)
}

export async function recordCouponMiss(customerId: string | null): Promise<void> {
  checkRateLimit(await bucket(customerId), LIMIT, WINDOW)
}
