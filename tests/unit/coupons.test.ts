import { describe, it, expect, vi } from 'vitest'
import {
  COUPON_MESSAGES,
  computeAmounts,
  describeOffer,
  eligibleLines,
  evaluateRules,
  normalizeCode,
  randomCodePart,
  type CartLine,
  type CouponRecord,
  type CustomerFacts,
} from '@/lib/marketing/coupon-rules'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ db: {} }))

const NOW = new Date('2026-11-18T10:00:00Z')
const HOUR = 3_600_000

const line = (over: Partial<CartLine> = {}): CartLine => ({ productId: 'p1', categoryId: 'c1', brandId: 'b1', unitPrice: 100_000, quantity: 1, ...over })
const sum = (lines: CartLine[]) => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

const coupon = (over: Partial<CouponRecord> = {}): CouponRecord => ({
  id: 'k1',
  code: 'TEST10',
  title: 'آزمون',
  type: 'PERCENT',
  value: 10,
  maxDiscount: null,
  minSubtotal: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  autoApply: false,
  usageLimit: null,
  usedCount: 0,
  perCustomerLimit: 1,
  firstOrderOnly: false,
  customerId: null,
  groupId: null,
  categoryIds: [],
  brandIds: [],
  productIds: [],
  source: 'manual',
  ...over,
})

const me = (over: Partial<CustomerFacts> = {}): CustomerFacts => ({ id: 'u1', completedOrders: 0, usedThisCoupon: 0, inGroup: false, contactMatch: false, ...over })

function run(c: CouponRecord, lines: CartLine[] = [line()], opts: { customer?: CustomerFacts | null; shippingFee?: number | null } = {}) {
  return evaluateRules(c, {
    now: NOW,
    lines,
    subtotal: sum(lines),
    shippingFee: opts.shippingFee === undefined ? 80_000 : opts.shippingFee,
    customer: opts.customer === undefined ? me() : opts.customer,
  })
}

describe('normalizeCode', () => {
  it('uppercases, trims and unifies separators', () => {
    expect(normalizeCode('  pb-7kq2-m9xd ')).toBe('PB-7KQ2-M9XD')
    expect(normalizeCode('pb 7kq2_m9xd')).toBe('PB-7KQ2-M9XD')
  })
  it('converts Persian and Arabic digits', () => {
    expect(normalizeCode('sale۱۲۳')).toBe('SALE123')
    expect(normalizeCode('sale١٢٣')).toBe('SALE123')
  })
  it('rejects empty, too short, too long and non-strings', () => {
    expect(normalizeCode('')).toBeNull()
    expect(normalizeCode('ab')).toBeNull()
    expect(normalizeCode('خوش')).toBeNull()
    expect(normalizeCode('A'.repeat(41))).toBeNull()
    expect(normalizeCode(null)).toBeNull()
    expect(normalizeCode(12345 as unknown)).toBeNull()
  })
  it('drops unsafe characters', () => {
    expect(normalizeCode("a'b;DROP--x")).toBe('ABDROP-X')
  })
})

