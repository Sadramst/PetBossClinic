import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000))
    } catch {
      /* storage may be unavailable */
    }
  })
})

/**
 * Customer-club admin CRM, end to end in a real browser against the local database.
 * Every journey starts with a signed admin session (the same HMAC token the server issues, with a real User row
 * because the audit log points at it), works through the real admin UI and then proves the effect in the database
 * and in the audit log.
 *
 * Isolation: both browser projects run this file at once and sibling files share the database. Everything created
 * here is tied to TAG (a per-worker random token) or to a tracked id, and removed in afterAll by exactly those keys.
 * No assertion depends on a global count. The one global singleton, LoyaltyConfig, is changed or relied on only
 * inside withLoyaltyLock (E05, E09) and restored there.
 */
const prisma = new PrismaClient()

// Letters only: a search term with three or more digits would also be matched against phone numbers.
const TAG = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
const PHONE_PART = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
let seq = 0

const customerIds = new Set<string>()
const customerPhones = new Set<string>()
const userIds = new Set<string>()
const couponCodes = new Set<string>()

function uniquePhone(): string {
  const phone = `0935${PHONE_PART}${String(++seq).padStart(4, '0')}`
  customerPhones.add(phone)
  return phone
}

function sessionToken(userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER'): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون باشگاه', role, expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}

/** A real User row plus the signed admin session cookie. Calling it again with another role swaps the session. */
async function signIn(context: BrowserContext, baseURL: string | undefined, role: 'ADMIN' | 'EDITOR' | 'VIEWER', existing?: { id: string }) {
  const user =
    existing ??
    (await prisma.user.create({
      data: { email: `e2e-club-${TAG}-${++seq}@example.test`, name: 'مدیر آزمون باشگاه', role: role === 'VIEWER' ? 'VIEWER' : role },
    }))
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(user.id, role), url: baseURL! }])
  return user
}

async function makeCustomer(over: Record<string, unknown> = {}) {
  const phone = uniquePhone()
  const customer = await prisma.customer.create({
    data: { phone, firstName: 'مشتری', lastName: `${TAG} ${seq}`, marketingSmsConsent: false, ...over } as never,
  })
  customerIds.add(customer.id)
  return customer
}

async function makePet(customerId: string, name: string, species: 'DOG' | 'CAT' = 'DOG') {
  return prisma.pet.create({ data: { customerId, name, species } as never })
}

/** Waits until React has attached to the element: a click or submit before that would be a native form submit. */
async function hydrated(page: Page, testid: string) {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`)
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'))
    },
    testid,
    { timeout: 30000 }
  )
}

async function open360(page: Page, customerId: string) {
  await page.goto(`/admin/customers/${customerId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('customer-360')).toBeVisible()
  await hydrated(page, 'customer-360')
}

const tab = (page: Page, label: string) => page.getByRole('tab', { name: new RegExp(`^${label}`) })
async function openTab(page: Page, label: string) {
  await tab(page, label).click()
  await expect(tab(page, label)).toHaveAttribute('aria-selected', 'true')
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page must not scroll sideways').toBeLessThanOrEqual(1)
}

/** Persian or Latin digits with separators and units to a plain number. */
function toNumber(text: string): number {
  const latin = text
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  return Number(latin.replace(/\D/g, '') || 0)
}

const dayString = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)

const auditCount = (userId: string, entity: string, action: string, entityId?: string) =>
  prisma.auditLog.count({ where: { userId, entity, action, ...(entityId ? { entityId } : {}) } })

