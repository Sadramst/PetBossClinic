import { describe, it, expect } from 'vitest'
import { expiryState, sellableQuantity, nextShippingExpiry, daysUntil, formatJalaliDate } from '@/lib/shop/expiry'

const now = new Date('2026-11-16T00:00:00Z')
const inDays = (n: number) => new Date(now.getTime() + n * 86400000)

describe('expiry', () => {
  it('classifies expiry state', () => {
    expect(expiryState(null, now)).toBe('none')
    expect(expiryState(inDays(-1), now)).toBe('expired')
    expect(expiryState(inDays(10), now)).toBe('critical')
    expect(expiryState(inDays(60), now)).toBe('soon')
    expect(expiryState(inDays(200), now)).toBe('ok')
  })

  it('never counts expired or empty batches as sellable', () => {
    const batches = [
      { quantity: 5, expiryDate: inDays(-3) },
      { quantity: 0, expiryDate: inDays(100) },
      { quantity: 4, expiryDate: inDays(100) },
      { quantity: 2, expiryDate: null },
    ]
    expect(sellableQuantity(batches, now)).toBe(6)
  })

  it('ships the earliest non-expired batch first (FEFO)', () => {
    const batches = [
      { quantity: 3, expiryDate: inDays(300) },
      { quantity: 1, expiryDate: inDays(-5) },
      { quantity: 2, expiryDate: inDays(120) },
      { quantity: 0, expiryDate: inDays(20) },
    ]
    expect(nextShippingExpiry(batches, now)?.toISOString()).toBe(inDays(120).toISOString())
    expect(nextShippingExpiry([{ quantity: 1, expiryDate: null }], now)).toBeNull()
  })

  it('computes day differences and Jalali dates', () => {
    expect(daysUntil(inDays(7), now)).toBe(7)
    expect(formatJalaliDate('2026-03-21T12:00:00Z')).toContain('۱۴۰۵')
  })
})

import { relativeMonthsFa } from '@/lib/shop/expiry'
import { buildExpiryStrip } from '@/lib/shop/expiry-strip'
import { buildDigest } from '@/lib/shop/expiry-digest-core'
import { lineExpiryText } from '@/lib/shop/order-expiry'
import { sanitizeExpiryConfig } from '@/lib/shop/expiry-config-core'

describe('expiry v2', () => {
  it('honours configurable thresholds and the legacy signature', () => {
    expect(expiryState(inDays(50), { criticalDays: 60, soonDays: 120 }, now)).toBe('critical')
    expect(expiryState(inDays(50), now)).toBe('soon')
  })
  it('describes remaining time in Persian', () => {
    expect(relativeMonthsFa(inDays(425), now)).toMatch(/ماه دیگر/)
    expect(relativeMonthsFa(inDays(-2), now)).toMatch(/پیش/)
  })
  it('strip: calm note for near expiry, vet note for undated tracked, nothing for untracked', () => {
    const near = buildExpiryStrip({ date: inDays(40), state: 'soon', tracksExpiry: true, now })
    expect(near.kind === 'dated' && near.near && near.note).toBe('مناسب مصرف سریع')
    const disc = buildExpiryStrip({ date: inDays(40), state: 'soon', tracksExpiry: true, discounted: true, now })
    expect(disc.kind === 'dated' && disc.note).toContain('تخفیف')
    expect(buildExpiryStrip({ date: null, state: 'none', tracksExpiry: true, now }).kind).toBe('unverified')
    expect(buildExpiryStrip({ date: null, state: 'none', tracksExpiry: false, now }).kind).toBe('none')
    const ok = buildExpiryStrip({ date: inDays(300), state: 'ok', tracksExpiry: true, now })
    expect(ok.kind === 'dated' && ok.near).toBe(false)
  })
  it('digest counts states and notifies only for expired or critical', () => {
    const d = buildDigest(
      [
        { productName: 'a', quantity: 1, expiryDate: inDays(-1) },
        { productName: 'b', quantity: 1, expiryDate: inDays(10) },
        { productName: 'c', quantity: 0, expiryDate: inDays(10) },
        { productName: 'd', quantity: 2, expiryDate: null },
      ],
      {},
      now
    )
    expect(d.counts).toEqual({ expired: 1, critical: 1, soon: 0, undated: 1 })
    expect(d.top[0].productName).toBe('a')
    expect(buildDigest([{ productName: 'x', quantity: 1, expiryDate: inDays(60) }], {}, now).shouldNotify).toBe(false)
  })
  it('order line expiry: date, range, or nothing for old orders', () => {
    expect(lineExpiryText(null)).toBeNull()
    expect(lineExpiryText([{ batchId: 'a', quantity: 1 }])).toBeNull()
    expect(lineExpiryText([{ batchId: 'a', quantity: 1, expiryDate: inDays(100).toISOString() }])).toBeTruthy()
    expect(
      lineExpiryText([
        { batchId: 'a', quantity: 1, expiryDate: inDays(100).toISOString() },
        { batchId: 'b', quantity: 1, expiryDate: inDays(200).toISOString() },
      ])
    ).toContain(' تا ')
  })
  it('config sanitiser enforces critical < soon and minShelfLife <= critical', () => {
    expect(sanitizeExpiryConfig({ criticalDays: 100, soonDays: 50 }).soonDays).toBe(90)
    expect(sanitizeExpiryConfig({ criticalDays: 20, soonDays: 60, minShelfLifeDays: 5 })).toMatchObject({ criticalDays: 20, soonDays: 60, minShelfLifeDays: 5 })
  })
})
