import 'server-only'
import { db } from '@/lib/db'
import { releaseCouponForOrderId } from '@/lib/marketing/coupons'
import { releaseOrderStock } from '@/lib/shop/orders'

/** An unpaid online order that holds a discount code is given up after this long. */
export const UNPAID_COUPON_HOLD_MS = 2 * 3600_000

/**
 * Abandoned bank pages must not eat limited coupons (first 100 buyers, one-time welcome codes).
 * Cancels unpaid online orders that hold a coupon and are older than the hold window, giving the
 * coupon use and the stock back. Conditional updates make it safe to run from any request, in parallel.
 * A customer who pays after this still gets flagged for review by the payment callback.
 */
export async function expireStaleUnpaidCouponOrders(now = new Date(), limit = 25): Promise<number> {
  const stale = await db.order.findMany({
    where: {
      couponId: { not: null },
      paymentMethod: 'ONLINE',
      paidAt: null,
      status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] },
      createdAt: { lt: new Date(now.getTime() - UNPAID_COUPON_HOLD_MS) },
      payments: { none: { status: 'PAID' } },
    },
    select: { id: true },
    take: limit,
  })
  let done = 0
  for (const o of stale) {
    const res = await db.order.updateMany({
      where: { id: o.id, paidAt: null, status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] } },
      data: { status: 'CANCELLED' },
    })
    if (res.count !== 1) continue
    await releaseOrderStock(o.id)
    await releaseCouponForOrderId(o.id)
    done++
  }
  return done
}
