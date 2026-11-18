import { test, expect, type Page } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000)) } catch {}
  })
})


/**
 * The whole customer journey in a real browser against the local database:
 * sign up with an email address, see the profile, confirm the mobile number by SMS code,
 * sign out, sign back in by email and by phone, edit the profile, save an address,
 * put a product in the cart, pay on delivery, and find the order in the account.
 */
const prisma = new PrismaClient()
const PASSWORD = 'Gorbeh-Parvaneh-1405'
const created = new Set<string>()
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`

function uniquePhone(): string {
  const phone = `0938${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  created.add(phone)
  return phone
}

/** The SMS code is stored hashed, so the test recovers it the way an attacker would have to: by trying all 5-digit codes. */
async function recoverSmsCode(phone: string): Promise<string> {
  const row = await prisma.otpCode.findFirstOrThrow({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } })
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  for (let n = 10000; n < 100000; n++) {
    const h = crypto.createHmac('sha256', secret).update(`otp:${phone}:${n}`).digest('hex')
    if (h === row.codeHash) return String(n)
  }
  throw new Error('code not found')
}

async function logout(page: Page) {
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'خروج')
    return !!b && Object.keys(b).some((k) => k.startsWith('__reactProps'))
  })
  await page.getByRole('button', { name: 'خروج' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 })
}

async function login(page: Page, identifier: string, password: string) {
  await page.goto('/account/login')
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'ورود', exact: true }).click()
}

