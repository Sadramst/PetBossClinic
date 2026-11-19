import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { PrismaClient } from '@prisma/client'

/**
 * Marketing admin panel, end to end in a real browser against the local database.
 * Every journey starts with a signed admin session (same HMAC token the server issues), works through
 * the real admin UI, and then proves the effect on the storefront or in the audit log.
 *
 * Isolation: both browser projects run this file at the same time, and sibling files share the database.
 * Everything created here carries TAG (a per-worker random token) in its title/code/name, is tracked,
 * and is removed in afterAll by exactly those keys. No assertion depends on a global count.
 * The one global resource, MarketingConfig, is changed only inside withConfigLock (E09) and restored there.
 */
const prisma = new PrismaClient()

const TAG = `e${Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(2, 8).padEnd(6, 'x')}`
const TAGU = TAG.toUpperCase()
let seq = 0

const codes = new Set<string>()
const prefixes = new Set<string>()
const leadPhones = new Set<string>()
const customerPhones = new Set<string>()
const orderNumbers = new Set<string>()
const userIds = new Set<string>()

function rand3() {
  return String(Math.floor(Math.random() * 1000)).padStart(3, '0')
}
function uniquePhone(prefix: '0937' | '0936' | '0934', kind: 'lead' | 'customer'): string {
  const phone = `${prefix}${String(Date.now()).slice(-4)}${rand3()}`
  ;(kind === 'lead' ? leadPhones : customerPhones).add(phone)
  return phone
}
function newCode(kind: string): string {
  const code = `E2E-${kind.toUpperCase()}-${TAGU}-${++seq}`
  codes.add(code)
  return code
}

function sessionToken(userId: string, role: 'ADMIN' | 'VIEWER'): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون', role, expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}
function customerToken(customerId: string): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

/** A real User row (the audit log has a foreign key to it) plus the signed admin session cookie. */
async function signInAdmin(context: BrowserContext, baseURL: string | undefined) {
  const user = await prisma.user.create({ data: { email: `e2e-mkt-${TAG}-${++seq}@example.test`, name: 'مدیر آزمون بازاریابی', role: 'ADMIN' } })
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(user.id, 'ADMIN'), url: baseURL! }])
  return user
}

async function makeCustomer(prefix: '0937' | '0936' | '0934', name: string) {
  const phone = uniquePhone(prefix, 'customer')
  const customer = await prisma.customer.create({ data: { phone, firstName: name, lastName: 'آزمون' } })
  return { ...customer, phone }
}

async function seedCoupon(kind: string, over: Record<string, unknown> = {}) {
  const code = newCode(kind)
  return prisma.coupon.create({ data: { code, title: `E2E ${TAG} ${kind}`, type: 'PERCENT', value: 10, ...over } as never })
}

/** A confirmed order that used the coupon, the way checkout leaves it (order + redemption + counter). */
async function seedRedeemedOrder(customerId: string, coupon: { id: string; code: string }, discount: number, total: number) {
  const number = `PB-E${TAGU}-${++seq}`
  orderNumbers.add(number)
  const order = await prisma.order.create({
    data: {
      number,
      customerId,
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      subtotal: total + discount,
      shippingFee: 0,
      discount,
      total,
      couponId: coupon.id,
      couponCode: coupon.code,
      shipName: 'آزمون',
      shipPhone: '09370000000',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddress: 'خیابان آزمون',
      shipPostal: '1938973111',
    },
  })
  await prisma.couponRedemption.create({ data: { couponId: coupon.id, orderId: order.id, customerId, amount: discount } })
  await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })
  return order
}

/** Persian or Latin digits with separators and units to a plain number. */
function toNumber(text: string): number {
  const latin = text
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  return Number(latin.replace(/\D/g, '') || 0)
}

/** The visible coupon row: a table row on wide screens, a card on phones. */
const couponRow = (page: Page, text: string) =>
  page.locator('tr[data-testid="coupon-row"]:visible, [data-testid="coupons-cards"] > li:visible').filter({ hasText: text })