describe('random code parts', () => {
  it('only uses the unambiguous alphabet', () => {
    const part = randomCodePart(500, (max) => Math.floor(Math.random() * max))
    expect(part).toMatch(/^[A-HJKMNP-Z2-9]+$/)
    expect(part).not.toMatch(/[01OIL]/)
  })
  it('generateCode has the PB-XXXX-XXXX shape', async () => {
    const { generateCode } = await import('@/lib/marketing/coupons')
    expect(generateCode()).toMatch(/^PB-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(generateCode('welcome')).toMatch(/^WELCOME-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(new Set(Array.from({ length: 200 }, () => generateCode())).size).toBe(200)
  })
})

describe('discount arithmetic', () => {
  it('percent floors to whole Toman', () => {
    const lines = [line({ unitPrice: 33_333, quantity: 1 })]
    expect(computeAmounts(coupon({ value: 10 }), lines, sum(lines), 0).discount).toBe(3_333)
  })
  it('percent is capped by maxDiscount', () => {
    const lines = [line({ unitPrice: 1_000_000 })]
    expect(computeAmounts(coupon({ value: 50, maxDiscount: 120_000 }), lines, sum(lines), 0).discount).toBe(120_000)
  })
  it('percent above 100 or negative is clamped', () => {
    const lines = [line()]
    expect(computeAmounts(coupon({ value: 250 }), lines, sum(lines), 0).discount).toBe(100_000)
    expect(computeAmounts(coupon({ value: -5 }), lines, sum(lines), 0).discount).toBe(0)
  })
  it('fixed never exceeds the cart', () => {
    const lines = [line({ unitPrice: 40_000 })]
    expect(computeAmounts(coupon({ type: 'FIXED', value: 90_000 }), lines, sum(lines), 0).discount).toBe(40_000)
    expect(computeAmounts(coupon({ type: 'FIXED', value: 15_000 }), lines, sum(lines), 0).discount).toBe(15_000)
  })
  it('free shipping waives the fee and no item discount', () => {
    const r = computeAmounts(coupon({ type: 'FREE_SHIPPING', value: 0 }), [line()], 100_000, 80_000)
    expect(r).toMatchObject({ discount: 0, shippingDiscount: 80_000 })
  })
  it('never exceeds the subtotal and is never negative', () => {
    const lines = [line({ unitPrice: 1_000 })]
    for (const type of ['PERCENT', 'FIXED'] as const) {
      const d = computeAmounts(coupon({ type, value: 999_999_999 }), lines, sum(lines), 0).discount
      expect(d).toBeLessThanOrEqual(1_000)
      expect(d).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('restricted products', () => {
  const lines = [
    line({ productId: 'a', categoryId: 'cat1', brandId: 'br1', unitPrice: 100_000, quantity: 2 }),
    line({ productId: 'b', categoryId: 'cat2', brandId: 'br2', unitPrice: 50_000, quantity: 1 }),
    line({ productId: 'c', categoryId: null, brandId: null, unitPrice: 10_000, quantity: 1 }),
  ]
  it('applies only to matching category lines', () => {
    const c = coupon({ value: 10, categoryIds: ['cat1'] })
    expect(eligibleLines(c, lines).map((l) => l.productId)).toEqual(['a'])
    expect(computeAmounts(c, lines, sum(lines), 0).discount).toBe(20_000)
  })
  it('matches by brand or product (union)', () => {
    const c = coupon({ value: 10, brandIds: ['br2'], productIds: ['c'] })
    expect(eligibleLines(c, lines).map((l) => l.productId)).toEqual(['b', 'c'])
    expect(computeAmounts(c, lines, sum(lines), 0).discount).toBe(6_000)
  })
  it('fixed is capped by the eligible subtotal, not the cart', () => {
    const c = coupon({ type: 'FIXED', value: 100_000, productIds: ['b'] })
    expect(computeAmounts(c, lines, sum(lines), 0).discount).toBe(50_000)
  })
  it('rejects a cart with no matching line', () => {
    const r = run(coupon({ categoryIds: ['nope'] }), lines)
    expect(r).toMatchObject({ ok: false, error: COUPON_MESSAGES.notForProducts })
  })
})

describe('evaluateRules errors', () => {
  it('inactive', () => expect(run(coupon({ isActive: false }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.inactive }))
  it('not started yet', () => expect(run(coupon({ startsAt: new Date(NOW.getTime() + HOUR) }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.notStarted }))
  it('expired (endsAt is exclusive)', () => {
    expect(run(coupon({ endsAt: new Date(NOW.getTime() - HOUR) }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.expired })
    expect(run(coupon({ endsAt: NOW }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.expired })
  })
  it('inside the window works', () => {
    expect(run(coupon({ startsAt: new Date(NOW.getTime() - HOUR), endsAt: new Date(NOW.getTime() + HOUR) })).ok).toBe(true)
  })
  it('total usage limit reached', () => {
    expect(run(coupon({ usageLimit: 100, usedCount: 100 }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.usageLimit })
    expect(run(coupon({ usageLimit: 100, usedCount: 99 })).ok).toBe(true)
  })
  it('per-customer limit', () => {
    expect(run(coupon({ perCustomerLimit: 1 }), [line()], { customer: me({ usedThisCoupon: 1 }) })).toMatchObject({ ok: false, error: COUPON_MESSAGES.perCustomer })
    expect(run(coupon({ perCustomerLimit: 3 }), [line()], { customer: me({ usedThisCoupon: 2 }) }).ok).toBe(true)
    expect(run(coupon({ perCustomerLimit: null }), [line()], { customer: me({ usedThisCoupon: 50 }) }).ok).toBe(true)
  })
  it('minimum cart names the amount', () => {
    const r = run(coupon({ minSubtotal: 500_000 }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('حداقل مبلغ خرید')
      expect(r.error).toContain('۵۰۰٬۰۰۰')
    }
  })
  it('first-order only', () => {
    expect(run(coupon({ firstOrderOnly: true }), [line()], { customer: me({ completedOrders: 2 }) })).toMatchObject({ ok: false, error: COUPON_MESSAGES.firstOrder })
    expect(run(coupon({ firstOrderOnly: true }), [line()], { customer: me({ completedOrders: 0 }) }).ok).toBe(true)
  })
  it('personal code belongs to one customer', () => {
    expect(run(coupon({ customerId: 'someone-else' }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.notForCustomer })
    expect(run(coupon({ customerId: 'u1' })).ok).toBe(true)
  })
  it('group code needs membership', () => {
    expect(run(coupon({ groupId: 'g1' }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.notForGroup })
    expect(run(coupon({ groupId: 'g1' }), [line()], { customer: me({ inGroup: true }) }).ok).toBe(true)
  })
  it('welcome coupon issued before sign-up needs the matching contact', () => {
    const w = coupon({ source: 'welcome', customerId: null, firstOrderOnly: true })
    expect(run(w, [line()], { customer: me({ contactMatch: false }) })).toMatchObject({ ok: false, error: COUPON_MESSAGES.notForCustomer })
    expect(run(w, [line()], { customer: me({ contactMatch: true }) }).ok).toBe(true)
  })
  it('guests are asked to sign in for customer-bound coupons', () => {
    for (const over of [{ customerId: 'u1' }, { groupId: 'g1' }, { firstOrderOnly: true }, { source: 'welcome' }]) {
      expect(run(coupon(over), [line()], { customer: null })).toMatchObject({ ok: false, error: 'برای استفاده از این کد وارد حساب شوید.' })
    }
  })
  it('guests may use a plain public coupon', () => {
    expect(run(coupon(), [line()], { customer: null }).ok).toBe(true)
  })
  it('free shipping when shipping is already free', () => {
    expect(run(coupon({ type: 'FREE_SHIPPING' }), [line()], { shippingFee: 0 })).toMatchObject({ ok: false, error: COUPON_MESSAGES.shippingAlreadyFree })
  })
  it('free shipping with unknown address is accepted with no saving yet', () => {
    expect(run(coupon({ type: 'FREE_SHIPPING' }), [line()], { shippingFee: null })).toMatchObject({ ok: true, discount: 0, shippingDiscount: 0 })
  })
  it('zero-value discount has no effect', () => {
    expect(run(coupon({ value: 0 }))).toMatchObject({ ok: false, error: COUPON_MESSAGES.noEffect })
  })
  it('checks run in a sensible order: expired beats customer rules', () => {
    expect(run(coupon({ endsAt: new Date(NOW.getTime() - HOUR), customerId: 'x' }), [line()], { customer: null })).toMatchObject({ error: COUPON_MESSAGES.expired })
  })
})

describe('evaluateRules success', () => {
  it('returns the discount and no shipping change for percent', () => {
    expect(run(coupon({ value: 15 }), [line({ unitPrice: 200_000 })])).toEqual({ ok: true, discount: 30_000, shippingDiscount: 0 })
  })
  it('free shipping returns the fee', () => {
    expect(run(coupon({ type: 'FREE_SHIPPING' }), [line()], { shippingFee: 150_000 })).toEqual({ ok: true, discount: 0, shippingDiscount: 150_000 })
  })
  it('describeOffer reads naturally', () => {
    expect(describeOffer({ type: 'PERCENT', value: 10, maxDiscount: null })).toBe('۱۰٪ تخفیف')
    expect(describeOffer({ type: 'PERCENT', value: 10, maxDiscount: 50_000 })).toContain('حداکثر')
    expect(describeOffer({ type: 'FREE_SHIPPING', value: 0, maxDiscount: null })).toBe('ارسال رایگان')
    expect(describeOffer({ type: 'FIXED', value: 200_000, maxDiscount: null })).toContain('تومان')
  })
})
