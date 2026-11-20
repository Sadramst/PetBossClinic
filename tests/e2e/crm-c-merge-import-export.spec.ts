import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
// Each browser context also gets its own client IP so per-IP rate limits never couple tests together.
test.beforeEach(async ({ context }) => {
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

/**
 * CRM data tools, end to end: duplicate finder and merge wizard, CSV import (preview and apply), CSV export
 * safety, and the ADMIN-only guards around all of them.
 *
 * Isolation: both browser projects run this file at once and sibling files share the database. Every row created
 * here is tracked by id or phone (a per-worker random token plus a per-worker phone block) and removed in afterAll
 * by exactly those keys. Each test signs in as its own fresh User so per-user rate limits and audit queries never
 * overlap. No assertion depends on a global count and no global singleton is changed.
 */
const prisma = new PrismaClient()

// Letters only: a search term with three or more digits would also be matched against phone numbers.
const TAG = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
const PHONE_PART = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
let seq = 0
const startedAt = new Date()

const customerIds = new Set<string>()
const customerPhones = new Set<string>()
const userIds = new Set<string>()
const leadIds = new Set<string>()
const couponCodes = new Set<string>()
const orderNumbers = new Set<string>()

/** A fresh, tracked 11-digit mobile number. */
function uniquePhone(): string {
  const phone = `0936${PHONE_PART}${String(++seq).padStart(4, '0')}`
  customerPhones.add(phone)
  return phone
}

/** The +98 spelling of the same number: a different `phone` string that the duplicate finder still treats as equal. */
function plus98(phone: string): string {
  const p = `+98${phone.slice(1)}`
  customerPhones.add(p)
  return p
}

const fa = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
/** One digit written in Persian or Latin. */
const dg = (n: number) => `[${fa(n)}${n}]`

function sessionToken(userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER'): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون داده‌ها', role, expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}

/** A real User row (the audit log points at it) plus the signed session cookie. Calling again swaps the session. */
async function signIn(context: BrowserContext, baseURL: string | undefined, role: 'ADMIN' | 'EDITOR' | 'VIEWER', existing?: { id: string }) {
  const user =
    existing ??
    (await prisma.user.create({
      data: { email: `e2e-crmc-${TAG}-${++seq}@example.test`, name: 'مدیر آزمون داده‌ها', role },
    }))
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(user.id, role), url: baseURL! }])
  return user
}

async function makeCustomer(over: Record<string, unknown> = {}) {
  const phone = (over.phone as string | undefined) ?? uniquePhone()
  const customer = await prisma.customer.create({
    data: { firstName: 'مشتری', lastName: `${TAG}-${++seq}`, marketingSmsConsent: false, ...over, phone } as never,
  })
  customerIds.add(customer.id)
  return customer
}

async function makeOrder(customerId: string, total: number) {
  const number = `PB-CC${TAG.toUpperCase()}-${++seq}`
  orderNumbers.add(number)
  return prisma.order.create({
    data: {
      number,
      customerId,
      status: 'DELIVERED',
      paymentMethod: 'COD',
      subtotal: total,
      shippingFee: 0,
      discount: 0,
      total,
      shipName: 'آزمون',
      shipPhone: '09320000000',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddress: 'خیابان آزمون ادغام',
      shipPostal: '1938973111',
    },
  })
}

async function makePoints(customerId: string, points: number) {
  return prisma.pointsTransaction.create({ data: { customerId, kind: 'ADJUST', points, balanceAfter: points, note: 'e2e merge' } })
}

async function makeCoupon(customerId: string) {
  const code = `CC${TAG.toUpperCase()}${++seq}`
  couponCodes.add(code)
  return prisma.coupon.create({ data: { code, title: 'کوپن آزمون ادغام', type: 'PERCENT', value: 5, customerId } })
}

/** Waits until React has attached to the element: a click before that would be a native event. */
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

