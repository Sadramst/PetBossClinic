import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient, type CouponType } from '@prisma/client'

/**
 * Every discount type in the real cart and checkout UI, against the local database:
 * percent (with and without a cap), fixed (also bigger than the cart), free shipping,
 * minimum cart, expired / not started / inactive / unknown codes, code normalisation,
 * auto-apply, removing a coupon, persistence across reloads, restricted coupons and
 * identical totals in cart, checkout and the saved order.
 *
 * Isolation: both browser projects run this file at once, so every coupon, customer and
 * order is created per test with unique data and only those rows are removed afterwards.
 * Nothing here asserts a global count.
 */
const prisma = new PrismaClient()
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`
const fmt = (n: number) => `${n.toLocaleString('fa-IR')} تومان`
const toNum = (s: string) =>
  Number((s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).match(/[\d٬,]+/)?.[0] ?? '').replace(/[٬,]/g, ''))

const couponIds = new Set<string>()
const customerIds = new Set<string>()

function customerToken(customerId: string): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

type Prod = { id: string; slugFa: string; nameFa: string; price: number; categoryId: string; brandId: string | null }

/** Purchasable products without dated batches, so no stock is touched. */
async function pool(): Promise<Prod[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null, price: { gte: 100_000, lte: 1_200_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
    select: { id: true, slugFa: true, nameFa: true, price: true, categoryId: true, brandId: true },
    orderBy: { id: 'asc' },
    take: 60,
  })
  expect(rows.length).toBeGreaterThan(0)
  return rows as Prod[]
}

async function mkCoupon(data: { type: CouponType; value?: number; title?: string; code?: string; [k: string]: unknown }) {
  const { type, value, title, code, ...rest } = data
  const row = await prisma.coupon.create({
    data: {
      code: code ?? `PWC-${stamp()}`,
      title: title ?? `کمپین آزمون ${stamp()}`,
      type,
      value: value ?? 0,
      perCustomerLimit: null,
      ...rest,
    },
  })
  couponIds.add(row.id)
  return row
}

async function mkCustomer(prefix: '0937' | '0936' | '0934', withAddress?: { province: string; city: string }) {
  const phone = `${prefix}${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  const customer = await prisma.customer.create({ data: { phone, firstName: 'آزمون', lastName: 'تخفیف' } })
  customerIds.add(customer.id)
  if (withAddress) {
    await prisma.address.create({
      data: {
        customerId: customer.id,
        recipientName: 'آزمون تخفیف',
        recipientPhone: phone,
        province: withAddress.province,
        city: withAddress.city,
        addressLine: 'خیابان آزمون، کوچه تخفیف، پلاک ۱۲',
        postalCode: '1938973111',
        isDefault: true,
      },
    })
  }
  return customer
}

async function signIn(context: BrowserContext, baseURL: string | undefined, customerId: string) {
  await context.addCookies([{ name: 'pb_customer', value: customerToken(customerId), url: baseURL! }])
}

/** Puts products in the browser cart before the first page script runs (only when the cart is still unset). */
async function seedCart(page: Page, items: { p: Prod; qty: number }[]) {
  const lines = items.map(({ p, qty }) => ({ productId: p.id, quantity: qty, name: p.nameFa, slug: p.slugFa, price: p.price, image: '' }))
  await page.addInitScript((l) => {
    try {
      if (!localStorage.getItem('pb_cart_v1')) localStorage.setItem('pb_cart_v1', JSON.stringify(l))
    } catch {
      /* ignore */
    }
  }, lines)
}

async function applyCode(page: Page, code: string) {
  await page.getByTestId('coupon-input').fill(code)
  await page.getByTestId('coupon-apply').click()
}

