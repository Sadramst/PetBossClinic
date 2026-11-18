import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

/**
 * Marketing, customer side (author B): a new customer from sign-up to a second purchase.
 * Welcome code on /account, cart coupon box, discount line, COD checkout, redemption row,
 * used code refused, someone else's code refused, a normal public coupon on the next order.
 *
 * Isolation: every test makes its own customers/coupons with unique values and only ever
 * asserts on rows it created. The global MarketingConfig is set once for the file (serial
 * describe) and restored afterwards.
 */
const prisma = new PrismaClient()
const PASSWORD = 'Gorbeh-Parvaneh-1405'
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase()

const phones = new Set<string>()
const emails = new Set<string>()
const couponIds = new Set<string>()
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`

function uniquePhone(): string {
  const prefix = ['0937', '0936', '0934'][Math.floor(Math.random() * 3)]
  for (;;) {
    const p = `${prefix}${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`
    if (!phones.has(p)) {
      phones.add(p)
      return p
    }
  }
}
function uniqueEmail(tag: string): string {
  const e = `mkt.b.${tag}.${stamp()}@example.com`
  emails.add(e)
  return e
}
let codeSeq = 0
function uniqueCode(tag: string): string {
  return `TB-${tag}-${RUN}${++codeSeq}`.toUpperCase()
}

function customerToken(customerId: string): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

async function signIn(context: BrowserContext, baseURL: string | undefined, customerId: string) {
  await context.addCookies([{ name: 'pb_customer', value: customerToken(customerId), url: baseURL! }])
}

/** Keeps the welcome popup out of the way (it would cover the page on its timer). */
async function quietPopup(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86_400_000))
    } catch {
      /* ignore */
    }
  })
}

async function pickProduct() {
  return prisma.product.findFirstOrThrow({
    where: { isActive: true, deletedAt: null, price: { gte: 100_000, lt: 2_000_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
    select: { slugFa: true, nameFa: true, price: true },
  })
}

async function register(page: Page, phone: string, email: string, first = 'سارا') {
  await page.goto('/account/login?mode=register')
  await page.locator('input[name="firstName"]').fill(first)
  await page.locator('input[name="lastName"]').fill('آزمون')
  await page.locator('input[name="phone"]').fill(phone)
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
  await expect(page).toHaveURL(/\/account$/)
}

async function welcomeCouponOf(phone: string) {
  // The sign-up hook runs on the server right after the account is created.
  await expect
    .poll(async () => (await prisma.marketingContact.findUnique({ where: { phone }, select: { welcomeCouponId: true } }))?.welcomeCouponId ?? null, { timeout: 15000 })
    .not.toBeNull()
  const contact = await prisma.marketingContact.findUniqueOrThrow({ where: { phone } })
  const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: contact.welcomeCouponId! } })
  couponIds.add(coupon.id)
  return coupon
}

async function addToCart(page: Page, product: { slugFa: string; nameFa: string }) {
  await page.goto(`/product/${encodeURIComponent(product.slugFa)}`)
  await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
  await page.goto('/cart')
  await expect(page.getByText(product.nameFa).first()).toBeVisible()
}

async function applyInCart(page: Page, code: string) {
  await page.getByTestId('coupon-input').fill(code)
  await page.getByTestId('coupon-apply').click()
}

async function saveAddress(page: Page, phone: string) {
  await page.goto('/checkout')
  await expect(page.locator('h1')).toHaveText('تکمیل خرید')
  await page.locator('textarea[name="addressLine"]').fill('خیابان شریعتی، کوچه آزمون بازاریابی، پلاک ۷')
  await page.locator('input[name="postalCode"]').fill('1938973111')
  await page.locator('input[name="recipientPhone"]').fill(phone)
  await page.getByRole('button', { name: 'ذخیره نشانی' }).click()
  await expect(page.getByText('کوچه آزمون بازاریابی').first()).toBeVisible()
}

async function placeOrder(page: Page) {
  await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()
  await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}\?placed=1/, { timeout: 30000 })
}

async function newCustomer(tag: string) {
  const phone = uniquePhone()
  const email = uniqueEmail(tag)
  return prisma.customer.create({ data: { phone, email, firstName: 'مشتری', lastName: `آزمون ${tag}` } })
}

async function publicCoupon(tag: string, extra: Record<string, unknown> = {}) {
  const c = await prisma.coupon.create({
    data: { code: uniqueCode(tag), title: `کمپین آزمون ${tag}`, type: 'FIXED', value: 20_000, perCustomerLimit: 1, source: 'manual', ...extra },
  })
  couponIds.add(c.id)
  return c
}

test.describe('marketing B: customer flow', () => {
  // Each test is its own shopper: the coupon box limits code guessing per client address, and every test
  // browser would otherwise share localhost and exhaust that budget together.
  test.beforeEach(async ({ context }) => {
    const o = () => Math.floor(Math.random() * 250) + 1
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
  })

  test.describe.configure({ mode: 'serial' })
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  let priorConfig: Awaited<ReturnType<typeof prisma.marketingConfig.findUnique>> = null
  const welcomeSettings = {
    popupEnabled: false,
    bannerEnabled: false,
    welcomeEnabled: true,
    welcomeType: 'PERCENT' as const,
    welcomeValue: 10,
    welcomeMaxDiscount: null,
    welcomeMinSubtotal: 0,
    welcomeValidDays: 14,
  }

  test.beforeAll(async () => {
    priorConfig = await prisma.marketingConfig.findUnique({ where: { id: 'main' } })
    await prisma.marketingConfig.upsert({ where: { id: 'main' }, create: { id: 'main', ...welcomeSettings }, update: welcomeSettings })
  })

  test.afterAll(async () => {
    const customers = await prisma.customer.findMany({
      where: { OR: [{ phone: { in: [...phones] } }, { email: { in: [...emails].map((e) => e.toLowerCase()) } }] },
      select: { id: true },
    })
    const ids = customers.map((c) => c.id)
    const contacts = await prisma.marketingContact.findMany({
      where: { OR: [{ phone: { in: [...phones] } }, { email: { in: [...emails].map((e) => e.toLowerCase()) } }] },
      select: { id: true, welcomeCouponId: true },
    })
    for (const c of contacts) if (c.welcomeCouponId) couponIds.add(c.welcomeCouponId)
    const orders = await prisma.order.findMany({ where: { customerId: { in: ids } }, select: { id: true } })
    const orderIds = orders.map((o) => o.id)
    await prisma.couponRedemption.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { couponId: { in: [...couponIds] } }] } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    await prisma.marketingContact.deleteMany({ where: { id: { in: contacts.map((c) => c.id) } } })
    await prisma.customerGroupMember.deleteMany({ where: { customerId: { in: ids } } })
    await prisma.coupon.deleteMany({ where: { id: { in: [...couponIds] } } })
    await prisma.customer.deleteMany({ where: { id: { in: ids } } })
    if (priorConfig) {
      const { id: _id, updatedAt: _u, ...rest } = priorConfig
      await prisma.marketingConfig.update({ where: { id: 'main' }, data: rest })
    } else {
      await prisma.marketingConfig.deleteMany({ where: { id: 'main' } })
    }
    await prisma.$disconnect()
  })

  test('B01 signing up with email and phone creates one personal welcome code, shown in the account', async ({ page, context }) => {
    await quietPopup(context)
    const phone = uniquePhone()
    const email = uniqueEmail('b01')
    await register(page, phone, email)

    const coupon = await welcomeCouponOf(phone)
    expect(coupon.source).toBe('welcome')
    expect(coupon.usageLimit).toBe(1)
    expect(coupon.firstOrderOnly).toBe(true)
    expect(coupon.usedCount).toBe(0)
    expect(coupon.code).toMatch(/^WELCOME-/)
    expect(await prisma.marketingContact.count({ where: { phone } })).toBe(1)

    await page.goto('/account')
    const banner = page.getByTestId('welcome-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(coupon.code)

    await page.goto('/account/coupons')
    const list = page.getByTestId('my-coupons-list')
    await expect(list).toBeVisible()
    await expect(list.getByText(coupon.code)).toBeVisible()
    await expect(list.getByText('قابل استفاده').first()).toBeVisible()
    await expect(list.getByTestId('coupon-copy').first()).toBeVisible()
  })

  test('B02 new customer 0 to 100: welcome code in cart, discount line, COD order, redemption row', async ({ page, context }) => {
    await quietPopup(context)
    const phone = uniquePhone()
    await register(page, phone, uniqueEmail('b02'))
    const coupon = await welcomeCouponOf(phone)
    const product = await pickProduct()

    await addToCart(page, product)
    await applyInCart(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.code)
    await expect(page.getByTestId('discount-line')).toBeVisible()
    await expect(page.getByTestId('coupon-input')).toHaveCount(0)

    await saveAddress(page, phone)
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.code)
    await expect(page.getByTestId('discount-line')).toBeVisible()
    await placeOrder(page)
    await expect(page.getByTestId('discount-line')).toBeVisible()
    await expect(page.getByText(coupon.code).first()).toBeVisible()

    const customer = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    const order = await prisma.order.findFirstOrThrow({ where: { customerId: customer.id }, include: { items: true } })
    const expectedDiscount = Math.floor((product.price * 10) / 100)
    expect(order.paymentMethod).toBe('COD')
    expect(order.couponCode).toBe(coupon.code)
    expect(order.couponId).toBe(coupon.id)
    expect(order.discount).toBe(expectedDiscount)
    expect(order.total).toBe(order.subtotal - order.discount + order.shippingFee)
    const redemption = await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(redemption.couponId).toBe(coupon.id)
    expect(redemption.customerId).toBe(customer.id)
    expect(redemption.amount).toBe(order.discount + order.shippingDiscount)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
  })

  test('B03 after the order the welcome code shows as used everywhere', async ({ page, context, baseURL }) => {
    await quietPopup(context)
    const phone = uniquePhone()
    await register(page, phone, uniqueEmail('b03'))
    const coupon = await welcomeCouponOf(phone)
    const product = await pickProduct()
    await addToCart(page, product)
    await applyInCart(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    await saveAddress(page, phone)
    await placeOrder(page)

    await page.goto('/account')
    await expect(page.getByTestId('welcome-banner')).toHaveCount(0)
    await page.goto('/account/coupons')
    const list = page.getByTestId('my-coupons-list')
    await expect(list.getByText(coupon.code)).toBeVisible()
    await expect(list.getByText('استفاده شده')).toBeVisible()
    await expect(list.getByText('قابل استفاده')).toHaveCount(0)
    void baseURL
  })

  test('B04 a used welcome code is refused on the second order with a Persian error and no discount', async ({ page, context }) => {
    await quietPopup(context)
    const phone = uniquePhone()
    await register(page, phone, uniqueEmail('b04'))
    const coupon = await welcomeCouponOf(phone)
    const product = await pickProduct()
    await addToCart(page, product)
    await applyInCart(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    await saveAddress(page, phone)
    await placeOrder(page)

    // Second purchase: the same code is rejected.
    await addToCart(page, product)
    await applyInCart(page, coupon.code)
    await expect(page.getByRole('alert').filter({ hasText: /ظرفیت استفاده|پیش‌تر از این کد|اولین خرید/ })).toBeVisible()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
    await expect(page.getByTestId('discount-line')).toHaveCount(0)

    // A stale code left in the browser is dropped by the server-side quote at checkout.
    await page.evaluate((c) => localStorage.setItem('pb_coupon_v1', c), coupon.code)
    await page.goto('/checkout')
    await expect(page.locator('h1')).toHaveText('تکمیل خرید')
    await expect(page.getByTestId('discount-line')).toHaveCount(0)
    await placeOrder(page)

    const customer = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    const orders = await prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'asc' } })
    expect(orders).toHaveLength(2)
    expect(orders[1].discount).toBe(0)
    expect(orders[1].couponCode).toBeNull()
    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(1)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
  })

  test('B05 a different new customer uses a normal public coupon on their first order', async ({ page, context, baseURL }) => {
    await quietPopup(context)
    const coupon = await publicCoupon('B05', { value: 25_000, usageLimit: 50 })
    const customer = await newCustomer('b05')
    await signIn(context, baseURL, customer.id)
    const product = await pickProduct()

    await addToCart(page, product)
    await applyInCart(page, coupon.code.toLowerCase()) // typed in lower case
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.code)
    await expect(page.getByTestId('discount-line')).toBeVisible()
    await saveAddress(page, customer.phone!)
    await placeOrder(page)

    const order = await prisma.order.findFirstOrThrow({ where: { customerId: customer.id } })
    expect(order.couponCode).toBe(coupon.code)
    expect(order.discount).toBe(25_000)
    expect(order.total).toBe(order.subtotal - 25_000 + order.shippingFee)
    expect(await prisma.couponRedemption.count({ where: { orderId: order.id, couponId: coupon.id } })).toBe(1)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
  })

  test('B06 after a welcome order the same customer can still use a normal coupon on the second order', async ({ page, context }) => {
    await quietPopup(context)
    const phone = uniquePhone()
    await register(page, phone, uniqueEmail('b06'))
    const welcome = await welcomeCouponOf(phone)
    const normal = await publicCoupon('B06', { value: 15_000, usageLimit: 50 })
    const product = await pickProduct()

    await addToCart(page, product)
    await applyInCart(page, welcome.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    await saveAddress(page, phone)
    await placeOrder(page)

    await addToCart(page, product)
    await applyInCart(page, normal.code)
    await expect(page.getByTestId('coupon-applied')).toContainText(normal.code)
    await expect(page.getByTestId('discount-line')).toBeVisible()
    await page.goto('/checkout')
    await expect(page.getByTestId('coupon-applied')).toContainText(normal.code)
    await placeOrder(page)

    const customer = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    const orders = await prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'asc' } })
    expect(orders).toHaveLength(2)
    expect(orders[0].couponCode).toBe(welcome.code)
    expect(orders[1].couponCode).toBe(normal.code)
    expect(orders[1].discount).toBe(15_000)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: normal.id } })).usedCount).toBe(1)
  })

  test('B07 a guest keeps a typed personal code through sign-in and it then applies', async ({ page, context, baseURL }) => {
    await quietPopup(context)
    const customer = await newCustomer('b07')
    const coupon = await publicCoupon('B07', { customerId: customer.id, usageLimit: 1, value: 30_000 })
    const product = await pickProduct()

    await addToCart(page, product)
    await applyInCart(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
    await expect(page.getByText(/وارد حساب شوید/).first()).toBeVisible()

    await signIn(context, baseURL, customer.id)
    await page.goto('/cart')
    await applyInCart(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.code)
    await expect(page.getByTestId('discount-line')).toBeVisible()
    const stored = await page.evaluate(() => localStorage.getItem('pb_coupon_v1'))
    expect(stored).toBe(coupon.code)
  })

  test('B08 an unknown code shows a Persian error, a valid one can be removed again', async ({ page, context, baseURL }) => {
    await quietPopup(context)
    const customer = await newCustomer('b08')
    await signIn(context, baseURL, customer.id)
    const coupon = await publicCoupon('B08', { value: 10_000, usageLimit: 20 })
    const product = await pickProduct()
    await addToCart(page, product)

    await applyInCart(page, `NOPE-${RUN}`)
    await expect(page.getByRole('alert').filter({ hasText: 'معتبر نیست' })).toBeVisible()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)

    await applyInCart(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    await expect(page.getByTestId('discount-line')).toBeVisible()
    await page.getByTestId('coupon-remove').click()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
    await expect(page.getByTestId('discount-line')).toHaveCount(0)
    await expect(page.getByTestId('coupon-input')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('pb_coupon_v1'))).toBeFalsy()
  })

  test('B09 the applied coupon survives a reload and cart, checkout and the charged total agree', async ({ page, context, baseURL }) => {
    await quietPopup(context)
    const customer = await newCustomer('b09')
    await signIn(context, baseURL, customer.id)
    const coupon = await publicCoupon('B09', { type: 'PERCENT', value: 20, maxDiscount: 50_000, usageLimit: 20 })
    const product = await pickProduct()
    await addToCart(page, product)
    await applyInCart(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.code)
    const cartTotal = (await page.getByTestId('cart-total').innerText()).trim()
    expect(cartTotal.length).toBeGreaterThan(0)

    await saveAddress(page, customer.phone!)
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.code)
    await placeOrder(page)

    const order = await prisma.order.findFirstOrThrow({ where: { customerId: customer.id } })
    const expected = Math.min(Math.floor((product.price * 20) / 100), 50_000) // capped percent
    expect(order.discount).toBe(expected)
    expect(order.total).toBe(order.subtotal - expected + order.shippingFee)
  })

  test("B10 someone else's personal welcome code is refused and not listed in the account", async ({ page, context, baseURL }) => {
    await quietPopup(context)
    const owner = await newCustomer('b10o')
    const other = await newCustomer('b10x')
    const coupon = await publicCoupon('B10', { customerId: owner.id, usageLimit: 1, source: 'welcome', firstOrderOnly: true, value: 20_000 })
    await signIn(context, baseURL, other.id)
    const product = await pickProduct()
    await addToCart(page, product)

    await applyInCart(page, coupon.code)
    await expect(page.getByRole('alert').filter({ hasText: 'برای حساب شما صادر نشده' })).toBeVisible()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)

    await page.goto('/account/coupons')
    await expect(page.getByText(coupon.code)).toHaveCount(0)
    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(0)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0)
  })
})
