import { describe, it, expect } from 'vitest'
import { adjustPrice, previewPriceAdjust, validatePriceAdjust } from '@/lib/shop/price-adjust'

describe('adjustPrice', () => {
  it('applies a percent change with rounding', () => {
    expect(adjustPrice(100_000, { mode: 'percent', value: 10 })).toBe(110_000)
    expect(adjustPrice(123_456, { mode: 'percent', value: 10, round: 1000 })).toBe(136_000)
    expect(adjustPrice(100_000, { mode: 'percent', value: -25 })).toBe(75_000)
  })
  it('applies a fixed amount', () => {
    expect(adjustPrice(50_000, { mode: 'amount', value: 5_000 })).toBe(55_000)
    expect(adjustPrice(50_000, { mode: 'amount', value: -5_000 })).toBe(45_000)
  })
  it('returns null for results that are not a valid price', () => {
    expect(adjustPrice(1_000, { mode: 'amount', value: -1_000 })).toBeNull()
    expect(adjustPrice(900_000_000, { mode: 'percent', value: 100 })).toBeNull()
    expect(adjustPrice(NaN, { mode: 'amount', value: 1 })).toBeNull()
  })
  it('previews every row', () => {
    const rows = previewPriceAdjust([{ id: 'a', name: 'الف', price: 1000 }, { id: 'b', name: 'ب', price: 2000 }], { mode: 'amount', value: -1500 })
    expect(rows.map((r) => r.after)).toEqual([null, 500])
  })
})

describe('validatePriceAdjust', () => {
  it('rejects zero, huge percent and absurd amounts', () => {
    expect(validatePriceAdjust({ mode: 'percent', value: 0 })).toBeTruthy()
    expect(validatePriceAdjust({ mode: 'percent', value: -95 })).toBeTruthy()
    expect(validatePriceAdjust({ mode: 'percent', value: 301 })).toBeTruthy()
    expect(validatePriceAdjust({ mode: 'amount', value: 2_000_000_000 })).toBeTruthy()
    expect(validatePriceAdjust({ mode: 'percent', value: 10 })).toBeNull()
  })
})