test.describe('customer journey', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')
  test.afterAll(async () => {
    const customers = await prisma.customer.findMany({ where: { phone: { in: [...created] } }, select: { id: true } })
    const ids = customers.map((c) => c.id)
    await prisma.order.deleteMany({ where: { customerId: { in: ids } } })
    await prisma.customer.deleteMany({ where: { id: { in: ids } } })
    await prisma.$disconnect()
  })

  test('email sign-up, phone confirmation, both logins, profile, address and a purchase', async ({ page }) => {
    const phone = uniquePhone()
    const email = `Journey.${stamp()}@Example.com`
    const lower = email.toLowerCase()
    // A purchasable product without dated batches (so the test does not touch stock).
    const product = await prisma.product.findFirstOrThrow({
      where: { isActive: true, deletedAt: null, price: { gt: 0, lt: 2_000_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
      select: { slugFa: true, nameFa: true, price: true },
    })

    // 1. Sign up with name, mobile, email and password
    await page.goto('/account/login?mode=register')
    await page.locator('input[name="firstName"]').fill('نگار')
    await page.locator('input[name="lastName"]').fill('محمدی')
    await page.locator('input[name="phone"]').fill(phone)
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page).toHaveURL(/\/account$/)
    const row = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    expect(row.email).toBe(lower) // stored normalised
    expect(row.phoneVerifiedAt).toBeNull()

    // 2. Profile shows everything, number is unconfirmed
    await page.goto('/account/profile')
    await expect(page.getByTestId('phone-unverified')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toHaveValue(lower)
    await expect(page.locator('input[name="firstName"]')).toHaveValue('نگار')

    // 3. Confirm the number with the SMS code (wrong code first)
    await page.getByRole('button', { name: 'ارسال کد تأیید شماره' }).click()
    const codeInput = page.getByLabel('کد تأیید')
    await expect(codeInput).toBeVisible()
    await codeInput.fill('00000')
    await page.getByRole('button', { name: 'تأیید شماره' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'نادرست' })).toBeVisible()
    await codeInput.fill(await recoverSmsCode(phone))
    await page.getByRole('button', { name: 'تأیید شماره' }).click()
    await expect(page.getByTestId('phone-verified')).toBeVisible()
    expect((await prisma.customer.findUniqueOrThrow({ where: { phone } })).phoneVerifiedAt).not.toBeNull()

    // 4. Sign out, then in again with the email (any letter case), then with the phone
    await logout(page)
    await login(page, email.toUpperCase(), 'Wrong-Password-1')
    await expect(page.getByRole('alert').filter({ hasText: 'نادرست' })).toBeVisible()
    await login(page, email.toUpperCase(), PASSWORD)
    await expect(page).toHaveURL(/\/account$/)
    await page.goto('/account/profile')
    await logout(page)
    await login(page, phone, PASSWORD)
    await expect(page).toHaveURL(/\/account$/)

    // 5. Edit the profile; an email that belongs to another account is refused
    const other = uniquePhone()
    const otherEmail = `other.${stamp()}@example.com`
    await prisma.customer.create({ data: { phone: other, email: otherEmail, firstName: 'دیگر', lastName: 'کاربر' } })
    await page.goto('/account/profile')
    await page.locator('input[name="email"]').fill(otherEmail)
    await page.getByRole('button', { name: 'ذخیره', exact: true }).click()
    await expect(page.getByText('این ایمیل برای حساب دیگری ثبت شده است.')).toBeVisible()
    await page.locator('input[name="lastName"]').fill('محمدی‌زاده')
    await page.locator('input[name="email"]').fill(lower)
    await page.getByRole('button', { name: 'ذخیره', exact: true }).click()
    await expect(page.getByText('اطلاعات ذخیره شد.')).toBeVisible()
    await expect(page.getByText('نگار محمدی‌زاده').first()).toBeVisible()

    // 6. Save an Iranian address on the address page
    await page.goto('/account/addresses')
    await page.locator('textarea[name="addressLine"]').fill('خیابان ولیعصر، کوچه گلستان، پلاک ۱۲، واحد ۳')
    await page.locator('input[name="postalCode"]').fill('1938973111')
    await page.getByRole('button', { name: 'ذخیره نشانی' }).click()
    await expect(page.getByText('کوچه گلستان').first()).toBeVisible()
    expect(await prisma.address.count({ where: { customer: { phone } } })).toBe(1)

    // 7. Buy: product → cart → checkout (the saved address is used) → cash on delivery
    await page.goto(`/product/${encodeURIComponent(product.slugFa)}`)
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await page.goto('/cart')
    await expect(page.getByText(product.nameFa).first()).toBeVisible()
    await page.goto('/checkout')
    await expect(page.locator('h1')).toHaveText('تکمیل خرید')
    await expect(page.getByText('کوچه گلستان').first()).toBeVisible()
    await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()
    await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}\?placed=1/)
    await expect(page.getByText('سفارش شما با موفقیت ثبت شد')).toBeVisible()

    // 8. The order is in the list, with the right details
    const order = await prisma.order.findFirstOrThrow({ where: { customer: { phone } }, include: { items: true } })
    expect(order.paymentMethod).toBe('COD')
    expect(order.items[0].unitPrice).toBe(product.price)
    expect(order.shipPostal).toBe('1938973111')
    await page.goto('/account/orders')
    await expect(page.getByText(order.number).first()).toBeVisible()
  })

  test('a taken or malformed email is refused with a clear Persian message', async ({ page }) => {
    const phone = uniquePhone()
    const email = `dup.${stamp()}@example.com`
    await prisma.customer.create({ data: { phone: uniquePhone(), email, firstName: 'علی', lastName: 'کریمی' } })

    await page.goto('/account/login?mode=register')
    await page.locator('input[name="firstName"]').fill('مریم')
    await page.locator('input[name="lastName"]').fill('احمدی')
    await page.locator('input[name="phone"]').fill(phone)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.locator('input[name="email"]').fill(email)
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'ایمیل دیگری' })).toBeVisible()
    expect(await prisma.customer.count({ where: { phone } })).toBe(0)

    await page.locator('input[name="email"]').fill('name@gmail')
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'ایمیل معتبر نیست' })).toBeVisible()
    expect(await prisma.customer.count({ where: { phone } })).toBe(0)
  })

  test('login with an unknown email or a malformed identifier gives the generic Persian errors', async ({ page }) => {
    await login(page, `nobody.${stamp()}@example.com`, PASSWORD)
    await expect(page.getByRole('alert').filter({ hasText: 'نادرست' })).toBeVisible()
    await login(page, 'abc', PASSWORD)
    await expect(page.getByRole('alert').filter({ hasText: 'معتبر نیست' })).toBeVisible()
  })
})
