import 'server-only'
import { evaluateCoupon, COUPON_MESSAGES, type CartLine } from '@/lib/marketing/coupons'
import { COUPON_RATE_MESSAGE, couponGuessAllowed, recordCouponMiss } from '@/lib/marketing/guard'
import type { PricedLine } from '@/lib/shop/orders'

export interface AppliedCoupon {
  id: string
  code: string
  title: string
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'
  /** Found automatically (no code typed). */
  auto: boolean
}

export interface CouponPricing {
  coupon: AppliedCoupon | null
  discount: number
  shippingDiscount: number
  /** Why the typed code was refused (null when no code was typed or it was accepted). */
  error: string | null
  message: string | null
}

/** Only sellable lines count toward a coupon. */
export function toCouponLines(lines: PricedLine[]): CartLine[] {
  return lines
    .filter((l) => !l.problem)
    .map((l) => ({ productId: l.productId, categoryId: l.categoryId ?? null, brandId: l.brandId ?? null, unitPrice: l.unitPrice, quantity: l.quantity }))
}

const GUEST_VISIBLE = (message: string): boolean =>
  message === COUPON_MESSAGES.needLogin ||
  message === COUPON_MESSAGES.empty ||
  message === COUPON_MESSAGES.notForProducts ||
  message === COUPON_MESSAGES.noEffect ||
  message === COUPON_MESSAGES.shippingAlreadyFree ||
  message.startsWith('حداقل مبلغ خرید')

export const NO_COUPON: CouponPricing = { coupon: null, discount: 0, shippingDiscount: 0, error: null, message: null }

/**
 * The one place that decides which discount a cart gets, shared by the cart quote,
 * the coupon box and order placement so all three always agree.
 * A typed code wins over auto-apply; if the typed code fails, `error` says why and the
 * best auto-apply discount (if any) is still returned.
 */
export async function priceWithCoupon(args: {
  lines: PricedLine[]
  subtotal: number
  /** Shipping fee before the coupon; null when the address is not known yet. */
  shippingFee: number | null
  customerId: string | null
  code?: string | null
}): Promise<CouponPricing> {
  const couponLines = toCouponLines(args.lines)
  if (couponLines.length === 0 || args.subtotal <= 0) {
    const typed = args.code != null && args.code.trim() !== ''
    return { ...NO_COUPON, error: typed ? 'سبد خرید شما خالی است.' : null }
  }
  const base = { lines: couponLines, subtotal: args.subtotal, shippingFee: args.shippingFee, customerId: args.customerId }
  let error: string | null = null
  if (args.code != null && args.code.trim() !== '') {
    // Code guessing is throttled here, so the coupon box, the cart quote and order placement share one budget.
    if (!(await couponGuessAllowed(args.customerId))) return { ...NO_COUPON, error: COUPON_RATE_MESSAGE }
    const typed = await evaluateCoupon({ ...base, code: args.code })
    if (typed.ok) return toPricing(typed)
    await recordCouponMiss(args.customerId)
    // A guest must not be able to tell "exists but expired / used up / restricted" from "no such code".
    // Messages that help the shopper fix their cart (minimum, products) stay; they are throttled above.
    error = args.customerId === null && !GUEST_VISIBLE(typed.error) ? COUPON_MESSAGES.unknown : typed.error
  }
  const auto = await evaluateCoupon(base)
  if (auto.ok) return { ...toPricing(auto), error }
  return { ...NO_COUPON, error }
}

function toPricing(r: Extract<Awaited<ReturnType<typeof evaluateCoupon>>, { ok: true }>): CouponPricing {
  return {
    coupon: { id: r.coupon.id, code: r.coupon.code, title: r.coupon.title, type: r.coupon.type, auto: r.auto },
    discount: r.discount,
    shippingDiscount: r.shippingDiscount,
    error: null,
    message: r.message,
  }
}
