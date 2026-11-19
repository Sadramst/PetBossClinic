import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TIERS,
  parseTiers,
  pointsForOrder,
  pointsForService,
  pointsToToman,
  tierForLifetime,
  tierProgress,
  tierRank,
  validateTiers,
} from '@/lib/club/tiers'

const rates = { pointsPerThousandToman: 1, serviceMultiplier: 1.5 }

describe('club tiers and points math', () => {
  it('maps lifetime points to tiers at the boundaries', () => {
    expect(tierForLifetime(DEFAULT_TIERS, 0).key).toBe('BRONZE')
    expect(tierForLifetime(DEFAULT_TIERS, 999).key).toBe('BRONZE')
    expect(tierForLifetime(DEFAULT_TIERS, 1000).key).toBe('SILVER')
    expect(tierForLifetime(DEFAULT_TIERS, 7999).key).toBe('GOLD')
    expect(tierForLifetime(DEFAULT_TIERS, 8000).key).toBe('PLATINUM')
    expect(tierForLifetime(DEFAULT_TIERS, 10_000_000).key).toBe('PLATINUM')
  })

  it('computes progress toward the next tier', () => {
    const p = tierProgress(DEFAULT_TIERS, 1500)
    expect(p.current.key).toBe('SILVER')
    expect(p.next?.key).toBe('GOLD')
    expect(p.remaining).toBe(1500)
    expect(p.percent).toBe(25)
    const top = tierProgress(DEFAULT_TIERS, 9000)
    expect(top.next).toBeNull()
    expect(top.percent).toBe(100)
    expect(top.remaining).toBe(0)
  })

  it('earns points per thousand Toman with the tier multiplier, never fractional or negative', () => {
    const [bronze, silver, , platinum] = DEFAULT_TIERS
    expect(pointsForOrder(1_999_999, bronze, rates)).toBe(1999)
    expect(pointsForOrder(1_000_000, silver, rates)).toBe(1100)
    expect(pointsForOrder(1_000_000, platinum, rates)).toBe(1500)
    expect(pointsForOrder(999, bronze, rates)).toBe(0)
    expect(pointsForOrder(-5000, bronze, rates)).toBe(0)
    expect(pointsForOrder(50_000, bronze, { pointsPerThousandToman: 0 })).toBe(0)
  })

  it('gives services the extra multiplier', () => {
    expect(pointsForService(1_000_000, DEFAULT_TIERS[0], rates)).toBe(1500)
    expect(pointsForService(1_000_000, DEFAULT_TIERS[1], rates)).toBe(1650)
    expect(pointsForService(0, DEFAULT_TIERS[0], rates)).toBe(0)
  })

  it('values points in Toman', () => {
    expect(pointsToToman(250, 100)).toBe(25_000)
    expect(pointsToToman(-3, 100)).toBe(0)
  })

  it('ranks tiers and tolerates unknown keys', () => {
    expect(tierRank(DEFAULT_TIERS, 'GOLD')).toBe(2)
    expect(tierRank(DEFAULT_TIERS, 'NOPE')).toBe(0)
    expect(tierRank(DEFAULT_TIERS, null)).toBe(0)
  })

  it('sanitises tier JSON and falls back to defaults', () => {
    expect(parseTiers(null)).toEqual(DEFAULT_TIERS)
    expect(parseTiers([])).toEqual(DEFAULT_TIERS)
    const t = parseTiers([
      { key: 'vip', label: 'ویژه', minPoints: 500, color: 'red', perk: 'x', earnMultiplier: 99 },
      { key: 'BASE', label: 'پایه', minPoints: 40, earnMultiplier: 0.2 },
      { key: 'BASE', label: 'تکراری', minPoints: 0 },
    ])
    expect(t.map((x) => x.key)).toEqual(['BASE', 'VIP'])
    expect(t[0].minPoints).toBe(0)
    expect(t[0].earnMultiplier).toBe(1)
    expect(t[1].earnMultiplier).toBe(5)
    expect(t[1].color).toBe('#8d96a3')
  })

  it('validates the ladder for the admin editor', () => {
    expect(validateTiers(DEFAULT_TIERS)).toBeNull()
    expect(validateTiers([])).toBeTruthy()
    expect(validateTiers([{ ...DEFAULT_TIERS[0], minPoints: 10 }])).toBeTruthy()
    expect(validateTiers([DEFAULT_TIERS[0], { ...DEFAULT_TIERS[1], minPoints: 0 }])).toBeTruthy()
    expect(validateTiers([DEFAULT_TIERS[0], { ...DEFAULT_TIERS[1], key: 'bad key' }])).toBeTruthy()
  })
})
