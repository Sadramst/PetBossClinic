import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

/**
 * CRM v2 (A): unified customers list and the customer 360 timeline, in a real browser against the local database.
 *
 * Isolation: both browser projects run this file at once and sibling files share the database. Every row created here
 * carries TAG (a per-worker random letter token) in its last name or is tracked by id, and is removed in afterAll by
 * exactly those keys. Every list journey narrows the table with `q=TAG`, so no assertion depends on a global count.
 * Nothing here touches a global singleton, so the file needs no serial mode.
 */
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the CRM e2e specs')
const prisma = new PrismaClient()

const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
// Letters only: a search term with three or more digits would also be matched against phone numbers.
const TAG = letters(7)
const PHONE_PART = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
let seq = 0
// Per-test search scope: starts with TAG (cleanup key) plus three letters, so earlier tests' customers never match.
let scope = TAG

const customerIds = new Set<string>()
const customerPhones = new Set<string>()
const userIds = new Set<string>()

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const toNumber = (text: string) => Number(text.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/\D/g, '') || 0)

test.beforeEach(async ({ context }) => {
  scope = `${TAG}${letters(3)}`
  // The welcome popup (8 s after load) would cover the page; these tests are not about it.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000))
    } catch {
      /* storage may be unavailable */
    }
  })
  const o = () => Math.floor(Math.random() * 250) + 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
})

function uniquePhone(): string {
  const phone = `0935${PHONE_PART}${String(++seq).padStart(4, '0')}`
  customerPhones.add(phone)
  return phone
}

function sessionToken(userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER'): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون پرونده', role, expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}

/** A real User row (the audit log and saved views point at it) plus the signed session cookie. */
async function signIn(context: BrowserContext, baseURL: string | undefined, role: 'ADMIN' | 'EDITOR' = 'ADMIN') {
  const user = await prisma.user.create({ data: { email: `e2e-crm-a-${TAG}-${++seq}@example.test`, name: `مدیر آزمون ${TAG}`, role } })
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(user.id, role), url: baseURL! }])
  return user
}

/** A staff member who can own customers; the name is unique so it can be picked by its label. */
async function makeStaff() {
  const name = `مسئول ${TAG}${letters(4)}`
  const user = await prisma.user.create({ data: { email: `e2e-crm-a-staff-${TAG}-${++seq}@example.test`, name, role: 'EDITOR' } })
  userIds.add(user.id)
  return user
}