test.describe('marketing C: discount types in cart and checkout', () => {
  // Each test is its own shopper: the coupon box limits code guessing per client address, and every test
  // browser would otherwise share localhost and exhaust that budget together.
  test.beforeEach(async ({ context }) => {
    const o = () => Math.floor(Math.random() * 250) + 1
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
  })

  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const cids = [...customerIds]
    const kids = [...couponIds]
    const orders = await prisma.order.findMany({
      where: { OR: [{ customerId: { in: cids } }, { couponId: { in: kids } }] },
      select: { id: true },
    })
    const oids = orders.map((o) => o.id)
    await prisma.couponRedemption.deleteMany({ where: { OR: [{ orderId: { in: oids } }, { couponId: { in: kids } }] } })
    await prisma.order.deleteMany({ where: { id: { in: oids } } })
    await prisma.coupon.deleteMany({ where: { id: { in: kids } } })
    await prisma.customer.deleteMany({ where: { id: { in: cids } } })
    await prisma.$disconnect()
  })

  test('C01 percent coupon takes the right share off the cart', async ({ page }) => {
    const [p] = await pool()
    const c = await mkCoupon({ type: 'PERCENT', value: 10, title: `ده درصد ${stamp()}` })
    await seedCart(page, [{ p, qty: 2 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    const subtotal = p.price * 2
    const off = Math.floor((subtotal * 10) / 100)

    await expect(page.getByTestId('cart-total')).toContainText(fmt(subtotal))
    await applyCode(page, c.code)
    await expect(page.getByTestId('coupon-applied')).toContainText(c.title)
    await expect(page.getByTestId('coupon-applied')).toContainText(c.code)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(off))
    await expect(page.getByTestId('cart-total')).toContainText(fmt(subtotal - off))
    await expect(page.getByTestId('shipping-discount-line')).toHaveCount(0)
  })

  test('C02 percent cap limits the saving, removing it then lets a fixed coupon apply', async ({ page }) => {
    const [p] = await pool()
    const capped = await mkCoupon({ type: 'PERCENT', value: 50, maxDiscount: 30_000 })
    const fixed = await mkCoupon({ type: 'FIXED', value: 25_000 })
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })

    await applyCode(page, capped.code)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(30_000)) // 50% would be far more
    await expect(page.getByTestId('cart-total')).toContainText(fmt(p.price - 30_000))

    await page.getByTestId('coupon-remove').click()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
    await expect(page.getByTestId('discount-line')).toHaveCount(0)
    await expect(page.getByTestId('cart-total')).toContainText(fmt(p.price))

    await applyCode(page, fixed.code)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(25_000))
    await expect(page.getByTestId('cart-total')).toContainText(fmt(p.price - 25_000))
  })

  test('C03 a fixed coupon bigger than the cart never goes below zero', async ({ page }) => {
    const [p] = await pool()
    const c = await mkCoupon({ type: 'FIXED', value: p.price + 500_000 })
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await applyCode(page, c.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    // The saving is capped at the cart value, so the goods cost nothing (price 0 renders as «تماس بگیرید»).
    await expect(page.getByTestId('discount-line')).toContainText(fmt(p.price))
    await expect(page.getByTestId('discount-line')).not.toContainText(fmt(p.price + 500_000))
    await expect(page.getByTestId('cart-total')).toContainText('تماس بگیرید')
  })

  test('C04 free-shipping coupon waives the post fee for a city outside Tehran', async ({ page, context, baseURL }) => {
    const [p] = await pool()
    const customer = await mkCustomer('0937', { province: 'اصفهان', city: 'اصفهان' })
    const c = await mkCoupon({ type: 'FREE_SHIPPING' })
    await signIn(context, baseURL, customer.id)
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveText('تکمیل خرید')

    // Before the code: shipping is charged by post and added to the total.
    await expect(page.getByText('پست پیشتاز').first()).toBeVisible()
    await expect(page.getByTestId('shipping-discount-line')).toHaveCount(0)
    const shipRow = page.locator('dl div').filter({ hasText: 'ارسال (' })
    await expect(shipRow).toContainText('تومان')
    const fee = toNum((await shipRow.innerText()).replace(/ارسال.*?\)/, ''))
    expect(fee).toBeGreaterThan(0)

    await applyCode(page, c.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    await expect(page.getByTestId('shipping-discount-line')).toContainText(fmt(fee))
    await expect(page.getByTestId('discount-line')).toHaveCount(0)
    await expect(shipRow).toContainText('رایگان')
    await expect(page.locator('dl div').filter({ hasText: 'مبلغ قابل پرداخت' })).toContainText(fmt(p.price))
  })

  test('C05 minimum cart: refused below it, accepted once the cart reaches it', async ({ page }) => {
    const [p] = await pool()
    const min = p.price * 2
    const c = await mkCoupon({ type: 'FIXED', value: 10_000, minSubtotal: min })
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })

    await applyCode(page, c.code)
    await expect(page.locator('#coupon-error')).toContainText('حداقل مبلغ خرید برای این کد')
    await expect(page.locator('#coupon-error')).toContainText(fmt(min))
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
    await expect(page.getByTestId('discount-line')).toHaveCount(0)

    // Two of the product reach the minimum.
    await page.evaluate(
      ([id]) => {
        const lines = JSON.parse(localStorage.getItem('pb_cart_v1') || '[]')
        for (const l of lines) if (l.productId === id) l.quantity = 2
        localStorage.setItem('pb_cart_v1', JSON.stringify(lines))
      },
      [p.id]
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('cart-total')).toContainText(fmt(min))
    await applyCode(page, c.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    await expect(page.getByTestId('cart-total')).toContainText(fmt(min - 10_000))
  })

  test('C06 expired, not started, inactive and unknown codes each get their own clear error', async ({ page }) => {
    const [p] = await pool()
    const now = Date.now()
    const expired = await mkCoupon({ type: 'PERCENT', value: 20, endsAt: new Date(now - 86_400_000), startsAt: new Date(now - 5 * 86_400_000) })
    const future = await mkCoupon({ type: 'PERCENT', value: 20, startsAt: new Date(now + 5 * 86_400_000) })
    const off = await mkCoupon({ type: 'PERCENT', value: 20, isActive: false })
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })

    const cases: [string, string][] = [
      [expired.code, 'این کد تخفیف معتبر نیست'],
      [future.code, 'این کد تخفیف معتبر نیست'],
      [off.code, 'این کد تخفیف معتبر نیست'],
      [`NOPE-${stamp()}`, 'این کد تخفیف معتبر نیست'],
    ]
    for (const [code, message] of cases) {
      await applyCode(page, code)
      await expect(page.locator('#coupon-error')).toContainText(message)
      await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
    }
    await expect(page.getByTestId('discount-line')).toHaveCount(0)
    await expect(page.getByTestId('cart-total')).toContainText(fmt(p.price))
  })

  test('C07 lowercase, Persian digits and stray spaces still match, and the code survives a reload', async ({ page }) => {
    const [p] = await pool()
    const digits = String(Date.now()).slice(-6)
    const c = await mkCoupon({ type: 'PERCENT', value: 15, code: `NRM-${digits}-X` })
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })

    const persianDigits = digits.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
    await applyCode(page, `  nrm ${persianDigits} x `)
    await expect(page.getByTestId('coupon-applied')).toContainText(c.code)
    const off = Math.floor((p.price * 15) / 100)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(off))
    expect(await page.evaluate(() => localStorage.getItem('pb_coupon_v1'))).toBe(c.code)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('coupon-applied')).toContainText(c.code)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(off))
    await expect(page.getByTestId('cart-total')).toContainText(fmt(p.price - off))
  })

  test('C08 an auto-apply discount appears with no code and cannot be removed by hand', async ({ page, context, baseURL }) => {
    const [p] = await pool()
    // Bound to this customer and one product so no other test cart is ever touched by it.
    const customer = await mkCustomer('0936')
    const title = `هدیه خودکار ${stamp()}`
    await mkCoupon({ type: 'PERCENT', value: 90, autoApply: true, title, customerId: customer.id, productIds: [p.id] })
    await signIn(context, baseURL, customer.id)
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('coupon-applied')).toContainText(title)
    await expect(page.getByTestId('coupon-applied')).toContainText('اعمال خودکار')
    await expect(page.getByTestId('coupon-remove')).toHaveCount(0)
    const off = Math.floor((p.price * 90) / 100)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(off))
    await expect(page.getByTestId('cart-total')).toContainText(fmt(p.price - off))
    // Nothing was typed, so nothing is stored.
    expect(await page.evaluate(() => localStorage.getItem('pb_coupon_v1'))).toBeFalsy()
  })

  test('C09 category and product restricted coupons discount only the matching lines', async ({ page }) => {
    const all = await pool()
    const a = all[0]
    const b = all.find((x) => x.categoryId !== a.categoryId)
    test.skip(!b, 'needs products from two different categories')
    const byCategory = await mkCoupon({ type: 'PERCENT', value: 20, categoryIds: [a.categoryId] })
    const byProduct = await mkCoupon({ type: 'FIXED', value: 10_000, productIds: [b!.id] })
    await seedCart(page, [
      { p: a, qty: 1 },
      { p: b!, qty: 1 },
    ])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    const subtotal = a.price + b!.price
    await expect(page.getByTestId('cart-total')).toContainText(fmt(subtotal))

    // Only A is in the coupon's category, so only A is discounted.
    await applyCode(page, byCategory.code)
    const offA = Math.floor((a.price * 20) / 100)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(offA))
    await expect(page.getByTestId('cart-total')).toContainText(fmt(subtotal - offA))

    await page.getByTestId('coupon-remove').click()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)

    // A fixed coupon for B's product only.
    await applyCode(page, byProduct.code)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(10_000))
    await expect(page.getByTestId('cart-total')).toContainText(fmt(subtotal - 10_000))

    // A cart without any matching line is refused with a specific message.
    await page.getByTestId('coupon-remove').click()
    await page.evaluate(
      ([id]) => {
        const lines = JSON.parse(localStorage.getItem('pb_cart_v1') || '[]').filter((l: { productId: string }) => l.productId === id)
        localStorage.setItem('pb_cart_v1', JSON.stringify(lines))
      },
      [a.id]
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await applyCode(page, byProduct.code)
    await expect(page.locator('#coupon-error')).toContainText('برای کالاهای سبد شما معتبر نیست')
  })

  test('C10 cart, checkout, charged total and saved order all agree', async ({ page, context, baseURL }) => {
    const [p] = await pool()
    const customer = await mkCustomer('0934', { province: 'تهران', city: 'تهران' })
    const c = await mkCoupon({ type: 'PERCENT', value: 15, maxDiscount: 100_000 })
    await signIn(context, baseURL, customer.id)
    await seedCart(page, [{ p, qty: 1 }])
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await applyCode(page, c.code)
    const off = Math.min(Math.floor((p.price * 15) / 100), 100_000)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(off))
    await expect(page.getByTestId('cart-total')).toContainText(fmt(p.price - off))

    // The code follows the customer into checkout (kept in the browser, re-checked by the server).
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveText('تکمیل خرید')
    await expect(page.getByTestId('coupon-applied')).toContainText(c.code)
    await expect(page.getByTestId('discount-line')).toContainText(fmt(off))
    const shipRow = page.locator('dl div').filter({ hasText: 'ارسال (' })
    await expect(shipRow).toContainText(/تومان|رایگان/)
    const shipText = await shipRow.innerText()
    const fee = shipText.includes('رایگان') ? 0 : toNum(shipText.replace(/ارسال.*?\)/, ''))
    const total = p.price - off + fee
    await expect(page.locator('dl div').filter({ hasText: 'مبلغ قابل پرداخت' })).toContainText(fmt(total))

    await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()
    await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}\?placed=1/, { timeout: 30000 })
    await expect(page.getByTestId('discount-line')).toContainText(fmt(off))

    const order = await prisma.order.findFirstOrThrow({ where: { customerId: customer.id } })
    expect(order.couponCode).toBe(c.code)
    expect(order.discount).toBe(off)
    expect(order.total).toBe(total)
    const redemption = await prisma.couponRedemption.findUnique({ where: { orderId: order.id } })
    expect(redemption?.couponId).toBe(c.id)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount).toBe(1)
  })
})
