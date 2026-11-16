import { describe, it, expect } from 'vitest'
import {
  jalaliToGregorian,
  jalaliToDate,
  dateToJalali,
  parseJalaliInput,
  formatJalaliInput,
  isValidJalali,
} from '@/lib/date/jalali'

describe('jalali conversion', () => {
  it('converts known Nowruz dates', () => {
    expect(jalaliToGregorian(1403, 1, 1)).toEqual({ gy: 2024, gm: 3, gd: 20 })
    expect(jalaliToGregorian(1404, 1, 1)).toEqual({ gy: 2025, gm: 3, gd: 21 })
  })

  it('round-trips against the ICU Persian calendar for every day over 4 years', () => {
    const start = Date.UTC(2025, 0, 1, 12)
    for (let i = 0; i < 365 * 4; i++) {
      const d = new Date(start + i * 86400000)
      const { jy, jm, jd } = dateToJalali(d)
      expect(jalaliToDate(jy, jm, jd).toISOString()).toBe(d.toISOString())
    }
  })

  it('validates month lengths including Esfand', () => {
    expect(isValidJalali(1405, 6, 31)).toBe(true)
    expect(isValidJalali(1405, 7, 31)).toBe(false)
    expect(isValidJalali(1405, 13, 1)).toBe(false)
  })

  it('parses admin input in Persian or Latin digits', () => {
    const d = parseJalaliInput('۱۴۰۵/۰۶/۱۵')!
    expect(formatJalaliInput(d)).toBe('1405/06/15')
    expect(parseJalaliInput('05-6-15')?.toISOString()).toBe(d.toISOString())
    expect(parseJalaliInput('1405/02/40')).toBeNull()
    expect(parseJalaliInput('hello')).toBeNull()
  })
})
