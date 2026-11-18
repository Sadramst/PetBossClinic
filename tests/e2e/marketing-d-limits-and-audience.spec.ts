import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

/**
 * Discount codes: limits and audience, as a shopper and as staff experience them.
 * Each test builds its own customers, address, coupons and groups straight in the local database
 * (unique, random data), drives the real cart / checkout / admin screens, and asserts on its own rows only.
 * Both browser projects run this file at the same time, so cleanup removes only what this worker created.
 */
const prisma = new PrismaClient()
const PASSWORD = 'Gorbeh-Parvaneh-1405'
const DISCOUNT = 20000

const phones = new Set<string>()
const couponIds = new Set<string>()
const groupIds = new Set<string>()
const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase()

function uniquePhone(): string {
  for (;;) {
    const prefix = ['0937', '0936', '0934'][Math.floor(Math.random() * 3)]
    const phone = `${prefix}${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
    if (!phones.has(phone)) {
      phones.add(phone)
      return phone
    }
  }
}

function customerToken(customerId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600, v: 0 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

function adminCookie(baseURL: string) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId: 'admin_test_e2e', email: 'admin@petboss.com', name: 'Clinic Administrator', role: 'ADMIN', expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return { name: 'petboss_session', value: `${body}.${sig}`, domain: new URL(baseURL).hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const }
}

type Product = { id: string; slugFa: string; nameFa: string; price: number }

async function pickProduct(): Promise<Product> {
  // A purchasable product without dated batches (so the tests do not touch stock) and dear enough for a fixed discount.
  return prisma.product.findFirstOrThrow({
    where: { isActive: true, deletedAt: null, price: { gte: 50_000, lt: 2_000_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
    select: { id: true, slugFa: true, nameFa: true, price: true },
  })
}

async function makeCustomer(opts: { address?: boolean } = {}) {
  const phone = uniquePhone()
  const customer = await prisma.customer.create({ data: { phone, firstName: 'آزمون', lastName: 'تخفیف' } })
  if (opts.address !== false) await addAddress(customer.id, phone)
  return { id: customer.id, phone }
}

async function addAddress(customerId: string, phone: string) {
  await prisma.address.create({
    data: {
      customerId,
      recipientName: 'آزمون تخفیف',
      recipientPhone: phone,
      province: 'تهران',
      city: 'تهران',
      addressLine: 'خیابان شریعتی، کوچه آزمون خودکار، نبش میدان',
      postalCode: '1938973111',
      isDefault: true,
    },
  })
}

/** A unique fixed-amount code (20,000 Toman off) with whatever limits the test needs. */
async function makeCoupon(over: Record<string, unknown> = {}) {
  const code = `ZD-${stamp()}`
  const coupon = await prisma.coupon.create({
    data: {
      code,
      title: `آزمون ${code}`,
      type: 'FIXED',
      value: DISCOUNT,
      perCustomerLimit: null,
      ...over,
    } as Parameters<typeof prisma.coupon.create>[0]['data'],
  })
  couponIds.add(coupon.id)
  return coupon
}

/** Signs the browser in as this customer (or out, for null) and puts one unit of the product in a clean cart. */
async function startAs(page: Page, context: BrowserContext, baseURL: string, customerId: string | null, product: Product) {
  await context.clearCookies()
  if (customerId) await context.addCookies([{ name: 'pb_customer', value: customerToken(customerId), url: baseURL }])
  await page.goto('/robots.txt')
  await page.evaluate((p) => {
    localStorage.setItem('pb_cart_v1', JSON.stringify([{ productId: p.id, quantity: 1, name: p.nameFa, slug: p.slugFa, price: p.price, image: '' }]))
    localStorage.removeItem('pb_coupon_v1')
  }, product)
}

async function openCheckout(page: Page) {
  await page.goto('/checkout')
  await expect(page.locator('h1')).toHaveText('تکمیل خرید')
}

async function typeCode(page: Page, code: string) {
  await page.getByTestId('coupon-input').fill(code)
  await page.getByTestId('coupon-apply').click()
}

async function expectRefused(page: Page, code: string, message: string) {
  await typeCode(page, code)
  await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
  await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
}

async function expectApplied(page: Page, code: string) {
  await typeCode(page, code)
  await expect(page.getByTestId('coupon-applied')).toContainText(code)
  await expect(page.getByTestId('discount-line')).toContainText((DISCOUNT).toLocaleString('fa-IR'))
}

async function chooseCod(page: Page) {
  const cod = page.getByRole('radio', { name: /پرداخت در محل/ })
  await expect(cod).toBeEnabled()
  await cod.check()
  await expect(page.getByRole('button', { name: 'ثبت نهایی سفارش' })).toBeEnabled()
}

/** Pays on delivery with the code already applied; resolves with the new order's number. */
async function placeOrder(page: Page): Promise<string> {
  await chooseCod(page)
  await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()
  await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}/, { timeout: 30000 })
  return page.url().match(/PB-\d{4}-\d{6}/)![0]
}

/** A full purchase of the product with the code by this customer. */
async function buyWith(page: Page, context: BrowserContext, baseURL: string, customerId: string, product: Product, code: string) {
  await startAs(page, context, baseURL, customerId, product)
  await openCheckout(page)
  await expectApplied(page, code)
  return placeOrder(page)
}

test.describe('discount codes: limits and audience', () => {
  // Each test is its own shopper: the coupon box limits code guessing per client address, and every test
  // browser would otherwise share localhost and exhaust that budget together.
  test.beforeEach(async ({ context }) => {
    const o = () => Math.floor(Math.random() * 250) + 1
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
  })

  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const swallow = () => undefined
    const customers = await prisma.customer.findMany({ where: { phone: { in: [...phones] } }, select: { id: true } }).catch(() => [])
    const ids = customers.map((c) => c.id)
    const contacts = await prisma.marketingContact
      .findMany({ where: { OR: [{ phone: { in: [...phones] } }, { customerId: { in: ids } }] }, select: { welcomeCouponId: true } })
      .catch(() => [])
    const welcome = contacts.map((c) => c.welcomeCouponId).filter((x): x is string => !!x)
    await prisma.order.deleteMany({ where: { customerId: { in: ids } } }).catch(swallow)
    await prisma.marketingContact.deleteMany({ where: { OR: [{ phone: { in: [...phones] } }, { customerId: { in: ids } }] } }).catch(swallow)
    await prisma.coupon.deleteMany({ where: { id: { in: [...couponIds, ...welcome] } } }).catch(swallow)
    await prisma.customerGroup.deleteMany({ where: { id: { in: [...groupIds] } } }).catch(swallow)
    await prisma.customer.deleteMany({ where: { id: { in: ids } } }).catch(swallow)
    await prisma.$disconnect()
  })

  test('D01 a total usage limit: the last slot is taken, then the code is refused', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const [a, b, c] = await Promise.all([makeCustomer(), makeCustomer(), makeCustomer()])
    const coupon = await makeCoupon({ usageLimit: 2 })

    await buyWith(page, context, baseURL!, a.id, product, coupon.code)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)

    // The second buyer takes the last slot
    await buyWith(page, context, baseURL!, b.id, product, coupon.code)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(2)

    // The third buyer is told the code is used up and no order exists
    await startAs(page, context, baseURL!, c.id, product)
    await openCheckout(page)
    await expectRefused(page, coupon.code, 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.')
    expect(await prisma.order.count({ where: { customerId: c.id } })).toBe(0)
    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(2)
  })

  test('D02 a per-customer limit: one use each, a second customer is still welcome', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const [a, b] = await Promise.all([makeCustomer(), makeCustomer()])
    const coupon = await makeCoupon({ perCustomerLimit: 1 })

    await buyWith(page, context, baseURL!, a.id, product, coupon.code)

    await startAs(page, context, baseURL!, a.id, product)
    await openCheckout(page)
    await expectRefused(page, coupon.code, 'شما پیش‌تر از این کد تخفیف استفاده کرده‌اید.')

    await buyWith(page, context, baseURL!, b.id, product, coupon.code)
    const rows = await prisma.couponRedemption.findMany({ where: { couponId: coupon.id }, select: { customerId: true } })
    expect(rows.map((r) => r.customerId).sort()).toEqual([a.id, b.id].sort())
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(2)
  })

  test('D03 a first-order-only code works on the first purchase and not on the next one', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const a = await makeCustomer()
    const coupon = await makeCoupon({ firstOrderOnly: true })

    const number = await buyWith(page, context, baseURL!, a.id, product, coupon.code)
    const first = await prisma.order.findUniqueOrThrow({ where: { number } })
    expect(first.couponCode).toBe(coupon.code)
    expect(first.discount).toBe(DISCOUNT)

    // Now the customer has an order, so the same code is no longer for them
    await startAs(page, context, baseURL!, a.id, product)
    await openCheckout(page)
    await expectRefused(page, coupon.code, 'این کد فقط برای اولین خرید شما معتبر است.')
    expect(await prisma.order.count({ where: { customerId: a.id } })).toBe(1)
  })

  test('D04 a personal code works for its owner and is refused for another customer', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const [owner, other] = await Promise.all([makeCustomer(), makeCustomer()])
    const coupon = await makeCoupon({ customerId: owner.id, title: 'هدیه شخصی آزمون' })

    await startAs(page, context, baseURL!, other.id, product)
    await openCheckout(page)
    await expectRefused(page, coupon.code, 'این کد تخفیف برای حساب شما صادر نشده است.')

    await startAs(page, context, baseURL!, owner.id, product)
    await openCheckout(page)
    await typeCode(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toContainText('هدیه شخصی آزمون')
    const number = await placeOrder(page)
    const order = await prisma.order.findUniqueOrThrow({ where: { number } })
    expect(order.customerId).toBe(owner.id)
    expect(order.couponId).toBe(coupon.id)
    expect(await prisma.order.count({ where: { customerId: other.id } })).toBe(0)
  })

  test('D05 a group-only code works for a member and is refused for a non-member', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const [member, outsider] = await Promise.all([makeCustomer(), makeCustomer()])
    const group = await prisma.customerGroup.create({
      data: { name: `گروه آزمون ${stamp()}`, members: { create: [{ customerId: member.id }] } },
    })
    groupIds.add(group.id)
    const coupon = await makeCoupon({ groupId: group.id })

    await startAs(page, context, baseURL!, outsider.id, product)
    await openCheckout(page)
    await expectRefused(page, coupon.code, 'این کد تخفیف مخصوص گروهی از مشتریان است')

    await buyWith(page, context, baseURL!, member.id, product, coupon.code)
    const order = await prisma.order.findFirstOrThrow({ where: { customerId: member.id } })
    expect(order.couponId).toBe(coupon.id)
    expect(await prisma.order.count({ where: { customerId: outsider.id } })).toBe(0)
  })

  test('D06 a guest is asked to sign in, then signs up and the same code works', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    await startAs(page, context, baseURL!, null, product)
    const coupon = await makeCoupon({ firstOrderOnly: true, perCustomerLimit: 1 })

    // As a guest the cart says the code needs an account
    await page.goto('/cart')
    await typeCode(page, coupon.code)
    await expect(page.getByRole('alert').filter({ hasText: 'برای استفاده از این کد وارد حساب شوید.' })).toBeVisible()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)

    // Sign up from the cart; the cart survives and brings us back to it
    const phone = uniquePhone()
    await page.goto('/account/login?mode=register&next=%2Fcart')
    await page.locator('input[name="firstName"]').fill('مهمان')
    await page.locator('input[name="lastName"]').fill('تازه‌وارد')
    await page.locator('input[name="phone"]').fill(phone)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page).toHaveURL(/\/cart$/, { timeout: 30000 })

    await expectApplied(page, coupon.code)
    await expect(page.getByTestId('cart-total')).toContainText((product.price - DISCOUNT).toLocaleString('fa-IR'))

    // The code follows the customer to checkout and is charged there
    const customer = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    await addAddress(customer.id, phone)
    await openCheckout(page)
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.code)
    const number = await placeOrder(page)
    const order = await prisma.order.findUniqueOrThrow({ where: { number } })
    expect(order.customerId).toBe(customer.id)
    expect(order.couponCode).toBe(coupon.code)
    expect(order.discount).toBe(DISCOUNT)
  })

  test('D07 cancelling an order gives the code back and it can be used again', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const [a, b] = await Promise.all([makeCustomer(), makeCustomer()])
    const coupon = await makeCoupon({ usageLimit: 1 })

    const number = await buyWith(page, context, baseURL!, a.id, product, coupon.code)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)

    // The only slot is gone: another customer is refused
    await startAs(page, context, baseURL!, b.id, product)
    await openCheckout(page)
    await expectRefused(page, coupon.code, 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.')

    // Staff cancel the first order in the admin panel
    await context.clearCookies()
    await context.addCookies([adminCookie(baseURL!)])
    await page.goto('/admin/orders?status=all')
    await page.getByRole('button', { name: new RegExp(number) }).click()
    await page.locator('label', { hasText: 'وضعیت' }).locator('select').selectOption({ label: 'لغوشده' })
    await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'لغو سفارش' }).click()
    await expect(page.getByText('ذخیره شد.')).toBeVisible()

    await expect.poll(async () => (await prisma.order.findUniqueOrThrow({ where: { number } })).status).toBe('CANCELLED')
    const after = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })
    expect(after.usedCount).toBe(0)
    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(0)

    // The freed slot is redeemable by the other customer
    await buyWith(page, context, baseURL!, b.id, product, coupon.code)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
  })

  test('D08 a code switched off between the cart and the payment button blocks the order with a clear message', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const a = await makeCustomer()
    const coupon = await makeCoupon()

    await startAs(page, context, baseURL!, a.id, product)
    await openCheckout(page)
    await expectApplied(page, coupon.code)
    await chooseCod(page)

    // Staff deactivate the code while the customer is still looking at the page
    await prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: false } })
    await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()

    await expect(page.getByRole('alert').filter({ hasText: 'این کد تخفیف غیرفعال است.' })).toBeVisible()
    await expect(page).toHaveURL(/\/checkout/)
    expect(await prisma.order.count({ where: { customerId: a.id } })).toBe(0)
    const after = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })
    expect(after.usedCount).toBe(0)
  })

  test('D09 a double click on the order button creates one order and uses the code once', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const a = await makeCustomer()
    const coupon = await makeCoupon({ usageLimit: 5, perCustomerLimit: 3 })

    await startAs(page, context, baseURL!, a.id, product)
    await openCheckout(page)
    await expectApplied(page, coupon.code)
    await chooseCod(page)
    await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).dblclick()
    await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}/, { timeout: 30000 })

    expect(await prisma.order.count({ where: { customerId: a.id } })).toBe(1)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1)
    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(1)
  })

  test('D10 the amount to pay, the order page, the account list and the stored order all show the same discounted total', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const a = await makeCustomer()
    const coupon = await makeCoupon({ title: 'تخفیف ویژه آزمون' })

    await startAs(page, context, baseURL!, a.id, product)
    await openCheckout(page)
    await expectApplied(page, coupon.code)
    // The "payable" row of the summary is what a bank would be asked for (online payment is not configured locally, so the
    // bank is never called; the stored order total is what startOnlinePayment multiplies by ten for the gateway).
    const payable = page.locator('dt', { hasText: 'مبلغ قابل پرداخت' }).locator('xpath=following-sibling::dd')
    await expect(payable).not.toHaveText('…')
    const payableText = await payable.innerText()
    const number = await placeOrder(page)
    const order = await prisma.order.findUniqueOrThrow({ where: { number }, include: { payments: true } })
    expect(payableText).toContain(order.total.toLocaleString('fa-IR'))
    expect(order.subtotal).toBe(product.price)
    expect(order.discount).toBe(DISCOUNT)
    expect(order.couponCode).toBe(coupon.code)
    expect(order.total).toBe(order.subtotal - order.discount + order.shippingFee)
    expect(order.payments.every((p) => p.amountRial === order.total * 10)).toBe(true)

    // Order page: discount line names the code, total is the discounted one
    await expect(page.getByTestId('discount-line')).toContainText(coupon.code)
    await expect(page.getByTestId('discount-line')).toContainText(DISCOUNT.toLocaleString('fa-IR'))
    await expect(page.getByText(`${order.total.toLocaleString('fa-IR')} تومان`).first()).toBeVisible()

    // Account list shows the same discounted total (not the full price)
    await page.goto('/account/orders')
    const row = page.locator(`a[href$="/account/orders/${number}"]`)
    await expect(row).toContainText(`${order.total.toLocaleString('fa-IR')} تومان`)

    // Staff see the discount and the code on the order too
    await context.clearCookies()
    await context.addCookies([adminCookie(baseURL!)])
    await page.goto('/admin/orders?status=all')
    await page.getByRole('button', { name: new RegExp(number) }).click()
    await expect(page.getByText(coupon.code).first()).toBeVisible()
  })
})