/** The survivor/loser pair used by the merge journeys. The loser carries an order, a pet, points and a coupon. */
async function seedMergePair(tag: string, withLoserData = true) {
  const phone = uniquePhone()
  const survivor = await makeCustomer({ phone, lastName: `${TAG}-${tag}-S`, pointsBalance: 100, lifetimePoints: 100, tags: ['survivor'] })
  const loser = await makeCustomer({ phone: plus98(phone), lastName: `${TAG}-${tag}-L`, pointsBalance: 40, lifetimePoints: 40, tags: ['loser'], city: 'شیراز' })
  await makePoints(survivor.id, 100)
  const survivorOrder = await makeOrder(survivor.id, 100_000)
  const survivorPet = await prisma.pet.create({ data: { customerId: survivor.id, name: `سروش${tag}`, species: 'DOG' } })
  let loserOrder: Awaited<ReturnType<typeof makeOrder>> | null = null
  let loserPet: Awaited<ReturnType<typeof prisma.pet.create>> | null = null
  let loserCoupon: Awaited<ReturnType<typeof makeCoupon>> | null = null
  if (withLoserData) {
    await makePoints(loser.id, 40)
    loserOrder = await makeOrder(loser.id, 250_000)
    loserPet = await prisma.pet.create({ data: { customerId: loser.id, name: `پلنگ${tag}`, species: 'CAT' } })
    loserCoupon = await makeCoupon(loser.id)
  }
  return { phone, survivor, loser, survivorOrder, survivorPet, loserOrder, loserPet, loserCoupon }
}

/** Opens the duplicates page and the wizard of the pair whose canonical phone is `phone`. */
async function openWizard(page: Page, phone: string) {
  await page.goto('/admin/customers/duplicates', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('duplicates-page')).toBeVisible()
  await hydrated(page, 'duplicates-page')
  const row = page.getByTestId('duplicates-row').filter({ hasText: phone })
  await expect(row).toHaveCount(1)
  await row.getByTestId('merge-open').click()
  await expect(page.getByTestId('merge-wizard')).toBeVisible()
}

const pickCard = (page: Page, namePart: string) => page.getByTestId(/^merge-pick-/).filter({ hasText: namePart })

/** Confirms the open confirmation dialog (the one whose title contains `title`) with the given button label. */
async function confirmDialogWith(page: Page, title: string, label: string) {
  const dialog = page.getByRole('dialog').filter({ hasText: title })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

const csvFile = (lines: string[]) => ({ name: `customers-${TAG}.csv`, mimeType: 'text/csv', buffer: Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf-8') })
const CSV_HEAD = 'phone,name,email,city,birthDate,tags,notes'

async function uploadAndPreview(page: Page, file: ReturnType<typeof csvFile>) {
  await page.getByTestId('import-file').setInputFiles(file)
  const btn = page.getByTestId('import-preview')
  await expect(btn).toBeEnabled()
  await btn.click()
  await expect(page.getByTestId('import-summary')).toBeVisible()
}

/** Minimal RFC-4180 reader for the exported files. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQ = false
      } else cell += ch
    } else if (ch === '"' && cell === '') inQ = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\r') {
      /* swallowed */
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const swallow = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
  } catch {
    /* best effort cleanup */
  }
}

test.afterAll(async () => {
  const phones = [...customerPhones]
  const found = await prisma.customer.findMany({ where: { OR: [{ id: { in: [...customerIds] } }, { phone: { in: phones } }] }, select: { id: true, contactId: true } })
  const ids = found.map((c) => c.id)
  const contactIds = found.map((c) => c.contactId).filter((x): x is string => !!x)
  const normalized = phones.map((p) => (p.startsWith('+98') ? `0${p.slice(3)}` : p))
  const byCustomer = { customerId: { in: ids } }
  await swallow(() => prisma.crmActivity.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.crmTask.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.pointsTransaction.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.messageOutbox.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.pet.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.address.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.healthSnapshot.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.marketingContact.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.cartSnapshot.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.customerGroupMember.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.adminCustomerNote.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.rewardRedemption.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.serviceVisit.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.couponRedemption.deleteMany({ where: byCustomer }))
  await swallow(() => prisma.orderItem.deleteMany({ where: { order: { number: { in: [...orderNumbers] } } } }))
  await swallow(() => prisma.order.deleteMany({ where: { OR: [{ number: { in: [...orderNumbers] } }, byCustomer] } }))
  await swallow(() => prisma.coupon.deleteMany({ where: { OR: [{ code: { in: [...couponCodes] } }, byCustomer] } }))
  await swallow(() => prisma.lead.deleteMany({ where: { OR: [{ id: { in: [...leadIds] } }, { name: { contains: TAG } }] } }))
  await swallow(() => prisma.contact.deleteMany({ where: { OR: [{ customerId: { in: ids } }, { id: { in: contactIds } }, { phone: { in: [...phones, ...normalized] } }] } }))
  await swallow(() => prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { userId: { in: [...userIds] } }] } }))
  await swallow(() => prisma.customer.deleteMany({ where: { id: { in: ids } } }))
  await swallow(() => prisma.user.deleteMany({ where: { id: { in: [...userIds] } } }))
  await prisma.$disconnect()
})

