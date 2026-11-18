import { db } from '@/lib/db'
import { getLoyaltyConfig } from '@/lib/club/config'
import { awardPoints, orderPointsFor, reversePoints } from '@/lib/club/points'
import { attachReferral, creditReferralOnFirstOrder, ensureReferralCode, reverseReferralForOrder } from '@/lib/club/referrals'

/**
 * Automatic point hooks. None of them can break the flow that calls them: every hook catches,
 * logs the error name (no personal data) and returns.
 */
async function safely<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    console.error(`club hook ${label} failed`, (err as Error)?.name, (err as Error)?.message?.slice(0, 120))
    return null
  }
}

/** New customer: referral code, signup bonus, optional referral link. */
export async function onCustomerCreated(customerId: string, opts: { referralCode?: unknown; createdByAdmin?: boolean } = {}): Promise<void> {
  await safely('customerCreated', async () => {
    await ensureReferralCode(customerId)
    if (opts.createdByAdmin) return
    if (opts.referralCode) await attachReferral(customerId, opts.referralCode)
    const cfg = await getLoyaltyConfig()
    if (cfg.enabled && cfg.signupBonus > 0) {
      await awardPoints(db, { customerId, kind: 'SIGNUP', points: cfg.signupBonus, refType: 'customer', refId: customerId, note: 'هدیهٔ عضویت در باشگاه مشتریان' })
    }
  })
}

/**
 * Recomputes order counters from the orders themselves (so running it twice, or after a cancel,
 * always gives the right numbers). Only DELIVERED orders count.
 */
export async function recomputeOrderStats(customerId: string): Promise<void> {
  const [agg, last] = await Promise.all([
    db.order.aggregate({ where: { customerId, status: 'DELIVERED' }, _count: { _all: true }, _sum: { total: true } }),
    db.order.findFirst({ where: { customerId, status: 'DELIVERED' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])
  await db.customer.update({
    where: { id: customerId },
    data: { ordersCount: agg._count._all, totalSpent: agg._sum.total ?? 0, lastOrderAt: last?.createdAt ?? null },
  })
}

/**
 * An order can be delivered, cancelled and delivered again. Each delivery cycle gets its own
 * ledger reference (`<id>`, `<id>:1`, ...), so a re-delivery earns again after its reversal.
 */
async function orderCycleRef(customerId: string, orderId: string): Promise<string> {
  const reversals = await db.pointsTransaction.count({ where: { customerId, kind: 'REVERSAL', refId: { startsWith: `ORDER:${orderId}` } } })
  return reversals === 0 ? orderId : `${orderId}:${reversals}`
}

/** Order reached DELIVERED: points, counters, and the referral reward on the first one. */
export async function onOrderDelivered(orderId: string): Promise<void> {
  await safely('orderDelivered', async () => {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, customerId: true, subtotal: true, discount: true, status: true } })
    if (!order || order.status !== 'DELIVERED') return
    await recomputeOrderStats(order.customerId)
    const points = await orderPointsFor(db, order.customerId, Math.max(0, order.subtotal - order.discount))
    if (points > 0) {
      await awardPoints(db, { customerId: order.customerId, kind: 'ORDER', points, refType: 'order', refId: await orderCycleRef(order.customerId, order.id), note: `خرید سفارش ${order.number}` })
    }
    await creditReferralOnFirstOrder(db, order.customerId, order.id)
  })
}

/** An order that had been delivered was cancelled or reopened: take its points back. */
export async function onOrderUndelivered(orderId: string): Promise<void> {
  await safely('orderUndelivered', async () => {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, customerId: true } })
    if (!order) return
    await reversePoints(db, { customerId: order.customerId, kind: 'ORDER', refId: await orderCycleRef(order.customerId, order.id), note: `بازگشت امتیاز سفارش ${order.number}` })
    await reverseReferralForOrder(db, order.id)
    await recomputeOrderStats(order.customerId)
  })
}

export { safely as clubSafely }
