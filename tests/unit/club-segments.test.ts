import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildSegmentWhere, normalizeRules } from '@/lib/club/segments'

const now = new Date('2026-06-19T12:00:00Z')
const conds = (r: Parameters<typeof buildSegmentWhere>[0], ids?: string[]) => buildSegmentWhere(r, now, ids).AND as Array<Record<string, unknown>>

describe('segment rules', () => {
  it('always excludes blocked customers and defaults to SMS consent', () => {
    const c = conds({})
    expect(c).toContainEqual({ isBlocked: false })
    expect(c).toContainEqual({ marketingSmsConsent: true })
    expect(conds({ smsConsentOnly: false })).not.toContainEqual({ marketingSmsConsent: true })
  })

  it('applies all pet conditions to the same pet', () => {
    const c = conds({ species: ['DOG'], breedContains: 'شیتزو', foodBrandContains: 'رویال', petAgeMonths: { min: 12, max: 24 } })
    const petCond = c.find((x) => 'pets' in x) as { pets: { some: Record<string, unknown> } }
    expect(petCond.pets.some).toMatchObject({ species: { in: ['DOG'] }, isActive: true })
    expect(petCond.pets.some.breed).toEqual({ contains: 'شیتزو', mode: 'insensitive' })
    expect(petCond.pets.some.foodBrand).toEqual({ contains: 'رویال', mode: 'insensitive' })
    const bd = petCond.pets.some.birthDate as { lte: Date; gt: Date }
    expect(bd.lte.toISOString().slice(0, 10)).toBe('2025-06-19')
    expect(bd.gt.toISOString().slice(0, 10)).toBe('2024-05-19')
    expect(c.filter((x) => 'pets' in x)).toHaveLength(1)
  })

  it('translates order recency and spend', () => {
    const c = conds({ lastOrderDaysAgo: { min: 60 }, totalSpentMin: 1_000_000, ordersCountMin: 2, neverOrdered: false })
    const last = c.find((x) => 'lastOrderAt' in x) as { lastOrderAt: { lte: Date } }
    expect(last.lastOrderAt.lte.toISOString().slice(0, 10)).toBe('2026-04-20')
    expect(c).toContainEqual({ totalSpent: { gte: 1_000_000 } })
    expect(c).toContainEqual({ ordersCount: { gte: 2 } })
    expect(conds({ neverOrdered: true })).toContainEqual({ ordersCount: 0 })
  })

  it('handles tier, points, tags, city, hasPet and birthday ids', () => {
    const c = conds({ tier: ['GOLD'], pointsMin: 100, pointsMax: 500, tagsAny: ['vip'], city: 'تهران', hasPet: false, birthdayMonth: 3 }, ['a', 'b'])
    expect(c).toContainEqual({ tier: { in: ['GOLD'] } })
    expect(c).toContainEqual({ pointsBalance: { gte: 100, lte: 500 } })
    expect(c).toContainEqual({ tags: { hasSome: ['vip'] } })
    expect(c).toContainEqual({ pets: { none: { isActive: true } } })
    expect(c).toContainEqual({ id: { in: ['a', 'b'] } })
    expect(conds({ birthdayMonth: 3 })).toContainEqual({ id: { in: [] } })
  })

  it('cleans untrusted rules', () => {
    const r = normalizeRules({
      species: ['DOG', 'DRAGON'],
      tier: ['gold', 'GOLD'],
      pointsMin: '50',
      birthdayMonth: 13,
      lastOrderDaysAgo: { min: '30', max: 'x' },
      evil: { $where: 1 },
      breedContains: '   ',
      smsConsentOnly: 'no',
      tagsAny: ['a', 5, ' '],
    })
    expect(r.species).toEqual(['DOG'])
    expect(r.tier).toEqual(['GOLD'])
    expect(r.pointsMin).toBe(50)
    expect(r.birthdayMonth).toBe(12)
    expect(r.lastOrderDaysAgo).toEqual({ min: 30 })
    expect(r.breedContains).toBeUndefined()
    expect(r.tagsAny).toEqual(['a'])
    expect('evil' in r).toBe(false)
    expect(r.smsConsentOnly).toBe(true)
    expect(normalizeRules(null)).toEqual({})
  })
})