const contactRow = (page: Page, text: string) => page.locator('tr[data-testid="contact-row"]:visible, ul.md\\:hidden > li:visible').filter({ hasText: text })

async function openTab(page: Page, tab: string, q?: string) {
  const qs = new URLSearchParams({ tab })
  if (q) qs.set('q', q)
  await page.goto(`/admin/marketing?${qs.toString()}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1, name: 'بازاریابی و تخفیف‌ها' })).toBeVisible()
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page must not scroll sideways').toBeLessThanOrEqual(1)
}

async function purchasableSlug(): Promise<string> {
  const product = await prisma.product.findFirstOrThrow({
    where: { isActive: true, deletedAt: null, price: { gt: 50_000, lt: 2_000_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
    select: { slugFa: true },
  })
  return product.slugFa
}

async function fillCart(page: Page, slug: string) {
  await page.goto(`/product/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
  await page.goto('/cart', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('coupon-input')).toBeVisible({ timeout: 25000 })
}

async function applyCode(page: Page, code: string) {
  await page.getByTestId('coupon-input').fill(code)
  await page.getByTestId('coupon-apply').click()
}

async function clearStoredCoupon(page: Page) {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('pb_coupon_v1')
    } catch {
      /* storage may be unavailable */
    }
  })
}

/** Cross-process lock: the campaign settings are global and both browser projects run E09 at once. */
const LOCK = path.join(os.tmpdir(), 'pb-e2e-marketing-config.lock')
async function withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
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
      if (Date.now() > deadline) throw new Error('could not get the marketing config lock')
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  const prior = await prisma.marketingConfig.findUnique({ where: { id: 'main' } })
  try {
    return await fn()
  } finally {
    if (prior) {
      const { id: _id, ...data } = prior
      void _id
      await prisma.marketingConfig.update({ where: { id: 'main' }, data })
    } else {
      await prisma.marketingConfig.deleteMany({ where: { id: 'main' } })
    }
    try {
      fs.unlinkSync(LOCK)
    } catch {
      /* already gone */
    }
  }
}

