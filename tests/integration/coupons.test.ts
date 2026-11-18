/**
 * Coupons against a real PostgreSQL database (skipped unless DATABASE_URL is local).
 * Covers the last-slot race, per-customer race, redeem/release idempotency, welcome-code
 * uniqueness per identity, group/personal restrictions and a real checkout with a coupon.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '10.9.8.7', host: 'localhost:3000' }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))
let currentCustomerId: string | null = null
vi.mock('@/lib/customer/session', () => ({
  getCustomer: async () => {
    if (!currentCustomerId) return null
    const { db } = await import('@/lib/db')
    return db.customer.findUnique({ where: { id: currentCustomerId } })
  },
}))
vi.mock('@/lib/payments/zarinpal', () => ({
  zarinpalConfigured: () => false,
  requestPayment: vi.fn(),
  startPayUrl: vi.fn(),
}))

const hasDb = isLocalDatabaseUrl(process.env.DATABASE_URL)
const d = hasDb ? describe : describe.skip
const tag = `cpn${Date.now().toString(36)}`

d('coupons (real database)', () => {
  let db: typeof import('@/lib/db').db
  const ids = { customers: [] as string[], coupons: [] as string[], orders: [] as string[], groups: [] as string[], contacts: [] as string[] }
  let categoryId = ''
  let productId = ''
  let addressId = ''
  let seq = 0

  const newCustomer = async (over: { email?: string } = {}) => {
    seq++
    const c = await db.customer.create({ data: { phone: `0938${String(Date.now() + seq).slice(-7)}`, firstName: 'آزمون', lastName: 'کوپن', ...over } })
    ids.customers.push(c.id)
    return c
  }
  const newCoupon = async (over: Record<string, unknown> = {}) => {
    seq++
    const c = await db.coupon.create({
      data: { code: `${tag}-${seq}`.toUpperCase(), title: 'آزمون', type: 'PERCENT', value: 10, ...over } as never,
    })
    ids.coupons.push(c.id)
    return c
  }
  const bareOrder = async (customerId: string, status: 'CONFIRMED' | 'PENDING_PAYMENT' = 'PENDING_PAYMENT') => {
    seq++
    const o = await db.order.create({
      data: {
        number: `TEST-${tag}-${seq}`,
        customerId,
        status,
        paymentMethod: 'COD',
        subtotal: 100_000,
        shippingFee: 0,
        total: 100_000,
        shipName: 'x',
        shipPhone: '09120000000',
        shipProvince: 'تهران',
        shipCity: 'تهران',
        shipAddress: 'x',
        shipPostal: '1938973111',
      },
    })
    ids.orders.push(o.id)
    return o
  }
  const redeem = async (couponId: string, customerId: string, orderId: string) => {
    const { redeemCoupon } = await import('@/lib/marketing/coupons')
    return db.$transaction((tx) => redeemCoupon(tx, { couponId, customerId, orderId, amount: 1000 }))
  }

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    const cat = await db.productCategory.create({ data: { slugFa: `${tag}-cat`, nameFa: 'دسته آزمون کوپن' } })
    categoryId = cat.id
    const p = await db.product.create({
      data: { categoryId, slugFa: `${tag}-p`, nameFa: 'کالای کوپن', price: 500_000, stockStatus: 'IN_STOCK', isPurchasable: true },
    })
    productId = p.id
    await db.inventory.create({ data: { productId, quantity: 50, expiryDate: new Date(Date.now() + 300 * 86400000) } })
  })

  afterAll(async () => {
    await db.order.deleteMany({ where: { id: { in: ids.orders } } })
    await db.order.deleteMany({ where: { customerId: { in: ids.customers } } })
    const leadWhere = { OR: [{ id: { in: ids.contacts } }, { phone: { in: phones } }, { email: { endsWith: `@${tag}.test` } }] }
    const leadCoupons = (await db.marketingContact.findMany({ where: leadWhere, select: { welcomeCouponId: true } })).flatMap((c) => (c.welcomeCouponId ? [c.welcomeCouponId] : []))
    ids.coupons.push(...leadCoupons)
    await db.marketingContact.deleteMany({ where: { OR: [{ id: { in: ids.contacts } }, { phone: { in: phones } }, { email: { endsWith: `@${tag}.test` } }] } })
    await db.coupon.deleteMany({ where: { OR: [{ id: { in: ids.coupons } }, { code: { startsWith: tag.toUpperCase() } }, { source: 'welcome', title: { contains: tag } }] } })
    await db.customerGroup.deleteMany({ where: { id: { in: ids.groups } } })
    await db.address.deleteMany({ where: { customerId: { in: ids.customers } } })
    await db.customer.deleteMany({ where: { id: { in: ids.customers } } })
    await db.product.delete({ where: { id: productId } }).catch(() => {})
    await db.productCategory.delete({ where: { id: categoryId } }).catch(() => {})
    await db.$disconnect()
  })
  const phones: string[] = []

  it('last slot: only one of many parallel redeemers wins', async () => {
    const coupon = await newCoupon({ usageLimit: 1, perCustomerLimit: null })
    const people = await Promise.all(Array.from({ length: 6 }, () => newCustomer()))
    const orders = await Promise.all(people.map((p) => bareOrder(p.id)))
    const results = await Promise.allSettled(people.map((p, i) => redeem(coupon.id, p.id, orders[i].id)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(failures).toHaveLength(5)
    for (const f of failures) expect(f.reason).toMatchObject({ name: 'CouponError', code: 'usageLimit' })
    const fresh = await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })
    expect(fresh.usedCount).toBe(1)
    expect(await db.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(1)
  })

  it('usage limit of N lets exactly N through', async () => {
    const coupon = await newCoupon({ usageLimit: 3, perCustomerLimit: null })
    const people = await Promise.all(Array.from({ length: 8 }, () => newCustomer()))
    const orders = await Promise.all(people.map((p) => bareOrder(p.id)))
    const results = await Promise.allSettled(people.map((p, i) => redeem(coupon.id, p.id, orders[i].id)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(3)
  })

  it('per-customer limit holds when one customer fires parallel orders', async () => {
    const coupon = await newCoupon({ perCustomerLimit: 1 })
    const me = await newCustomer()
    const orders = await Promise.all(Array.from({ length: 5 }, () => bareOrder(me.id)))
    const results = await Promise.allSettled(orders.map((o) => redeem(coupon.id, me.id, o.id)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await db.couponRedemption.count({ where: { couponId: coupon.id, customerId: me.id } })).toBe(1)
    expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
  })

  it('release gives the use back, is idempotent, and the code works again', async () => {
    const { releaseCouponForOrder } = await import('@/lib/marketing/coupons')
    const coupon = await newCoupon({ usageLimit: 1, perCustomerLimit: 1 })
    const me = await newCustomer()
    const order = await bareOrder(me.id)
    await redeem(coupon.id, me.id, order.id)
    expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)

    const released = await Promise.all([1, 2, 3].map(() => db.$transaction((tx) => releaseCouponForOrder(tx, order.id))))
    expect(released.filter(Boolean)).toHaveLength(1)
    expect(await db.$transaction((tx) => releaseCouponForOrder(tx, order.id))).toBe(false)
    const fresh = await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })
    expect(fresh.usedCount).toBe(0)

    const again = await bareOrder(me.id)
    await expect(redeem(coupon.id, me.id, again.id)).resolves.toBeUndefined()
  })

  it('refuses inactive, expired and foreign personal codes at redeem time', async () => {
    const me = await newCustomer()
    const other = await newCustomer()
    const inactive = await newCoupon({ isActive: false })
    const expired = await newCoupon({ endsAt: new Date(Date.now() - 1000) })
    const personal = await newCoupon({ customerId: other.id })
    for (const c of [inactive, expired, personal]) {
      const o = await bareOrder(me.id)
      await expect(redeem(c.id, me.id, o.id)).rejects.toMatchObject({ name: 'CouponError' })
    }
  })

  it('first-order coupon is refused for a customer with a completed order', async () => {
    const coupon = await newCoupon({ firstOrderOnly: true })
    const buyer = await newCustomer()
    await bareOrder(buyer.id, 'CONFIRMED')
    const o = await bareOrder(buyer.id)
    await expect(redeem(coupon.id, buyer.id, o.id)).rejects.toMatchObject({ code: 'firstOrder' })
    const fresh = await newCustomer()
    const o2 = await bareOrder(fresh.id)
    await expect(redeem(coupon.id, fresh.id, o2.id)).resolves.toBeUndefined()
  })

  it('evaluateCoupon: group and personal restrictions', async () => {
    const { evaluateCoupon } = await import('@/lib/marketing/coupons')
    const member = await newCustomer()
    const outsider = await newCustomer()
    const group = await db.customerGroup.create({ data: { name: `${tag}-vip` } })
    ids.groups.push(group.id)
    await db.customerGroupMember.create({ data: { groupId: group.id, customerId: member.id } })
    const groupCoupon = await newCoupon({ groupId: group.id, perCustomerLimit: null })
    const personal = await newCoupon({ customerId: member.id })
    const lines = [{ productId, categoryId, brandId: null, unitPrice: 500_000, quantity: 2 }]
    const base = { lines, subtotal: 1_000_000, shippingFee: 0 }

    expect(await evaluateCoupon({ ...base, code: groupCoupon.code, customerId: member.id })).toMatchObject({ ok: true, discount: 100_000 })
    expect(await evaluateCoupon({ ...base, code: groupCoupon.code, customerId: outsider.id })).toMatchObject({ ok: false, error: expect.stringContaining('گروه') })
    expect(await evaluateCoupon({ ...base, code: groupCoupon.code, customerId: null })).toMatchObject({ ok: false, error: 'برای استفاده از این کد وارد حساب شوید.' })
    expect(await evaluateCoupon({ ...base, code: personal.code, customerId: outsider.id })).toMatchObject({ ok: false })
    expect(await evaluateCoupon({ ...base, code: personal.code.toLowerCase(), customerId: member.id })).toMatchObject({ ok: true })
    expect(await evaluateCoupon({ ...base, code: 'NOPE-NOPE', customerId: member.id })).toMatchObject({ ok: false })
  })

  it('evaluateCoupon: auto-apply picks the biggest saving', async () => {
    const { evaluateCoupon } = await import('@/lib/marketing/coupons')
    // Isolate: deactivate any pre-existing auto coupons for this test's duration.
    const pre = await db.coupon.findMany({ where: { autoApply: true, isActive: true }, select: { id: true } })
    await db.coupon.updateMany({ where: { id: { in: pre.map((c) => c.id) } }, data: { isActive: false } })
    try {
      await newCoupon({ autoApply: true, value: 5, title: 'کم' })
      const big = await newCoupon({ autoApply: true, type: 'FIXED', value: 90_000, title: 'بزرگ' })
      await newCoupon({ autoApply: true, value: 50, minSubtotal: 99_000_000, title: 'کمینه بالا' })
      const res = await evaluateCoupon({
        lines: [{ productId, categoryId, brandId: null, unitPrice: 500_000, quantity: 1 }],
        subtotal: 500_000,
        shippingFee: 80_000,
        customerId: null,
      })
      expect(res).toMatchObject({ ok: true, auto: true, discount: 90_000 })
      if (res.ok) expect(res.coupon.id).toBe(big.id)
    } finally {
      await db.coupon.updateMany({ where: { id: { in: pre.map((c) => c.id) } }, data: { isActive: true } })
    }
  })

  describe('welcome coupons', () => {
    it('same identity always gets the same code; parallel submits create one coupon', async () => {
      const { captureContact } = await import('@/lib/marketing/contacts')
      const phone = `0939${String(Date.now()).slice(-7)}`
      phones.push(phone)
      const results = await Promise.all(Array.from({ length: 5 }, () => captureContact({ phone, source: 'popup' })))
      const codes = new Set(results.map((r) => (r.ok ? r.code : 'ERR')))
      expect(codes.size).toBe(1)
      expect([...codes][0]).toMatch(/^WELCOME-/)
      expect(results.filter((r) => r.ok && !r.alreadyHad).length).toBeGreaterThanOrEqual(1)
      const again = await captureContact({ phone: `+98${phone.slice(1)}`, source: 'footer' })
      expect(again).toMatchObject({ ok: true, alreadyHad: true, code: [...codes][0] })
      expect(await db.marketingContact.count({ where: { phone } })).toBe(1)
      const coupon = await db.coupon.findUniqueOrThrow({ where: { code: [...codes][0] } })
      ids.coupons.push(coupon.id)
      expect(coupon).toMatchObject({ source: 'welcome', usageLimit: 1, perCustomerLimit: 1, firstOrderOnly: true, type: 'PERCENT', value: 10 })
      expect(coupon.endsAt!.getTime()).toBeGreaterThan(Date.now() + 13 * 86400000)
    })

    it('email identity works, is case-insensitive and validated', async () => {
      const { captureContact } = await import('@/lib/marketing/contacts')
      const email = `Lead.${Date.now()}@${tag}.test`
      const a = await captureContact({ email, source: 'popup' })
      const b = await captureContact({ email: email.toUpperCase(), source: 'footer' })
      expect(a.ok && b.ok && a.code === b.code).toBe(true)
      expect(await captureContact({ email: 'not-an-email', source: 'popup' })).toMatchObject({ ok: false })
      expect(await captureContact({ phone: '123', source: 'popup' })).toMatchObject({ ok: false })
      expect(await captureContact({ source: 'popup' })).toMatchObject({ ok: false })
    })

    it('the lead can use the code after signing up, a stranger cannot, and it is one-shot', async () => {
      const { captureContact } = await import('@/lib/marketing/contacts')
      const { evaluateCoupon } = await import('@/lib/marketing/coupons')
      const phone = `0935${String(Date.now()).slice(-7)}`
      phones.push(phone)
      const lead = await captureContact({ phone, source: 'popup' })
      if (!lead.ok) throw new Error('capture failed')
      const coupon = await db.coupon.findUniqueOrThrow({ where: { code: lead.code } })
      ids.coupons.push(coupon.id)
      const lines = [{ productId, categoryId, brandId: null, unitPrice: 500_000, quantity: 1 }]
      const base = { code: lead.code, lines, subtotal: 500_000, shippingFee: 80_000 }

      expect(await evaluateCoupon({ ...base, customerId: null })).toMatchObject({ ok: false, error: 'برای استفاده از این کد وارد حساب شوید.' })
      const stranger = await newCustomer()
      expect(await evaluateCoupon({ ...base, customerId: stranger.id })).toMatchObject({ ok: false })

      // Sign-up with the same phone afterwards.
      const owner = await db.customer.create({ data: { phone } })
      ids.customers.push(owner.id)
      expect(await evaluateCoupon({ ...base, customerId: owner.id })).toMatchObject({ ok: true, discount: 50_000 })
      const linked = await captureContact({ phone, source: 'signup', customerId: owner.id })
      expect(linked).toMatchObject({ ok: true, code: lead.code, alreadyHad: true })
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).customerId).toBe(owner.id)
      expect(await evaluateCoupon({ ...base, customerId: stranger.id })).toMatchObject({ ok: false })

      const o = await bareOrder(owner.id)
      await redeem(coupon.id, owner.id, o.id)
      expect(await evaluateCoupon({ ...base, customerId: owner.id })).toMatchObject({ ok: false })
    })
  })

  describe('coupon life cycle and identity', () => {
    it('reinstate re-counts a released use once, and the stale-unpaid sweep gives it back', async () => {
      const { releaseCouponForOrderId, reinstateCouponForOrderId } = await import('@/lib/marketing/coupons')
      const { expireStaleUnpaidCouponOrders } = await import('@/lib/marketing/expiry')
      const me = await newCustomer()
      const coupon = await newCoupon({ usageLimit: 1 })
      const o = await bareOrder(me.id)
      await db.order.update({ where: { id: o.id }, data: { couponId: coupon.id, paymentMethod: 'ONLINE', createdAt: new Date(Date.now() - 3 * 3600_000) } })
      await redeem(coupon.id, me.id, o.id)
      expect(await releaseCouponForOrderId(o.id)).toBe(true)
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0)
      expect(await reinstateCouponForOrderId(o.id)).toBe(true)
      expect(await reinstateCouponForOrderId(o.id)).toBe(false)
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
      await expireStaleUnpaidCouponOrders()
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0)
      expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('CANCELLED')
    })

    it('an email-only lead coupon is never handed to a signup that merely claims that email', async () => {
      const { captureContact } = await import('@/lib/marketing/contacts')
      const { evaluateCoupon } = await import('@/lib/marketing/coupons')
      const email = `victim.${Date.now()}@${tag}.test`
      const lead = await captureContact({ email, source: 'popup' })
      if (!lead.ok) throw new Error('capture failed')
      const coupon = await db.coupon.findUniqueOrThrow({ where: { code: lead.code } })
      ids.coupons.push(coupon.id)
      const attacker = await newCustomer()
      await captureContact({ email, phone: attacker.phone, source: 'signup', customerId: attacker.id })
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).customerId).toBeNull()
      const lines = [{ productId, categoryId, brandId: null, unitPrice: 500_000, quantity: 1 }]
      expect(await evaluateCoupon({ code: lead.code, lines, subtotal: 500_000, shippingFee: 0, customerId: attacker.id })).toMatchObject({ ok: false })
    })

    it('plus-tags and gmail dots do not mint extra welcome codes', async () => {
      const { captureContact } = await import('@/lib/marketing/contacts')
      const base = `farm${Date.now()}`
      const a = await captureContact({ email: `${base}@gmail.com`, source: 'popup' })
      const b = await captureContact({ email: `${base.slice(0, 4)}.${base.slice(4)}+x1@gmail.com`, source: 'popup' })
      if (!a.ok || !b.ok) throw new Error('capture failed')
      ids.coupons.push(a.couponId!)
      expect(b.code).toBe(a.code)
    })
  })

  describe('real checkout path', () => {
    const items = () => [{ productId, quantity: 2 }]
    const key = () => `${tag}${Math.random().toString(36).slice(2)}0123456789`.slice(0, 40)

    it('places an order with a coupon, stores totals, and cancelling releases the use', async () => {
      const { placeOrderAction, cancelOrderAction, quoteAction } = await import('@/app/actions/checkout')
      const me = await newCustomer()
      const addr = await db.address.create({
        data: { customerId: me.id, title: 'خانه', recipientName: 'آزمون', recipientPhone: me.phone, province: 'تهران', city: 'تهران', addressLine: 'خیابان آزمون', postalCode: '1938973111' },
      })
      addressId = addr.id
      const coupon = await newCoupon({ value: 20, maxDiscount: 150_000, usageLimit: 5 })
      currentCustomerId = me.id

      const quote = await quoteAction(items(), 'تهران', 'تهران', coupon.code)
      // 2 x 500,000 = 1,000,000; 20% = 200,000 capped at 150,000; Tehran courier fee 80,000.
      expect(quote).toMatchObject({ subtotal: 1_000_000, discount: 150_000, shippingFee: 80_000, total: 930_000, couponError: null })
      expect(quote.coupon?.code).toBe(coupon.code)

      const res = await placeOrderAction({ items: items(), addressId, paymentMethod: 'COD', couponCode: coupon.code.toLowerCase(), idempotencyKey: key() })
      expect(res.error).toBeUndefined()
      expect(res.redirectTo).toContain('/account/orders/')
      const order = await db.order.findFirstOrThrow({ where: { customerId: me.id }, include: { items: true } })
      ids.orders.push(order.id)
      expect(order).toMatchObject({ subtotal: 1_000_000, discount: 150_000, shippingFee: 80_000, shippingDiscount: 0, total: 930_000, couponCode: coupon.code, couponId: coupon.id })
      expect(order.total).toBe(order.subtotal - order.discount + order.shippingFee)
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
      const redemption = await db.couponRedemption.findUniqueOrThrow({ where: { orderId: order.id } })
      expect(redemption.amount).toBe(150_000)

      // Same coupon again by the same customer: per-customer limit 1 -> clear error, no second order.
      const second = await placeOrderAction({ items: items(), addressId, paymentMethod: 'COD', couponCode: coupon.code, idempotencyKey: key() })
      expect(second.error).toContain('پیش‌تر')
      expect(await db.order.count({ where: { customerId: me.id } })).toBe(1)

      const cancelled = await cancelOrderAction(order.number)
      expect(cancelled.ok).toBe(true)
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0)
      expect(await db.couponRedemption.count({ where: { orderId: order.id } })).toBe(0)
      currentCustomerId = null
    })

    it('free-shipping coupon waives the fee and records it', async () => {
      const { placeOrderAction } = await import('@/app/actions/checkout')
      const me = await newCustomer()
      const addr = await db.address.create({
        data: { customerId: me.id, title: 'خانه', recipientName: 'آزمون', recipientPhone: me.phone, province: 'تهران', city: 'تهران', addressLine: 'خیابان آزمون', postalCode: '1938973111' },
      })
      const coupon = await newCoupon({ type: 'FREE_SHIPPING', value: 0 })
      currentCustomerId = me.id
      const res = await placeOrderAction({ items: [{ productId, quantity: 1 }], addressId: addr.id, paymentMethod: 'COD', couponCode: coupon.code, idempotencyKey: key() })
      expect(res.error).toBeUndefined()
      const order = await db.order.findFirstOrThrow({ where: { customerId: me.id } })
      ids.orders.push(order.id)
      expect(order).toMatchObject({ discount: 0, shippingFee: 0, shippingDiscount: 80_000, total: 500_000 })
      currentCustomerId = null
    })

    it('two customers racing for the last slot through the real checkout: one order, one clear error', async () => {
      const { placeOrderAction } = await import('@/app/actions/checkout')
      const coupon = await newCoupon({ usageLimit: 1, perCustomerLimit: null })
      const people = await Promise.all([newCustomer(), newCustomer()])
      const addrs = await Promise.all(
        people.map((p) =>
          db.address.create({
            data: { customerId: p.id, title: 'خانه', recipientName: 'آزمون', recipientPhone: p.phone, province: 'تهران', city: 'تهران', addressLine: 'خیابان آزمون', postalCode: '1938973111' },
          })
        )
      )
      // getCustomer is a module-level mock; run the two submits one after another but both before the slot frees.
      const outcomes: { error?: string; redirectTo?: string }[] = []
      for (let i = 0; i < 2; i++) {
        currentCustomerId = people[i].id
        outcomes.push(await placeOrderAction({ items: [{ productId, quantity: 1 }], addressId: addrs[i].id, paymentMethod: 'COD', couponCode: coupon.code, idempotencyKey: key() }))
      }
      currentCustomerId = null
      expect(outcomes.filter((o) => !o.error)).toHaveLength(1)
      expect(outcomes.find((o) => o.error)?.error).toContain('ظرفیت')
      const orders = await db.order.findMany({ where: { customerId: { in: people.map((p) => p.id) } } })
      ids.orders.push(...orders.map((o) => o.id))
      expect(orders).toHaveLength(1)
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
    })

    it('an invalid typed code blocks the order with an error and creates nothing', async () => {
      const { placeOrderAction } = await import('@/app/actions/checkout')
      const me = await newCustomer()
      const addr = await db.address.create({
        data: { customerId: me.id, title: 'خانه', recipientName: 'آزمون', recipientPhone: me.phone, province: 'تهران', city: 'تهران', addressLine: 'خیابان آزمون', postalCode: '1938973111' },
      })
      currentCustomerId = me.id
      const res = await placeOrderAction({ items: [{ productId, quantity: 1 }], addressId: addr.id, paymentMethod: 'COD', couponCode: 'NO-SUCH-CODE', idempotencyKey: key() })
      currentCustomerId = null
      expect(res.error).toBeTruthy()
      expect(await db.order.count({ where: { customerId: me.id } })).toBe(0)
    })
  })
})
