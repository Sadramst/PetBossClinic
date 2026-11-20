import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { computeLifecycleStage } from '@/lib/crm/lifecycle'
import { computeHealth, type HealthInput } from '@/lib/crm/health'
import { csvSafe, toCsv } from '@/lib/crm/export'
import { parseImportCsv, validateImportRow } from '@/lib/crm/import'
import { canTransition, LEAD_TRANSITIONS, legacyStatusForStage } from '@/lib/crm/leads'
import { roleAtLeast } from '@/lib/crm/roles'
import { pageArgs } from '@/lib/crm/types'
import { phoneVariants } from '@/lib/crm/promote'

const NOW = new Date('2026-11-20T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)
const BOM = String.fromCharCode(0xfeff)

describe('lifecycle stage rules', () => {
  const base = { hasCustomer: true, now: NOW }
  it('blocked wins over everything', () => {
    expect(computeLifecycleStage({ ...base, isBlocked: true, topTier: true })).toBe('BLOCKED')
  })
  it('VIP by tier, spend or health with repeat orders', () => {
    expect(computeLifecycleStage({ ...base, topTier: true })).toBe('VIP')
    expect(computeLifecycleStage({ ...base, topSpender: true })).toBe('VIP')
    expect(computeLifecycleStage({ ...base, healthScore: 90, orders12m: 3, joinedAt: daysAgo(400), lastOrderAt: daysAgo(5), ordersCount: 6 })).toBe('VIP')
    expect(computeLifecycleStage({ ...base, healthScore: 90, orders12m: 2, joinedAt: daysAgo(400), lastOrderAt: daysAgo(5), ordersCount: 6 })).not.toBe('VIP')
  })
  it('new customer: joined within 30 days', () => {
    expect(computeLifecycleStage({ ...base, joinedAt: daysAgo(10) })).toBe('NEW_CUSTOMER')
  })
  it('active, at risk and lapsed follow recency', () => {
    const c = { ...base, joinedAt: daysAgo(500), ordersCount: 5 }
    expect(computeLifecycleStage({ ...c, lastOrderAt: daysAgo(40) })).toBe('ACTIVE')
    expect(computeLifecycleStage({ ...c, lastOrderAt: daysAgo(100) })).toBe('AT_RISK')
    expect(computeLifecycleStage({ ...c, lastOrderAt: daysAgo(200), healthScore: 10 })).toBe('LAPSED')
    expect(computeLifecycleStage({ ...c, lastOrderAt: daysAgo(40), healthScore: 20 })).toBe('AT_RISK')
  })
  it('a visit counts as activity', () => {
    expect(computeLifecycleStage({ ...base, joinedAt: daysAgo(500), ordersCount: 0, lastVisitAt: daysAgo(20) })).toBe('ACTIVE')
  })
  it('non-customers: lead, prospect, subscriber', () => {
    const n = { hasCustomer: false, now: NOW }
    expect(computeLifecycleStage({ ...n, leadStages: ['NEW'] })).toBe('LEAD')
    expect(computeLifecycleStage({ ...n, leadStages: ['QUALIFIED'] })).toBe('PROSPECT')
    expect(computeLifecycleStage({ ...n, leadStages: ['APPOINTMENT_BOOKED', 'NEW'] })).toBe('PROSPECT')
    expect(computeLifecycleStage({ ...n, subscribed: true })).toBe('SUBSCRIBER')
    expect(computeLifecycleStage({ ...n, leadStages: ['LOST'], subscribed: true })).toBe('SUBSCRIBER')
  })
})

describe('health score and churn risk', () => {
  const best: HealthInput = { daysSinceLast: 3, activity12m: 6, activityLifetime: 20, spendPercentile: 100, smsConsent: true, smsDelivered90d: true, couponRedeemed180d: true, care: 'NONE_OVERDUE' }
  it('perfect customer scores 100 and low risk', () => {
    expect(computeHealth(best)).toEqual({ score: 100, churnRisk: 'LOW' })
  })
  it('never-active customer scores zero and is high risk', () => {
    const r = computeHealth({ ...best, daysSinceLast: null, activity12m: 0, activityLifetime: 0, spendPercentile: 0, smsConsent: false, smsDelivered90d: false, couponRedeemed180d: false, care: 'OVERDUE' })
    expect(r.score).toBe(0)
    expect(r.churnRisk).toBe('HIGH')
  })
  it('brand-new account without activity is not flagged', () => {
    expect(computeHealth({ ...best, daysSinceLast: null, activity12m: 0, activityLifetime: 0, spendPercentile: 0, joinedDaysAgo: 3, care: 'NO_PETS' }).churnRisk).toBe('LOW')
  })
  it('score is bounded and never rises as recency worsens', () => {
    let prev = 101
    for (const d of [0, 30, 60, 120, 240, 600]) {
      const s = computeHealth({ ...best, daysSinceLast: d }).score
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
      expect(s).toBeLessThanOrEqual(prev)
      prev = s
    }
  })
  it('long silence of a repeat customer is high risk', () => {
    expect(computeHealth({ ...best, daysSinceLast: 130, activity12m: 3, activityLifetime: 4 }).churnRisk).toBe('HIGH')
  })
})

describe('CSV safety', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x', ' =x', '"=x'])('neutralises formula starter %j', (v) => {
    expect(csvSafe(v).replace(/^"/, '')).toMatch(/^'/)
  })
  it('quotes commas, quotes and line breaks', () => {
    expect(csvSafe('a,b')).toBe('"a,b"')
    expect(csvSafe('say "hi"')).toBe('"say ""hi"""')
    expect(csvSafe('x\ny')).toBe('"x\ny"')
  })
  it('keeps Persian text and null', () => {
    expect(csvSafe('گربه')).toBe('گربه')
    expect(csvSafe(null)).toBe('')
  })
  it('toCsv has BOM, CRLF and caps rows', () => {
    const out = toCsv(['a'], Array.from({ length: 10_050 }, (_, i) => [i]))
    expect(out.startsWith(BOM + 'a\r\n')).toBe(true)
    expect(out.split('\r\n')).toHaveLength(10_001)
  })
})

