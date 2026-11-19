import { dueStatus, type DueStatus } from '@/lib/club/pet-math'

interface DueRecord {
  petId: string
  kind: string
  title: string
  doneAt: Date
  nextDueAt: Date | null
}

export interface DueItem<T extends DueRecord> {
  record: T
  status: DueStatus
}

/**
 * The reminders that are still open: for each (pet, kind, title) only the most recent record counts,
 * so re-doing a vaccine clears the older "overdue" entry. Oldest due date first.
 */
export function openReminders<T extends DueRecord>(records: T[], now: Date = new Date(), soonDays = 30): Array<DueItem<T>> {
  const latest = new Map<string, T>()
  for (const r of records) {
    const key = `${r.petId}|${r.kind}|${r.title.trim().toLowerCase()}`
    const cur = latest.get(key)
    if (!cur || r.doneAt > cur.doneAt) latest.set(key, r)
  }
  return [...latest.values()]
    .filter((r) => r.nextDueAt)
    .map((r) => ({ record: r, status: dueStatus(r.nextDueAt, now, soonDays) }))
    .sort((a, b) => a.record.nextDueAt!.getTime() - b.record.nextDueAt!.getTime())
}
