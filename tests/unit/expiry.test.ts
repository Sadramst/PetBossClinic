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
