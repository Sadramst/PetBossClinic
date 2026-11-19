/**
 * Pure coupon rules (no database, no server-only): code format, the Persian error
 * messages and the discount arithmetic. lib/marketing/coupons.ts feeds these with data.
 * All amounts are whole Toman.
 */
import { formatPrice } from '@/lib/format/price'

export type CouponKind = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'

/** What the rules need to know about a coupon row. */
export interface CouponRecord {
  id: string
  code: string
  title: string
  type: CouponKind
  value: number
  maxDiscount: number | null
  minSubtotal: number
  startsAt: Date | null
  endsAt: Date | null
  isActive: boolean
  autoApply: boolean
  usageLimit: number | null
  usedCount: number
  perCustomerLimit: number | null
  firstOrderOnly: boolean
  customerId: string | null
  groupId: string | null
  categoryIds: string[]
  brandIds: string[]
  productIds: string[]
  source: string
}

export type CartLine = {
  productId: string
  categoryId: string | null
  brandId: string | null
  unitPrice: number
  quantity: number
}

/** Facts about the signed-in customer, looked up by the database layer. */
export interface CustomerFacts {
  id: string
  /** Paid/confirmed orders the customer already has (a first-order coupon needs 0). */
  completedOrders: number
  /** Live redemptions of THIS coupon by the customer. */
  usedThisCoupon: number
  inGroup: boolean
  /** True when the customer's phone/email belongs to the lead the welcome coupon was issued to. */
  contactMatch: boolean
}

export const COUPON_MESSAGES = {
  empty: 'کد تخفیف را وارد کنید.',
  unknown: 'این کد تخفیف معتبر نیست. املای آن را بررسی کنید.',
  inactive: 'این کد تخفیف غیرفعال است.',
  notStarted: 'این کد تخفیف هنوز فعال نشده است؛ زمان استفاده از آن فرا نرسیده.',
  expired: 'مهلت استفاده از این کد تخفیف به پایان رسیده است.',
  usageLimit: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.',
  perCustomer: 'شما پیش‌تر از این کد تخفیف استفاده کرده‌اید.',
  firstOrder: 'این کد فقط برای اولین خرید شما معتبر است.',
  needLogin: 'برای استفاده از این کد وارد حساب شوید.',
  notForCustomer: 'این کد تخفیف برای حساب شما صادر نشده است.',
  notForGroup: 'این کد تخفیف مخصوص گروهی از مشتریان است و برای حساب شما فعال نیست.',
  notForProducts: 'این کد تخفیف برای کالاهای سبد شما معتبر نیست.',
  noEffect: 'این کد تخفیف روی سبد شما تخفیفی ایجاد نمی‌کند.',
  shippingAlreadyFree: 'ارسال این سفارش از قبل رایگان است.',
  minSubtotal: (min: number) => `حداقل مبلغ خرید برای این کد ${formatPrice(min, 'fa')} است.`,
} as const

export type CouponErrorKey = Exclude<keyof typeof COUPON_MESSAGES, 'minSubtotal'> | 'minSubtotal'

/** Codes are stored UPPERCASE with A-Z, 0-9 and "-" only. Returns null when nothing usable is left. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const code = digits
    .trim()
    .toUpperCase()
    .replace(/[\s_‐-―−]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return code.length >= 3 && code.length <= 40 ? code : null
}

/** Unambiguous alphabet (no 0/O, 1/I/L) so codes survive being read out over the phone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function randomCodePart(length: number, random: (max: number) => number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)]
  return out
}

export interface RuleContext {
  now: Date
  lines: CartLine[]
  subtotal: number
  /** Shipping fee before any coupon; null when the address is not known yet. */
  shippingFee: number | null
  /** null = guest */
  customer: CustomerFacts | null
}

export type RuleResult =
  | { ok: true; discount: number; shippingDiscount: number }
  | { ok: false; error: string; key: CouponErrorKey }

const fail = (key: Exclude<CouponErrorKey, 'minSubtotal'>): RuleResult => ({ ok: false, error: COUPON_MESSAGES[key], key })

/** Lines the discount applies to (all lines when the coupon has no restriction). Union of category/brand/product rules. */
export function eligibleLines(coupon: Pick<CouponRecord, 'categoryIds' | 'brandIds' | 'productIds'>, lines: CartLine[]): CartLine[] {
  const restricted = coupon.categoryIds.length + coupon.brandIds.length + coupon.productIds.length > 0
  if (!restricted) return lines
  return lines.filter(
    (l) =>
      coupon.productIds.includes(l.productId) ||
      (l.categoryId !== null && coupon.categoryIds.includes(l.categoryId)) ||
      (l.brandId !== null && coupon.brandIds.includes(l.brandId))
  )
}

export function isRestricted(c: Pick<CouponRecord, 'categoryIds' | 'brandIds' | 'productIds'>): boolean {
  return c.categoryIds.length + c.brandIds.length + c.productIds.length > 0
}

