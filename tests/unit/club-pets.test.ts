import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { computeAge, dueStatus, formatAge, isProfileBonusComplete, petCompleteness, weightTrend } from '@/lib/club/pet-math'
import { parseDateInput } from '@/lib/club/input'
import { generateReferralCode, normalizeReferralCode } from '@/lib/club/referrals'
import { csvCell } from '@/lib/club/customers-admin'

const d = (s: string) => new Date(s + 'T12:00:00Z')

describe('pet age', () => {
  it('computes whole years and months', () => {
    const a = computeAge(d('2023-03-20'), d('2026-06-19'))!
    expect(a).toMatchObject({ years: 3, months: 2, totalMonths: 38 })
    expect(computeAge(d('2026-06-10'), d('2026-06-19'))!.totalMonths).toBe(0)
    expect(computeAge(d('2030-01-01'), d('2026-06-19'))!.totalMonths).toBe(0)
    expect(computeAge(null)).toBeNull()
  })
  it('formats Persian ages', () => {
    expect(formatAge(computeAge(d('2023-03-20'), d('2026-06-19')))).toBe('۳ سال و ۲ ماه')
    expect(formatAge(computeAge(d('2026-01-01'), d('2026-06-19')))).toBe('۵ ماه')
    expect(formatAge(computeAge(d('2026-06-10'), d('2026-06-19')))).toBe('کمتر از یک ماه')
    expect(formatAge(null)).toBe('نامشخص')
  })
})

describe('profile completeness', () => {
  it('requires breed, birth date and photo or weight for the bonus', () => {
    expect(isProfileBonusComplete({ breed: 'پرشین', birthDate: d('2022-01-01'), weightKg: 4 })).toBe(true)
    expect(isProfileBonusComplete({ breed: 'پرشین', birthDate: d('2022-01-01'), photoUrl: 'data:x' })).toBe(true)
    expect(isProfileBonusComplete({ breed: 'پرشین', birthDate: d('2022-01-01') })).toBe(false)
    expect(isProfileBonusComplete({ breed: '  ', birthDate: d('2022-01-01'), weightKg: 4 })).toBe(false)
  })
  it('reports a percentage and the missing fields', () => {
    const c = petCompleteness({ breed: 'x', birthDate: d('2022-01-01') })
    expect(c.percent).toBeGreaterThan(0)
    expect(c.percent).toBeLessThan(100)
    expect(c.missing).toContain('وزن')
    expect(petCompleteness({}).percent).toBe(0)
  })
})

describe('due status and weight trend', () => {
  const now = d('2026-06-19')
  it('classifies due dates', () => {
    expect(dueStatus(null, now)).toBe('none')
    expect(dueStatus(d('2026-06-01'), now)).toBe('overdue')
    expect(dueStatus(d('2026-07-10'), now)).toBe('soon')
    expect(dueStatus(d('2026-12-10'), now)).toBe('ok')
  })
  it('builds an oldest-first weight series with the latest change', () => {
    const t = weightTrend([
      { kind: 'WEIGHT', doneAt: d('2026-03-01'), valueNumber: 4.2 },
      { kind: 'VACCINE', doneAt: d('2026-03-02'), valueNumber: null },
      { kind: 'WEIGHT', doneAt: d('2026-01-01'), valueNumber: 3.9 },
    ])
    expect(t.points.map((p) => p.kg)).toEqual([3.9, 4.2])
    expect(t.delta).toBe(0.3)
    expect(weightTrend([]).delta).toBeNull()
  })
})

describe('date input', () => {
  it('reads Gregorian and Jalali dates at noon UTC', () => {
    expect(parseDateInput('2024-02-29')?.toISOString()).toBe('2024-02-29T12:00:00.000Z')
    expect(parseDateInput('1403/12/10')?.toISOString().slice(0, 10)).toBe('2025-02-28')
    expect(parseDateInput('۱۴۰۳/۱۲/۱۰')?.toISOString().slice(0, 10)).toBe('2025-02-28')
  })
  it('rejects nonsense and treats blank as null', () => {
    expect(parseDateInput('')).toBeNull()
    expect(parseDateInput('2023-02-30')).toBeUndefined()
    expect(parseDateInput('hello')).toBeUndefined()
    expect(parseDateInput(5)).toBeUndefined()
  })
})

describe('referral codes', () => {
  it('generates readable codes and validates input', () => {
    const c = generateReferralCode()
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{7}$/)
    expect(normalizeReferralCode(` ${c.toLowerCase()} `)).toBe(c)
    expect(normalizeReferralCode('ab')).toBeNull()
    expect(normalizeReferralCode('ABC DEF1')).toBeNull()
    expect(normalizeReferralCode(null)).toBeNull()
  })
})

describe('csv safety', () => {
  it('neutralises formula injection and quotes special characters', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell('+98912')).toBe("'+98912")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@sum')).toBe("'@sum")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(12)).toBe('12')
  })
})
