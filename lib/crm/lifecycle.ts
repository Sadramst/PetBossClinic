import type { LifecycleStage, LeadStage } from '@prisma/client'
import { db } from '@/lib/db'
import { getLoyaltyConfig } from '@/lib/club/config'

const DAY = 86_400_000

export type LifecycleInput = {
  hasCustomer: boolean
  isBlocked?: boolean
  /** Customer is on the highest loyalty tier. */
  topTier?: boolean
  /** totalSpent is in the top 5 percent of customers. */
  topSpender?: boolean
  healthScore?: number | null
  /** Delivered orders in the last 12 months. */
  orders12m?: number
  joinedAt?: Date | null
  ordersCount?: number
  lastOrderAt?: Date | null
  lastVisitAt?: Date | null
  /** Stages of the person's leads (any non-customer signal). */
  leadStages?: LeadStage[]
  /** A MarketingContact / newsletter record exists. */
  subscribed?: boolean
  now?: Date
}

const days = (from: Date, now: Date) => Math.floor((now.getTime() - from.getTime()) / DAY)

/**
 * CRM-SPEC section 2, first match wins. Pure.
 * Two deliberate readings of the table: a customer with no order or visit at all is judged by how long
 * ago they joined (health is meaningless without activity), and LAPSED (over 180 days) is tested before
 * the AT_RISK health rule, otherwise a lapsed customer's low score would always make them AT_RISK.
 */
export function computeLifecycleStage(i: LifecycleInput): LifecycleStage {
  const now = i.now ?? new Date()
  if (i.hasCustomer) {
    if (i.isBlocked) return 'BLOCKED'
    const health = i.healthScore ?? null
    if (i.topTier || i.topSpender || (health !== null && health >= 85 && (i.orders12m ?? 0) >= 3)) return 'VIP'
    const orders = i.ordersCount ?? 0
    const lastActivity = [i.lastOrderAt, i.lastVisitAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
    const joined = i.joinedAt ?? null
    if ((joined && days(joined, now) <= 30) || (orders <= 1 && i.lastOrderAt && days(i.lastOrderAt, now) <= 45)) return 'NEW_CUSTOMER'
    if (lastActivity) {
      const since = days(lastActivity, now)
      if (since > 180) return 'LAPSED'
      if ((health !== null && health < 40) || (since >= 90 && orders >= 2)) return 'AT_RISK'
      return 'ACTIVE'
    }
    // Registered but never bought or visited.
    return joined && days(joined, now) > 180 ? 'LAPSED' : 'ACTIVE'
  }
  const leads = i.leadStages ?? []
  if (leads.some((s) => s === 'QUALIFIED' || s === 'APPOINTMENT_BOOKED')) return 'PROSPECT'
  if (leads.some((s) => s !== 'LOST')) return 'LEAD'
  if (i.subscribed) return 'SUBSCRIBER'
  // Only lost leads (kept for dedupe) or a bare contact.
  return leads.length > 0 ? 'LEAD' : 'SUBSCRIBER'
}

type ContactRow = { id: string; phone: string | null; email: string | null; customerId: string | null; stageOverride: LifecycleStage | null; stage: LifecycleStage }

/** Share of customers considered "top spenders", and the minimum population before the rule applies. */
const TOP_SHARE = 0.05
const MIN_POPULATION = 20

async function topSpendThreshold(): Promise<number | null> {
  const rows = await db.$queryRaw<Array<{ n: bigint; t: number | null }>>`
    SELECT COUNT(*)::bigint AS n, percentile_cont(${1 - TOP_SHARE}) WITHIN GROUP (ORDER BY "totalSpent") AS t
    FROM "Customer" WHERE "ordersCount" > 0 AND "mergedIntoId" IS NULL`
  const r = rows[0]
  return r && Number(r.n) >= MIN_POPULATION && r.t !== null && Number(r.t) > 0 ? Number(r.t) : null
}

/** Evaluates one batch of contacts with grouped queries and writes only the rows that changed. */
async function applyBatch(contacts: ContactRow[], ctx: { threshold: number | null; topTierKey: string | null; now: Date }): Promise<number> {
  const customerIds = contacts.map((c) => c.customerId).filter((x): x is string => !!x)
  const phones = contacts.map((c) => c.phone).filter((x): x is string => !!x)
  const contactIds = contacts.map((c) => c.id)
  const y1 = new Date(ctx.now.getTime() - 365 * DAY)
  const [customers, visits, orders12, leads, marketing] = await Promise.all([
    customerIds.length ? db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, isBlocked: true, tier: true, totalSpent: true, healthScore: true, createdAt: true, ordersCount: true, lastOrderAt: true, lifecycleStage: true } }) : [],
    customerIds.length ? db.serviceVisit.groupBy({ by: ['customerId'], where: { customerId: { in: customerIds } }, _max: { visitedAt: true } }) : [],
    customerIds.length ? db.order.groupBy({ by: ['customerId'], where: { customerId: { in: customerIds }, status: 'DELIVERED', createdAt: { gte: y1 } }, _count: { _all: true } }) : [],
    db.lead.findMany({ where: { OR: [{ contactId: { in: contactIds } }, ...(phones.length ? [{ normalizedPhone: { in: phones } }] : [])] }, select: { contactId: true, normalizedPhone: true, stage: true }, take: 50_000 }),
    db.marketingContact.findMany({ where: { OR: [{ contactId: { in: contactIds } }, ...(phones.length ? [{ phone: { in: phones } }] : [])] }, select: { contactId: true, phone: true, unsubscribedAt: true }, take: 50_000 }),
  ])
  const custM = new Map(customers.map((c) => [c.id, c]))
  const visitM = new Map(visits.map((v) => [v.customerId, v._max.visitedAt]))
  const o12M = new Map(orders12.map((o) => [o.customerId, o._count._all]))
  let changed = 0
  for (const ct of contacts) {
    const cust = ct.customerId ? custM.get(ct.customerId) : undefined
    const leadStages = leads.filter((l) => l.contactId === ct.id || (ct.phone && l.normalizedPhone === ct.phone)).map((l) => l.stage)
    const subscribed = marketing.some((m) => (m.contactId === ct.id || (ct.phone && m.phone === ct.phone)) && !m.unsubscribedAt)
    const computed = computeLifecycleStage({
      hasCustomer: !!cust,
      isBlocked: cust?.isBlocked,
      topTier: !!cust && !!ctx.topTierKey && cust.tier === ctx.topTierKey,
      topSpender: !!cust && ctx.threshold !== null && cust.totalSpent >= ctx.threshold,
      healthScore: cust?.healthScore,
      orders12m: cust ? o12M.get(cust.id) ?? 0 : 0,
      joinedAt: cust?.createdAt,
      ordersCount: cust?.ordersCount,
      lastOrderAt: cust?.lastOrderAt,
      lastVisitAt: cust ? visitM.get(cust.id) ?? null : null,
      leadStages,
      subscribed,
      now: ctx.now,
    })
    const stage = ct.stageOverride ?? computed
    if (stage !== ct.stage) {
      await db.contact.update({ where: { id: ct.id }, data: { stage } })
      changed++
    }
    if (cust && cust.lifecycleStage !== stage) await db.customer.update({ where: { id: cust.id }, data: { lifecycleStage: stage } })
  }
  return changed
}

