import { db } from '@/lib/db'
import { openReminders } from '@/lib/club/due'

const DAY = 86_400_000

export type HealthInput = {
  /** Days since the last delivered order or clinic visit; null = never. */
  daysSinceLast: number | null
  /** Orders + visits in the last 12 months. */
  activity12m: number
  /** Orders + visits ever. */
  activityLifetime: number
  /** totalSpent percentile among customers, 0-100 (0 when never ordered). */
  spendPercentile: number
  smsConsent: boolean
  smsDelivered90d: boolean
  couponRedeemed180d: boolean
  /** Overdue pet reminders: none, exactly one under 60 days late, anything else, or the customer has no pets. */
  care: 'NONE_OVERDUE' | 'ONE_RECENT' | 'OVERDUE' | 'NO_PETS'
  /** Days since the customer joined; only used so brand-new accounts are not flagged. */
  joinedDaysAgo?: number
}

export type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH'

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))

/** CRM-SPEC section 9: 0.35 R + 0.25 F + 0.15 M + 0.15 E + 0.10 C, each 0-100. */
export function computeHealth(i: HealthInput): { score: number; churnRisk: ChurnRisk } {
  const d = i.daysSinceLast
  const R = d === null ? 0 : d <= 30 ? 100 : clamp(100 - ((d - 30) / 210) * 100)
  const F = Math.min(100, Math.max(0, i.activity12m) * 20)
  const M = clamp(i.spendPercentile)
  const E = (i.smsConsent ? 50 : 0) + (i.smsDelivered90d ? 25 : 0) + (i.couponRedeemed180d ? 25 : 0)
  const C = i.care === 'NONE_OVERDUE' ? 100 : i.care === 'ONE_RECENT' ? 50 : i.care === 'NO_PETS' ? 60 : 0
  const score = Math.round(0.35 * R + 0.25 * F + 0.15 * M + 0.15 * E + 0.1 * C)
  let churnRisk: ChurnRisk
  if (i.activityLifetime === 0 && (i.joinedDaysAgo ?? 999) <= 30) churnRisk = 'LOW'
  else if (score < 35 || (d !== null && d > 120 && i.activityLifetime >= 2)) churnRisk = 'HIGH'
  else if (score < 60) churnRisk = 'MEDIUM'
  else churnRisk = 'LOW'
  return { score, churnRisk }
}

/** Classifies a customer's open pet reminders for the care factor. */
export function careState(overdueDays: number[], petCount: number): HealthInput['care'] {
  if (petCount === 0) return 'NO_PETS'
  if (overdueDays.length === 0) return 'NONE_OVERDUE'
  if (overdueDays.length === 1 && overdueDays[0] < 60) return 'ONE_RECENT'
  return 'OVERDUE'
}

type CustomerForHealth = { id: string; createdAt: Date; marketingSmsConsent: boolean; ordersCount: number; lastOrderAt: Date | null }

