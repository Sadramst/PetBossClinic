import { describe, it, expect } from 'vitest'
import { expiryState, relativeMonthsFa } from '@/lib/shop/expiry'
import { parseBatchLine, parseBatchPaste, validateExpiryConfig, EXPIRY_CONFIG_DEFAULTS } from '@/lib/shop/expiry-rules'

const now = new Date('2026-06-01T12:00:00Z')
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000)

describe('expiryState with configurable thresholds', () => {
  it('uses custom soon/critical days', () => {
    const cfg = { soonDays: 120, criticalDays: 45 }
    expect(expiryState(inDays(40), cfg, now)).toBe('critical')
    expect(expiryState(inDays(100), cfg, now)).toBe('soon')
    expect(expiryState(inDays(121), cfg, now)).toBe('ok')
    expect(expiryState(inDays(-1), cfg, now)).toBe('expired')
    expect(expiryState(null, cfg, now)).toBe('none')
  })
  it('keeps the legacy (date, now) form', () => {
    expect(expiryState(inDays(10), now)).toBe('critical')
  })
  it('describes distance in months', () => {
    expect(relativeMonthsFa(inDays(420), now)).toContain('ماه دیگر')
    expect(relativeMonthsFa(inDays(-90), now)).toContain('پیش')
  })
})

describe('validateExpiryConfig', () => {
  it('accepts defaults', () => expect(validateExpiryConfig(EXPIRY_CONFIG_DEFAULTS)).toBeNull())
  it('rejects critical >= soon', () => expect(validateExpiryConfig({ ...EXPIRY_CONFIG_DEFAULTS, criticalDays: 90 })).toMatch(/بحرانی/))
  it('rejects min shelf life above critical', () => expect(validateExpiryConfig({ ...EXPIRY_CONFIG_DEFAULTS, minShelfLifeDays: 31 })).toMatch(/ماندگاری/))
  it('rejects discount start outside the window', () => {
    expect(validateExpiryConfig({ ...EXPIRY_CONFIG_DEFAULTS, discountStartDays: 5 })).toMatch(/شروع تخفیف/)
    expect(validateExpiryConfig({ ...EXPIRY_CONFIG_DEFAULTS, discountStartDays: 200 })).toMatch(/شروع تخفیف/)
  })
  it('rejects bad percent and non-integers', () => {
    expect(validateExpiryConfig({ ...EXPIRY_CONFIG_DEFAULTS, discountPercent: 95 })).toMatch(/درصد/)
    expect(validateExpiryConfig({ ...EXPIRY_CONFIG_DEFAULTS, soonDays: 90.5 })).toMatch(/صحیح/)
  })
})

describe('parseBatchLine', () => {
  const perishable = { tracksExpiry: true }
  const plain = { tracksExpiry: false }
  const base = { productId: 'p1', quantity: 5 }
  it('requires expiry for perishables, with the row number', () => {
    const r = parseBatchLine({ ...base }, 2, perishable)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('ردیف ۳')
  })
  it('accepts a plain product without dates', () => expect(parseBatchLine(base, 0, plain).ok).toBe(true))
  it('rejects quantity below 1 and unknown product', () => {
    expect(parseBatchLine({ ...base, quantity: 0 }, 0, plain).ok).toBe(false)
    expect(parseBatchLine(base, 0, undefined).ok).toBe(false)
  })
  it('rejects manufacture after expiry and bad dates', () => {
    expect(parseBatchLine({ ...base, manufactureDate: '2026-05-01T12:00:00.000Z', expiryDate: '2026-04-01T12:00:00.000Z' }, 0, plain).ok).toBe(false)
    expect(parseBatchLine({ ...base, expiryDate: 'not a date' }, 0, plain).ok).toBe(false)
  })
  it('parses ISO and Jalali expiry', () => {
    const iso = parseBatchLine({ ...base, expiryDate: '2027-01-01T12:00:00.000Z' }, 0, perishable)
    const fa = parseBatchLine({ ...base, expiryDate: '۱۴۰۶/۰۱/۰۱' }, 0, perishable)
    expect(iso.ok && iso.line.expiryDate?.getUTCFullYear()).toBe(2027)
    expect(fa.ok && fa.line.expiryDate instanceof Date).toBe(true)
  })
})

describe('parseBatchPaste', () => {
  it('reads comma, tab and semicolon rows with Persian digits', () => {
    const rows = parseBatchPaste('SKU-1, ۱۲, ۱۴۰۶/۱۲/۰۱\nSKU-2\t5\t\nbad\nSKU-3;7;1406/01/01')
    expect(rows.map((r) => [r.sku, r.quantity])).toEqual([['SKU-1', 12], ['SKU-2', 5], ['SKU-3', 7]])
  })
})