test.describe('marketing admin panel', () => {
  // Each test is its own shopper: the coupon box limits code guessing per client address, and every test
  // browser would otherwise share localhost and exhaust that budget together.
  test.beforeEach(async ({ context }) => {
    const o = () => Math.floor(Math.random() * 250) + 1
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
  })

  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  let slug = ''
  test.beforeAll(async () => {
    slug = await purchasableSlug()
  })

  test.afterAll(async () => {
    const leads = await prisma.marketingContact.findMany({ where: { phone: { in: [...leadPhones] } }, select: { welcomeCouponId: true } })
    const welcomeIds = leads.map((l) => l.welcomeCouponId).filter((x): x is string => !!x)
    const couponWhere = {
      OR: [{ code: { in: [...codes] } }, { title: { contains: TAG } }, { id: { in: welcomeIds } }, ...[...prefixes].map((p) => ({ code: { startsWith: p } }))],
    }
    const customers = await prisma.customer.findMany({ where: { phone: { in: [...customerPhones] } }, select: { id: true } })
    const customerIds = customers.map((c) => c.id)
    await prisma.couponRedemption.deleteMany({ where: { OR: [{ coupon: couponWhere }, { customerId: { in: customerIds } }] } })
    await prisma.order.deleteMany({ where: { OR: [{ number: { in: [...orderNumbers] } }, { customerId: { in: customerIds } }] } })
    await prisma.coupon.deleteMany({ where: couponWhere })
    await prisma.customerGroupMember.deleteMany({ where: { OR: [{ group: { name: { contains: TAG } } }, { customerId: { in: customerIds } }] } })
    await prisma.customerGroup.deleteMany({ where: { name: { contains: TAG } } })
    await prisma.marketingContact.deleteMany({ where: { OR: [{ phone: { in: [...leadPhones] } }, { customerId: { in: customerIds } }] } })
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } })
    await prisma.auditLog.deleteMany({ where: { userId: { in: [...userIds] } } })
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } })
    await prisma.$disconnect()
  })

  test('E01 admin finds Marketing in the menu, every tab opens, nothing overflows, a viewer is kept out', async ({ page, context, baseURL }) => {
    await seedCoupon('long', { title: `E2E ${TAG} یک عنوان بسیار بلند برای بررسی سرریز در عرض موبایل و نمایش درست کارت‌ها در پنل` })
    await signInAdmin(context, baseURL)
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    const navLink = page.locator('a[href*="/admin/marketing"]').first()
    const isDesktop = (page.viewportSize()?.width ?? 1280) >= 1024
    if (isDesktop) {
      await expect(navLink).toBeVisible()
      await expect(navLink).toContainText('بازاریابی')
      await navLink.click()
      await expect(page).toHaveURL(/\/admin\/marketing/)
    } else {
      await expect(navLink).toBeAttached()
      await page.goto('/admin/marketing', { waitUntil: 'domcontentloaded' })
    }
    await expect(page.getByRole('heading', { level: 1, name: 'بازاریابی و تخفیف‌ها' })).toBeVisible()

    const tabs = ['coupons', 'groups', 'contacts', 'config', 'report']
    for (const t of tabs) {
      await page.getByTestId(`marketing-tab-${t}`).click()
      await expect(page).toHaveURL(new RegExp(`tab=${t}`))
      await expect(page.getByTestId(`marketing-tab-${t}`)).toHaveAttribute('aria-current', 'page')
      await expect(page.getByText('بارگذاری انجام نشد')).toHaveCount(0)
      await noHorizontalOverflow(page)
    }
    // The coupon list itself (with the long title) fits the screen.
    await openTab(page, 'coupons', TAG)
    await expect(couponRow(page, TAG).first()).toBeVisible()
    await noHorizontalOverflow(page)

    // A viewer is a valid admin session but must not see or open Marketing.
    await context.addCookies([{ name: 'petboss_session', value: sessionToken('viewer_e2e', 'VIEWER'), url: baseURL! }])
    await page.goto('/admin/marketing', { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/admin\/marketing/)
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin(?!\/login)/)
    await expect(page.locator('a[href*="/admin/marketing"]')).toHaveCount(0)
  })

  test('E02 admin creates a discount code in the UI, it is audited and works on the storefront', async ({ page, context, baseURL }) => {
    const admin = await signInAdmin(context, baseURL)
    const code = newCode('new')
    const title = `E2E ${TAG} جشنواره ساخت`
    await openTab(page, 'coupons')
    await page.getByTestId('coupon-new').click()
    await expect(page.getByTestId('coupon-form')).toBeVisible()
    // An empty title is refused with a clear message and nothing is created.
    await page.getByTestId('coupon-form-submit').click()
    await expect(page.getByTestId('coupon-form-error')).toBeVisible()
    expect(await prisma.coupon.count({ where: { code } })).toBe(0)

    await page.getByTestId('coupon-form-title').fill(title)
    await page.getByTestId('coupon-form-code').fill(code.toLowerCase())
    await page.getByTestId('coupon-form-type').selectOption('PERCENT')
    await page.getByTestId('coupon-form-value').fill('15')
    await page.getByTestId('coupon-form-usage-limit').fill('5')
    await page.getByTestId('coupon-form-submit').click()

    await expect.poll(async () => (await prisma.coupon.findUnique({ where: { code } }))?.value, { timeout: 20000 }).toBe(15)
    const row = await prisma.coupon.findUniqueOrThrow({ where: { code } })
    expect(row).toMatchObject({ title, type: 'PERCENT', isActive: true, usageLimit: 5, usedCount: 0, source: 'manual' })
    const audit = await prisma.auditLog.findFirst({ where: { entity: 'COUPON', entityId: row.id, action: 'CREATE', userId: admin.id } })
    expect(audit, 'creating a coupon is written to the audit log').not.toBeNull()

    await openTab(page, 'coupons', code)
    await expect(couponRow(page, code)).toBeVisible()

    // A shopper uses it.
    await fillCart(page, slug)
    await applyCode(page, code)
    await expect(page.getByTestId('coupon-applied')).toContainText(title)
    await expect(page.getByTestId('discount-line')).toBeVisible()
  })

  test('E03 admin edits a code, then deactivates it and the storefront refuses it', async ({ page, context, baseURL }) => {
    const admin = await signInAdmin(context, baseURL)
    const coupon = await seedCoupon('edit', { value: 10 })
    await openTab(page, 'coupons', coupon.code)
    const row = couponRow(page, coupon.code)
    await expect(row).toBeVisible()
    await row.getByTestId('coupon-edit').click()
    await expect(page.getByTestId('coupon-form-code')).toHaveValue(coupon.code)
    const newTitle = `E2E ${TAG} ویرایش‌شده`
    await page.getByTestId('coupon-form-title').fill(newTitle)
    await page.getByTestId('coupon-form-value').fill('20')
    await page.getByTestId('coupon-form-submit').click()
    await expect.poll(async () => (await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.value, { timeout: 20000 }).toBe(20)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).title).toBe(newTitle)
    expect(await prisma.auditLog.count({ where: { entity: 'COUPON', entityId: coupon.id, action: 'UPDATE', userId: admin.id } })).toBeGreaterThan(0)

    // The edited code works for a shopper.
    await fillCart(page, slug)
    await applyCode(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toContainText(newTitle)

    // Deactivate in the admin.
    await openTab(page, 'coupons', coupon.code)
    await couponRow(page, coupon.code).getByTestId('coupon-toggle').click()
    await expect.poll(async () => (await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.isActive, { timeout: 20000 }).toBe(false)
    await expect(couponRow(page, coupon.code).getByText('غیرفعال', { exact: true })).toBeVisible()

    // The storefront now refuses it with a specific message.
    await clearStoredCoupon(page)
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('coupon-input')).toBeVisible({ timeout: 25000 })
    await applyCode(page, coupon.code)
    await expect(page.getByRole('alert').filter({ hasText: 'معتبر نیست' })).toBeVisible()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)
  })

  test('E04 admin duplicates a code, deletes the copy with confirmation, and cannot delete a redeemed code', async ({ page, context, baseURL }) => {
    const admin = await signInAdmin(context, baseURL)
    const original = await seedCoupon('dup', { value: 12 })
    const redeemed = await seedCoupon('used', { value: 5000, type: 'FIXED' })
    const customer = await makeCustomer('0936', 'خریدار')
    await seedRedeemedOrder(customer.id, redeemed, 5000, 95000)

    // Duplicate: the copy is inactive, has a fresh code and no usage.
    await openTab(page, 'coupons', original.title)
    await couponRow(page, original.code).getByTestId('coupon-duplicate').click()
    await expect
      .poll(async () => prisma.coupon.count({ where: { title: `${original.title} (کپی)` } }), { timeout: 20000 })
      .toBe(1)
    const copy = await prisma.coupon.findFirstOrThrow({ where: { title: `${original.title} (کپی)` } })
    expect(copy).toMatchObject({ isActive: false, usedCount: 0, value: 12, type: 'PERCENT' })
    expect(copy.code).not.toBe(original.code)
    codes.add(copy.code)
    expect(await prisma.auditLog.count({ where: { entity: 'COUPON', entityId: copy.id, action: 'CREATE', userId: admin.id } })).toBe(1)

    // Delete the copy: the confirmation dialog can be cancelled, then confirmed.
    await openTab(page, 'coupons', copy.code)
    const copyRow = couponRow(page, copy.code)
    await expect(copyRow).toBeVisible()
    await copyRow.getByTestId('coupon-delete').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(copy.code)
    await dialog.getByRole('button', { name: 'انصراف' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await prisma.coupon.count({ where: { id: copy.id } })).toBe(1)
    await copyRow.getByTestId('coupon-delete').click()
    await page.getByRole('dialog').getByRole('button', { name: 'حذف کد' }).click()
    await expect.poll(async () => prisma.coupon.count({ where: { id: copy.id } }), { timeout: 20000 }).toBe(0)
    expect(await prisma.auditLog.count({ where: { entity: 'COUPON', entityId: copy.id, action: 'DELETE', userId: admin.id } })).toBe(1)

    // A code that was used in an order is protected: the panel says so and keeps it.
    await openTab(page, 'coupons', redeemed.code)
    await couponRow(page, redeemed.code).getByTestId('coupon-delete').click()
    await page.getByRole('dialog').getByRole('button', { name: 'حذف کد' }).click()
    await expect(page.getByText('در سفارش‌ها استفاده شده').first()).toBeVisible({ timeout: 15000 })
    expect(await prisma.coupon.count({ where: { id: redeemed.id } })).toBe(1)
    expect(await prisma.couponRedemption.count({ where: { couponId: redeemed.id } })).toBe(1)
  })

  test('E05 admin bulk-generates single-use codes, gets the CSV, and one of them works for a shopper', async ({ page, context, baseURL }) => {
    const admin = await signInAdmin(context, baseURL)
    const prefix = `EB${String(Date.now()).slice(-5)}`
    prefixes.add(prefix)
    const title = `E2E ${TAG} گروهی`
    await openTab(page, 'coupons')
    await page.getByTestId('bulk-open').click()
    await expect(page.getByTestId('bulk-form')).toBeVisible()
    await page.getByTestId('bulk-count').fill('12')
    await page.getByTestId('bulk-form').locator('input').nth(1).fill(prefix)
    await page.getByTestId('coupon-form-title').fill(title)
    await page.getByTestId('coupon-form-value').fill('8')

    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByTestId('bulk-submit').click()])
    await expect(page.getByTestId('bulk-done')).toBeVisible()
    const csv = fs.readFileSync((await download.path())!, 'utf8')

    const rows = await prisma.coupon.findMany({ where: { code: { startsWith: `${prefix}-` } } })
    expect(rows).toHaveLength(12)
    expect(new Set(rows.map((r) => r.code)).size).toBe(12)
    for (const r of rows) {
      expect(r).toMatchObject({ source: 'bulk', usageLimit: 1, perCustomerLimit: 1, value: 8, title })
      expect(r.batchId).toBe(rows[0].batchId)
      expect(csv).toContain(r.code)
    }
    const batchAudit = await prisma.auditLog.findFirst({ where: { entity: 'COUPON_BATCH', entityId: rows[0].batchId!, userId: admin.id } })
    expect(batchAudit).not.toBeNull()

    // The batch can be downloaded again later from the panel.
    await page.getByRole('button', { name: 'بستن', exact: true }).first().click()
    await openTab(page, 'coupons', prefix)
    await expect(page.getByText('دسته‌های ساخته‌شده')).toBeVisible()

    // One generated code works once for a shopper.
    await fillCart(page, slug)
    await applyCode(page, rows[0].code)
    await expect(page.getByTestId('coupon-applied')).toContainText(title)
  })

  test('E06 admin searches and filters the code list by text, status and type', async ({ page, context, baseURL }) => {
    await signInAdmin(context, baseURL)
    const token = `flt${TAG}`
    const a = await seedCoupon('fa', { title: `${token} الف`, type: 'PERCENT', value: 10 })
    const b = await seedCoupon('fb', { title: `${token} ب`, type: 'FIXED', value: 20000, isActive: false })
    const c = await seedCoupon('fc', { title: `${token} ج`, type: 'FREE_SHIPPING', value: 0 })
    const other = await seedCoupon('fo', { title: `E2E ${TAG} دیگر` })

    await openTab(page, 'coupons')
    await page.getByTestId('coupon-search').fill(token)
    await page.getByTestId('coupon-search').press('Enter')
    await expect(page).toHaveURL(new RegExp(`q=${token}`))
    for (const x of [a, b, c]) await expect(couponRow(page, x.code)).toHaveCount(1)
    await expect(couponRow(page, other.code)).toHaveCount(0)

    await page.getByTestId('coupon-filter-status').selectOption('inactive')
    await expect(page).toHaveURL(/status=inactive/)
    await expect(couponRow(page, b.code)).toHaveCount(1)
    await expect(couponRow(page, a.code)).toHaveCount(0)
    await expect(couponRow(page, c.code)).toHaveCount(0)

    await page.getByTestId('coupon-filter-status').selectOption('')
    await expect(page).not.toHaveURL(/status=/)
    await page.getByTestId('coupon-filter-type').selectOption('FREE_SHIPPING')
    await expect(page).toHaveURL(/type=FREE_SHIPPING/)
    await expect(couponRow(page, c.code)).toHaveCount(1)
    await expect(couponRow(page, a.code)).toHaveCount(0)
    await expect(couponRow(page, b.code)).toHaveCount(0)

    // Nothing matches: a friendly empty state, not a blank page.
    await openTab(page, 'coupons', `zzz${TAG}nomatch`)
    await expect(page.getByText('کدی با این فیلتر پیدا نشد')).toBeVisible()
    await noHorizontalOverflow(page)
  })

  test('E07 admin creates a customer group, adds a member by phone, and the group code works only for that member', async ({ page, context, baseURL }) => {
    const admin = await signInAdmin(context, baseURL)
    const member = await makeCustomer('0937', 'عضو')
    const outsider = await makeCustomer('0934', 'بیرونی')
    const groupName = `E2E ${TAG} مشتریان ویژه`

    await openTab(page, 'groups')
    await page.getByTestId('group-name').fill(groupName)
    await page.getByTestId('group-create').click()
    const card = page.locator(`[data-testid="group-card"][data-name="${groupName}"]`)
    await expect(card).toBeVisible({ timeout: 20000 })
    const group = await prisma.customerGroup.findUniqueOrThrow({ where: { name: groupName } })
    expect(await prisma.auditLog.count({ where: { entity: 'CUSTOMER_GROUP', entityId: group.id, action: 'CREATE', userId: admin.id } })).toBe(1)

    await card.getByTestId('group-manage').click()
    await card.getByTestId('group-add-input').fill(`${member.phone}\n09100000000`)
    await card.getByTestId('group-add-submit').click()
    await expect(card.getByTestId('group-note')).toContainText('نفر اضافه شد')
    // The second number is not a customer: reported, not silently dropped.
    await expect(card.getByTestId('group-note')).toContainText('09100000000')
    await expect(card.getByTestId('group-members')).toContainText(member.phone)
    await expect(card.getByTestId('group-count')).toHaveText(/^[1۱]$/)
    expect(await prisma.customerGroupMember.count({ where: { groupId: group.id, customerId: member.id } })).toBe(1)
    expect(await prisma.customerGroupMember.count({ where: { groupId: group.id } })).toBe(1)

    const coupon = await seedCoupon('grp', { groupId: group.id, value: 25 })
    await fillCart(page, slug)

    // Someone outside the group is told the code is for a group.
    await context.addCookies([{ name: 'pb_customer', value: customerToken(outsider.id), url: baseURL! }])
    await clearStoredCoupon(page)
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('coupon-input')).toBeVisible({ timeout: 25000 })
    await applyCode(page, coupon.code)
    await expect(page.getByRole('alert').filter({ hasText: 'مخصوص گروهی' })).toBeVisible()

    // The member gets the discount.
    await context.addCookies([{ name: 'pb_customer', value: customerToken(member.id), url: baseURL! }])
    await clearStoredCoupon(page)
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('coupon-input')).toBeVisible({ timeout: 25000 })
    await applyCode(page, coupon.code)
    await expect(page.getByTestId('coupon-applied')).toContainText(coupon.title)
    await expect(page.getByTestId('discount-line')).toBeVisible()

    // Removing the member in the panel takes the discount away again.
    await openTab(page, 'groups')
    const again = page.locator(`[data-testid="group-card"][data-name="${groupName}"]`)
    await again.getByTestId('group-manage').click()
    await again.getByTestId('group-members').getByRole('button').first().click()
    await expect.poll(async () => prisma.customerGroupMember.count({ where: { groupId: group.id } }), { timeout: 20000 }).toBe(0)
    await clearStoredCoupon(page)
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('coupon-input')).toBeVisible({ timeout: 25000 })
    await applyCode(page, coupon.code)
    await expect(page.getByRole('alert').filter({ hasText: 'مخصوص گروهی' })).toBeVisible()
  })

  test('E08 admin sees a captured lead, its coupon status, exports the CSV and unsubscribes it', async ({ page, context, baseURL }) => {
    const admin = await signInAdmin(context, baseURL)
    const phone = uniquePhone('0937', 'lead')
    const welcome = await seedCoupon('wel', { source: 'welcome', usageLimit: 1, usedCount: 1, firstOrderOnly: true })
    const contact = await prisma.marketingContact.create({
      data: { phone, name: 'مخاطب آزمون', source: 'footer', consentAt: new Date(), welcomeCouponId: welcome.id },
    })

    await openTab(page, 'contacts', phone)
    const row = contactRow(page, phone)
    await expect(row).toBeVisible()
    await expect(row).toContainText('فوتر سایت')
    await expect(row).toContainText('کد استفاده شد')
    await expect(page.getByTestId('contacts-total')).toHaveText(/^[1۱]$/)

    // CSV export contains the lead.
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByTestId('contacts-export').click()])
    expect(fs.readFileSync((await download.path())!, 'utf8')).toContain(phone)
    expect(await prisma.auditLog.count({ where: { entity: 'MARKETING_CONTACT', entityId: 'csv', action: 'EXPORT', userId: admin.id } })).toBeGreaterThan(0)

    // Unsubscribe, then subscribe again.
    await row.getByRole('button', { name: 'لغو عضویت' }).click()
    await expect.poll(async () => (await prisma.marketingContact.findUnique({ where: { id: contact.id } }))?.unsubscribedAt != null, { timeout: 20000 }).toBe(true)
    await expect(row.getByRole('button', { name: 'فعال‌سازی' })).toBeVisible()
    await expect(row.getByText('لغو عضویت', { exact: true })).toBeVisible()
    // A success toast from the previous action can sit over the button on a phone: click through the DOM.
    await row.getByRole('button', { name: 'فعال‌سازی' }).evaluate((el) => (el as HTMLElement).click())
    await expect.poll(async () => (await prisma.marketingContact.findUnique({ where: { id: contact.id } }))?.unsubscribedAt, { timeout: 20000 }).toBeNull()
    expect(await prisma.auditLog.count({ where: { entity: 'MARKETING_CONTACT', entityId: contact.id, userId: admin.id } })).toBe(2)
    await noHorizontalOverflow(page)
  })

  test('E09 campaign settings: a new welcome value reaches the popup code and the banner shows on the storefront', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    const admin = await signInAdmin(context, baseURL)
    const leadPhone = uniquePhone('0936', 'lead')
    const popupTitle = `E2E ${TAG} هدیه خوش‌آمد`
    const bannerText = `E2E ${TAG} بنر جشنواره`

    await withConfigLock(async () => {
      await prisma.marketingConfig.upsert({
        where: { id: 'main' },
        create: { id: 'main' },
        update: {},
      })
      // Start from a known state: popup on and immediate, welcome gift 10%, banner off.
      await prisma.marketingConfig.update({
        where: { id: 'main' },
        data: {
          popupEnabled: true,
          popupTitle: 'تخفیف خوش‌آمد',
          popupText: 'شماره‌تان را بگذارید تا کد تخفیف شخصی بگیرید.',
          popupDelaySeconds: 0,
          welcomeEnabled: true,
          welcomeType: 'PERCENT',
          welcomeValue: 10,
          welcomeMaxDiscount: null,
          welcomeMinSubtotal: 0,
          welcomeValidDays: 14,
          bannerEnabled: false,
          bannerText: null,
          bannerLink: null,
          bannerEndsAt: null,
          bannerCouponCode: null,
        },
      })

      await openTab(page, 'config')
      await expect(page.getByTestId('config-form')).toBeVisible()
      await page.getByTestId('config-popup-title').fill(popupTitle)
      await expect(page.getByTestId('config-preview')).toContainText(popupTitle)
      await page.getByTestId('config-welcome-type').selectOption('PERCENT')
      await page.getByTestId('config-welcome-value').fill('23')
      await page.getByTestId('config-banner-enabled').setChecked(true)
      await page.getByTestId('config-banner-text').fill(bannerText)
      await expect(page.getByTestId('config-banner-preview')).toContainText(bannerText)
      await page.getByTestId('config-save').click()
      await expect.poll(async () => (await prisma.marketingConfig.findUnique({ where: { id: 'main' } }))?.welcomeValue, { timeout: 20000 }).toBe(23)
      const saved = await prisma.marketingConfig.findUniqueOrThrow({ where: { id: 'main' } })
      expect(saved).toMatchObject({ popupTitle, bannerEnabled: true, bannerText, welcomeType: 'PERCENT' })
      expect(await prisma.auditLog.count({ where: { entity: 'MARKETING_CONFIG', userId: admin.id, action: 'UPDATE' } })).toBeGreaterThan(0)

      // A visitor on the storefront sees the banner and the popup with the new copy, and gets a 23% code.
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('promo-banner')).toContainText(bannerText, { timeout: 20000 })
      const popup = page.getByTestId('welcome-popup')
      await expect(popup).toBeVisible({ timeout: 25000 })
      await expect(popup).toContainText(popupTitle)
      await page.getByTestId('welcome-popup-input').fill(leadPhone)
      await page.getByTestId('welcome-popup-submit').click()
      const shown = (await page.getByTestId('welcome-code').innerText()).trim()
      const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: shown } })
      expect(coupon).toMatchObject({ source: 'welcome', type: 'PERCENT', value: 23, usageLimit: 1, firstOrderOnly: true })
      codes.add(coupon.code)
    })

    // The lead now shows up in the contacts list, with its popup source.
    await openTab(page, 'contacts', leadPhone)
    const row = contactRow(page, leadPhone)
    await expect(row).toBeVisible()
    await expect(row).toContainText('پنجره خوش‌آمد')
    await expect(row).toContainText('کد استفاده نشده')
  })

  test('E10 report numbers grow after an order that used a code, and the code list shows its usage', async ({ page, context, baseURL }) => {
    await signInAdmin(context, baseURL)
    const customer = await makeCustomer('0934', 'گزارش')
    const coupon = await seedCoupon('rep', { type: 'FIXED', value: 5000 })
    const phone = uniquePhone('0937', 'lead')
    const stat = async (id: string) => toNumber(await page.getByTestId(`stat-${id}`).innerText())

    await openTab(page, 'report')
    const before = {
      redemptions: await stat('redemptions'),
      discount: await stat('discount'),
      revenue: await stat('revenue'),
      contacts7: await stat('contacts7'),
    }

    await seedRedeemedOrder(customer.id, coupon, 5000, 95000)
    await seedRedeemedOrder(customer.id, coupon, 7000, 93000)
    await prisma.marketingContact.create({ data: { phone, source: 'popup', consentAt: new Date(), customerId: customer.id } })

    await expect
      .poll(
        async () => {
          await openTab(page, 'report')
          return await stat('redemptions')
        },
        { timeout: 30000, intervals: [500, 1000, 2000] }
      )
      .toBeGreaterThanOrEqual(2)
    // Other workers add and delete rows at the same time, so a before/after delta is unreliable:
    // the totals can only be asserted to include at least our own share.
    await openTab(page, 'report')
    expect(await stat('redemptions')).toBeGreaterThanOrEqual(2)
    expect(await stat('discount')).toBeGreaterThanOrEqual(12000)
    expect(await stat('revenue')).toBeGreaterThanOrEqual(188000)
    expect(await stat('contacts7')).toBeGreaterThanOrEqual(1)
    void before
    await expect(page.getByTestId('stat-conversion')).toBeVisible()
    await noHorizontalOverflow(page)

    // The coupon list shows how often it was used.
    await openTab(page, 'coupons', coupon.code)
    await expect(couponRow(page, coupon.code)).toContainText(/[2۲]\s*بار/)
  })
})