describe('import parsing and validation', () => {
  it('parses Persian headers, digits and quoted cells', () => {
    const r = parseImportCsv('نام,موبایل,برچسب\n"علی, رضایی",۰۹۱۲۳۴۵۶۷۸۹,vip|سگ\n')
    expect(r.errors).toEqual([])
    expect(r.rows[0]).toMatchObject({ phone: '09123456789', name: 'علی, رضایی', tags: ['vip', 'سگ'] })
  })
  it('reports bad phones with line numbers and keeps good rows', () => {
    const r = parseImportCsv('phone,name\n123,الف\n09121112233,ب\n')
    expect(r.rows).toHaveLength(1)
    expect(r.errors[0].line).toBe(2)
  })
  it('empty file is an error; BOM and semicolons are tolerated', () => {
    expect(parseImportCsv('').errors).toHaveLength(1)
    expect(parseImportCsv(BOM + 'phone;name\n09121112233;x\n').rows).toHaveLength(1)
  })
  it('rejects invalid email and birthdate, accepts a Jalali birthdate', () => {
    expect(validateImportRow({ phone: '09121112233', email: 'nope' }).error).toBeTruthy()
    expect(validateImportRow({ phone: '09121112233', birthDate: 'zzz' }).error).toBeTruthy()
    expect(validateImportRow({ phone: '09121112233', birthDate: '1375/04/09' }).row?.birthDate).toMatch(/^1996-/)
  })
  it('caps tags at ten and dedupes', () => {
    const t = Array.from({ length: 20 }, (_, i) => `t${i % 12}`).join('|')
    expect(validateImportRow({ phone: '09121112233', tags: t }).row?.tags?.length).toBe(10)
  })
})

describe('lead pipeline transitions', () => {
  it('forward moves and LOST are allowed from open stages', () => {
    expect(canTransition('NEW', 'CONTACTED')).toBe(true)
    expect(canTransition('CONTACTED', 'QUALIFIED')).toBe(true)
    expect(canTransition('QUALIFIED', 'LOST')).toBe(true)
  })
  it('WON is terminal and there are no self-loops', () => {
    expect(LEAD_TRANSITIONS.WON).toEqual([])
    expect(canTransition('NEW', 'NEW')).toBe(false)
  })
  it('legacy status stays in sync', () => {
    expect(legacyStatusForStage('APPOINTMENT_BOOKED')).toBe('BOOKED')
    expect(legacyStatusForStage('WON')).toBe('CONVERTED')
    expect(legacyStatusForStage('LOST')).toBe('LOST')
  })
})

describe('RBAC helpers and paging', () => {
  it('role matrix', () => {
    const roles = ['VIEWER', 'AUTHOR', 'EDITOR', 'ADMIN', 'SUPER_ADMIN']
    roles.forEach((r, i) => roles.forEach((m, j) => expect(roleAtLeast(r, m)).toBe(i >= j)))
    expect(roleAtLeast(null, 'VIEWER')).toBe(false)
    expect(roleAtLeast('BOGUS', 'VIEWER')).toBe(false)
  })
  it('pageArgs clamps untrusted input', () => {
    expect(pageArgs({ page: -3, size: 100000 })).toMatchObject({ page: 1, size: 100, skip: 0 })
    expect(pageArgs({ page: 3, size: 10 }).skip).toBe(20)
    expect(pageArgs({ page: NaN, size: 0 }).size).toBe(25)
  })
  it('phone variants cover the stored spellings', () => {
    expect(phoneVariants('09121112233')).toContain('+989121112233')
  })
})