test.describe('CRM data tools: duplicates, merge, import, export', () => {
  test('C01 duplicate finder lists phone and e-mail twins with the reason and leaves unrelated customers out', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'ADMIN')
    const phone = uniquePhone()
    const a = await makeCustomer({ phone, lastName: `${TAG}-c01-a` })
    const b = await makeCustomer({ phone: plus98(phone), lastName: `${TAG}-c01-b` })
    const emailPhoneA = uniquePhone()
    const e1 = await makeCustomer({ phone: emailPhoneA, lastName: `${TAG}-c01-e1`, email: `Twin.${TAG}@example.test` })
    const e2 = await makeCustomer({ lastName: `${TAG}-c01-e2`, email: `twin.${TAG}@example.test` })
    const lone = await makeCustomer({ lastName: `${TAG}-c01-lone` })

    await page.goto('/admin/customers/duplicates', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'مشتریان تکراری' })).toBeVisible()
    await hydrated(page, 'duplicates-page')

    const phoneRow = page.getByTestId('duplicates-row').filter({ hasText: phone })
    await expect(phoneRow).toHaveCount(1)
    await expect(phoneRow).toContainText('شمارهٔ یکسان')
    await expect(phoneRow).toContainText(`${TAG}-c01-a`)
    await expect(phoneRow).toContainText(`${TAG}-c01-b`)
    await expect(phoneRow).toContainText('شباهت')
    await expect(phoneRow.getByTestId('merge-open')).toBeVisible()

    const emailRow = page.getByTestId('duplicates-row').filter({ hasText: emailPhoneA })
    await expect(emailRow).toHaveCount(1)
    await expect(emailRow).toContainText('ایمیل یکسان')
    await expect(emailRow).toContainText(`${TAG}-c01-e2`)

    // A customer who matches nobody never appears.
    await expect(page.getByTestId('duplicates-list')).not.toContainText(`${TAG}-c01-lone`)
    // Nothing was changed by looking.
    const after = await prisma.customer.findMany({ where: { id: { in: [a.id, b.id, e1.id, e2.id, lone.id] } }, select: { mergedIntoId: true } })
    expect(after.every((c) => c.mergedIntoId === null)).toBe(true)
  })

  test('C02 merge preview is an exact dry run: it lists what moves and changes nothing', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'ADMIN')
    const d = await seedMergePair('c02')
    await openWizard(page, d.phone)

    await pickCard(page, `${TAG}-c02-S`).locator('input[type="radio"]').check()
    await page.getByTestId('merge-preview').click()
    const report = page.getByTestId('merge-report')
    await expect(report).toBeVisible()
    await expect(report).toContainText('هنوز انجام نشده')
    await expect(report).toContainText(new RegExp(`${dg(1)} سفارش منتقل می.شود`))
    await expect(report).toContainText(new RegExp(`${dg(1)} حیوان خانگی منتقل می.شود`))
    await expect(report).toContainText(new RegExp(`${dg(1)} کوپن منتقل می.شود`))
    await expect(report).toContainText(new RegExp(`${dg(1)} تراکنش امتیاز منتقل می.شود`))
    await expect(report).toContainText(new RegExp(`امتیاز نهایی ${dg(1)}${dg(4)}${dg(0)}`))
    await expect(report).toContainText(new RegExp(`${dg(2)} سفارش`))
    await expect(page.getByTestId('merge-confirm')).toBeVisible()

    // The preview rolled back: every row is exactly where it was and no MERGE audit row exists.
    const [loser, survivor, order, pet, coupon] = await Promise.all([
      prisma.customer.findUnique({ where: { id: d.loser.id } }),
      prisma.customer.findUnique({ where: { id: d.survivor.id } }),
      prisma.order.findUnique({ where: { id: d.loserOrder!.id } }),
      prisma.pet.findUnique({ where: { id: d.loserPet!.id } }),
      prisma.coupon.findUnique({ where: { id: d.loserCoupon!.id } }),
    ])
    expect(loser?.mergedIntoId).toBeNull()
    expect(loser?.isBlocked).toBe(false)
    expect(loser?.pointsBalance).toBe(40)
    expect(survivor?.pointsBalance).toBe(100)
    expect(order?.customerId).toBe(d.loser.id)
    expect(pet?.customerId).toBe(d.loser.id)
    expect(coupon?.customerId).toBe(d.loser.id)
    expect(await prisma.auditLog.count({ where: { entity: 'CUSTOMER', action: 'MERGE', entityId: d.survivor.id } })).toBe(0)
    expect(admin.id).toBeTruthy()
  })

  test('C03 confirmed merge moves orders, pets, points and coupons, blocks the duplicate and writes the audit trail', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'ADMIN')
    const d = await seedMergePair('c03')
    await openWizard(page, d.phone)
    await pickCard(page, `${TAG}-c03-S`).locator('input[type="radio"]').check()
    await page.getByTestId('merge-preview').click()
    await expect(page.getByTestId('merge-report')).toBeVisible()

    await page.getByTestId('merge-confirm').click()
    await confirmDialogWith(page, 'این دو پرونده ادغام شوند؟', 'ادغام')
    await expect(page.getByText(/پرونده.ها ادغام شدند/)).toBeVisible()
    // The wizard closes and the pair leaves the list.
    await expect(page.getByTestId('merge-wizard')).toHaveCount(0)
    await expect(page.getByTestId('duplicates-row').filter({ hasText: d.phone })).toHaveCount(0)

    await expect.poll(async () => (await prisma.customer.findUnique({ where: { id: d.loser.id } }))?.mergedIntoId, { timeout: 15000 }).toBe(d.survivor.id)
    const [loser, survivor, orders, pets, coupons, ledger] = await Promise.all([
      prisma.customer.findUnique({ where: { id: d.loser.id } }),
      prisma.customer.findUnique({ where: { id: d.survivor.id } }),
      prisma.order.findMany({ where: { id: { in: [d.survivorOrder.id, d.loserOrder!.id] } } }),
      prisma.pet.findMany({ where: { id: { in: [d.survivorPet.id, d.loserPet!.id] } } }),
      prisma.coupon.findUnique({ where: { id: d.loserCoupon!.id } }),
      prisma.pointsTransaction.findMany({ where: { customerId: d.survivor.id } }),
    ])
    expect(orders).toHaveLength(2)
    expect(orders.every((o) => o.customerId === d.survivor.id)).toBe(true)
    expect(pets).toHaveLength(2)
    expect(pets.every((p) => p.customerId === d.survivor.id)).toBe(true)
    expect(coupons?.customerId).toBe(d.survivor.id)
    expect(ledger.map((t) => t.points).sort((x, y) => x - y)).toEqual([40, 100])
    expect(survivor?.pointsBalance).toBe(140)
    expect(survivor?.ordersCount).toBe(2)
    expect(survivor?.totalSpent).toBe(350_000)
    expect(survivor?.tags).toEqual(expect.arrayContaining(['survivor', 'loser']))
    expect(survivor?.city).toBe('شیراز') // empty field filled from the duplicate
    expect(loser?.isBlocked).toBe(true)
    expect(loser?.pointsBalance).toBe(0)
    expect(loser?.ordersCount).toBe(0)

    await expect
      .poll(async () => (await prisma.auditLog.findMany({ where: { entity: 'CUSTOMER', action: 'MERGE', entityId: d.survivor.id, userId: admin.id } })).length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(1)
    const audits = await prisma.auditLog.findMany({ where: { entity: 'CUSTOMER', action: 'MERGE', entityId: d.survivor.id } })
    expect(audits.some((a) => JSON.stringify(a.before ?? {}).includes(d.loser.id))).toBe(true)
    await expect
      .poll(async () => prisma.crmActivity.count({ where: { customerId: d.survivor.id, type: 'CUSTOMER_MERGED' } }), { timeout: 15000 })
      .toBeGreaterThanOrEqual(1)
  })

  test('C04 the survivor defaults to the customer with more orders and can be flipped before merging', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'ADMIN')
    const phone = uniquePhone()
    const heavy = await makeCustomer({ phone, lastName: `${TAG}-c04-heavy`, ordersCount: 3, totalSpent: 300_000 })
    const light = await makeCustomer({ phone: plus98(phone), lastName: `${TAG}-c04-light`, ordersCount: 0 })
    const heavyOrder = await makeOrder(heavy.id, 300_000)
    const lightPet = await prisma.pet.create({ data: { customerId: light.id, name: `بیژن${TAG}`, species: 'DOG' } })

    await openWizard(page, phone)
    // The richer record is pre-selected.
    await expect(pickCard(page, `${TAG}-c04-heavy`).locator('input[type="radio"]')).toBeChecked()
    await expect(pickCard(page, `${TAG}-c04-heavy`)).toContainText('مشتری باقی‌مانده')

    // Flip it: the lighter record becomes the survivor.
    await pickCard(page, `${TAG}-c04-light`).locator('input[type="radio"]').check()
    await expect(pickCard(page, `${TAG}-c04-light`)).toContainText('مشتری باقی‌مانده')
    await page.getByTestId('merge-preview').click()
    await expect(page.getByTestId('merge-report')).toContainText(new RegExp(`${dg(1)} سفارش منتقل می.شود`))

    await page.getByTestId('merge-confirm').click()
    await confirmDialogWith(page, 'این دو پرونده ادغام شوند؟', 'ادغام')
    await expect.poll(async () => (await prisma.customer.findUnique({ where: { id: heavy.id } }))?.mergedIntoId, { timeout: 15000 }).toBe(light.id)
    expect((await prisma.customer.findUnique({ where: { id: light.id } }))?.mergedIntoId).toBeNull()
    expect((await prisma.order.findUnique({ where: { id: heavyOrder.id } }))?.customerId).toBe(light.id)
    expect((await prisma.pet.findUnique({ where: { id: lightPet.id } }))?.customerId).toBe(light.id)
  })

  test('C05 an editor can review duplicates but the merge preview and the final merge are refused', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'EDITOR')
    const d = await seedMergePair('c05')
    await openWizard(page, d.phone)

    await page.getByTestId('merge-preview').click()
    await expect(page.getByText('دسترسی غیرمجاز')).toBeVisible()
    await expect(page.getByTestId('merge-report')).toHaveCount(0)
    await expect(page.getByTestId('merge-confirm')).toHaveCount(0)

    const [loser, order] = await Promise.all([prisma.customer.findUnique({ where: { id: d.loser.id } }), prisma.order.findUnique({ where: { id: d.loserOrder!.id } })])
    expect(loser?.mergedIntoId).toBeNull()
    expect(order?.customerId).toBe(d.loser.id)
    expect(await prisma.auditLog.count({ where: { entity: 'CUSTOMER', action: 'MERGE', entityId: { in: [d.survivor.id, d.loser.id] } } })).toBe(0)
  })

  test('C06 viewers cannot open the duplicates page and only an admin gets the import page', async ({ page, context, baseURL }) => {
    const viewer = await signIn(context, baseURL, 'VIEWER')
    await page.goto('/admin/customers/duplicates', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin(\/login)?\/?(\?.*)?$/)
    await expect(page.getByTestId('duplicates-page')).toHaveCount(0)

    await signIn(context, baseURL, 'EDITOR')
    await page.goto('/admin/customers/import', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin(\/login)?\/?(\?.*)?$/)
    await expect(page.getByTestId('import-wizard')).toHaveCount(0)

    await signIn(context, baseURL, 'ADMIN')
    await page.goto('/admin/customers/import', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('import-wizard')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'ورود مشتریان از فایل' })).toBeVisible()
    await expect(page.getByTestId('import-template')).toBeVisible()
    await expect(page.getByTestId('import-preview')).toBeDisabled()
    expect(viewer.id).toBeTruthy()
  })

  test('C07 import preview classifies new, duplicate and invalid rows with Persian reasons and writes nothing', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'ADMIN')
    const p1 = uniquePhone()
    const p2 = uniquePhone()
    const p3 = uniquePhone()
    const p4 = uniquePhone() // valid number but bad e-mail
    const p5 = uniquePhone() // valid number but bad birth date
    await makeCustomer({ phone: p3, lastName: `${TAG}-c07-exist` })

    await page.goto('/admin/customers/import', { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'import-wizard')
    await uploadAndPreview(
      page,
      csvFile([
        CSV_HEAD,
        `${p1},${TAG} الف,new1.${TAG}@example.test,تهران,1375/04/09,سگ|vip,مشتری حضوری`, // line 2: new
        `${plus98(p2)},${TAG} ب,,اصفهان,,,`, // line 3: new, +98 spelling
        `${p3},${TAG} موجود,,,,,`, // line 4: already a customer
        `123,${TAG} بد,,,,,`, // line 5: invalid phone
        `${p4},${TAG} ایمیل,not-an-email,,,,`, // line 6: invalid e-mail
        `${p5},${TAG} تولد,,,not-a-date,,`, // line 7: invalid birth date
        `${p1},${TAG} تکرار,,,,,`, // line 8: same phone twice in the file
      ])
    )

    await expect(page.getByTestId('stat-card-new')).toContainText(new RegExp(dg(2)))
    await expect(page.getByTestId('stat-card-dup')).toContainText(new RegExp(dg(1)))
    await expect(page.getByTestId('stat-card-invalid')).toContainText(new RegExp(dg(4)))
    await expect(page.getByTestId('stat-card-total')).toContainText(new RegExp(dg(7)))

    const errors = page.getByTestId('import-errors')
    await expect(errors).toBeVisible()
    await expect(errors).toContainText(new RegExp(`سطر ${dg(5)}: .*موبایل معتبر نیست`))
    await expect(errors).toContainText(new RegExp(`سطر ${dg(6)}: .*ایمیل معتبر نیست`))
    await expect(errors).toContainText(new RegExp(`سطر ${dg(7)}: .*تاریخ تولد معتبر نیست`))
    await expect(errors).toContainText(new RegExp(`سطر ${dg(8)}: .*در همین فایل تکراری است`))

    const rows = page.getByTestId('import-row')
    await expect(rows).toHaveCount(3)
    await expect(rows.filter({ hasText: p1 })).toContainText('جدید')
    await expect(rows.filter({ hasText: p2 })).toContainText('جدید') // shown in its normalised form
    await expect(rows.filter({ hasText: p3 })).toContainText('تکراری')
    await expect(page.getByTestId('import-commit')).toBeEnabled()
    await expect(page.getByTestId('import-commit')).toContainText(new RegExp(dg(2)))

    // Preview is read-only.
    expect(await prisma.customer.count({ where: { phone: { in: [p1, p2, p4, p5] } } })).toBe(0)
  })

  test('C08 applying an import creates exactly the new customers, audits it and is safe to repeat', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'ADMIN')
    const p1 = uniquePhone()
    const p2 = uniquePhone()
    const p3 = uniquePhone()
    const existing = await makeCustomer({ phone: p3, firstName: 'قدیمی', lastName: `${TAG}-c08-exist`, city: 'مشهد' })
    const lines = [
      CSV_HEAD,
      `${p1},سارا ${TAG},c08.${TAG}@example.test,تهران,1375/04/09,سگ|vip,مشتری حضوری`,
      `${plus98(p2)},علی ${TAG},,کرج,,,`,
      `${p3},نام تازه ${TAG},,رشت,,,`,
      `abc,نامعتبر,,,,,`,
    ]

    await page.goto('/admin/customers/import', { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'import-wizard')
    await uploadAndPreview(page, csvFile(lines))
    await expect(page.getByTestId('stat-card-new')).toContainText(new RegExp(dg(2)))
    await page.getByTestId('import-commit').click()
    await confirmDialogWith(page, 'مشتری جدید ساخته شود', 'ورود مشتریان')

    const done = page.getByTestId('import-done')
    await expect(done).toBeVisible()
    await expect(done).toContainText(new RegExp(`${dg(2)} مشتری جدید ساخته شد`))
    await expect(done).toContainText(new RegExp(`${dg(2)} ردیف تکراری یا نامعتبر`))

    await expect.poll(async () => prisma.customer.count({ where: { phone: { in: [p1, p2] } } }), { timeout: 15000 }).toBe(2)
    const c1 = await prisma.customer.findUnique({ where: { phone: p1 } })
    expect(c1?.city).toBe('تهران')
    expect(c1?.tags).toEqual(expect.arrayContaining(['سگ', 'vip']))
    expect(c1?.source).toBe('IMPORT')
    expect(c1?.createdByAdmin).toBe(true)
    expect(c1?.marketingSmsConsent).toBe(false)
    expect(c1?.birthDate).not.toBeNull()
    expect(c1?.pointsBalance).toBe(0)
    expect([c1?.firstName, c1?.lastName].join(' ')).toContain(TAG)
    // The existing customer is untouched.
    const kept = await prisma.customer.findUnique({ where: { id: existing.id } })
    expect(kept?.firstName).toBe('قدیمی')
    expect(kept?.city).toBe('مشهد')
    await expect.poll(async () => prisma.auditLog.count({ where: { userId: admin.id, entity: 'CUSTOMER', action: 'IMPORT', createdAt: { gte: startedAt } } }), { timeout: 15000 }).toBeGreaterThanOrEqual(1)

    // Same file again: nothing new, the commit button stays off, no duplicates appear.
    await page.getByRole('button', { name: 'ورود فایل دیگر' }).click()
    await expect(page.getByTestId('import-file')).toBeVisible()
    await uploadAndPreview(page, csvFile(lines))
    await expect(page.getByTestId('stat-card-new')).toContainText(new RegExp(dg(0)))
    await expect(page.getByTestId('stat-card-dup')).toContainText(new RegExp(dg(3)))
    await expect(page.getByTestId('import-commit')).toBeDisabled()
    expect(await prisma.customer.count({ where: { phone: { in: [p1, p2, p3] } } })).toBe(3)
  })

  test('C09 exported leads CSV neutralises formula injection and keeps normal cells intact', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'ADMIN')
    const evil = [
      { name: `=HYPERLINK("http://evil.test","x") ${TAG}`, phone: uniquePhone() },
      { name: `+1+1 ${TAG}`, phone: uniquePhone() },
      { name: `-2+3 ${TAG}`, phone: uniquePhone() },
      { name: `@SUM(1) ${TAG}`, phone: uniquePhone() },
      { name: `ورودی عادی ${TAG}`, phone: plus98(uniquePhone()) }, // a normal name, but a phone that starts with +
    ]
    for (const l of evil) {
      const lead = await prisma.lead.create({ data: { name: l.name, phone: l.phone, stage: 'NEW', status: 'NEW', source: 'e2e-csv' } })
      leadIds.add(lead.id)
    }

    await page.goto(`/admin/leads?q=${TAG}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('leads-page')).toBeVisible()
    await hydrated(page, 'leads-page')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('leads-export').click()])
    expect(download.suggestedFilename()).toBe('leads.csv')
    const file = await download.path()
    const raw = fs.readFileSync(file!, 'utf-8')

    expect(raw.charCodeAt(0)).toBe(0xfeff) // BOM so Excel reads Persian
    expect(raw).toContain('\r\n')
    const table = parseCsv(raw.slice(1))
    const header = table[0]
    expect(header[0]).toBe('نام')
    const nameCol = 0
    const phoneCol = header.indexOf('موبایل')
    expect(phoneCol).toBeGreaterThan(0)
    const mine = table.slice(1).filter((r) => (r[nameCol] ?? '').includes(TAG))
    expect(mine).toHaveLength(5)

    // No cell anywhere may start with a formula character.
    for (const row of table) for (const cell of row) expect(cell, `cell "${cell}"`).not.toMatch(/^[=+\-@\t\r]/)

    const names = mine.map((r) => r[nameCol])
    expect(names).toContain(`'=HYPERLINK("http://evil.test","x") ${TAG}`)
    expect(names).toContain(`'+1+1 ${TAG}`)
    expect(names).toContain(`'-2+3 ${TAG}`)
    expect(names).toContain(`'@SUM(1) ${TAG}`)
    expect(names).toContain(`ورودی عادی ${TAG}`) // harmless text is not touched
    const plusPhone = mine.find((r) => r[nameCol] === `ورودی عادی ${TAG}`)![phoneCol]
    expect(plusPhone.startsWith("'+98")).toBe(true)

    await expect.poll(async () => prisma.auditLog.count({ where: { userId: admin.id, entity: 'LEAD', action: 'EXPORT', createdAt: { gte: startedAt } } }), { timeout: 15000 }).toBeGreaterThanOrEqual(1)
  })

  test('C10 only admins see the leads export and the audit log; editors are kept out', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'EDITOR')
    await page.goto('/admin/leads', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('leads-page')).toBeVisible()
    await expect(page.getByTestId('lead-new')).toBeVisible() // editors do get the normal tools
    await expect(page.getByTestId('leads-export')).toHaveCount(0)

    await page.goto('/admin/audit', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin(\/login)?\/?(\?.*)?$/)
    await expect(page.getByTestId('audit-log')).toHaveCount(0)

    await signIn(context, baseURL, 'ADMIN')
    await page.goto('/admin/leads', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('leads-export')).toBeVisible()
    await page.goto('/admin/audit', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('audit-log')).toBeVisible()
  })
})