async function context(now: Date) {
  const [threshold, cfg] = await Promise.all([topSpendThreshold(), getLoyaltyConfig()])
  const sorted = [...cfg.tiers].sort((a, b) => a.minPoints - b.minPoints)
  // A ladder with a single tier has no "top".
  const topTierKey = sorted.length > 1 ? sorted[sorted.length - 1].key : null
  return { threshold, topTierKey, now }
}

/** Recomputes (and stores) the stage of one contact. `stageOverride` wins until cleared. */
export async function recomputeLifecycle(contactId: string): Promise<LifecycleStage> {
  const c = await db.contact.findUnique({ where: { id: contactId }, select: { id: true, phone: true, email: true, customerId: true, stageOverride: true, stage: true } })
  if (!c) throw new Error('contact not found')
  await applyBatch([c], await context(new Date()))
  return (await db.contact.findUniqueOrThrow({ where: { id: contactId }, select: { stage: true } })).stage
}

/** Nightly pass over every live contact. Returns how many changed stage. */
export async function recomputeAllLifecycles(now: Date = new Date()): Promise<{ updated: number }> {
  const ctx = await context(now)
  let cursor: string | undefined
  let updated = 0
  for (;;) {
    const batch = await db.contact.findMany({
      where: { mergedIntoId: null },
      select: { id: true, phone: true, email: true, customerId: true, stageOverride: true, stage: true },
      orderBy: { id: 'asc' },
      take: 300,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    updated += await applyBatch(batch, ctx)
    if (batch.length < 300) break
  }
  return { updated }
}
