import { describe, expect, it } from 'vitest'
import { openReminders } from '@/lib/club/due'

const now = new Date('2026-06-01T00:00:00Z')
const day = (n: number) => new Date(now.getTime() + n * 86_400_000)
const rec = (o: Partial<Parameters<typeof openReminders>[0][number]>) => ({ petId: 'p1', kind: 'VACCINE', title: 'سه‌گانه', doneAt: day(-300), nextDueAt: null as Date | null, ...o })

describe('openReminders', () => {
  it('flags overdue and soon, orders by due date', () => {
    const out = openReminders([rec({ nextDueAt: day(10), title: 'a' }), rec({ nextDueAt: day(-5), title: 'b' }), rec({ nextDueAt: day(200), title: 'c' })], now)
    expect(out.map((o) => [o.record.title, o.status])).toEqual([['b', 'overdue'], ['a', 'soon'], ['c', 'ok']])
  })

  it('a newer record of the same vaccine clears the older overdue one', () => {
    const out = openReminders([rec({ doneAt: day(-400), nextDueAt: day(-35) }), rec({ doneAt: day(-2), nextDueAt: day(363) })], now)
    expect(out).toHaveLength(1)
    expect(out[0].status).toBe('ok')
  })

  it('ignores records without a due date and keeps pets separate', () => {
    const out = openReminders([rec({}), rec({ petId: 'p2', nextDueAt: day(-1) }), rec({ petId: 'p1', title: 'x', nextDueAt: day(-1) })], now)
    expect(out).toHaveLength(2)
  })
})
