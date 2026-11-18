import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000)) } catch {}
  })
  // Each test is its own client address: sign-in and SMS code requests are rate limited per address.
  const o = () => Math.floor(Math.random() * 250) + 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
})

/**
 * Clinic services and the owner profile, end to end: an admin records a visit and the customer sees it with points,
 * health reminders, profile fields, SMS consent, the dashboard, the orders page, nav, a clinic-created profile claimed
 * by SMS code, and the cart snapshot that follows a signed-in shopper.
 * Everything is keyed by phones from uniquePhone(); nothing depends on global counts.
 */
const prisma = new PrismaClient()
const TAG = `d${Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(2, 7).padEnd(5, 'x')}`
const phones = new Set<string>()
const userIds = new Set<string>()
const couponCodes = new Set<string>()
let seq = 0

function uniquePhone(): string {
  const phone = `0935${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  phones.add(phone)
  return phone
}
function customerToken(customerId: string): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}
function adminToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون', role: 'ADMIN', expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}
async function recoverSmsCode(phone: string): Promise<string> {
  const row = await prisma.otpCode.findFirstOrThrow({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } })
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  for (let n = 10000; n < 100000; n++) {
    if (crypto.createHmac('sha256', secret).update(`otp:${phone}:${n}`).digest('hex') === row.codeHash) return String(n)
  }
  throw new Error('code not found')
}
async function signInAdmin(context: BrowserContext, baseURL: string | undefined) {
  const user = await prisma.user.create({ data: { email: `e2e-club-d-${TAG}-${++seq}@example.test`, name: 'مدیر آزمون باشگاه', role: 'ADMIN' } })
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: adminToken(user.id), url: baseURL! }])
}
async function makeCustomer(extra: Record<string, unknown> = {}) {
  const phone = uniquePhone()
  const c = await prisma.customer.create({ data: { phone, firstName: 'نیلوفر', lastName: `باشگاه${TAG}`, ...extra } })
  return { id: c.id, phone }
}
async function signInCustomer(context: BrowserContext, baseURL: string | undefined, id: string) {
  await context.addCookies([{ name: 'pb_customer', value: customerToken(id), url: baseURL! }])
}
const days = (n: number) => new Date(Date.now() + n * 86400000)
async function shopProduct() {
  return prisma.product.findFirstOrThrow({
    where: { isActive: true, deletedAt: null, price: { gt: 0, lt: 2_000_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
    select: { id: true, slugFa: true, nameFa: true },
  })
}
async function loginBySms(page: Page, phone: string) {
  await page.goto('/account/login')
  await page.getByRole('tab', { name: 'ورود با کد پیامکی' }).click()
  await page.locator('input[inputmode="tel"]').fill(phone)
  await page.getByRole('button', { name: 'دریافت کد ورود' }).click()
  const codeInput = page.locator('input[autocomplete="one-time-code"]')
  await expect(codeInput).toBeVisible()
  await expect.poll(() => prisma.otpCode.count({ where: { phone, consumedAt: null } }), { timeout: 15000 }).toBeGreaterThan(0)
  await codeInput.fill(await recoverSmsCode(phone))
}

test.describe('club: services and owner profile', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const swallow = () => undefined
    const customers = await prisma.customer.findMany({ where: { phone: { in: [...phones] } }, select: { id: true } }).catch(() => [])
    const ids = customers.map((c) => c.id)
    await prisma.order.deleteMany({ where: { customerId: { in: ids } } }).catch(swallow)
    await prisma.coupon.deleteMany({ where: { code: { in: [...couponCodes] } } }).catch(swallow)
    await prisma.auditLog.deleteMany({ where: { userId: { in: [...userIds] } } }).catch(swallow)
    await prisma.pointsTransaction.deleteMany({ where: { customerId: { in: ids } } }).catch(swallow)
    await prisma.serviceVisit.deleteMany({ where: { customerId: { in: ids } } }).catch(swallow)
    // Pets, records, notes, cart snapshots and addresses go with the customer (cascade).
    await prisma.customer.deleteMany({ where: { id: { in: ids } } }).catch(swallow)
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } }).catch(swallow)
    await prisma.$disconnect()
  })

  test('D01 an admin records a clinic visit and the customer sees it in her service history with points', async ({ page, context, baseURL }) => {
    const c = await makeCustomer()
    const pet = await prisma.pet.create({ data: { customerId: c.id, name: `پوپک${TAG}`, species: 'DOG' } })
    await signInAdmin(context, baseURL)
    await page.goto(`/admin/customers/${c.id}`)
    await page.getByRole('tab', { name: /^خدمات/ }).click()
    const form = page.getByTestId('visit-form')
    await expect(form).toBeVisible()
    await page.getByTestId('visit-service').fill(`واکسن هاری ${TAG}`)
    await form.locator('select[name="petId"]').selectOption({ label: pet.name })
    await page.getByTestId('visit-amount').fill('400000')
    await page.getByTestId('visit-save').click()
    await expect(page.getByTestId('admin-visit-row').filter({ hasText: `واکسن هاری ${TAG}` })).toBeVisible()

    const visit = await prisma.serviceVisit.findFirstOrThrow({ where: { customerId: c.id } })
    expect(visit.petId).toBe(pet.id)
    expect(visit.pointsAwarded).toBeGreaterThan(0)
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })).pointsBalance).toBeGreaterThanOrEqual(visit.pointsAwarded)

    await context.clearCookies()
    await signInCustomer(context, baseURL, c.id)
    await page.goto('/account/services')
    const row = page.getByTestId('visit-row').filter({ hasText: `واکسن هاری ${TAG}` })
    await expect(row).toBeVisible()
    await expect(row).toContainText(pet.name)
    await expect(row).toContainText('امتیاز')
  })

  test('D02 a vaccine that is due soon (and one that is overdue) shows up as a reminder on the dashboard', async ({ page, context, baseURL }) => {
    const c = await makeCustomer()
    const pet = await prisma.pet.create({ data: { customerId: c.id, name: `میشی${TAG}`, species: 'CAT' } })
    await prisma.petRecord.createMany({
      data: [
        { petId: pet.id, kind: 'VACCINE', title: `سه‌گانه ${TAG}`, doneAt: days(-350), nextDueAt: days(6) },
        { petId: pet.id, kind: 'DEWORMING', title: `ضدانگل ${TAG}`, doneAt: days(-100), nextDueAt: days(-4) },
      ],
    })
    await signInCustomer(context, baseURL, c.id)
    await page.goto('/account')
    const soon = page.getByTestId('dashboard-reminder').filter({ hasText: `سه‌گانه ${TAG}` })
    await expect(soon).toBeVisible()
    await expect(soon).toContainText(pet.name)
    await expect(page.getByTestId('dashboard-reminder').filter({ hasText: `ضدانگل ${TAG}` })).toContainText('موعد گذشته')
    await soon.getByRole('link').click()
    await expect(page).toHaveURL(new RegExp(`/account/pets/${pet.id}$`))
    await expect(page.getByTestId('pet-profile')).toBeVisible()
  })

  test('D03 the owner profile saves birthday, city and gender', async ({ page, context, baseURL }) => {
    const c = await makeCustomer()
    await signInCustomer(context, baseURL, c.id)
    await page.goto('/account/profile')
    await page.waitForFunction(() => {
      const el = document.querySelector('input[name="birthDate"]')?.closest('form')
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'))
    })
    // The seeded surname carries a Latin run tag, which a person's name may not: type a real one.
    await page.locator('input[name="lastName"]').fill('باشگاهی')
    await page.locator('input[name="birthDate"]').fill('1992-07-15')
    await page.locator('input[name="city"]').fill('شیراز')
    await page.locator('select[name="gender"]').selectOption('FEMALE')
    await page.getByRole('button', { name: 'ذخیره', exact: true }).click()
    await expect(page.getByText('اطلاعات ذخیره شد.')).toBeVisible()
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.city).toBe('شیراز')
    expect(row.gender).toBe('FEMALE')
    expect(row.birthDate?.toISOString().slice(0, 10)).toBe('1992-07-15')
    await page.reload()
    await expect(page.locator('input[name="city"]')).toHaveValue('شیراز')
    await expect(page.locator('input[name="birthDate"]')).toHaveValue('1992-07-15')
    await expect(page.locator('select[name="gender"]')).toHaveValue('FEMALE')
  })

  test('D04 the SMS marketing consent toggle persists and records when it changed', async ({ page, context, baseURL }) => {
    const c = await makeCustomer({ marketingSmsConsent: false, marketingConsentAt: null })
    await signInCustomer(context, baseURL, c.id)
    await page.goto('/account/profile')
    const box = page.getByTestId('pref-sms-consent')
    await expect(box).toBeEnabled()
    await expect(box).not.toBeChecked()
    await box.check()
    await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })).marketingSmsConsent).toBe(true)
    const on = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(on.marketingConsentAt).not.toBeNull()
    await page.reload()
    await expect(page.getByTestId('pref-sms-consent')).toBeChecked()

    await expect(page.getByTestId('pref-sms-consent')).toBeEnabled()
    await page.getByTestId('pref-sms-consent').uncheck()
    await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })).marketingSmsConsent).toBe(false)
    const off = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(off.marketingConsentAt!.getTime()).toBeGreaterThanOrEqual(on.marketingConsentAt!.getTime())
    await page.reload()
    await expect(page.getByTestId('pref-sms-consent')).not.toBeChecked()
  })

  test('D05 the dashboard shows points, tier, pets, a personal coupon and the orders section', async ({ page, context, baseURL }) => {
    const c = await makeCustomer({ pointsBalance: 40, lifetimePoints: 40 })
    const pet = await prisma.pet.create({ data: { customerId: c.id, name: `رکس${TAG}`, species: 'DOG', breed: 'ژرمن شپرد' } })
    const code = `D5-${TAG}-${++seq}`.toUpperCase()
    couponCodes.add(code)
    await prisma.coupon.create({ data: { code, title: `هدیه آزمون ${TAG}`, type: 'FIXED', value: 30000, customerId: c.id, perCustomerLimit: 1, usageLimit: 1 } })
    await signInCustomer(context, baseURL, c.id)
    await page.goto('/account')
    await expect(page.getByTestId('club-points')).toBeVisible()
    await expect(page.getByTestId('club-tier')).toBeVisible()
    await expect(page.getByTestId('club-progress')).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(pet.name) }).first()).toBeVisible()
    await expect(page.getByText(code).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'آخرین سفارش‌ها' })).toBeVisible()
  })

  test('D06 the account menu reaches every club page and the old orders list lives at /account/orders', async ({ page, context, baseURL }) => {
    const c = await makeCustomer()
    await signInCustomer(context, baseURL, c.id)
    await page.goto('/account')
    const nav = page.getByRole('navigation', { name: 'حساب کاربری' })
    const targets: [string, RegExp][] = [
      ['حیوانات خانگی', /\/account\/pets$/],
      ['امتیازها و جوایز', /\/account\/club$/],
      ['سوابق خدمات', /\/account\/services$/],
      ['سفارش‌های من', /\/account\/orders$/],
      ['اطلاعات حساب', /\/account\/profile$/],
      ['داشبورد باشگاه', /\/account$/],
    ]
    for (const [label, url] of targets) {
      await nav.getByRole('link', { name: label, exact: true }).click()
      await expect(page).toHaveURL(url)
      await expect(page.locator('h1').first()).toBeVisible()
    }
    await page.goto('/account/orders')
    await expect(nav.getByRole('link', { name: 'سفارش‌های من', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('D07 a profile made by the clinic cannot be taken over with a password sign-up and is claimed by SMS code', async ({ page, context, baseURL }) => {
    const phone = uniquePhone()
    await signInAdmin(context, baseURL)
    await page.goto('/admin/customers')
    await page.getByTestId('customer-create-toggle').click()
    const form = page.getByTestId('customer-create-form')
    await form.locator('input[name="firstName"]').fill('سارا')
    await form.locator('input[name="lastName"]').fill(`کلینیکی${TAG}`)
    await form.locator('input[name="phone"]').fill(phone)
    await form.locator('input[name="city"]').fill('تبریز')
    await page.getByTestId('customer-create-save').click()
    await expect(page).toHaveURL(/\/admin\/customers\/[a-z0-9]+$/, { timeout: 30000 })
    const made = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    expect(made.createdByAdmin).toBe(true)
    expect(made.passwordHash).toBeNull()
    await prisma.pet.create({ data: { customerId: made.id, name: `کوکو${TAG}`, species: 'CAT' } })

    await context.clearCookies()
    // Typing the phone into the password sign-up must not hand over the clinic profile.
    await page.goto('/account/login?mode=register')
    await page.locator('input[name="firstName"]').fill('مهاجم')
    await page.locator('input[name="lastName"]').fill('آزمون')
    await page.locator('input[name="phone"]').fill(phone)
    await page.locator('input[name="password"]').fill('Gorbeh-Parvaneh-1405')
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page).not.toHaveURL(/\/account$/)
    expect((await prisma.customer.findUniqueOrThrow({ where: { phone } })).passwordHash).toBeNull()

    // The real owner proves the phone with the SMS code and finds her pet in the same profile.
    await loginBySms(page, phone)
    await expect(page).toHaveURL(/\/account$/, { timeout: 30000 })
    const claimed = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    expect(claimed.id).toBe(made.id)
    expect(claimed.phoneVerifiedAt).not.toBeNull()
    await expect(page.getByRole('link', { name: new RegExp(`کوکو${TAG}`) }).first()).toBeVisible()
  })

  test('D08 a signed-in shopper cart is mirrored into a cart snapshot', async ({ page, context, baseURL }) => {
    const c = await makeCustomer()
    const product = await shopProduct()
    await signInCustomer(context, baseURL, c.id)
    await page.goto(`/product/${encodeURIComponent(product.slugFa)}`)
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await expect.poll(() => prisma.cartSnapshot.findUnique({ where: { customerId: c.id } }), { timeout: 30000 }).not.toBeNull()
    const snap = await prisma.cartSnapshot.findUniqueOrThrow({ where: { customerId: c.id } })
    expect(snap.itemCount).toBeGreaterThanOrEqual(1)
    expect(snap.subtotal).toBeGreaterThan(0)
    expect(JSON.stringify(snap.items)).toContain(product.id)
  })

  test('D09 placing the order clears the cart snapshot', async ({ page, context, baseURL }) => {
    const c = await makeCustomer()
    await prisma.address.create({
      data: { customerId: c.id, recipientName: 'آزمون باشگاه', recipientPhone: c.phone, province: 'تهران', city: 'تهران', addressLine: 'خیابان شریعتی، کوچه آزمون خودکار، نبش میدان', postalCode: '1938973111', isDefault: true },
    })
    const product = await shopProduct()
    await signInCustomer(context, baseURL, c.id)
    await page.goto(`/product/${encodeURIComponent(product.slugFa)}`)
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await expect.poll(() => prisma.cartSnapshot.findUnique({ where: { customerId: c.id } }), { timeout: 30000 }).not.toBeNull()

    await page.goto('/checkout')
    await expect(page.locator('h1')).toHaveText('تکمیل خرید')
    const cod = page.getByRole('radio', { name: /پرداخت در محل/ })
    await expect(cod).toBeEnabled()
    await cod.check()
    await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()
    await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}/, { timeout: 30000 })
    await expect
      .poll(async () => (await prisma.cartSnapshot.findUnique({ where: { customerId: c.id } }))?.itemCount ?? 0, { timeout: 30000 })
      .toBe(0)
  })

  test('D10 another customer can neither open a pet profile nor see its clinic visits', async ({ page, context, baseURL }) => {
    const owner = await makeCustomer()
    const other = await makeCustomer()
    const pet = await prisma.pet.create({ data: { customerId: owner.id, name: `خصوصی${TAG}`, species: 'DOG' } })
    await prisma.serviceVisit.create({ data: { customerId: owner.id, petId: pet.id, serviceName: `ویزیت محرمانه ${TAG}`, visitedAt: new Date(), amount: 100000 } })
    await signInCustomer(context, baseURL, other.id)
    const res = await page.goto(`/account/pets/${pet.id}`)
    expect(res?.status()).toBe(404)
    await expect(page.getByTestId('pet-profile')).toHaveCount(0)
    await page.goto('/account/services')
    await expect(page.getByText(`ویزیت محرمانه ${TAG}`)).toHaveCount(0)
    await expect(page.getByTestId('visit-row')).toHaveCount(0)
    await page.goto('/account/pets')
    await expect(page.getByText(`خصوصی${TAG}`)).toHaveCount(0)
  })
})
