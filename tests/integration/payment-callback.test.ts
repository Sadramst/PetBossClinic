/**
 * The ZarinPal return page against a real PostgreSQL database (skipped without a local one):
 * the bank's answer is faked, everything else (payment/order state, stock) is real.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))

const verify = vi.fn()
vi.mock('@/lib/payments/zarinpal', () => ({ verifyPayment: (...args: unknown[]) => verify(...args) }))

const d = isLocalDatabaseUrl(process.env.DATABASE_URL) ? describe : describe.skip

d('ZarinPal callback (real database, faked bank)', () => {
  let db: typeof import('@/lib/db').db
  let GET: typeof import('@/app/api/payment/zarinpal/callback/route').GET
  const created = { customer: '', product: '', category: '' }
  let seq = 0

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    GET = (await import('@/app/api/payment/zarinpal/callback/route')).GET
    const cat = await db.productCategory.create({ data: { slugFa: `pay-${Date.now()}`, nameFa: 'آزمون پرداخت' } })
    created.category = cat.id
    created.product = (await db.product.create({ data: { categoryId: cat.id, slugFa: `pay-p-${Date.now()}`, nameFa: 'کالا', price: 1000, stockStatus: 'IN_STOCK' } })).id
    // Batch-tracked stock: 5 units, so a double allocation would be visible.
    await db.inventory.create({ data: { productId: created.product, quantity: 5, expiryDate: new Date(Date.now() + 200 * 86400000) } })
    created.customer = (await db.customer.create({ data: { phone: `0935${String(Date.now()).slice(-7)}` } })).id
  })

  afterEach(() => verify.mockReset())

  afterAll(async () => {
    await db.order.deleteMany({ where: { customerId: created.customer } })
    await db.customer.delete({ where: { id: created.customer } })
    await db.product.delete({ where: { id: created.product } })
    await db.productCategory.delete({ where: { id: created.category } })
    await db.$disconnect()
  })

  async function newOrderWithPayment() {
    const n = ++seq
    const authority = `A${Date.now()}${n}`
    const order = await db.order.create({
      data: {
        number: `TESTPAY-${Date.now()}-${n}`, customerId: created.customer, status: 'PENDING_PAYMENT', paymentMethod: 'ONLINE',
        subtotal: 2000, shippingFee: 0, total: 2000, shipName: 'x', shipPhone: '09120000000', shipProvince: 'تهران', shipCity: 'تهران',
        shipAddress: 'x', shipPostal: '1938973111',
        items: { create: [{ productId: created.product, nameFa: 'کالا', unitPrice: 1000, quantity: 2, lineTotal: 2000 }] },
        payments: { create: [{ provider: 'zarinpal', amountRial: 20000, authority }] },
      },
    })
    return { order, authority }
  }

  const callback = (authority: string, status = 'OK') =>
    GET(new NextRequest(`http://localhost/api/payment/zarinpal/callback?Authority=${authority}&Status=${status}`))
  const stock = async () => (await db.inventory.findFirstOrThrow({ where: { productId: created.product } })).quantity

  it('a bank outage leaves the payment pending: not failed, no stock taken, no second payment invited', async () => {
    const { order, authority } = await newOrderWithPayment()
    verify.mockResolvedValue({ ok: false, transient: true, raw: null })
    const before = await stock()

    const res = await callback(authority)
    expect(res.headers.get('location')).toContain('?payment=pending')
    const payment = await db.payment.findUniqueOrThrow({ where: { authority } })
    expect(payment.status).toBe('INITIATED')
    expect((payment.raw as { transientVerifyAt?: string }).transientVerifyAt).toBeTruthy()
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING_PAYMENT')
    expect(await stock()).toBe(before)

    // The customer re-checks later; the bank answers this time: now it is confirmed.
    verify.mockResolvedValue({ ok: true, refId: '123', cardPan: '6037**1234', raw: {} })
    expect((await callback(authority)).headers.get('location')).toContain('?payment=success')
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('CONFIRMED')
    expect(await stock()).toBe(before - 2)
  })

  it('a definite refusal marks the payment failed so the customer can pay again', async () => {
    const { order, authority } = await newOrderWithPayment()
    verify.mockResolvedValue({ ok: false, transient: false, raw: { errors: { code: -51 } } })
    expect((await callback(authority)).headers.get('location')).toContain('?payment=failed')
    expect((await db.payment.findUniqueOrThrow({ where: { authority } })).status).toBe('FAILED')
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAYMENT_FAILED')
  })

  it('the customer cancelling on the bank page fails the payment without asking the bank', async () => {
    const { authority } = await newOrderWithPayment()
    expect((await callback(authority, 'NOK')).headers.get('location')).toContain('?payment=failed')
    expect(verify).not.toHaveBeenCalled()
  })

  it('refreshing or replaying a successful return confirms once and takes stock once', async () => {
    const { order, authority } = await newOrderWithPayment()
    verify.mockResolvedValue({ ok: true, refId: '999', cardPan: null, raw: {} })
    const before = await stock()
    await Promise.all([callback(authority), callback(authority), callback(authority)])
    await callback(authority)
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('CONFIRMED')
    expect(await stock()).toBe(before - 2) // 2 units, once
    expect(await db.payment.count({ where: { authority, status: 'PAID' } })).toBe(1)
  })

  it('an unknown authority goes nowhere and verifies nothing', async () => {
    const res = await callback('does-not-exist')
    expect(res.headers.get('location')).toContain('/account')
    expect(verify).not.toHaveBeenCalled()
  })
})
