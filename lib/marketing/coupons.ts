import 'server-only'
import { randomInt } from 'node:crypto'
import type { Coupon, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  COUPON_MESSAGES,
  checkAvailability,
  evaluateRules,
  randomCodePart,
  successMessage,
  normalizeCode,
  type CartLine,
  type CouponRecord,
  type CustomerFacts,
} from '@/lib/marketing/coupon-rules'

export { normalizeCode, COUPON_MESSAGES, describeOffer } from '@/lib/marketing/coupon-rules'
export type { CartLine, CouponRecord } from '@/lib/marketing/coupon-rules'

/** Orders that count as "the customer already bought": paid online or confirmed COD, and later states. */
export const COMPLETED_ORDER_STATUSES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const

/** e.g. PB-7KQ2-M9XD */
export function generateCode(prefix = 'PB'): string {
  const clean = normalizeCode(prefix) ?? 'PB'
  const pick = (n: number) => randomInt(n)
  return `${clean}-${randomCodePart(4, pick)}-${randomCodePart(4, pick)}`
}

export type CouponErrorCode = 'unavailable' | 'usageLimit' | 'perCustomer' | 'firstOrder' | 'unknown'

/** Thrown by redeemCoupon; the message is customer-facing Persian. */
export class CouponError extends Error {
  constructor(
    public readonly code: CouponErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'CouponError'
  }
}

export type EvaluateResult =
  | {
      ok: true
      coupon: { id: string; code: string; title: string; type: Coupon['type'] }
      discount: number
      shippingDiscount: number
      message: string
      /** True when the coupon was found automatically (no code typed). */
      auto: boolean
    }
  | { ok: false; error: string }

export interface EvaluateInput {
  code?: string | null
  lines: CartLine[]
  subtotal: number
  /** Shipping fee before the coupon; null when the address is not known yet. */
  shippingFee: number | null
  customerId: string | null
  now?: Date
}

const toRecord = (c: Coupon): CouponRecord => c

/** Customer-specific facts for one coupon (a handful of indexed lookups). */
async function loadFacts(
  client: Prisma.TransactionClient | typeof db,
  coupon: CouponRecord,
  customerId: string
): Promise<CustomerFacts> {
  const needsFirst = coupon.firstOrderOnly
  const [completedOrders, usedThisCoupon, membership, contactMatch] = await Promise.all([
    needsFirst
      ? client.order.count({ where: { customerId, status: { in: [...COMPLETED_ORDER_STATUSES] } } })
      : Promise.resolve(0),
    coupon.perCustomerLimit !== null ? client.couponRedemption.count({ where: { couponId: coupon.id, customerId } }) : Promise.resolve(0),
    coupon.groupId ? client.customerGroupMember.findUnique({ where: { groupId_customerId: { groupId: coupon.groupId, customerId } }, select: { groupId: true } }) : Promise.resolve(null),
    coupon.source === 'welcome' && coupon.customerId === null ? welcomeContactMatches(client, coupon.id, customerId) : Promise.resolve(false),
  ])
  return { id: customerId, completedOrders, usedThisCoupon, inGroup: !!membership, contactMatch }
}

/** Does the customer's phone or email belong to the lead this welcome coupon was issued to? */
async function welcomeContactMatches(client: Prisma.TransactionClient | typeof db, couponId: string, customerId: string): Promise<boolean> {
  // Only the phone proves ownership: an email typed at sign-up is never verified.
  const customer = await client.customer.findUnique({ where: { id: customerId }, select: { phone: true } })
  if (!customer) return false
  const hit = await client.marketingContact.findFirst({ where: { welcomeCouponId: couponId, phone: customer.phone }, select: { id: true } })
  return !!hit
}

/**
 * Checks a coupon against a cart. With a code it explains exactly why it cannot be used;
 * without one it picks the autoApply coupon that saves the most. Read-only: nothing is reserved.
 */
export async function evaluateCoupon(input: EvaluateInput): Promise<EvaluateResult> {
  const now = input.now ?? new Date()
  const base = { now, lines: input.lines, subtotal: input.subtotal, shippingFee: input.shippingFee }

  const evaluateOne = async (row: Coupon) => {
    const record = toRecord(row)
    const customer = input.customerId ? await loadFacts(db, record, input.customerId) : null
    return { record, result: evaluateRules(record, { ...base, customer }) }
  }

  if (input.code != null && String(input.code).trim() !== '') {
    const code = normalizeCode(input.code)
    if (!code) return { ok: false, error: COUPON_MESSAGES.unknown }
    const row = await db.coupon.findUnique({ where: { code } })
    // Public codes are not enumerable: an unknown code and a code reserved for someone else both read as "invalid".
    if (!row) return { ok: false, error: COUPON_MESSAGES.unknown }
    const { record, result } = await evaluateOne(row)
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok: true,
      coupon: { id: record.id, code: record.code, title: record.title, type: record.type },
      discount: result.discount,
      shippingDiscount: result.shippingDiscount,
      message: successMessage(record, result.discount, result.shippingDiscount),
      auto: false,
    }
  }

  // Auto-apply: best eligible saving wins.
  const candidates = await db.coupon.findMany({
    where: {
      autoApply: true,
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    take: 50,
  })
  let best: { record: CouponRecord; discount: number; shippingDiscount: number } | null = null
  for (const row of candidates) {
    if (checkAvailability(toRecord(row), now)) continue
    const { record, result } = await evaluateOne(row)
    if (!result.ok) continue
    const saving = result.discount + result.shippingDiscount
    // A free-shipping coupon with an unknown fee saves nothing measurable yet: never beats a real discount.
    if (!best || saving > best.discount + best.shippingDiscount) best = { record, discount: result.discount, shippingDiscount: result.shippingDiscount }
  }
  if (!best) return { ok: false, error: '' }
  return {
    ok: true,
    coupon: { id: best.record.id, code: best.record.code, title: best.record.title, type: best.record.type },
    discount: best.discount,
    shippingDiscount: best.shippingDiscount,
    message: successMessage(best.record, best.discount, best.shippingDiscount),
    auto: true,
  }
}