async function makeCustomer(word: string, over: Record<string, unknown> = {}) {
  const customer = await prisma.customer.create({
    data: { phone: uniquePhone(), firstName: 'مشتری', lastName: `${scope}${word}`, marketingSmsConsent: false, ...over } as never,
  })
  customerIds.add(customer.id)
  return customer
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

async function openList(page: Page, query = `q=${scope}`) {
  await page.goto(`/admin/customers?${query}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('customers-search')).toBeVisible()
  await hydrated(page, 'customers-search')
}

async function open360(page: Page, customerId: string) {
  await page.goto(`/admin/customers/${customerId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('customer-360')).toBeVisible()
  await hydrated(page, 'customer-health-card')
  await hydrated(page, 'timeline')
}

const row = (page: Page, word: string) => page.getByTestId('customer-row').filter({ hasText: `${scope}${word}` })
const applyFilters = (page: Page) => page.getByRole('search').getByRole('button', { name: 'اعمال' }).click()
const timelineItems = (page: Page, type: string) => page.locator(`[data-testid="timeline-item"][data-type="${type}"]`)

const tab = (page: Page, label: string) => page.getByRole('tab', { name: new RegExp(`^${label}`) })
async function openTab(page: Page, label: string) {
  await tab(page, label).click()
  await expect(tab(page, label)).toHaveAttribute('aria-selected', 'true')
}

async function confirmDialogWith(page: Page, label: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

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
  await guarded(() => prisma.crmActivity.deleteMany({ where: { OR: [{ customerId: { in: ids } }, { actorUserId: { in: [...userIds] } }] } }))
  await guarded(() => prisma.crmTask.deleteMany({ where: { customerId: { in: ids } } }))
  await guarded(() => prisma.contactMessage.deleteMany({ where: { customerId: { in: ids } } }))
  await guarded(() => prisma.orderItem.deleteMany({ where: { order: { customerId: { in: ids } } } }))
  await guarded(() => prisma.order.deleteMany({ where: { customerId: { in: ids } } }))
  await guarded(() => prisma.messageOutbox.deleteMany({ where: { customerId: { in: ids } } }))
  await guarded(() => prisma.pointsTransaction.deleteMany({ where: { customerId: { in: ids } } }))
  await guarded(() => prisma.serviceVisit.deleteMany({ where: { customerId: { in: ids } } }))
  await guarded(() => prisma.adminCustomerNote.deleteMany({ where: { customerId: { in: ids } } }))
  await guarded(() => prisma.savedView.deleteMany({ where: { ownerId: { in: [...userIds] } } }))
  await guarded(() => prisma.customer.deleteMany({ where: { id: { in: ids } } }))
  await guarded(() => prisma.auditLog.deleteMany({ where: { userId: { in: [...userIds] } } }))
  await guarded(() => prisma.user.deleteMany({ where: { id: { in: [...userIds] } } }))
  await prisma.$disconnect()
})

test.describe('CRM A: customers list and timeline', () => {
  test('A01 the list shows lifecycle stage and health score, and search narrows by name and by phone', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL)
    const vip = await makeCustomer('vipx', { lifecycleStage: 'VIP', healthScore: 91, churnRisk: 'LOW' })
    await makeCustomer('riskx', { lifecycleStage: 'AT_RISK', healthScore: 28, churnRisk: 'HIGH' })

    await openList(page)
    await expect(row(page, 'vipx')).toHaveCount(1)
    await expect(row(page, 'riskx')).toHaveCount(1)
    await expect(row(page, 'vipx')).toContainText('ویژه')
    await expect(row(page, 'riskx')).toContainText('در معرض ریزش')
    expect(toNumber((await row(page, 'vipx').getByTestId('customer-health').locator('b').innerText()) || '')).toBe(91)
    expect(toNumber((await row(page, 'riskx').getByTestId('customer-health').locator('b').innerText()) || '')).toBe(28)
    await expect(row(page, 'riskx').getByTestId('churn-badge')).toBeVisible()

    // Narrow by a name fragment typed into the search box, then by a phone number.
    await page.getByTestId('customers-search').fill(`${scope}riskx`)
    await applyFilters(page)
    await expect(page).toHaveURL(new RegExp(`q=${scope}riskx`))
    await expect(row(page, 'riskx')).toHaveCount(1)
    await expect(row(page, 'vipx')).toHaveCount(0)

    await page.getByTestId('customers-search').fill(vip.phone)
    await applyFilters(page)
    await expect(page).toHaveURL(/q=09/)
    await expect(row(page, 'vipx')).toHaveCount(1)
    await expect(row(page, 'riskx')).toHaveCount(0)
  })

  test('A02 filtering by lifecycle stage and by churn risk keeps only matching customers', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL)
    await makeCustomer('actv', { lifecycleStage: 'ACTIVE', healthScore: 70, churnRisk: 'LOW' })
    await makeCustomer('vipy', { lifecycleStage: 'VIP', healthScore: 95, churnRisk: 'LOW' })
    await makeCustomer('lapz', { lifecycleStage: 'LAPSED', healthScore: 12, churnRisk: 'HIGH' })

    await openList(page)
    await expect(page.getByTestId('customer-row')).toHaveCount(3)

    await page.getByTestId('customers-filter-lifecycle').selectOption('VIP')
    await applyFilters(page)
    await expect(page).toHaveURL(/lifecycle=VIP/)
    await expect(page.getByTestId('customer-row')).toHaveCount(1)
    await expect(row(page, 'vipy')).toHaveCount(1)

    // Swap to the churn filter alone: the two LOW-risk customers are not the high-risk one.
    await page.getByTestId('customers-filter-lifecycle').selectOption('')
    await page.getByTestId('customers-filter-churn').selectOption('HIGH')
    await applyFilters(page)
    await expect(page).toHaveURL(/churn=HIGH/)
    await expect(page).not.toHaveURL(/lifecycle=/)
    await expect(page.getByTestId('customer-row')).toHaveCount(1)
    await expect(row(page, 'lapz')).toHaveCount(1)
    await expect(row(page, 'lapz')).toContainText('غیرفعال')
  })

  test('A03 the owner filter separates owned, other-owner and unowned customers', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL)
    const staff = await makeStaff()
    const other = await makeStaff()
    await makeCustomer('own1', { ownerId: staff.id })
    await makeCustomer('own2', { ownerId: staff.id })
    await makeCustomer('oth1', { ownerId: other.id })
    await makeCustomer('free', {})

    await openList(page)
    await expect(page.getByTestId('customer-row')).toHaveCount(4)
    await expect(row(page, 'own1')).toContainText(staff.name!)

    await page.getByTestId('customers-filter-owner').selectOption({ label: staff.name! })
    await applyFilters(page)
    await expect(page).toHaveURL(new RegExp(`owner=${staff.id}`))
    await expect(page.getByTestId('customer-row')).toHaveCount(2)
    await expect(row(page, 'own1')).toHaveCount(1)
    await expect(row(page, 'own2')).toHaveCount(1)

    await page.getByTestId('customers-filter-owner').selectOption('none')
    await applyFilters(page)
    await expect(page).toHaveURL(/owner=none/)
    await expect(page.getByTestId('customer-row')).toHaveCount(1)
    await expect(row(page, 'free')).toHaveCount(1)
  })

  test('A04 a saved view stores the filters, restores them from a clean list and can be deleted', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL)
    await makeCustomer('svip', { lifecycleStage: 'VIP', healthScore: 90, churnRisk: 'LOW' })
    await makeCustomer('sact', { lifecycleStage: 'ACTIVE', healthScore: 60, churnRisk: 'LOW' })
    const viewName = `ویژه‌های ${TAG}`

    await openList(page)
    await expect(page.getByTestId('saved-view-save')).toBeEnabled()
    await page.getByTestId('customers-filter-lifecycle').selectOption('VIP')
    await applyFilters(page)
    await expect(page).toHaveURL(/lifecycle=VIP/)
    await expect(page.getByTestId('customer-row')).toHaveCount(1)

    await hydrated(page, 'saved-views')
    await page.getByTestId('saved-view-save').click()
    await page.getByTestId('saved-view-name').fill(viewName)
    await page.getByTestId('saved-view-save-confirm').click()
    await expect
      .poll(async () => (await prisma.savedView.findFirst({ where: { ownerId: admin.id, entity: 'CUSTOMER', name: viewName } }))?.filters, { timeout: 20000 })
      .toMatchObject({ lifecycle: 'VIP', q: scope })

    // From a clean list (both customers visible) the view brings the filters back.
    await openList(page)
    await expect(page.getByTestId('customer-row')).toHaveCount(2)
    await page.getByTestId('saved-view-select').selectOption({ label: viewName })
    await expect(page).toHaveURL(/lifecycle=VIP/)
    await expect(page.getByTestId('customer-row')).toHaveCount(1)
    await expect(row(page, 'svip')).toHaveCount(1)

    await page.getByTestId('saved-view-delete').selectOption({ label: viewName })
    await confirmDialogWith(page, 'حذف')
    await expect.poll(() => prisma.savedView.count({ where: { ownerId: admin.id, name: viewName } }), { timeout: 20000 }).toBe(0)
  })

  test('A05 bulk tagging tags only the selected customers, writes an audit row and the tag filter finds them', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL)
    const a = await makeCustomer('tga')
    const b = await makeCustomer('tgb')
    const c = await makeCustomer('tgc')
    const tag = `tg${TAG}`

    await openList(page)
    await expect(page.getByTestId('customer-row')).toHaveCount(3)
    await expect(page.getByTestId('customers-bulk')).toHaveCount(0)
    await row(page, 'tga').getByTestId('customer-select').check()
    await row(page, 'tgb').getByTestId('customer-select').check()
    await expect(page.getByTestId('customers-bulk')).toBeVisible()

    await page.getByTestId('bulk-tag').fill(tag)
    await page.getByTestId('bulk-tag-add').click()
    await expect
      .poll(async () => (await prisma.customer.findMany({ where: { id: { in: [a.id, b.id, c.id] }, tags: { has: tag } }, select: { id: true } })).map((x) => x.id).sort(), { timeout: 20000 })
      .toEqual([a.id, b.id].sort())
    await expect(page.getByTestId('customers-bulk')).toHaveCount(0)
    await expect
      .poll(() => prisma.auditLog.count({ where: { userId: admin.id, entity: 'CUSTOMER', action: 'UPDATE', entityId: 'bulk' } }), { timeout: 20000 })
      .toBeGreaterThan(0)

    await openList(page, `q=${scope}&tag=${tag}`)
    await expect(page.getByTestId('customer-row')).toHaveCount(2)
    await expect(row(page, 'tgc')).toHaveCount(0)
  })

  test('A06 bulk owner assignment sets the owner for the selected customers only', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL)
    const staff = await makeStaff()
    const a = await makeCustomer('asa')
    const b = await makeCustomer('asb')
    const c = await makeCustomer('asc')

    await openList(page)
    await row(page, 'asa').getByTestId('customer-select').check()
    await row(page, 'asb').getByTestId('customer-select').check()
    await expect(page.getByTestId('bulk-assign')).toBeDisabled()
    await page.getByTestId('bulk-owner').selectOption({ label: staff.name! })
    await page.getByTestId('bulk-assign').click()

    await expect
      .poll(async () => (await prisma.customer.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, select: { id: true, ownerId: true } })).filter((x) => x.ownerId === staff.id).map((x) => x.id).sort(), { timeout: 20000 })
      .toEqual([a.id, b.id].sort())
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(row(page, 'asa')).toContainText(staff.name!)
    await expect(row(page, 'asc')).not.toContainText(staff.name!)
  })

  test('A07 the 360 timeline merges an order, a visit, points and a message, and the chips narrow it', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL)
    const customer = await makeCustomer('tl07')
    const number = `E2E-${TAG}-${++seq}`
    const now = Date.now()
    await prisma.order.create({
      data: {
        number, customerId: customer.id, status: 'CONFIRMED', paymentMethod: 'COD', subtotal: 450000, shippingFee: 0, total: 450000,
        shipName: 'مشتری آزمون', shipPhone: customer.phone, shipProvince: 'تهران', shipCity: 'تهران', shipAddress: 'خیابان آزمون', shipPostal: '1234567890',
        createdAt: new Date(now - 4 * 3600_000),
      },
    })
    await prisma.serviceVisit.create({ data: { customerId: customer.id, serviceName: `واکسن ${TAG}`, visitedAt: new Date(now - 3 * 3600_000) } as never })
    await prisma.pointsTransaction.create({ data: { customerId: customer.id, kind: 'ADJUST', points: 40, balanceAfter: 40, note: `هدیه ${TAG}`, createdAt: new Date(now - 2 * 3600_000) } })
    await prisma.contactMessage.create({
      data: { name: 'مشتری آزمون', phone: customer.phone, normalizedPhone: customer.phone, customerId: customer.id, subject: `پرسش ${TAG}`, message: 'سلام، یک سؤال دارم', createdAt: new Date(now - 3600_000) },
    })

    await open360(page, customer.id)
    await expect(timelineItems(page, 'ORDER_PLACED')).toHaveCount(1)
    await expect(timelineItems(page, 'ORDER_PLACED')).toContainText(number)
    await expect(timelineItems(page, 'VISIT_LOGGED')).toContainText(`واکسن ${TAG}`)
    await expect(timelineItems(page, 'POINTS_ADJUSTED')).toContainText(`هدیه ${TAG}`)
    await expect(timelineItems(page, 'CONTACT_MESSAGE_RECEIVED')).toContainText(`پرسش ${TAG}`)
    // Newest first: the message (1 h ago) sits above the order (4 h ago).
    const types = await page.getByTestId('timeline-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
    expect(types.indexOf('CONTACT_MESSAGE_RECEIVED')).toBeLessThan(types.indexOf('ORDER_PLACED'))

    await page.getByTestId('timeline-filter-orders').click()
    await expect(timelineItems(page, 'VISIT_LOGGED')).toHaveCount(0)
    await expect(timelineItems(page, 'ORDER_PLACED')).toHaveCount(1)
    await expect(page.locator('[data-testid="timeline-item"]:not([data-type^="ORDER_"])')).toHaveCount(0)

    await page.getByTestId('timeline-filter-messages').click()
    await expect(timelineItems(page, 'ORDER_PLACED')).toHaveCount(0)
    await expect(timelineItems(page, 'CONTACT_MESSAGE_RECEIVED')).toHaveCount(1)
    await page.getByTestId('timeline-filter-all').click()
    await expect(timelineItems(page, 'VISIT_LOGGED')).toHaveCount(1)
  })

  test('A08 a quick note and a clinic visit entered in the admin UI appear on the timeline', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL)
    const customer = await makeCustomer('tl08')
    const note = `تلفنی نوبت واکسن خواست ${TAG}`
    const service = `معاینه ${TAG}`

    await open360(page, customer.id)
    await expect(page.getByTestId('timeline-item')).toHaveCount(0)

    await page.getByTestId('quick-note-body').fill(note)
    await page.getByTestId('quick-note-submit').click()
    await expect.poll(() => prisma.adminCustomerNote.count({ where: { customerId: customer.id, body: note } }), { timeout: 20000 }).toBe(1)
    await expect.poll(() => prisma.crmActivity.count({ where: { customerId: customer.id, type: 'NOTE_ADDED', actorUserId: admin.id } }), { timeout: 20000 }).toBe(1)

    await openTab(page, 'خدمات')
    await page.getByTestId('visit-service').fill(service)
    await page.getByTestId('visit-amount').fill('200000')
    await page.getByTestId('visit-save').click()
    await expect(page.getByTestId('admin-visit-row').filter({ hasText: service })).toHaveCount(1)
    await expect.poll(() => prisma.serviceVisit.count({ where: { customerId: customer.id, serviceName: service } }), { timeout: 20000 }).toBe(1)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await hydrated(page, 'timeline')
    await expect(timelineItems(page, 'NOTE_ADDED')).toHaveCount(1)
    await expect(timelineItems(page, 'NOTE_ADDED')).toContainText(note)
    await expect(timelineItems(page, 'VISIT_LOGGED')).toContainText(service)
    // The visit earns points (the configured rate decides how many); when it did, the ledger shows on the timeline too.
    const earned = await prisma.pointsTransaction.count({ where: { customerId: customer.id, kind: 'SERVICE' } })
    if (earned > 0) await expect(timelineItems(page, 'POINTS_AWARDED').first()).toBeVisible()
  })

  test('A09 assigning an owner on the 360 page is saved, logged on the timeline and shown in the list', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL)
    const staff = await makeStaff()
    const customer = await makeCustomer('tl09')

    await open360(page, customer.id)
    await expect(page.getByTestId('customer-owner-select')).toHaveValue('')
    await page.getByTestId('customer-owner-select').selectOption({ label: staff.name! })
    await expect.poll(async () => (await prisma.customer.findUnique({ where: { id: customer.id }, select: { ownerId: true } }))?.ownerId, { timeout: 20000 }).toBe(staff.id)
    await expect.poll(() => prisma.crmActivity.count({ where: { customerId: customer.id, type: 'OWNER_CHANGED', actorUserId: admin.id } }), { timeout: 20000 }).toBe(1)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await hydrated(page, 'timeline')
    await expect(page.getByTestId('customer-owner-select')).toHaveValue(staff.id)
    await expect(timelineItems(page, 'OWNER_CHANGED')).toHaveCount(1)

    await openList(page)
    await expect(row(page, 'tl09')).toContainText(staff.name!)

    // And back to unassigned: the select empties and a second event is logged.
    await open360(page, customer.id)
    await page.getByTestId('customer-owner-select').selectOption('')
    await expect.poll(async () => (await prisma.customer.findUnique({ where: { id: customer.id }, select: { ownerId: true } }))?.ownerId, { timeout: 20000 }).toBeNull()
    await expect.poll(() => prisma.crmActivity.count({ where: { customerId: customer.id, type: 'OWNER_CHANGED' } }), { timeout: 20000 }).toBe(2)
  })

  test('A10 a long list is paged at 25 rows and the second page holds the rest', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL)
    const total = 27
    const base = Date.now() - 60_000
    await prisma.customer.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        phone: uniquePhone(), firstName: 'مشتری', lastName: `${scope}pg${letters(3)}`, marketingSmsConsent: false, createdAt: new Date(base + i * 1000),
      })) as never,
    })

    await openList(page)
    await expect(page.getByTestId('customer-row')).toHaveCount(25)
    await expect(page.getByRole('navigation', { name: 'صفحه‌بندی' })).toBeVisible()
    const first = (await page.getByTestId('customer-row').first().innerText()).split('\n')[0]

    await page.getByRole('navigation', { name: 'صفحه‌بندی' }).getByRole('link', { name: 'صفحه ۲' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByTestId('customer-row')).toHaveCount(total - 25)
    expect((await page.getByTestId('customer-row').first().innerText()).split('\n')[0]).not.toBe(first)

    // Narrowing the search returns to page one with only the matching customer.
    await hydrated(page, 'customers-search')
    await page.getByTestId('customers-search').fill(`${scope}pg`)
    await applyFilters(page)
    await expect(page).not.toHaveURL(/page=2/)
    await expect(page.getByTestId('customer-row')).toHaveCount(25)
  })
})
