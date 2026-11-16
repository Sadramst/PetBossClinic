import { test, expect } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

/**
 * Full purchase flow against the local database: add to cart as a guest,
 * sign in (session cookie minted the same way the server does), add an Iranian
 * address, pay on delivery, and check the order in the DB.
 */
const prisma = new PrismaClient()

function customerToken(customerId: string): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

test.describe('checkout', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  let customerId = ''
  test.afterEach(async () => {
    if (!customerId) return
    await prisma.order.deleteMany({ where: { customerId } })
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {})
  })
  test.afterAll(() => prisma.$disconnect())

  test('guest cart, sign-in, address, cash on delivery', async ({ page, context, baseURL }) => {
    // A purchasable product without dated batches (so the test does not touch stock).
    const product = await prisma.product.findFirstOrThrow({
      where: { isActive: true, deletedAt: null, price: { gt: 0, lt: 2_000_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
      select: { slugFa: true, price: true },
    })

    await page.goto(`/product/${encodeURIComponent(product.slugFa)}`)
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await page.goto('/cart')
    await expect(page.getByRole('link', { name: 'ورود و ادامه خرید' })).toBeVisible()

    // Sign in
    const phone = `0935${String(Date.now()).slice(-7)}`
    const customer = await prisma.customer.create({ data: { phone, firstName: 'آزمون', lastName: 'خودکار' } })
    customerId = customer.id
    await context.addCookies([{ name: 'pb_customer', value: customerToken(customer.id), url: baseURL! }])

    await page.goto('/checkout')
    await expect(page.locator('h1')).toHaveText('تکمیل خرید')

    // Add a Tehran address
    await page.locator('textarea[name="addressLine"]').fill('خیابان شریعتی، کوچه آزمون خودکار، نبش میدان')
    await page.locator('input[name="postalCode"]').fill('1938973111')
    await page.locator('input[name="recipientPhone"]').fill(phone)
    await page.getByRole('button', { name: 'ذخیره نشانی' }).click()
    await expect(page.getByText('کوچه آزمون خودکار').first()).toBeVisible()

    // Online payment is not configured locally, so cash on delivery is selected for Tehran.
    await expect(page.getByText('پیک ویژه تهران')).toBeVisible()
    await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()

    await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}\?placed=1/)
    await expect(page.getByText('سفارش شما با موفقیت ثبت شد')).toBeVisible()

    const order = await prisma.order.findFirstOrThrow({ where: { customerId }, include: { items: true } })
    expect(order.status).toBe('CONFIRMED')
    expect(order.paymentMethod).toBe('COD')
    expect(order.items[0].unitPrice).toBe(product.price)
    expect(order.shipPostal).toBe('1938973111')

    // The cart is emptied after the order
    const cart = await page.evaluate(() => localStorage.getItem('pb_cart_v1'))
    expect(cart).toBe('[]')
  })

  test('account pages require sign-in', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/account\/login\?next=%2Fcheckout/)
    await page.goto('/account/orders/PB-1405-000001')
    await expect(page).toHaveURL(/\/account\/login/)
  })
})