/**
 * Reserves one use of a coupon for an order, inside the order's transaction.
 *
 * Concurrency: the customer row is locked first (so one person's parallel checkouts queue up and
 * the per-customer count is exact), and the total usage counter is bumped with ONE conditional
 * UPDATE, so two people racing for the last slot can never both win.
 */
export async function redeemCoupon(
  tx: Prisma.TransactionClient,
  args: { couponId: string; orderId: string; customerId: string; amount: number; now?: Date }
): Promise<void> {
  const now = args.now ?? new Date()
  await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${args.customerId} FOR UPDATE`

  const coupon = await tx.coupon.findUnique({ where: { id: args.couponId } })
  if (!coupon) throw new CouponError('unknown', COUPON_MESSAGES.unknown)
  const unavailable = checkAvailability(coupon, now)
  if (unavailable && !unavailable.ok) {
    throw new CouponError(unavailable.key === 'usageLimit' ? 'usageLimit' : 'unavailable', unavailable.error)
  }

  if (coupon.customerId !== null && coupon.customerId !== args.customerId) {
    throw new CouponError('unavailable', COUPON_MESSAGES.notForCustomer)
  }
  if (coupon.perCustomerLimit !== null) {
    const used = await tx.couponRedemption.count({ where: { couponId: coupon.id, customerId: args.customerId } })
    if (used >= coupon.perCustomerLimit) throw new CouponError('perCustomer', COUPON_MESSAGES.perCustomer)
  }
  if (coupon.firstOrderOnly) {
    const done = await tx.order.count({
      where: { customerId: args.customerId, id: { not: args.orderId }, status: { in: [...COMPLETED_ORDER_STATUSES] } },
    })
    if (done > 0) throw new CouponError('firstOrder', COUPON_MESSAGES.firstOrder)
  }

  const reserved = await tx.$executeRaw`
    UPDATE "Coupon" SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${coupon.id} AND "isActive" = true AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`
  if (reserved !== 1) throw new CouponError('usageLimit', COUPON_MESSAGES.usageLimit)

  await tx.couponRedemption.create({
    data: { couponId: coupon.id, orderId: args.orderId, customerId: args.customerId, amount: Math.max(0, Math.floor(args.amount)) },
  })
}

/**
 * Re-counts the use for an order that comes back to life (admin reopen, late payment).
 * An override: availability is not re-checked (the order already carries its discount), but the
 * counter is bumped so limits stay honest. Idempotent.
 */
export async function reinstateCouponForOrder(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { couponId: true, customerId: true, discount: true, shippingDiscount: true } })
  if (!order?.couponId) return false
  const coupon = await tx.coupon.findUnique({ where: { id: order.couponId }, select: { id: true } })
  if (!coupon) return false
  const exists = await tx.couponRedemption.findUnique({ where: { orderId }, select: { id: true } })
  if (exists) return false
  await tx.couponRedemption.create({
    data: { couponId: coupon.id, orderId, customerId: order.customerId, amount: Math.max(0, order.discount + order.shippingDiscount) },
  })
  await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${coupon.id}`
  return true
}

export async function reinstateCouponForOrderId(orderId: string): Promise<boolean> {
  return db.$transaction((tx) => reinstateCouponForOrder(tx, orderId))
}

/** Gives the use back (order cancelled / payment lost). Safe to call twice. */
export async function releaseCouponForOrder(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
  const redemption = await tx.couponRedemption.findUnique({ where: { orderId }, select: { id: true, couponId: true } })
  if (!redemption) return false
  const removed = await tx.couponRedemption.deleteMany({ where: { id: redemption.id } })
  if (removed.count !== 1) return false // a parallel release already did it
  await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${redemption.couponId}`
  return true
}

/** releaseCouponForOrder in its own transaction, for callers that are not inside one. */
export async function releaseCouponForOrderId(orderId: string): Promise<boolean> {
  return db.$transaction((tx) => releaseCouponForOrder(tx, orderId))
}

/** Creates a coupon with a fresh unique code (retries on the rare collision). */
export async function createCouponWithUniqueCode(
  data: Omit<Prisma.CouponUncheckedCreateInput, 'code'>,
  prefix = 'PB',
  client: Prisma.TransactionClient | typeof db = db
): Promise<Coupon> {
  for (let i = 0; i < 8; i++) {
    const code = generateCode(prefix)
    const clash = await client.coupon.findUnique({ where: { code }, select: { id: true } })
    if (clash) continue
    try {
      return await client.coupon.create({ data: { ...data, code } })
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') continue
      throw err
    }
  }
  throw new Error('could not generate a unique coupon code')
}