/** Confirms the open confirmation dialog with the given button label. */
async function confirm(page: Page, label: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

/** Points a clinic visit is worth, with exactly the formula the server uses. */
async function expectedServicePoints(amount: number, tierKey: string): Promise<number> {
  const cfg = await prisma.loyaltyConfig.findUnique({ where: { id: 'main' } })
  const ppt = cfg?.pointsPerThousandToman ?? 1
  const svc = cfg?.serviceMultiplier ?? 1.5
  const tiers = (Array.isArray(cfg?.tiersJson) ? cfg!.tiersJson : []) as Array<{ key?: string; earnMultiplier?: number }>
  const mult = tiers.find((t) => t.key === tierKey)?.earnMultiplier ?? 1
  return Math.floor((amount / 1000) * ppt * svc * mult)
}

/** Cross-process lock: LoyaltyConfig is global and both browser projects run these tests at the same time. */
const LOCK = path.join(os.tmpdir(), 'pb-e2e-club-loyalty-config.lock')
async function withLoyaltyLock<T>(fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 150_000
  for (;;) {
    try {
      fs.writeFileSync(LOCK, String(Date.now()), { flag: 'wx' })
      break
    } catch {
      try {
        if (Date.now() - Number(fs.readFileSync(LOCK, 'utf8')) > 180_000) fs.unlinkSync(LOCK)
      } catch {
        /* another worker just released it */
      }
      if (Date.now() > deadline) throw new Error('could not get the loyalty config lock')
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  const prior = await prisma.loyaltyConfig.findUnique({ where: { id: 'main' } })
  try {
    return await fn()
  } finally {
    if (prior) {
      const { id: _id, updatedAt: _u, ...data } = prior
      void _id
      void _u
      await prisma.loyaltyConfig.update({ where: { id: 'main' }, data: data as never })
    } else {
      await prisma.loyaltyConfig.deleteMany({ where: { id: 'main' } })
    }
    try {
      fs.unlinkSync(LOCK)
    } catch {
      /* already gone */
    }
  }
}

test.describe('customer club: admin CRM', () => {
  // Each test is its own admin on its own client address: admin writes are rate limited per address and user.
  test.beforeEach(async ({ context }) => {
    const o = () => Math.floor(Math.random() * 250) + 1
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
  })

  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const byTag = await prisma.customer.findMany({
      where: { OR: [{ phone: { in: [...customerPhones] } }, { id: { in: [...customerIds] } }, { lastName: { contains: TAG } }] },
      select: { id: true },
    })
    const ids = byTag.map((c) => c.id)
    const guarded = async (fn: () => Promise<unknown>) => {
      try {
        await fn()
      } catch {
        /* a sibling table may not cascade: the next step still runs */
      }
    }
    await guarded(() => prisma.messageOutbox.deleteMany({ where: { customerId: { in: ids } } }))
    await guarded(() => prisma.coupon.deleteMany({ where: { OR: [{ customerId: { in: ids } }, { code: { in: [...couponCodes] } }] } }))
    await guarded(() => prisma.pointsTransaction.deleteMany({ where: { customerId: { in: ids } } }))
    await guarded(() => prisma.serviceVisit.deleteMany({ where: { customerId: { in: ids } } }))
    await guarded(() => prisma.petRecord.deleteMany({ where: { pet: { customerId: { in: ids } } } }))
    await guarded(() => prisma.pet.deleteMany({ where: { customerId: { in: ids } } }))
    await guarded(() => prisma.adminCustomerNote.deleteMany({ where: { customerId: { in: ids } } }))
    await guarded(() => prisma.cartSnapshot.deleteMany({ where: { customerId: { in: ids } } }))
    await guarded(() => prisma.customer.deleteMany({ where: { id: { in: ids } } }))
    await guarded(() => prisma.reward.deleteMany({ where: { title: { contains: TAG } } }))
    await guarded(() => prisma.segment.deleteMany({ where: { name: { contains: TAG } } }))
    await guarded(() => prisma.auditLog.deleteMany({ where: { userId: { in: [...userIds] } } }))
    await guarded(() => prisma.user.deleteMany({ where: { id: { in: [...userIds] } } }))
    await prisma.$disconnect()
  })

  test('E01 customer list: search by name, phone and pet, filters, sorting and pagination', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'EDITOR')
    const rows = page.getByTestId('customer-row')

    // Three customers with different tier, city, species, consent and tag.
    const flag = `fl${TAG}`
    const a = await makeCustomer({ lastName: `${flag}-a`, tier: 'SILVER', city: 'شیراز', tags: [`vip${TAG}`], marketingSmsConsent: true, pointsBalance: 1200 })
    const b = await makeCustomer({ lastName: `${flag}-b`, tier: 'BRONZE', city: 'تبریز', tags: [], marketingSmsConsent: false, pointsBalance: 5 })
    const c = await makeCustomer({ lastName: `${flag}-c`, tier: 'GOLD', city: 'شیراز', tags: [], marketingSmsConsent: true, pointsBalance: 3300 })
    await makePet(a.id, `رکسی${TAG}`, 'DOG')
    await makePet(b.id, `میمی${TAG}`, 'CAT')
    await makePet(c.id, `بتی${TAG}`, 'CAT')

    await page.goto('/admin/customers', { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'customers-search')
    const search = page.getByTestId('customers-search')

    // Search by name part, by phone and by a pet's name.
    await search.fill(flag)
    await search.press('Enter')
    await expect(page).toHaveURL(new RegExp(`q=${flag}`))
    await expect(rows).toHaveCount(3)

    await search.fill(a.phone)
    await search.press('Enter')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${flag}-a`)

    await search.fill(`میمی${TAG}`)
    await search.press('Enter')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${flag}-b`)
    await expect(rows.first()).toContainText('بدون رضایت پیامک')

    // Filters narrow the same three people.
    await search.fill(flag)
    await page.getByLabel('سطح', { exact: true }).selectOption('GOLD')
    await page.getByRole('button', { name: 'اعمال' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${flag}-c`)

    await page.getByLabel('سطح', { exact: true }).selectOption('')
    await page.getByLabel('نوع حیوان', { exact: true }).selectOption('DOG')
    await page.getByRole('button', { name: 'اعمال' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${flag}-a`)

    await page.getByLabel('نوع حیوان', { exact: true }).selectOption('')
    await page.getByLabel('رضایت پیامک', { exact: true }).selectOption('no')
    await page.getByRole('button', { name: 'اعمال' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${flag}-b`)

    await page.getByLabel('رضایت پیامک', { exact: true }).selectOption('')
    await page.getByLabel('شهر', { exact: true }).fill('شیراز')
    await page.getByRole('button', { name: 'اعمال' }).click()
    await expect(rows).toHaveCount(2)

    await page.getByLabel('شهر', { exact: true }).fill('')
    await page.getByLabel('برچسب', { exact: true }).fill(`vip${TAG}`)
    await page.getByRole('button', { name: 'اعمال' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${flag}-a`)

    // Sorting by points: the header link toggles the direction.
    await page.goto(`/admin/customers?q=${flag}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'customers-search')
    await page.getByTestId('customers-table').getByRole('link', { name: 'امتیاز' }).click()
    await expect(page).toHaveURL(/sort=points&dir=desc|dir=desc&sort=points/)
    await expect(rows.first()).toContainText(`${flag}-c`)
    await page.getByTestId('customers-table').getByRole('link', { name: 'امتیاز' }).click()
    await expect(page).toHaveURL(/dir=asc/)
    await expect(rows.first()).toContainText(`${flag}-b`)

    // Pagination: 27 people, 25 per page.
    const bulk = `pg${TAG}`
    await prisma.customer.createMany({
      data: Array.from({ length: 27 }, (_, i) => ({
        phone: uniquePhone(),
        firstName: 'مشتری',
        lastName: `${bulk}-${String(i).padStart(2, '0')}`,
        pointsBalance: i * 10,
        marketingSmsConsent: false,
      })),
    })
    await page.goto(`/admin/customers?q=${bulk}&sort=points&dir=desc`, { waitUntil: 'domcontentloaded' })
    await expect(rows).toHaveCount(25)
    await expect(page.getByText('۲۷ مشتری')).toBeVisible()
    await expect(rows.first()).toContainText(`${bulk}-26`)
    const pager = page.getByRole('navigation', { name: 'صفحه‌بندی' })
    await pager.getByRole('link', { name: 'بعدی' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText(`${bulk}-01`)
    await expect(rows.last()).toContainText(`${bulk}-00`)
    await noHorizontalOverflow(page)
  })

  test('E02 admin creates a customer profile, a duplicate phone or email is refused, then edits the profile', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'EDITOR')
    const phone = uniquePhone()
    const email = `e2e.${TAG}.${++seq}@example.com`

    await page.goto('/admin/customers', { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'customer-create-toggle')
    await page.getByTestId('customer-create-toggle').click()
    const form = page.getByTestId('customer-create-form')
    await expect(form).toBeVisible()
    await form.locator('input[name="firstName"]').fill('سارا')
    await form.locator('input[name="lastName"]').fill(`${TAG} کلینیک`)
    await form.locator('input[name="phone"]').fill(phone)
    await form.locator('input[name="email"]').fill(email)
    await form.locator('input[name="birthDate"]').fill('1370/05/12')
    await form.locator('input[name="city"]').fill('اصفهان')
    await form.locator('input[name="tags"]').fill(`vip, clinic${TAG}`)
    await form.locator('textarea[name="notes"]').fill('مشتری حضوری، یادداشت داخلی آزمون')
    await page.getByTestId('customer-create-save').click()
    await expect(page).toHaveURL(/\/admin\/customers\/[a-z0-9]+$/, { timeout: 30000 })
    await expect(page.getByTestId('customer-360')).toBeVisible()

    const row = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    customerIds.add(row.id)
    expect(row.createdByAdmin).toBe(true)
    expect(row.source).toBe('clinic')
    expect(row.city).toBe('اصفهان')
    expect(row.email).toBe(email)
    expect(row.tags).toEqual(expect.arrayContaining(['vip', `clinic${TAG}`]))
    expect(row.birthDate).not.toBeNull()
    // Nobody agreed to SMS at the desk, so nothing is assumed.
    expect(row.marketingSmsConsent).toBe(false)
    await expect(page.getByText('ثبت توسط کلینیک').first()).toBeVisible()
    await expect(page.getByText('رضایت پیامک تبلیغاتی ندارد')).toBeVisible()
    await expect.poll(() => auditCount(admin.id, 'CUSTOMER', 'CREATE', row.id)).toBe(1)

    // The same phone is refused, then the same email under another phone.
    await page.goto('/admin/customers', { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'customer-create-toggle')
    await page.getByTestId('customer-create-toggle').click()
    const again = page.getByTestId('customer-create-form')
    await again.locator('input[name="firstName"]').fill('تکراری')
    await again.locator('input[name="lastName"]').fill(`${TAG} dup`)
    await again.locator('input[name="phone"]').fill(phone)
    await page.getByTestId('customer-create-save').click()
    await expect(page.getByText('مشتری‌ای با این شماره موبایل قبلاً ثبت شده است.')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/customers$/)

    await again.locator('input[name="phone"]').fill(uniquePhone())
    await again.locator('input[name="email"]').fill(email.toUpperCase())
    await page.getByTestId('customer-create-save').click()
    await expect(page.getByText('مشتری‌ای با این ایمیل قبلاً ثبت شده است.')).toBeVisible()
    expect(await prisma.customer.count({ where: { OR: [{ phone }, { email }] } })).toBe(1)

    // Edit the profile on the 360 page and record the consent given at the desk.
    await open360(page, row.id)
    await page.getByRole('button', { name: 'ویرایش', exact: true }).click()
    const edit = page.getByTestId('c360-edit-form')
    await expect(edit).toBeVisible()
    await edit.locator('input[name="city"]').fill('مشهد')
    await edit.locator('input[name="consent"]').check()
    await edit.getByRole('button', { name: 'ذخیره', exact: true }).click()
    await expect(page.getByText('پروفایل ذخیره شد').first()).toBeVisible()
    const updated = await prisma.customer.findUniqueOrThrow({ where: { id: row.id } })
    expect(updated.city).toBe('مشهد')
    expect(updated.marketingSmsConsent).toBe(true)
    expect(updated.marketingConsentAt).not.toBeNull()
    await expect.poll(() => auditCount(admin.id, 'CUSTOMER', 'UPDATE', row.id)).toBe(1)
    await expect(page.getByText('رضایت پیامک تبلیغاتی ثبت است')).toBeVisible()
  })

  test('E03 customer 360: every tab opens at any width, insights act, notes form a timeline, the cart is visible', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'EDITOR')
    const customer = await makeCustomer({ firstName: 'نگین', lastName: `${TAG} نمای کلی`, city: 'کرج', tags: ['آزمون'], marketingSmsConsent: false })
    const productName = `خوراک آزمون ${TAG}`
    await prisma.cartSnapshot.create({
      data: { customerId: customer.id, items: [{ productId: 'none', quantity: 2, name: productName, price: 150000 }], itemCount: 2, subtotal: 300000 },
    })

    await open360(page, customer.id)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${TAG} نمای کلی`)
    await expect(page.getByTestId('c360-tier')).toBeVisible()
    await expect(page.getByTestId('c360-points')).toBeVisible()
    await expect(page.getByText('رضایت پیامک تبلیغاتی ندارد')).toBeVisible()

    const signature: Array<[string, Locator]> = [
      ['نمای کلی', page.getByText('پیشنهادهای هوشمند')],
      ['حیوانات', page.getByTestId('admin-pet-add')],
      ['خدمات', page.getByTestId('visit-form')],
      ['سفارش‌ها', page.getByText('این مشتری هنوز سفارشی ندارد.')],
      ['امتیاز', page.getByTestId('adjust-form')],
      ['کدهای تخفیف', page.getByTestId('coupon-form')],
      ['پیام‌ها', page.getByTestId('msg-body')],
      ['یادداشت‌ها', page.getByTestId('note-body')],
      ['سبد خرید', page.getByText(productName)],
    ]
    for (const [label, marker] of signature) {
      await openTab(page, label)
      await expect(marker).toBeVisible()
      await noHorizontalOverflow(page)
    }
    await expect(page.getByText('جمع:')).toContainText('۳۰۰٬۰۰۰ تومان')

    // A one-click insight: this customer has no SMS consent, so the suggestion is a task that lands in the notes.
    await openTab(page, 'نمای کلی')
    const insight = page.getByTestId('insights').locator('li').filter({ hasText: 'پیامک تبلیغاتی نمی‌خواهد' })
    await expect(insight).toBeVisible()
    await insight.getByTestId('insight-apply').click()
    await expect(page.getByText('انجام شد').first()).toBeVisible()
    await expect.poll(() => prisma.adminCustomerNote.count({ where: { customerId: customer.id } })).toBe(1)

    // A hand-written note joins the timeline, newest first, with who wrote it.
    await openTab(page, 'یادداشت‌ها')
    const text = `تماس گرفته شد و وقت واکسن هماهنگ شد ${TAG}`
    await page.getByTestId('note-body').fill(text)
    await page.getByTestId('note-save').click()
    const list = page.getByTestId('notes-list')
    await expect(list.locator('li')).toHaveCount(2)
    await expect(list.locator('li').first()).toContainText(text)
    await expect(list.locator('li').first()).toContainText('مدیر آزمون باشگاه')
    await expect(list.locator('li').last()).toContainText('کار پیشنهادی')
    const notes = await prisma.adminCustomerNote.findMany({ where: { customerId: customer.id } })
    expect(notes.every((n) => n.adminId === admin.id)).toBe(true)
    await expect.poll(() => auditCount(admin.id, 'CUSTOMER_NOTE', 'CREATE')).toBe(2)
  })

  test('E04 admin adds a pet and health records on the customer\'s behalf, edits, and removes them', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'EDITOR')
    const customer = await makeCustomer({ firstName: 'مهسا', lastName: `${TAG} حیوان` })
    const petName = `رکس ${TAG}`

    await open360(page, customer.id)
    await openTab(page, 'حیوانات')
    await expect(page.getByText('هنوز حیوانی برای این مشتری ثبت نشده است.')).toBeVisible()
    await page.getByTestId('admin-pet-add').click()
    await page.getByTestId('admin-pet-name').fill(petName)
    await page.locator('input[name="breed"]').fill('ژرمن شپرد')
    await page.locator('input[name="weightKg"]').fill('12.5')
    await page.locator('input[name="foodBrand"]').fill('رویال کنین')
    await page.getByTestId('admin-pet-save').click()
    await expect(page.getByText('حیوان اضافه شد').first()).toBeVisible()

    const pet = await prisma.pet.findFirstOrThrow({ where: { customerId: customer.id, name: { contains: TAG } } })
    expect(pet.species).toBe('DOG')
    expect(pet.weightKg).toBe(12.5)
    expect(pet.foodBrand).toBe('رویال کنین')
    await expect.poll(() => auditCount(admin.id, 'PET', 'CREATE', pet.id)).toBe(1)

    const card = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(TAG) }) })
    await expect(card).toBeVisible()
    await expect(card).toContainText('ژرمن شپرد')

    // A vaccine whose next date has already passed shows as overdue.
    await card.locator('input[name="title"]').fill('هاری')
    await card.locator('input[name="doneAt"]').fill(dayString(400))
    await card.locator('input[name="nextDueAt"]').fill(dayString(30))
    await card.getByTestId('admin-record-add').click()
    await expect(page.getByText('سابقه ثبت شد').first()).toBeVisible()
    const item = card.locator('li').filter({ hasText: 'هاری' })
    await expect(item).toBeVisible()
    await expect(item).toContainText('واکسن')
    await expect(item.getByText('عقب‌افتاده')).toBeVisible()
    const record = await prisma.petRecord.findFirstOrThrow({ where: { petId: pet.id, kind: 'VACCINE' } })
    expect(record.kind).toBe('VACCINE')
    expect(record.source).toBe('admin')
    expect(record.nextDueAt).not.toBeNull()
    await expect.poll(() => auditCount(admin.id, 'PET_RECORD', 'CREATE')).toBeGreaterThanOrEqual(1)

    // The weight is corrected in the edit form.
    await card.getByRole('button', { name: 'ویرایش', exact: true }).click()
    await card.locator('input[name="weightKg"]').fill('14')
    await card.getByRole('button', { name: 'ذخیره', exact: true }).click()
    await expect(page.getByText('ذخیره شد').first()).toBeVisible()
    await expect.poll(async () => (await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).weightKg).toBe(14)
    await expect.poll(() => auditCount(admin.id, 'PET', 'UPDATE', pet.id)).toBe(1)

    // Removing the record asks first, then deletes it.
    await item.getByRole('button', { name: 'حذف' }).click()
    await confirm(page, 'حذف')
    await expect(card.locator('li').filter({ hasText: 'هاری' })).toHaveCount(0)
    expect(await prisma.petRecord.count({ where: { petId: pet.id, kind: 'VACCINE' } })).toBe(0)
    await expect.poll(() => auditCount(admin.id, 'PET_RECORD', 'DELETE', record.id)).toBe(1)

    // Removing the pet is soft: the profile keeps its history but is marked removed.
    await card.getByRole('button', { name: 'حذف', exact: true }).first().click()
    await confirm(page, 'حذف')
    await expect.poll(async () => (await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).isActive).toBe(false)
    await expect(page.getByRole('heading', { level: 2, name: /حذف‌شده/ })).toBeVisible()
    await expect.poll(() => auditCount(admin.id, 'PET', 'DELETE', pet.id)).toBe(1)
    await noHorizontalOverflow(page)
  })

  test('E05 a clinic visit awards points by the live rate, an edit corrects them, a delete takes them back', async ({ page, context, baseURL }) => {
    test.setTimeout(120_000)
    const admin = await signIn(context, baseURL, 'EDITOR')
    const customer = await makeCustomer({ firstName: 'پگاه', lastName: `${TAG} خدمات`, tier: 'BRONZE', pointsBalance: 0, lifetimePoints: 0 })
    const pet = await makePet(customer.id, `لوسی${TAG}`, 'CAT')
    const service = `واکسیناسیون سالانه ${TAG}`

    await withLoyaltyLock(async () => {
      await open360(page, customer.id)
      await openTab(page, 'خدمات')
      await page.getByTestId('visit-service').fill(service)
      await page.locator('select[name="petId"]').selectOption(pet.id)
      await page.getByTestId('visit-amount').fill('200000')
      await page.locator('input[name="doctor"]').fill('دکتر آزمون')
      await page.getByTestId('visit-save').click()
      await expect(page.getByText('مراجعه ثبت شد').first()).toBeVisible()

      const visit = await prisma.serviceVisit.findFirstOrThrow({ where: { customerId: customer.id } })
      const expected = await expectedServicePoints(200_000, 'BRONZE')
      expect(expected).toBeGreaterThan(0)
      expect(visit.serviceName).toBe(service)
      expect(visit.petId).toBe(pet.id)
      expect(visit.pointsAwarded).toBe(expected)
      expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).pointsBalance).toBe(expected)
      const tx = await prisma.pointsTransaction.findFirstOrThrow({ where: { customerId: customer.id, kind: 'SERVICE' } })
      expect(tx.refId).toBe(visit.id)
      await expect.poll(() => auditCount(admin.id, 'SERVICE_VISIT', 'CREATE', visit.id)).toBe(1)

      const row = page.getByTestId('admin-visit-row').filter({ hasText: service })
      await expect(row).toBeVisible()
      await expect(row).toContainText('لوسی')
      await expect(row).toContainText('دکتر آزمون')
      await expect(page.getByTestId('c360-points')).toContainText(expected.toLocaleString('fa-IR'))

      // The ledger tab lists the earning with its running balance.
      await openTab(page, 'امتیاز')
      await expect(page.getByTestId('ledger-table').locator('tbody tr').first()).toBeVisible()
      await openTab(page, 'خدمات')

      // Editing the amount corrects the points by the difference.
      await row.getByRole('button', { name: 'ویرایش', exact: true }).click()
      await page.getByTestId('visit-amount').fill('100000')
      await page.getByTestId('visit-save').click()
      await expect(page.getByText('مراجعه ویرایش شد و امتیاز اصلاح شد').first()).toBeVisible()
      const lower = await expectedServicePoints(100_000, 'BRONZE')
      await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).pointsBalance).toBe(lower)
      expect((await prisma.serviceVisit.findUniqueOrThrow({ where: { id: visit.id } })).pointsAwarded).toBe(lower)
      await expect.poll(() => auditCount(admin.id, 'SERVICE_VISIT', 'UPDATE', visit.id)).toBe(1)

      // Deleting the visit asks first and reverses what is left of its points.
      await page.getByTestId('admin-visit-row').filter({ hasText: service }).getByRole('button', { name: 'حذف' }).click()
      await confirm(page, 'حذف و کسر امتیاز')
      await expect.poll(() => prisma.serviceVisit.count({ where: { id: visit.id } })).toBe(0)
      await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).pointsBalance).toBe(0)
      await expect.poll(() => auditCount(admin.id, 'SERVICE_VISIT', 'DELETE', visit.id)).toBe(1)
    })
  })

  test('E06 points adjustment needs a reason, never goes below zero, and is capped for editors but not for admins', async ({ page, context, baseURL }) => {
    const editor = await signIn(context, baseURL, 'EDITOR')
    const customer = await makeCustomer({ firstName: 'امید', lastName: `${TAG} امتیاز`, pointsBalance: 0, lifetimePoints: 0 })
    const balance = async () => (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).pointsBalance

    await open360(page, customer.id)
    await openTab(page, 'امتیاز')
    const points = page.getByTestId('adjust-points')
    const note = page.getByTestId('adjust-note')

    // Without a reason the form does not even submit.
    await points.fill('40')
    await page.getByTestId('adjust-save').click()
    expect(await prisma.pointsTransaction.count({ where: { customerId: customer.id } })).toBe(0)

    await note.fill('جبران خطای ثبت آزمون')
    await page.getByTestId('adjust-save').click()
    await expect(page.getByText('امتیاز تعدیل شد').first()).toBeVisible()
    await expect.poll(balance).toBe(40)
    const tx = await prisma.pointsTransaction.findFirstOrThrow({ where: { customerId: customer.id, kind: 'ADJUST' } })
    expect(tx.note).toBe('جبران خطای ثبت آزمون')
    expect(tx.points).toBe(40)
    expect(tx.createdByAdminId).toBe(editor.id)
    await expect(page.getByTestId('ledger-table')).toContainText('جبران خطای ثبت آزمون')
    await expect.poll(() => auditCount(editor.id, 'CUSTOMER_POINTS', 'UPDATE', customer.id)).toBe(1)

    // A deduction larger than the balance stops at zero.
    await points.fill('-100')
    await note.fill('کسر آزمون')
    await page.getByTestId('adjust-save').click()
    await expect.poll(balance).toBe(0)

    // Above 1,000 points an editor is refused and nothing changes.
    await points.fill('1500')
    await note.fill('هدیه ویژه آزمون')
    await page.getByTestId('adjust-save').click()
    await expect(page.getByRole('alert').filter({ hasText: 'فقط توسط مدیر' })).toBeVisible()
    expect(await balance()).toBe(0)

    // The same adjustment goes through for an admin (same page, new session).
    const admin = await signIn(context, baseURL, 'ADMIN')
    await open360(page, customer.id)
    await openTab(page, 'امتیاز')
    await page.getByTestId('adjust-points').fill('1500')
    await page.getByTestId('adjust-note').fill('هدیه ویژه آزمون')
    await page.getByTestId('adjust-save').click()
    await expect.poll(balance).toBe(1500)
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).lifetimePoints).toBeGreaterThanOrEqual(1500)
    await expect.poll(() => auditCount(admin.id, 'CUSTOMER_POINTS', 'UPDATE', customer.id)).toBe(1)
    await expect(page.getByTestId('c360-points')).toContainText('۱٬۵۰۰')
  })

  test('E07 a personal coupon is made from the 360 page, and a message to a customer without consent is refused', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'EDITOR')
    const customer = await makeCustomer({ firstName: 'کیان', lastName: `${TAG} کوپن`, marketingSmsConsent: false })

    await open360(page, customer.id)
    await openTab(page, 'کدهای تخفیف')
    await expect(page.getByText('این مشتری کد تخفیف اختصاصی ندارد.')).toBeVisible()
    await page.getByTestId('coupon-value').fill('15')
    await page.getByTestId('coupon-save').click()
    const made = page.getByTestId('coupon-made')
    await expect(made).toBeVisible()
    const code = (await made.textContent())!.trim()
    couponCodes.add(code)
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code } })
    expect(coupon.customerId).toBe(customer.id)
    expect(coupon.type).toBe('PERCENT')
    expect(coupon.value).toBe(15)
    expect(coupon.isActive).toBe(true)
    expect(coupon.source).toBe('admin')
    await expect.poll(() => auditCount(admin.id, 'COUPON', 'CREATE', coupon.id)).toBe(1)
    // After the refresh the code is in the customer's list too.
    await expect(page.locator('table').filter({ hasText: code })).toBeVisible()

    // Messaging: the page warns, drafts are offered, and sending is refused without queueing anything.
    await openTab(page, 'پیام‌ها')
    await expect(page.getByText('این مشتری رضایت دریافت پیامک تبلیغاتی نداده است').first()).toBeVisible()
    await page.getByTestId('ai-draft').click()
    const options = page.getByTestId('draft-options')
    await expect(options).toBeVisible({ timeout: 40000 })
    await expect(options.getByRole('button')).toHaveCount(3)
    await options.getByRole('button').first().click()
    await expect(page.getByTestId('msg-body')).not.toHaveValue('')
    await page.getByTestId('msg-send').click()
    await expect(page.getByText('مشتری رضایت دریافت پیامک تبلیغاتی را نداده است.').first()).toBeVisible()
    expect(await prisma.messageOutbox.count({ where: { customerId: customer.id } })).toBe(0)
    expect(await auditCount(admin.id, 'MESSAGE', 'CREATE')).toBe(0)
  })

  test('E08 CSV export is formula-safe and audited; editors lose the password reset that admins keep; viewers are kept out', async ({ page, context, baseURL }) => {
    const editor = await signIn(context, baseURL, 'EDITOR')
    const csvTag = `${TAG}csv`
    const evil = await makeCustomer({ firstName: "=HYPERLINK(\"http://x.test\")", lastName: csvTag, city: '+SUM(1)', tags: ['@cmd'] })
    await makeCustomer({ firstName: '-2+3', lastName: csvTag })

    await page.goto(`/admin/customers?q=${csvTag}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'customers-export')
    await expect(page.getByTestId('customer-row')).toHaveCount(2)
    // Editors manage customers but cannot reset passwords or block.
    await expect(page.getByRole('button', { name: 'رمز موقت' })).toHaveCount(0)

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('customers-export').click()])
    expect(download.suggestedFilename()).toBe('customers.csv')
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
    const csv = Buffer.concat(chunks).toString('utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff) // opens correctly in Excel with Persian text
    const lines = csv.replace(/^﻿/, '').split(/\r\n/).filter((l) => l.includes(csvTag))
    expect(lines).toHaveLength(2)
    // No cell may start with a character a spreadsheet would run as a formula.
    for (const line of lines) {
      expect(line.startsWith('=') || line.startsWith('+') || line.startsWith('-') || line.startsWith('@')).toBe(false)
      expect(line).not.toMatch(/,[=+@-]/)
    }
    expect(csv).toContain("'=HYPERLINK(")
    expect(csv).toContain("'+SUM(1)")
    expect(csv).toContain("'-2+3")
    // The tag list is joined into one cell, and that cell is not a formula either.
    expect(csv).toContain("'@cmd")
    await expect.poll(() => auditCount(editor.id, 'CUSTOMER', 'EXPORT', 'csv')).toBe(1)

    // An admin sees the extra controls on the same rows.
    await signIn(context, baseURL, 'ADMIN')
    await page.goto(`/admin/customers?q=${csvTag}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'رمز موقت' }).first()).toBeVisible()

    // A viewer cannot open any of the club admin pages.
    await signIn(context, baseURL, 'VIEWER')
    for (const url of ['/admin/customers', `/admin/customers/${evil.id}`, '/admin/club', '/admin/segments']) {
      await page.goto(url)
      await expect(page).not.toHaveURL(/\/admin\/(customers|club|segments)/)
    }
    await page.goto('/admin/customers', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('customers-table')).toHaveCount(0)
  })

  test('E09 club settings change the earn rate, rewards are created, edited and deleted, the report adds up', async ({ page, context, baseURL }) => {
    test.setTimeout(150_000)
    await signIn(context, baseURL, 'EDITOR')
    let adminId = ''
    const rich1 = await makeCustomer({ lastName: `${TAG} rp1`, pointsBalance: 777, lifetimePoints: 777 })
    const rich2 = await makeCustomer({ lastName: `${TAG} rp2`, pointsBalance: 777, lifetimePoints: 777 })
    const rewardTitle = `جایزه آزمون ${TAG}`

    await withLoyaltyLock(async () => {
      // Report: the numbers are internally consistent and include the two members just created.
      await page.goto('/admin/club', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1, name: 'باشگاه مشتریان' })).toBeVisible()
      await hydrated(page, 'club-report')
      const members = toNumber((await page.getByTestId('rep-members').textContent()) ?? '')
      const outstanding = toNumber((await page.getByTestId('rep-outstanding').textContent()) ?? '')
      const liability = toNumber((await page.getByTestId('rep-liability').textContent()) ?? '')
      const cfgRow = await prisma.loyaltyConfig.findUniqueOrThrow({ where: { id: 'main' } })
      expect(members).toBeGreaterThanOrEqual(2)
      expect(outstanding).toBeGreaterThanOrEqual(777 * 2)
      expect(liability).toBe(outstanding * cfgRow.pointValueToman)
      await noHorizontalOverflow(page)

      // An editor sees the rules but cannot change them.
      await openTab(page, 'تنظیمات امتیاز و سطح‌ها')
      await expect(page.getByText('تغییر قوانین امتیاز فقط برای نقش مدیر فعال است.')).toBeVisible()
      await expect(page.getByTestId('cfg-save')).toHaveCount(0)
      await expect(page.getByTestId('cfg-per-thousand')).toBeDisabled()

      // An admin raises the earn rate; a clinic visit then earns on the new rate.
      const admin = await signIn(context, baseURL, 'ADMIN')
      adminId = admin.id
      await page.goto('/admin/club', { waitUntil: 'domcontentloaded' })
      await hydrated(page, 'club-report')
      await openTab(page, 'تنظیمات امتیاز و سطح‌ها')
      const newRate = cfgRow.pointsPerThousandToman === 3 ? 4 : 3
      await page.getByTestId('cfg-per-thousand').fill(String(newRate))
      await page.getByTestId('cfg-save').click()
      await expect(page.getByText('تنظیمات باشگاه ذخیره شد').first()).toBeVisible()
      await expect.poll(async () => (await prisma.loyaltyConfig.findUniqueOrThrow({ where: { id: 'main' } })).pointsPerThousandToman).toBe(newRate)
      await expect.poll(() => auditCount(admin.id, 'LOYALTY_CONFIG', 'UPDATE', 'main')).toBe(1)

      const member = await makeCustomer({ firstName: 'رها', lastName: `${TAG} نرخ`, tier: 'BRONZE', pointsBalance: 0, lifetimePoints: 0 })
      await open360(page, member.id)
      await openTab(page, 'خدمات')
      await page.getByTestId('visit-service').fill(`معاینه ${TAG}`)
      await page.getByTestId('visit-amount').fill('100000')
      await page.getByTestId('visit-save').click()
      await expect(page.getByText('مراجعه ثبت شد').first()).toBeVisible()
      const expected = await expectedServicePoints(100_000, 'BRONZE')
      const oldRate = Math.floor((100_000 / 1000) * cfgRow.pointsPerThousandToman * cfgRow.serviceMultiplier)
      expect(expected).toBeGreaterThan(0)
      expect(expected).not.toBe(oldRate)
      await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: member.id } })).pointsBalance).toBe(expected)
    })

    // Rewards: create, edit, delete (admin session is still active).
    await page.goto('/admin/club', { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'club-report')
    await openTab(page, 'جوایز')
    await page.getByTestId('reward-new').click()
    await expect(page.getByTestId('reward-form')).toBeVisible()
    await page.getByTestId('reward-title').fill(rewardTitle)
    await page.getByTestId('reward-cost').fill('123')
    await page.getByTestId('reward-value').fill('15')
    await page.getByTestId('reward-save').click()
    await expect(page.getByText('جایزه ذخیره شد').first()).toBeVisible()
    const reward = await prisma.reward.findFirstOrThrow({ where: { title: rewardTitle } })
    expect(reward.pointsCost).toBe(123)
    expect(reward.couponType).toBe('PERCENT')
    expect(reward.couponValue).toBe(15)
    const adminUser = adminId
    await expect.poll(() => auditCount(adminUser, 'REWARD', 'CREATE', reward.id)).toBe(1)

    const rewardRow = page.getByTestId('rewards-table').locator('tr').filter({ hasText: rewardTitle })
    await expect(rewardRow).toContainText('۱۲۳ امتیاز')
    await rewardRow.getByRole('button', { name: 'ویرایش' }).click()
    await page.getByTestId('reward-cost').fill('200')
    await page.getByTestId('reward-save').click()
    await expect.poll(async () => (await prisma.reward.findUniqueOrThrow({ where: { id: reward.id } })).pointsCost).toBe(200)
    await expect(rewardRow).toContainText('۲۰۰ امتیاز')
    await expect.poll(() => auditCount(adminUser, 'REWARD', 'UPDATE', reward.id)).toBe(1)

    // Bad input is refused with a clear message.
    await rewardRow.getByRole('button', { name: 'ویرایش' }).click()
    await page.getByTestId('reward-value').fill('150')
    await page.getByTestId('reward-save').click()
    await expect(page.getByText('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.').first()).toBeVisible()
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: reward.id } })).couponValue).toBe(15)
    await page.getByRole('button', { name: 'انصراف' }).click()

    await rewardRow.getByRole('button', { name: 'حذف' }).click()
    await confirm(page, 'حذف')
    await expect.poll(() => prisma.reward.count({ where: { id: reward.id } })).toBe(0)
    await expect.poll(() => auditCount(adminUser, 'REWARD', 'DELETE', reward.id)).toBe(1)
    void rich1
    void rich2
  })

  test('E10 segment builder: live audience count, consent exclusion, save, pin, delete, and nothing overflows', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'EDITOR')
    const segTag = `seg${TAG}`
    const dogOwner = await makeCustomer({ lastName: `${TAG} s1`, tags: [segTag], marketingSmsConsent: true })
    const catOwner = await makeCustomer({ lastName: `${TAG} s2`, tags: [segTag], marketingSmsConsent: true })
    await makeCustomer({ lastName: `${TAG} s3`, tags: [segTag], marketingSmsConsent: true })
    await makeCustomer({ lastName: `${TAG} s4`, tags: [segTag], marketingSmsConsent: false })
    await makeCustomer({ lastName: `${TAG} s5`, tags: ['other'], marketingSmsConsent: true })
    await makePet(dogOwner.id, `رکس${TAG}`, 'DOG')
    await makePet(catOwner.id, `میمی${TAG}`, 'CAT')
    const name = `گروه آزمون ${TAG}`

    await page.goto('/admin/segments', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: 'گروه‌های مشتریان' })).toBeVisible()
    await hydrated(page, 'segment-new')
    await page.getByTestId('segment-new').click()
    await expect(page.getByTestId('segment-form')).toBeVisible()
    await page.getByTestId('segment-name').fill(name)
    await noHorizontalOverflow(page)

    // The audience count follows the rules: three consenting people carry the tag, a fourth is left out for lack of consent.
    await page.getByLabel('برچسب (هرکدام)').fill(segTag)
    await expect(page.getByTestId('segment-count')).toHaveText('۳')
    await expect(page.getByTestId('segment-preview')).toContainText('به‌دلیل نداشتن رضایت پیامک کنار گذاشته شدند')
    // Narrowing by species leaves only the dog owner.
    await page.getByTestId('rules-builder').getByRole('button', { name: 'سگ', exact: true }).click()
    await expect(page.getByTestId('segment-count')).toHaveText('۱')
    await expect(page.getByTestId('segment-preview')).toContainText(`رکس${TAG}`)
    await noHorizontalOverflow(page)

    await page.getByTestId('segment-save').click()
    await expect(page.getByText('گروه ذخیره شد').first()).toBeVisible()
    const segment = await prisma.segment.findFirstOrThrow({ where: { name } })
    expect(segment.rules).toMatchObject({ tagsAny: [segTag], species: ['DOG'] })
    await expect.poll(() => auditCount(admin.id, 'SEGMENT', 'CREATE', segment.id)).toBe(1)

    const card = page.getByTestId('segments-list').locator('li').filter({ hasText: name })
    await expect(card).toBeVisible()
    await expect(card).toContainText('۱ مشتری با رضایت پیامک')

    // Pin, then delete with confirmation.
    await card.getByRole('button', { name: 'سنجاق', exact: true }).click()
    await expect.poll(async () => (await prisma.segment.findUniqueOrThrow({ where: { id: segment.id } })).isPinned).toBe(true)
    await expect(card.getByText('سنجاق‌شده')).toBeVisible()
    await expect.poll(() => auditCount(admin.id, 'SEGMENT', 'UPDATE', segment.id)).toBe(1)

    await card.getByRole('button', { name: 'حذف', exact: true }).click()
    await confirm(page, 'حذف')
    await expect.poll(() => prisma.segment.count({ where: { id: segment.id } })).toBe(0)
    await expect.poll(() => auditCount(admin.id, 'SEGMENT', 'DELETE', segment.id)).toBe(1)

    // The other club pages fit the screen too (the phone project runs this at phone width).
    for (const url of [`/admin/customers?q=${TAG}`, '/admin/club', `/admin/customers/${dogOwner.id}`]) {
      await page.goto(url)
      await expect(page.locator('h1').first()).toBeVisible()
      await noHorizontalOverflow(page)
    }
  })
})
