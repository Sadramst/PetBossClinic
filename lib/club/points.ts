import { Prisma, type PointsKind } from '@prisma/client'
import { db } from '@/lib/db'
import { getLoyaltyConfig } from '@/lib/club/config'
import { pointsForOrder as orderMath, pointsForService as serviceMath, tierByKey, tierForLifetime, type TierDef } from '@/lib/club/tiers'

export type DbClient = Prisma.TransactionClient | typeof db

/** Runs `fn` inside a transaction: reuses the caller's one, or opens a new one. */
export async function inTx<T>(client: DbClient, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if ('$transaction' in client) return (client as typeof db).$transaction(fn, { timeout: 15_000 })
  return fn(client as Prisma.TransactionClient)
}

/** Row lock on the customer: every points change for one person queues up behind it. */
async function lockCustomer(tx: Prisma.TransactionClient, customerId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} FOR UPDATE`
  return rows.length === 1
}

export interface PointsResult {
  ok: boolean
  /** False when the same (customer, kind, ref) was already applied */
  applied: boolean
  points: number
  balance: number
  error?: string
}

export interface AwardArgs {
  customerId: string
  kind: PointsKind
  /** Final points (already multiplied). Negative only for REVERSAL / ADJUST / EXPIRE. */
  points: number
  refType?: string | null
  refId?: string | null
  note?: string | null
  adminId?: string | null
  expiresAt?: Date | null
}

const NEGATIVE_OK: PointsKind[] = ['REVERSAL', 'ADJUST', 'EXPIRE']

/**
 * Adds (or, for reversals/adjustments, removes) points. Idempotent per (customer, kind, refId):
 * awarding the same thing twice, even in parallel, applies it once. The balance never goes
 * below zero, and the tier follows lifetime points.
 */
export async function awardPoints(client: DbClient, args: AwardArgs): Promise<PointsResult> {
  const delta = Math.trunc(args.points)
  if (!Number.isFinite(delta) || delta === 0) return { ok: true, applied: false, points: 0, balance: 0 }
  if (delta < 0 && !NEGATIVE_OK.includes(args.kind)) return { ok: false, applied: false, points: 0, balance: 0, error: 'invalid negative award' }

  const cfg = await getLoyaltyConfig(client as never)
  return inTx(client, async (tx) => {
    if (!(await lockCustomer(tx, args.customerId))) return { ok: false, applied: false, points: 0, balance: 0, error: 'customer not found' }
    if (args.refId) {
      const dup = await tx.pointsTransaction.findUnique({
        where: { customerId_kind_refId: { customerId: args.customerId, kind: args.kind, refId: args.refId } },
        select: { balanceAfter: true },
      })
      if (dup) return { ok: true, applied: false, points: 0, balance: dup.balanceAfter }
    }
    const c = await tx.customer.findUniqueOrThrow({ where: { id: args.customerId }, select: { pointsBalance: true, lifetimePoints: true } })
    // A deduction can never take more than what is there.
    const applied = delta < 0 ? -Math.min(-delta, c.pointsBalance) : delta
    if (applied === 0) return { ok: true, applied: false, points: 0, balance: c.pointsBalance }
    const balance = c.pointsBalance + applied
    // Earnings and reversals move lifetime points; a manual adjustment does too so tiers stay honest.
    const lifetime = Math.max(0, c.lifetimePoints + applied)
    const tier = tierForLifetime(cfg.tiers, lifetime).key
    await tx.customer.update({ where: { id: args.customerId }, data: { pointsBalance: balance, lifetimePoints: lifetime, tier } })
    await tx.pointsTransaction.create({
      data: {
        customerId: args.customerId,
        kind: args.kind,
        points: applied,
        balanceAfter: balance,
        refType: args.refType ?? null,
        refId: args.refId ?? null,
        note: args.note?.slice(0, 300) ?? null,
        expiresAt: args.expiresAt ?? null,
        createdByAdminId: args.adminId ?? null,
      },
    })
    return { ok: true, applied: true, points: applied, balance }
  }).catch((err) => {
    // Lost a race against the unique key: someone else applied it first.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: true, applied: false, points: 0, balance: 0 }
    throw err
  })
}

/** Spends points (REDEEM). Fails cleanly, without touching anything, when the balance is too low. */
export async function spendPoints(
  client: DbClient,
  args: { customerId: string; points: number; refType?: string | null; refId?: string | null; note?: string | null }
): Promise<PointsResult> {
  const cost = Math.trunc(args.points)
  if (!(cost > 0)) return { ok: false, applied: false, points: 0, balance: 0, error: 'invalid amount' }
  return inTx(client, async (tx) => {
    if (!(await lockCustomer(tx, args.customerId))) return { ok: false, applied: false, points: 0, balance: 0, error: 'customer not found' }
    const moved = await tx.customer.updateMany({
      where: { id: args.customerId, pointsBalance: { gte: cost } },
      data: { pointsBalance: { decrement: cost } },
    })
    if (moved.count !== 1) {
      const c = await tx.customer.findUnique({ where: { id: args.customerId }, select: { pointsBalance: true } })
      return { ok: false, applied: false, points: 0, balance: c?.pointsBalance ?? 0, error: 'insufficient' }
    }
    const c = await tx.customer.findUniqueOrThrow({ where: { id: args.customerId }, select: { pointsBalance: true } })
    await tx.pointsTransaction.create({
      data: {
        customerId: args.customerId,
        kind: 'REDEEM',
        points: -cost,
        balanceAfter: c.pointsBalance,
        refType: args.refType ?? null,
        refId: args.refId ?? null,
        note: args.note?.slice(0, 300) ?? null,
      },
    })
    return { ok: true, applied: true, points: -cost, balance: c.pointsBalance }
  })
}

/**
 * Takes back what an order or visit earned (cancelled/returned). Safe to call twice: the
 * REVERSAL row shares the original reference, so it applies once.
 */
export async function reversePoints(
  client: DbClient,
  args: { customerId: string; kind: 'ORDER' | 'SERVICE'; refId: string; refType?: string; note?: string }
): Promise<PointsResult> {
  const original = await client.pointsTransaction.findUnique({
    where: { customerId_kind_refId: { customerId: args.customerId, kind: args.kind, refId: args.refId } },
    select: { points: true },
  })
  if (!original || original.points <= 0) return { ok: true, applied: false, points: 0, balance: 0 }
  return awardPoints(client, {
    customerId: args.customerId,
    kind: 'REVERSAL',
    points: -original.points,
    refType: args.refType ?? (args.kind === 'ORDER' ? 'order' : 'visit'),
    refId: `${args.kind}:${args.refId}`,
    note: args.note ?? 'بازگشت امتیاز',
  })
}

/** Manual admin adjustment. A reason is mandatory. */
export async function adjustPoints(
  client: DbClient,
  args: { customerId: string; points: number; note: string; adminId?: string | null }
): Promise<PointsResult> {
  const note = args.note?.trim()
  if (!note) return { ok: false, applied: false, points: 0, balance: 0, error: 'note required' }
  if (!Number.isFinite(args.points) || Math.trunc(args.points) === 0) return { ok: false, applied: false, points: 0, balance: 0, error: 'zero' }
  return awardPoints(client, { customerId: args.customerId, kind: 'ADJUST', points: args.points, note, adminId: args.adminId ?? null, refType: 'admin' })
}

// ─── Earn helpers (read the live config and the customer's tier) ─────────────

async function customerTier(client: DbClient, customerId: string, tiers: TierDef[]): Promise<TierDef> {
  const c = await client.customer.findUnique({ where: { id: customerId }, select: { tier: true } })
  return tierByKey(tiers, c?.tier)
}

/** Points an order total earns for this customer right now. */
export async function orderPointsFor(client: DbClient, customerId: string, total: number): Promise<number> {
  const cfg = await getLoyaltyConfig(client as never)
  if (!cfg.enabled) return 0
  return orderMath(total, await customerTier(client, customerId, cfg.tiers), cfg)
}

/** Points a clinic service amount earns for this customer right now. */
export async function servicePointsFor(client: DbClient, customerId: string, amount: number): Promise<number> {
  const cfg = await getLoyaltyConfig(client as never)
  if (!cfg.enabled) return 0
  return serviceMath(amount, await customerTier(client, customerId, cfg.tiers), cfg)
}

export { orderMath as pointsForOrder, serviceMath as pointsForService }

export interface LedgerFilter {
  kinds?: PointsKind[]
  direction?: 'in' | 'out'
  page?: number
  pageSize?: number
}

/** Paged points history for one customer (newest first). */
export async function getPointsLedger(customerId: string, f: LedgerFilter = {}) {
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20))
  const page = Math.max(1, f.page ?? 1)
  const where: Prisma.PointsTransactionWhereInput = {
    customerId,
    ...(f.kinds?.length ? { kind: { in: f.kinds } } : {}),
    ...(f.direction === 'in' ? { points: { gt: 0 } } : f.direction === 'out' ? { points: { lt: 0 } } : {}),
  }
  const [rows, total] = await Promise.all([
    db.pointsTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.pointsTransaction.count({ where }),
  ])
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
}