/** Loads every factor for one batch of customers with a handful of grouped queries (no per-customer queries). */
export async function loadHealthInputs(customers: CustomerForHealth[], percentiles: Map<string, number>, now: Date): Promise<Map<string, HealthInput>> {
  const ids = customers.map((c) => c.id)
  const y1 = new Date(now.getTime() - 365 * DAY)
  const [visitMax, ordLife, visLife, ord12, vis12, sms, coupons, petCounts, records] = await Promise.all([
    db.serviceVisit.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _max: { visitedAt: true } }),
    db.order.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, status: 'DELIVERED' }, _count: { _all: true } }),
    db.serviceVisit.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _count: { _all: true } }),
    db.order.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, status: 'DELIVERED', createdAt: { gte: y1 } }, _count: { _all: true } }),
    db.serviceVisit.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, visitedAt: { gte: y1 } }, _count: { _all: true } }),
    db.messageOutbox.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, status: 'SENT', sentAt: { gte: new Date(now.getTime() - 90 * DAY) } }, _count: { _all: true } }),
    db.couponRedemption.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, createdAt: { gte: new Date(now.getTime() - 180 * DAY) } }, _count: { _all: true } }),
    db.pet.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, isActive: true }, _count: { _all: true } }),
    db.petRecord.findMany({
      where: { pet: { customerId: { in: ids }, isActive: true } },
      select: { petId: true, kind: true, title: true, doneAt: true, nextDueAt: true, pet: { select: { customerId: true } } },
      take: 20_000,
    }),
  ])
  const m = <T extends { customerId: string | null }>(rows: T[], f: (r: T) => number) => new Map(rows.filter((r) => r.customerId).map((r) => [r.customerId as string, f(r)]))
  const visitMaxM = new Map(visitMax.map((r) => [r.customerId, r._max.visitedAt]))
  const ordLifeM = m(ordLife, (r) => r._count._all)
  const visLifeM = m(visLife, (r) => r._count._all)
  const ord12M = m(ord12, (r) => r._count._all)
  const vis12M = m(vis12, (r) => r._count._all)
  const smsM = m(sms, (r) => r._count._all)
  const couponM = m(coupons, (r) => r._count._all)
  const petM = m(petCounts, (r) => r._count._all)
  const byCustomer = new Map<string, typeof records>()
  for (const r of records) {
    const arr = byCustomer.get(r.pet.customerId) ?? []
    arr.push(r)
    byCustomer.set(r.pet.customerId, arr)
  }
  const out = new Map<string, HealthInput>()
  for (const c of customers) {
    const lastV = visitMaxM.get(c.id) ?? null
    const lastTs = Math.max(c.lastOrderAt?.getTime() ?? 0, lastV?.getTime() ?? 0)
    const overdue = openReminders(byCustomer.get(c.id) ?? [], now)
      .filter((x) => x.status === 'overdue')
      .map((x) => Math.floor((now.getTime() - x.record.nextDueAt!.getTime()) / DAY))
    out.set(c.id, {
      daysSinceLast: lastTs > 0 ? Math.max(0, Math.floor((now.getTime() - lastTs) / DAY)) : null,
      activity12m: (ord12M.get(c.id) ?? 0) + (vis12M.get(c.id) ?? 0),
      activityLifetime: (ordLifeM.get(c.id) ?? 0) + (visLifeM.get(c.id) ?? 0),
      spendPercentile: c.ordersCount > 0 ? (percentiles.get(c.id) ?? 0) : 0,
      smsConsent: c.marketingSmsConsent,
      smsDelivered90d: (smsM.get(c.id) ?? 0) > 0,
      couponRedeemed180d: (couponM.get(c.id) ?? 0) > 0,
      care: careState(overdue, petM.get(c.id) ?? 0),
      joinedDaysAgo: Math.floor((now.getTime() - c.createdAt.getTime()) / DAY),
    })
  }
  return out
}

/** totalSpent percentile (0-100) for every customer who has ordered. */
export async function spendPercentiles(): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<Array<{ id: string; p: number }>>`
    SELECT "id", ROUND(100 * percent_rank() OVER (ORDER BY "totalSpent"))::int AS p
    FROM "Customer" WHERE "ordersCount" > 0 AND "mergedIntoId" IS NULL`
  return new Map(rows.map((r) => [r.id, Number(r.p)]))
}

const BATCH = 400

/**
 * Nightly: recomputes score and churn risk for every live customer. A HealthSnapshot is written only
 * when the score or risk changed, and at most once per customer per day.
 */
export async function recomputeAllHealth(now: Date = new Date()): Promise<{ updated: number }> {
  const percentiles = await spendPercentiles()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  let cursor: string | undefined
  let updated = 0
  for (;;) {
    const batch = await db.customer.findMany({
      where: { mergedIntoId: null },
      select: { id: true, createdAt: true, marketingSmsConsent: true, ordersCount: true, lastOrderAt: true, healthScore: true, churnRisk: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    const inputs = await loadHealthInputs(batch, percentiles, now)
    const changed = batch
      .map((c) => ({ c, h: computeHealth(inputs.get(c.id)!) }))
      .filter(({ c, h }) => c.healthScore !== h.score || c.churnRisk !== h.churnRisk)
    if (changed.length) {
      const already = new Set(
        (await db.healthSnapshot.findMany({ where: { customerId: { in: changed.map((x) => x.c.id) }, computedAt: { gte: dayStart } }, select: { customerId: true } })).map((r) => r.customerId)
      )
      await db.$transaction([
        ...changed.map(({ c, h }) => db.customer.update({ where: { id: c.id }, data: { healthScore: h.score, churnRisk: h.churnRisk } })),
        ...(changed.filter(({ c }) => !already.has(c.id)).length
          ? [db.healthSnapshot.createMany({ data: changed.filter(({ c }) => !already.has(c.id)).map(({ c, h }) => ({ customerId: c.id, score: h.score, churnRisk: h.churnRisk, computedAt: now })) })]
          : []),
      ])
      updated += changed.length
    }
    if (batch.length < BATCH) break
  }
  return { updated }
}

/** One customer, on demand (for example right after an order). */
export async function recomputeCustomerHealth(customerId: string, now: Date = new Date()): Promise<{ score: number; churnRisk: ChurnRisk } | null> {
  const c = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, createdAt: true, marketingSmsConsent: true, ordersCount: true, lastOrderAt: true } })
  if (!c) return null
  const percentiles = await spendPercentiles()
  const h = computeHealth((await loadHealthInputs([c], percentiles, now)).get(c.id)!)
  await db.customer.update({ where: { id: c.id }, data: { healthScore: h.score, churnRisk: h.churnRisk } })
  return h
}
