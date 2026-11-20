import { describe, it, expect, vi } from 'vitest'
import { LEAD_STAGE_ORDER, LEAD_NEXT, LOST_REASON_LABEL, TICKET_NEXT, TICKET_STATUS_LABEL, TASK_TYPE_LABEL, TIMELINE_GROUPS, relativeDayFa, dayDiff, isoDayOffset, faNum } from '@/lib/crm/labels'
import { LEAD_TRANSITIONS, LEAD_STAGES, LOST_REASONS } from '@/lib/crm/leads'
import { TICKET_TRANSITIONS, TICKET_STATUSES } from '@/lib/crm/tickets'
import { TASK_TYPES } from '@/lib/crm/tasks'
import { ACTIVITY_TYPES } from '@/lib/crm/activity'
import { movedLines } from '@/components/admin/crm/duplicates-manager'

vi.mock('@/i18n/routing', () => ({ Link: () => null, useRouter: () => ({}), usePathname: () => '/' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), useSearchParams: () => new URLSearchParams('') }))
vi.mock('@/app/actions/crm-data', () => ({ findDuplicatesAction: vi.fn(), mergeCustomersAction: vi.fn() }))

describe('client labels stay in lockstep with the server constants', () => {
  it('lead stages and transitions', () => {
    expect([...LEAD_STAGE_ORDER]).toEqual([...LEAD_STAGES])
    expect(LEAD_NEXT).toEqual(LEAD_TRANSITIONS)
  })
  it('lost reasons', () => expect(Object.keys(LOST_REASON_LABEL).sort()).toEqual([...LOST_REASONS].sort()))
  it('ticket statuses and transitions', () => {
    expect(Object.keys(TICKET_STATUS_LABEL).sort()).toEqual([...TICKET_STATUSES].sort())
    expect(TICKET_NEXT).toEqual(TICKET_TRANSITIONS)
  })
  it('task types', () => expect(Object.keys(TASK_TYPE_LABEL).sort()).toEqual([...TASK_TYPES].sort()))
  it('every timeline group type is a real activity type and no type is in two groups', () => {
    const seen = new Set<string>()
    for (const g of TIMELINE_GROUPS) {
      for (const t of g.types) {
        expect(ACTIVITY_TYPES as readonly string[]).toContain(t)
        expect(seen.has(t)).toBe(false)
        seen.add(t)
      }
    }
  })
})

describe('date helpers', () => {
  const now = new Date(2026, 10, 20, 15, 0)
  it('relative day wording', () => {
    expect(relativeDayFa(new Date(2026, 10, 20, 1), now)).toBe('امروز')
    expect(relativeDayFa(new Date(2026, 10, 21), now)).toBe('فردا')
    expect(relativeDayFa(new Date(2026, 10, 19), now)).toBe('دیروز')
    expect(relativeDayFa(new Date(2026, 10, 25), now)).toBe(`${faNum(5)} روز دیگر`)
    expect(relativeDayFa(new Date(2026, 10, 10), now)).toBe(`${faNum(10)} روز گذشته`)
    expect(relativeDayFa(null, now)).toBe('—')
    expect(relativeDayFa('garbage', now)).toBe('—')
  })
  it('dayDiff ignores the time of day', () => expect(dayDiff(new Date(2026, 10, 21, 0, 1), new Date(2026, 10, 20, 23, 59))).toBe(1))
  it('isoDayOffset gives noon UTC of the shifted local day', () => expect(isoDayOffset(1, now)).toBe('2026-11-21T12:00:00.000Z'))
})

describe('merge report wording', () => {
  it('lists only tables that move rows, in Persian', () => {
    const lines = movedLines({ orders: 3, pets: 0, notes: 1, unknownTable: 2 })
    expect(lines).toEqual([`${faNum(3)} سفارش`, `${faNum(1)} یادداشت`, `${faNum(2)} unknownTable`])
  })
})