/** Time/state checks that need no customer knowledge. */
export function checkAvailability(c: CouponRecord, now: Date): RuleResult | null {
  if (!c.isActive) return fail('inactive')
  if (c.startsAt && c.startsAt.getTime() > now.getTime()) return fail('notStarted')
  if (c.endsAt && c.endsAt.getTime() <= now.getTime()) return fail('expired')
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return fail('usageLimit')
  return null
}

/** The amount arithmetic only. Never negative, never above the subtotal. */
export function computeAmounts(
  c: Pick<CouponRecord, 'type' | 'value' | 'maxDiscount' | 'categoryIds' | 'brandIds' | 'productIds'>,
  lines: CartLine[],
  subtotal: number,
  shippingFee: number | null
): { discount: number; shippingDiscount: number; eligibleSubtotal: number } {
  const eligible = eligibleLines(c, lines)
  const eligibleSubtotal = eligible.reduce((s, l) => s + Math.max(0, l.unitPrice) * Math.max(0, l.quantity), 0)
  let discount = 0
  let shippingDiscount = 0
  if (c.type === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, c.value))
    discount = Math.floor((eligibleSubtotal * pct) / 100)
    if (c.maxDiscount !== null && c.maxDiscount >= 0) discount = Math.min(discount, c.maxDiscount)
  } else if (c.type === 'FIXED') {
    discount = Math.min(Math.max(0, c.value), eligibleSubtotal)
  } else {
    shippingDiscount = Math.max(0, shippingFee ?? 0)
  }
  discount = Math.max(0, Math.min(Math.floor(discount), Math.max(0, subtotal)))
  return { discount, shippingDiscount, eligibleSubtotal }
}

/** Full rule check for one coupon. */
export function evaluateRules(c: CouponRecord, ctx: RuleContext): RuleResult {
  const unavailable = checkAvailability(c, ctx.now)
  if (unavailable) return unavailable

  const needsCustomer = c.customerId !== null || c.groupId !== null || c.firstOrderOnly || c.source === 'welcome'
  if (needsCustomer && !ctx.customer) return fail('needLogin')

  if (ctx.customer) {
    const me = ctx.customer
    if (c.customerId !== null && c.customerId !== me.id) return fail('notForCustomer')
    if (c.customerId === null && c.source === 'welcome' && !me.contactMatch) return fail('notForCustomer')
    if (c.groupId !== null && !me.inGroup) return fail('notForGroup')
    if (c.firstOrderOnly && me.completedOrders > 0) return fail('firstOrder')
    if (c.perCustomerLimit !== null && me.usedThisCoupon >= c.perCustomerLimit) return fail('perCustomer')
  }

  if (c.minSubtotal > 0 && ctx.subtotal < c.minSubtotal) {
    return { ok: false, error: COUPON_MESSAGES.minSubtotal(c.minSubtotal), key: 'minSubtotal' }
  }

  const eligible = eligibleLines(c, ctx.lines)
  if (isRestricted(c) && eligible.length === 0) return fail('notForProducts')

  if (c.type === 'FREE_SHIPPING' && ctx.shippingFee !== null && ctx.shippingFee <= 0) return fail('shippingAlreadyFree')

  const amounts = computeAmounts(c, ctx.lines, ctx.subtotal, ctx.shippingFee)
  // Free shipping with an unknown fee is accepted: the saving appears once the address is known.
  const hasEffect = c.type === 'FREE_SHIPPING' ? ctx.shippingFee === null || amounts.shippingDiscount > 0 : amounts.discount > 0
  if (!hasEffect) return fail('noEffect')
  return { ok: true, discount: amounts.discount, shippingDiscount: amounts.shippingDiscount }
}

/** Short Persian description of the offer, e.g. «۱۰٪ تخفیف (تا ۵۰٬۰۰۰ تومان)». */
export function describeOffer(c: Pick<CouponRecord, 'type' | 'value' | 'maxDiscount'>): string {
  if (c.type === 'FREE_SHIPPING') return 'ارسال رایگان'
  if (c.type === 'FIXED') return `${formatPrice(c.value, 'fa')} تخفیف`
  const cap = c.maxDiscount ? ` (حداکثر ${formatPrice(c.maxDiscount, 'fa')})` : ''
  return `${c.value.toLocaleString('fa-IR')}٪ تخفیف${cap}`
}

export function successMessage(c: Pick<CouponRecord, 'title' | 'type'>, discount: number, shippingDiscount: number): string {
  const saved = discount + shippingDiscount
  if (c.type === 'FREE_SHIPPING') {
    return shippingDiscount > 0 ? `«${c.title}» اعمال شد؛ هزینه ارسال رایگان شد.` : `«${c.title}» اعمال شد؛ ارسال این سفارش رایگان می‌شود.`
  }
  return `«${c.title}» اعمال شد؛ ${formatPrice(saved, 'fa')} صرفه‌جویی کردید.`
}
