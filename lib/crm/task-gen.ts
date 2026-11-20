import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { openReminders } from '@/lib/club/due'
import { newId } from '@/lib/crm/types'
import { elapsedWorkingHours, FIRST_RESPONSE_HOURS } from '@/lib/crm/tickets'

const HOUR = 3_600_000
const DAY = 86_400_000
const CAP = 500

/** Idle carts at or above this subtotal (Toman) get a follow-up task. */
export const CART_TASK_THRESHOLD = 1_500_000

type Draft = Omit<Prisma.CrmTaskCreateManyInput, 'id' | 'system'>

async function insert(drafts: Draft[]): Promise<number> {
  if (drafts.length === 0) return 0
  // dedupeKey is unique: rows that already exist are skipped, so every generator is idempotent.
  const res = await db.crmTask.createMany({ data: drafts.map((d) => ({ ...d, id: newId(), system: true })), skipDuplicates: true })
  return res.count
}

/** Closes system tasks whose reason has gone (lead contacted, ticket answered). */
async function cancelStale(): Promise<number> {
  const a = await db.$executeRaw`
    UPDATE "CrmTask" t SET "status" = 'CANCELLED'::"TaskStatus", "updatedAt" = NOW()
    FROM "Lead" l
    WHERE t."leadId" = l."id" AND t."system" = true AND t."status" IN ('OPEN'::"TaskStatus", 'IN_PROGRESS'::"TaskStatus")
      AND ((t."dedupeKey" LIKE 'lead-new:%' AND l."stage" <> 'NEW'::"LeadStage")
        OR (t."dedupeKey" LIKE 'lead-followup:%' AND l."stage" IN ('WON'::"LeadStage", 'LOST'::"LeadStage")))`
  const b = await db.$executeRaw`
    UPDATE "CrmTask" t SET "status" = 'CANCELLED'::"TaskStatus", "updatedAt" = NOW()
    FROM "ContactMessage" m
    WHERE t."ticketId" = m."id" AND t."system" = true AND t."status" IN ('OPEN'::"TaskStatus", 'IN_PROGRESS'::"TaskStatus")
      AND t."dedupeKey" LIKE 'ticket-reply:%' AND m."status" <> 'OPEN'::"TicketStatus"`
  const c = await db.$executeRaw`
    UPDATE "CrmTask" t SET "status" = 'CANCELLED'::"TaskStatus", "updatedAt" = NOW()
    FROM "Customer" cu
    WHERE t."customerId" = cu."id" AND t."system" = true AND t."status" IN ('OPEN'::"TaskStatus", 'IN_PROGRESS'::"TaskStatus")
      AND t."dedupeKey" LIKE 'winback:%' AND cu."lifecycleStage" IS DISTINCT FROM 'AT_RISK'::"LifecycleStage"`
  return Number(a) + Number(b) + Number(c)
}

/**
 * Daily (and on demand) generators, CRM-SPEC section 4. Every task carries a dedupeKey, so running this
 * twice, or in parallel, creates each task once. Returns how many new tasks were created.
 */
