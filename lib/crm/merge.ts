import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { CrmError } from '@/lib/crm/errors'
import { recordActivity } from '@/lib/crm/activity'
import { linkCustomerToContact } from '@/lib/crm/contacts'
import { getLoyaltyConfig } from '@/lib/club/config'
import { tierForLifetime } from '@/lib/club/tiers'

export type MergeReport = {
  dryRun: boolean
  survivorId: string
  loserId: string
  /** Rows moved (or that would move) per table. */
  moved: Record<string, number>
  /** Fields the survivor filled from the loser. */
  filledFields: string[]
  tagsAdded: string[]
  /** Ledger rows whose reference was renamed because the survivor already had the same (kind, ref). */
  pointsRefsRenamed: number
  pointsBalance: number
  lifetimePoints: number
  tier: string
  ordersCount: number
  totalSpent: number
}

class DryRunDone extends Error {
  constructor(readonly report: MergeReport) {
    super('dry run')
  }
}

const REPOINT: Array<{ label: string; run: (tx: Prisma.TransactionClient, from: string, to: string) => Promise<number> }> = [
  { label: 'addresses', run: async (tx, f, t) => (await tx.address.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'orders', run: async (tx, f, t) => (await tx.order.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'pets', run: async (tx, f, t) => (await tx.pet.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'visits', run: async (tx, f, t) => (await tx.serviceVisit.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'rewardRedemptions', run: async (tx, f, t) => (await tx.rewardRedemption.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'notes', run: async (tx, f, t) => (await tx.adminCustomerNote.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'messageOutbox', run: async (tx, f, t) => (await tx.messageOutbox.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'coupons', run: async (tx, f, t) => (await tx.coupon.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'couponRedemptions', run: async (tx, f, t) => (await tx.couponRedemption.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'marketingContacts', run: async (tx, f, t) => (await tx.marketingContact.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'leads', run: async (tx, f, t) => (await tx.lead.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'messages', run: async (tx, f, t) => (await tx.contactMessage.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'tasks', run: async (tx, f, t) => (await tx.crmTask.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
  { label: 'activities', run: async (tx, f, t) => (await tx.crmActivity.updateMany({ where: { customerId: f }, data: { customerId: t } })).count },
]

/**
 * Merges the loser customer INTO the survivor in one transaction (CRM-SPEC section 7).
 * - Both rows are locked in id order, so parallel merges of overlapping pairs queue up and the second
 *   one finds the loser already merged and refuses.
 * - Everything the loser owns moves to the survivor; ledger references that would collide are renamed;
 *   balance, lifetime points, tier and order counters are recomputed from the ledger and the orders.
 * - The loser keeps its phone (unique), is blocked and points at the survivor via `mergedIntoId`.
 * - dryRun runs the very same code and rolls back, so the report is exact.
 */
export async function mergeCustomers(survivorId: string, loserId: string, adminId: string, opts: { dryRun?: boolean } = {}): Promise<MergeReport> {
  if (!survivorId || !loserId || survivorId === loserId) throw new CrmError('SAME', 'پروندهٔ مقصد و پروندهٔ تکراری باید متفاوت باشند.')
  const dryRun = !!opts.dryRun
  const cfg = await getLoyaltyConfig()
  const [firstId, secondId] = survivorId < loserId ? [survivorId, loserId] : [loserId, survivorId]
  try {
    return await db.$transaction(
      async (tx) => {
        // Lock both customers in a fixed order (also queues behind any points change in flight).
        await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" IN (${firstId}, ${secondId}) ORDER BY "id" FOR UPDATE`
        const [survivor, loser] = await Promise.all([tx.customer.findUnique({ where: { id: survivorId } }), tx.customer.findUnique({ where: { id: loserId } })])
        if (!survivor || !loser) throw new CrmError('NOT_FOUND', 'یکی از دو مشتری پیدا نشد.')
        if (survivor.mergedIntoId || loser.mergedIntoId) throw new CrmError('ALREADY_MERGED', 'یکی از این دو پرونده پیش‌تر ادغام شده است.')

        const moved: Record<string, number> = {}
        const t = (label: string, n: number) => {
          moved[label] = (moved[label] ?? 0) + n
        }

        // Contacts first: make sure the survivor has one, find the loser's.
        const survivorContactId = await linkCustomerToContact(survivorId, tx)
        const loserContact = await tx.contact.findFirst({ where: { OR: [{ customerId: loserId }, ...(loser.contactId ? [{ id: loser.contactId }] : [])] }, select: { id: true } })

        // Customers who carry a unique value the survivor wants must release it before the survivor takes it.
        await tx.customer.update({ where: { id: loserId }, data: { email: null } })

        for (const r of REPOINT) t(r.label, await r.run(tx, loserId, survivorId))

        // Cart: one per customer. Keep the survivor's, otherwise adopt the loser's.
        const survivorCart = await tx.cartSnapshot.findUnique({ where: { customerId: survivorId }, select: { id: true } })
        if (survivorCart) t('cartDiscarded', (await tx.cartSnapshot.deleteMany({ where: { customerId: loserId } })).count)
        else t('cart', (await tx.cartSnapshot.updateMany({ where: { customerId: loserId }, data: { customerId: survivorId } })).count)

        // Groups: composite key (groupId, customerId): move only the groups the survivor is not in.
        const have = (await tx.customerGroupMember.findMany({ where: { customerId: survivorId }, select: { groupId: true } })).map((g) => g.groupId)
        t('groups', (await tx.customerGroupMember.updateMany({ where: { customerId: loserId, groupId: { notIn: have } }, data: { customerId: survivorId } })).count)
        await tx.customerGroupMember.deleteMany({ where: { customerId: loserId } })
        await tx.healthSnapshot.deleteMany({ where: { customerId: loserId } })

        // Points ledger: rename colliding (kind, refId) on the loser's side, move, then rebuild balances from the ledger.
        const renamed = await tx.$executeRaw`
          UPDATE "PointsTransaction" l SET "refId" = l."refId" || ':merged:' || ${loserId}
          WHERE l."customerId" = ${loserId} AND l."refId" IS NOT NULL
            AND EXISTS (SELECT 1 FROM "PointsTransaction" s WHERE s."customerId" = ${survivorId} AND s."kind" = l."kind" AND s."refId" = l."refId")`
        t('pointsTransactions', (await tx.pointsTransaction.updateMany({ where: { customerId: loserId }, data: { customerId: survivorId } })).count)
        await tx.$executeRaw`
          UPDATE "PointsTransaction" p SET "balanceAfter" = GREATEST(0, s."run")::int
          FROM (SELECT "id", SUM("points") OVER (ORDER BY "createdAt", "id") AS "run" FROM "PointsTransaction" WHERE "customerId" = ${survivorId}) s
          WHERE p."id" = s."id"`
        const sums = await tx.$queryRaw<Array<{ bal: bigint | null; life: bigint | null }>>`
          SELECT SUM("points") AS bal, SUM("points") FILTER (WHERE "kind" <> 'REDEEM') AS life FROM "PointsTransaction" WHERE "customerId" = ${survivorId}`
        const pointsBalance = Math.max(0, Number(sums[0]?.bal ?? 0))
        const lifetimePoints = Math.max(0, Number(sums[0]?.life ?? 0))
        const tier = tierForLifetime(cfg.tiers, lifetimePoints).key

        // Order counters from the (now merged) orders themselves.
        const agg = await tx.order.aggregate({ where: { customerId: survivorId, status: 'DELIVERED' }, _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true } })

        // Customers the loser referred now belong to the survivor; the survivor is never its own referrer.
        await tx.customer.updateMany({ where: { referredById: loserId, id: { not: survivorId } }, data: { referredById: survivorId } })
        if (survivor.referredById === loserId) {
          await tx.customer.update({ where: { id: survivorId }, data: { referredById: null } })
          survivor.referredById = null
        }

        // Survivor keeps phone and password; it only fills what is empty.
        const filledFields: string[] = []
        const fill: Prisma.CustomerUpdateInput = {}
        const take = <K extends 'email' | 'birthDate' | 'city' | 'gender' | 'firstName' | 'lastName' | 'referredById'>(k: K) => {
          if (k === 'referredById' && loser.referredById === survivorId) return
          if ((survivor[k] === null || survivor[k] === '') && loser[k]) {
            ;(fill as Record<string, unknown>)[k] = loser[k]
            filledFields.push(k)
          }
        }
        ;(['email', 'birthDate', 'city', 'gender', 'firstName', 'lastName', 'referredById'] as const).forEach(take)
        const tagsAdded = loser.tags.filter((x) => !survivor.tags.includes(x))
        if (loser.notes && loser.notes !== survivor.notes) {
          fill.notes = [survivor.notes, `— از پروندهٔ ادغام‌شده (${loser.phone}):`, loser.notes].filter(Boolean).join('\n').slice(0, 2000)
          filledFields.push('notes')
        }
        if (!survivor.ownerId && loser.ownerId) {
          fill.ownerId = loser.ownerId
          filledFields.push('ownerId')
        }
        await tx.customer.update({
          where: { id: survivorId },
          data: {
            ...fill,
            tags: [...survivor.tags, ...tagsAdded],
            pointsBalance,
            lifetimePoints,
            tier,
            ordersCount: agg._count._all,
            totalSpent: agg._sum.total ?? 0,
            lastOrderAt: agg._max.createdAt ?? null,
            lastContactedAt: [survivor.lastContactedAt, loser.lastContactedAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
            createdAt: loser.createdAt < survivor.createdAt ? loser.createdAt : undefined,
          },
        })

        // The loser stays as an empty shell: blocked, signed out, pointing at the survivor. Its phone stays unique.
        await tx.customer.update({
          where: { id: loserId },
          data: {
            referralCode: null,
            mergedIntoId: survivorId,
            isBlocked: true,
            sessionVersion: { increment: 1 },
            pointsBalance: 0,
            lifetimePoints: 0,
            ordersCount: 0,
            totalSpent: 0,
            lifecycleStage: 'BLOCKED',
            tags: [],
            contactId: survivorContactId,
          },
        })

        // Contact spine: the loser's contact now resolves to the survivor's.
        if (loserContact && loserContact.id !== survivorContactId) {
          await tx.contact.update({ where: { id: loserContact.id }, data: { mergedIntoId: survivorContactId, customerId: null, stage: 'BLOCKED' } })
          t('contactRefs', (await tx.lead.updateMany({ where: { contactId: loserContact.id }, data: { contactId: survivorContactId } })).count)
          await tx.contactMessage.updateMany({ where: { contactId: loserContact.id }, data: { contactId: survivorContactId } })
          await tx.marketingContact.updateMany({ where: { contactId: loserContact.id }, data: { contactId: survivorContactId } })
          await tx.crmTask.updateMany({ where: { contactId: loserContact.id }, data: { contactId: survivorContactId } })
          await tx.crmActivity.updateMany({ where: { contactId: loserContact.id }, data: { contactId: survivorContactId } })
        }

        // Audit trail, atomic with the merge. The actor is stored on the row only when it is a real user.
        const actor = await tx.user.findUnique({ where: { id: adminId }, select: { id: true } })
        const report: MergeReport = { dryRun, survivorId, loserId, moved, filledFields, tagsAdded, pointsRefsRenamed: Number(renamed), pointsBalance, lifetimePoints, tier, ordersCount: agg._count._all, totalSpent: agg._sum.total ?? 0 }
        await tx.auditLog.create({
          data: {
            userId: actor?.id ?? null,
            action: 'MERGE',
            entity: 'CUSTOMER',
            entityId: survivorId,
            before: { loserId, loserPhone: loser.phone, loserEmail: loser.email, survivorOrders: survivor.ordersCount, loserOrders: loser.ordersCount, survivorPoints: survivor.pointsBalance, loserPoints: loser.pointsBalance } as never,
            after: { survivorId, moved, filledFields, tagsAdded, pointsBalance, lifetimePoints, _actor: { id: adminId } } as never,
          },
        })
        await recordActivity(
          { type: 'CUSTOMER_MERGED', summary: `پروندهٔ ${loser.phone} با این پرونده ادغام شد`, customerId: survivorId, contactId: survivorContactId, actorUserId: adminId, refType: 'merge', refId: loserId, meta: { loserId, moved } },
          tx
        )
        if (dryRun) throw new DryRunDone(report)
        return report
      },
      { timeout: 30_000, maxWait: 10_000 }
    )
  } catch (err) {
    if (err instanceof DryRunDone) return err.report
    throw err
  }
}
