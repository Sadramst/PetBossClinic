'use server'

import { db } from '@/lib/db'
import { getCustomer } from '@/lib/customer/session'
import { sanitizeCartInput } from '@/lib/shop/cart-types'
import { priceCart } from '@/lib/shop/orders'
import { shippingFor } from '@/lib/shop/shipping'
import { COUPON_MESSAGES } from '@/lib/marketing/coupon-rules'
import { captureContact } from '@/lib/marketing/contacts'
import { getMarketingConfig } from '@/lib/marketing/config'
import { priceWithCoupon, type AppliedCoupon } from '@/lib/marketing/pricing'
import { describeOffer } from '@/lib/marketing/coupon-rules'
import { normalizeMobile } from '@/lib/text/iran'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { canonicalEmail } from '@/lib/customer/email'
import { clientIp } from '@/lib/marketing/guard'


export type ApplyCouponResult =
  | {
      ok: true
      discount: number
      shippingDiscount: number
      subtotal: number
      /** Shipping fee after the coupon (null when no address yet). */
      shippingFee: number | null
      total: number
      coupon: AppliedCoupon
      message: string
    }
  | { ok: false; error: string }

/** Validates a typed code against the cart (server-side prices). Nothing is reserved until the order is placed. */
export async function applyCouponAction(
  code: string,
  items: { productId: string; quantity: number }[],
  province?: string,
  city?: string
): Promise<ApplyCouponResult> {
  if (typeof code !== 'string' || code.trim() === '') return { ok: false, error: COUPON_MESSAGES.empty }
  const customer = await getCustomer()

  const clean = sanitizeCartInput(items)
  if (clean.length === 0) return { ok: false, error: 'سبد خرید خالی است.' }
  const priced = await priceCart(clean)
  const ship = province ? shippingFor(province, priced.subtotal, city) : null
  const deal = await priceWithCoupon({
    lines: priced.lines,
    subtotal: priced.subtotal,
    shippingFee: ship ? ship.fee : null,
    customerId: customer?.id ?? null,
    code,
  })
  if (deal.error) return { ok: false, error: deal.error }
  // priceWithCoupon falls back to an auto discount; this action is only about the typed code.
  if (!deal.coupon || deal.coupon.auto) return { ok: false, error: COUPON_MESSAGES.unknown }
  const shippingDiscount = ship ? Math.min(deal.shippingDiscount, ship.fee) : 0
  const fee = ship ? ship.fee - shippingDiscount : null
  return {
    ok: true,
    discount: deal.discount,
    shippingDiscount,
    subtotal: priced.subtotal,
    shippingFee: fee,
    total: priced.subtotal - deal.discount + (fee ?? 0),
    coupon: deal.coupon,
    message: deal.message ?? '',
  }
}

export type CaptureContactActionResult =
  | { ok: true; code: string; alreadyHad: boolean; message: string }
  | { ok: false; error: string }

/** Lead capture (popup, footer, checkout): stores the contact and returns their personal welcome code. */
export async function captureContactAction(input: {
  email?: string
  phone?: string
  name?: string
  source: string
}): Promise<CaptureContactActionResult> {
  const ip = await clientIp()
  if (!checkRateLimit(`capture:${ip}`, 8, 3600_000).allowed) {
    return { ok: false, error: 'درخواست‌های زیادی از این شبکه ثبت شده است. کمی بعد دوباره امتحان کنید.' }
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  const phone = str(input?.phone, 40)
  const email = str(input?.email, 160)
  // The same identity cannot be hammered either (guards against one victim being spammed from many networks).
  const identity = ((phone && normalizeMobile(phone)) || (email && canonicalEmail(email)) || (phone || email)).trim().toLowerCase()
  if (identity && !checkRateLimit(`capture-id:${identity}`, 5, 3600_000).allowed) {
    return { ok: false, error: 'برای این شماره یا ایمیل درخواست‌های زیادی ثبت شده است. کمی بعد دوباره امتحان کنید.' }
  }
  const customer = await getCustomer()
  const res = await captureContact({
    phone,
    email,
    name: str(input?.name, 80),
    source: str(input?.source, 20),
    // A signed-in customer capturing their own details links to their account.
    customerId: customer && phone && customer.phone === normalizeMobile(phone) ? customer.id : null,
  })
  if (!res.ok) return res
  // An anonymous submitter must not learn somebody else's existing code just by knowing their phone or email.
  if (res.alreadyHad && !(customer && res.code && (await ownsCode(customer.id, customer.phone, res.couponId)))) {
    return {
      ok: true,
      code: '',
      alreadyHad: true,
      message: 'برای این شماره یا ایمیل قبلاً کد تخفیف صادر شده است. با شماره موبایل خود وارد حساب شوید و آن را در بخش «کدهای تخفیف من» ببینید.',
    }
  }
  return { ok: true, code: res.code, alreadyHad: res.alreadyHad, message: res.message }
}

async function ownsCode(customerId: string, phone: string, couponId: string | null): Promise<boolean> {
  if (!couponId) return false
  const hit = await db.coupon.findFirst({
    where: { id: couponId, OR: [{ customerId }, { customerId: null, source: 'welcome' }] },
    select: { customerId: true },
  })
  if (!hit) return false
  if (hit.customerId === customerId) return true
  // Unbound welcome coupon: it is theirs only when their own phone is the contact's phone.
  return !!(await db.marketingContact.findFirst({ where: { welcomeCouponId: couponId, phone }, select: { id: true } }))
}

export interface PublicMarketing {
  popup: { enabled: boolean; title: string; text: string; delaySeconds: number }
  banner: { enabled: boolean; text: string; link: string | null; endsAt: string | null; couponCode: string | null } | null
  welcome: { label: string }
}

/** Safe-to-expose campaign settings for the storefront. */
export async function getPublicMarketingAction(): Promise<PublicMarketing> {
  const c = await getMarketingConfig()
  const live = c.bannerEnabled && !!c.bannerText && (!c.bannerEndsAt || c.bannerEndsAt.getTime() > Date.now())
  return {
    popup: { enabled: c.popupEnabled, title: c.popupTitle, text: c.popupText, delaySeconds: c.popupDelaySeconds },
    banner: live
      ? { enabled: true, text: c.bannerText!, link: c.bannerLink, endsAt: c.bannerEndsAt ? c.bannerEndsAt.toISOString() : null, couponCode: c.bannerCouponCode }
      : null,
    welcome: { label: describeOffer({ type: c.welcomeType, value: c.welcomeValue, maxDiscount: c.welcomeMaxDiscount }) },
  }
}