export async function generateCrmTasks(now: Date = new Date()): Promise<number> {
  await cancelStale()
  let created = 0

  // 1. New leads nobody touched for 4 hours.
  const newLeads = await db.lead.findMany({ where: { stage: 'NEW', createdAt: { lte: new Date(now.getTime() - 4 * HOUR) } }, select: { id: true, name: true, phone: true, ownerId: true, contactId: true, customerId: true }, take: CAP })
  created += await insert(
    newLeads.map((l) => ({ title: 'تماس با درخواست جدید', type: 'CALL' as const, priority: 1, dueAt: now, ownerId: l.ownerId, leadId: l.id, contactId: l.contactId, customerId: l.customerId, note: l.name || l.phone, dedupeKey: `lead-new:${l.id}` }))
  )

  // 2. Follow-up dates that arrived.
  const followUps = await db.lead.findMany({ where: { followUpDate: { lte: now }, stage: { notIn: ['WON', 'LOST'] } }, select: { id: true, name: true, phone: true, ownerId: true, contactId: true, customerId: true, followUpDate: true }, take: CAP })
  created += await insert(
    followUps.map((l) => ({ title: 'پیگیری', type: 'FOLLOW_UP' as const, priority: 2, dueAt: l.followUpDate, ownerId: l.ownerId, leadId: l.id, contactId: l.contactId, customerId: l.customerId, note: l.name || l.phone, dedupeKey: `lead-followup:${l.id}:${l.followUpDate!.toISOString().slice(0, 10)}` }))
  )

  // 3. Pet reminders due within 7 days (latest record per pet/kind/title only, reminder not sent yet).
  const horizon = new Date(now.getTime() + 7 * DAY)
  const dueRecords = await db.petRecord.findMany({
    where: { nextDueAt: { lte: horizon, gte: new Date(now.getTime() - 30 * DAY) }, reminderSentAt: null, pet: { isActive: true } },
    select: { id: true, petId: true, kind: true, title: true, doneAt: true, nextDueAt: true, pet: { select: { name: true, customerId: true } } },
    take: CAP * 2,
  })
  if (dueRecords.length) {
    const petIds = [...new Set(dueRecords.map((r) => r.petId))]
    const all = await db.petRecord.findMany({ where: { petId: { in: petIds } }, select: { id: true, petId: true, kind: true, title: true, doneAt: true, nextDueAt: true }, take: 20_000 })
    const open = new Set(openReminders(all, now, 7).map((x) => x.record.id))
    const wanted = dueRecords.filter((r) => open.has(r.id)).slice(0, CAP)
    created += await insert(
      wanted.map((r) => ({
        title: r.kind === 'VACCINE' ? 'یادآوری واکسن' : r.kind === 'DEWORMING' ? 'یادآوری ضدانگل' : `یادآوری ${r.title}`.slice(0, 140),
        type: 'VACCINE_REMINDER' as const,
        priority: 2,
        dueAt: new Date(r.nextDueAt!.getTime() - 3 * DAY),
        customerId: r.pet.customerId,
        note: r.pet.name,
        dedupeKey: `vaccine:${r.id}`,
      }))
    )
  }

  // 4. High-value carts idle for 24 hours.
  const carts = await db.cartSnapshot.findMany({ where: { subtotal: { gte: CART_TASK_THRESHOLD }, itemCount: { gt: 0 }, recoveredOrderId: null, updatedAt: { lte: new Date(now.getTime() - DAY) } }, select: { id: true, customerId: true, updatedAt: true, subtotal: true }, take: CAP })
  created += await insert(
    carts.map((c) => ({ title: 'پیگیری سبد خرید', type: 'CART' as const, priority: 2, dueAt: now, customerId: c.customerId, note: `${c.subtotal.toLocaleString('en-US')} تومان`, dedupeKey: `cart:${c.id}:${c.updatedAt.toISOString().slice(0, 10)}` }))
  )

  // 5. Valuable customers that slipped to AT_RISK: one win-back call per quarter.
  const atRisk = await db.customer.findMany({ where: { lifecycleStage: 'AT_RISK', mergedIntoId: null, OR: [{ ordersCount: { gte: 3 } }, { tier: { in: await topTierKeys() } }] }, select: { id: true, ownerId: true, contactId: true }, take: CAP })
  const quarter = `${now.getFullYear()}Q${Math.floor(now.getMonth() / 3) + 1}`
  created += await insert(
    atRisk.map((c) => ({ title: 'تماس بازگشت', type: 'WIN_BACK' as const, priority: 2, dueAt: new Date(now.getTime() + 2 * DAY), ownerId: c.ownerId, customerId: c.id, contactId: c.contactId, dedupeKey: `winback:${c.id}:${quarter}` }))
  )

  // 6. Tickets without an answer past the first-response target.
  const open = await db.contactMessage.findMany({ where: { status: 'OPEN', firstResponseAt: null, createdAt: { lte: new Date(now.getTime() - FIRST_RESPONSE_HOURS * HOUR) } }, select: { id: true, name: true, assigneeId: true, contactId: true, customerId: true, createdAt: true }, take: CAP })
  created += await insert(
    open
      .filter((t) => elapsedWorkingHours(t.createdAt, now) >= FIRST_RESPONSE_HOURS)
      .map((t) => ({ title: 'پاسخ به پیام', type: 'SMS' as const, priority: 1, dueAt: now, ownerId: t.assigneeId, ticketId: t.id, contactId: t.contactId, customerId: t.customerId, note: t.name, dedupeKey: `ticket-reply:${t.id}` }))
  )
  return created
}

async function topTierKeys(): Promise<string[]> {
  const { getLoyaltyConfig } = await import('@/lib/club/config')
  const cfg = await getLoyaltyConfig()
  const sorted = [...cfg.tiers].sort((a, b) => a.minPoints - b.minPoints)
  return sorted.length > 1 ? [sorted[sorted.length - 1].key] : []
}
