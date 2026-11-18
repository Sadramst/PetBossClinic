/**
 * Concurrency checks against a real PostgreSQL database (skipped without one).
 * These guard the fixes for double stock allocation and parallel OTP guessing.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))

const hasDb = isLocalDatabaseUrl(process.env.DATABASE_URL)
// Phones of the OTP rows this file creates; cleanup removes exactly these, never a number range.
const otpPhones: string[] = []
const d = hasDb ? describe : describe.skip

d('concurrency (real database)', () => {
  let db: typeof import('@/lib/db').db
  const created: { customer?: string; product?: string; category?: string } = {}

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    const cat = await db.productCategory.create({ data: { slugFa: `conc-${Date.now()}`, nameFa: 'آزمون همزمانی' } })
    created.category = cat.id
    const product = await db.product.create({
      data: { categoryId: cat.id, slugFa: `conc-product-${Date.now()}`, nameFa: 'کالای آزمون', price: 1000, stockStatus: 'IN_STOCK' },
    })
    created.product = product.id
    await db.inventory.create({ data: { productId: product.id, quantity: 3, expiryDate: new Date(Date.now() + 200 * 86400000) } })
    const customer = await db.customer.create({ data: { phone: `0936${String(Date.now()).slice(-7)}` } })
    created.customer = customer.id
  })

  afterAll(async () => {
    if (created.customer) {
      await db.order.deleteMany({ where: { customerId: created.customer } })
      await db.otpCode.deleteMany({ where: { phone: { in: otpPhones } } })
      await db.customer.delete({ where: { id: created.customer } })
    }
    if (created.product) await db.product.delete({ where: { id: created.product } })
    if (created.category) await db.productCategory.delete({ where: { id: created.category } })
    await db.$disconnect()
  })

  const makeOrder = (n: number, qty: number) =>
    db.order.create({
      data: {
        number: `TEST-${Date.now()}-${n}`,
        customerId: created.customer!,
        status: 'CONFIRMED',
        paymentMethod: 'COD',
        subtotal: 1000 * qty,
        shippingFee: 0,
        total: 1000 * qty,
        shipName: 'x',
        shipPhone: '09120000000',
        shipProvince: 'تهران',
        shipCity: 'تهران',
        shipAddress: 'x',
        shipPostal: '1938973111',
        items: { create: [{ productId: created.product!, nameFa: 'کالای آزمون', unitPrice: 1000, quantity: qty, lineTotal: 1000 * qty }] },
      },
    })

  it('allocates an order once even when called in parallel', async () => {
    const { allocateOrderStock } = await import('@/lib/shop/orders')
    const order = await makeOrder(1, 1)
    await Promise.all(Array.from({ length: 5 }, () => allocateOrderStock(order.id)))
    const batch = await db.inventory.findFirstOrThrow({ where: { productId: created.product! } })
    expect(batch.quantity).toBe(2)
  })

  it('never drives a batch below zero and flags the shortage', async () => {
    const { allocateOrderStock } = await import('@/lib/shop/orders')
    const a = await makeOrder(2, 2)
    const b = await makeOrder(3, 2)
    await Promise.all([allocateOrderStock(a.id), allocateOrderStock(b.id)])
    const batch = await db.inventory.findFirstOrThrow({ where: { productId: created.product! } })
    expect(batch.quantity).toBe(0)
    const notes = await db.order.findMany({ where: { id: { in: [a.id, b.id] } }, select: { adminNote: true } })
    expect(notes.filter((n) => n.adminNote?.includes('کسری')).length).toBe(1)
  })

  it('caps parallel OTP guesses at the attempt limit', async () => {
    const { issueOtp, verifyOtp, OTP_MAX_ATTEMPTS } = await import('@/lib/customer/otp')
    const phone = `0937${String(Date.now()).slice(-7)}`
    otpPhones.push(phone)
    const issued = await issueOtp(phone, null)
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const wrong = issued.code === '11111' ? '22222' : '11111'
    await Promise.all(Array.from({ length: 30 }, () => verifyOtp(phone, wrong)))
    const otp = await db.otpCode.findFirstOrThrow({ where: { phone } })
    expect(otp.attempts).toBe(OTP_MAX_ATTEMPTS)
    // Even the right code no longer works once the attempts are used up.
    expect(await verifyOtp(phone, issued.code)).toBe(false)
  })
})
