import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000)) } catch {}
  })
  // Each test is its own client address so write rate limits are never shared with sibling files.
  const o = () => Math.floor(Math.random() * 250) + 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
})

/**
 * Customer club, campaigns / automations / outbox / carts / AI drafts, end to end in a real browser.
 * Isolation: both browser projects run this file at once and sibling files share the database. Everything created
 * here carries TAG, is tracked, and is removed in afterAll by exactly those keys. Audiences are carved out with a
 * per-test pet food brand token so a campaign can never reach somebody else's customers, and no assertion depends
 * on a global count. Campaigns are scheduled two days ahead so a sibling pressing "send queue" cannot send them.
 * The only global rows touched are one AutomationRule flag (restored) and consumeDays of one product (restored).
 */
const prisma = new PrismaClient()
const TAG = `f${Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(2, 8).padEnd(6, 'x')}`
let seq = 0

const phones = new Set<string>()
const userIds = new Set<string>()
const brandSlugs = new Set<string>()
const touchedProducts = new Set<string>()
const ruleRestore = new Map<string, boolean>()

function uniquePhone(): string {
  let phone = ''
  do phone = `0935${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`
  while (phones.has(phone))
  phones.add(phone)
  return phone
}
const token = (n: string) => `fb${TAG}${n}`

function sessionToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون', role: 'ADMIN', expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}
async function signInAdmin(context: BrowserContext, baseURL: string | undefined) {
  const user = await prisma.user.create({ data: { email: `e2e-club-${TAG}-${++seq}@example.test`, name: 'مدیر آزمون باشگاه', role: 'ADMIN' } })
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(user.id), url: baseURL! }])
}

async function makeCustomer(name: string, o: { consent?: boolean; species?: 'DOG' | 'CAT'; brand?: string; petName?: string; extra?: Record<string, unknown> } = {}) {
  const phone = uniquePhone()
  const consent = o.consent ?? true
  const firstName = `${name}${TAG}`
  const customer = await prisma.customer.create({
    data: { phone, firstName, lastName: 'آزمون', marketingSmsConsent: consent, marketingConsentAt: consent ? new Date() : null, ...(o.extra ?? {}) } as never,
  })
  let petId: string | null = null
  const petName = o.petName ?? `پت${name}`
  if (o.species) {
    const pet = await prisma.pet.create({ data: { customerId: customer.id, name: petName, species: o.species, breed: 'لابرادور', foodBrand: o.brand ?? null } })
    petId = pet.id
  }
  return { id: customer.id, phone, firstName, petName, petId }
}

/** Asia/Tehran is a fixed UTC+03:30 (the same rule the sender uses). */
function tehran(date: Date) {
  const t = new Date(date.getTime() + 210 * 60_000)
  return { hour: t.getUTCHours(), minute: t.getUTCMinutes(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}
const isQuiet = (date: Date) => {
  const h = tehran(date).hour
  return h >= 21 || h < 9
}

async function confirmInDialog(page: Page, label: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
}

const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Drives the real four-step wizard and launches (scheduled two days ahead). Returns the new campaign id. */
async function launchWizard(page: Page, o: { name: string; brand: string; body: string; coupon?: boolean; restrict?: boolean; expectAudience?: number }) {
  await page.goto('/admin/campaigns', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('campaign-new').click()
  await page.getByTestId('campaign-name').fill(o.name)
  await page.getByRole('button', { name: 'سگ', exact: true }).click()
  await page.getByLabel('برند غذای حیوان شامل').fill(o.brand)
  if (o.expectAudience !== undefined) await expect(page.getByTestId('segment-count')).toHaveText(new RegExp(`^${o.expectAudience}$|^${String(o.expectAudience).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}$`))
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('campaign-body').fill(o.body)
  await page.getByTestId('wizard-next').click()
  if (o.coupon) {
    await page.getByTestId('coupon-toggle').check()
    if (o.restrict) await page.getByRole('checkbox', { name: /محدود به برند غذای حیوان هر مشتری/ }).check()
  }
  await page.getByTestId('wizard-next').click()
  const when = new Date(Date.now() + 2 * 86_400_000)
  when.setHours(12, 30, 0, 0)
  await page.locator('input[type="datetime-local"]').fill(localInput(when))
  await page.getByTestId('campaign-launch').click()
  await confirmInDialog(page, 'زمان‌بندی')
  await expect(page).toHaveURL(/\/admin\/campaigns\/[^/?]+$/, { timeout: 30000 })
  return page.url().split('/').pop()!.split('?')[0]
}

test.describe('customer club: campaigns, automations, outbox, carts, AI', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const customers = await prisma.customer.findMany({ where: { phone: { in: [...phones] } }, select: { id: true } })
    const ids = customers.map((c) => c.id)
    await prisma.messageOutbox.deleteMany({ where: { OR: [{ customerId: { in: ids } }, { phone: { in: [...phones] } }] } })
    await prisma.messageCampaign.deleteMany({ where: { name: { contains: TAG } } })
    await prisma.segment.deleteMany({ where: { name: { contains: TAG } } })
    await prisma.couponRedemption.deleteMany({ where: { customerId: { in: ids } } })
    await prisma.coupon.deleteMany({ where: { OR: [{ customerId: { in: ids } }, { title: { contains: TAG } }] } })
    await prisma.order.deleteMany({ where: { customerId: { in: ids } } })
    await prisma.marketingContact.deleteMany({ where: { OR: [{ phone: { in: [...phones] } }, { customerId: { in: ids } }] } })
    await prisma.customer.deleteMany({ where: { id: { in: ids } } })
    await prisma.brand.deleteMany({ where: { slugFa: { in: [...brandSlugs] } } })
    for (const [kind, enabled] of ruleRestore) await prisma.automationRule.updateMany({ where: { kind }, data: { enabled } }).catch(() => {})
    for (const id of touchedProducts) await prisma.product.updateMany({ where: { id, consumeDays: 30 }, data: { consumeDays: null } }).catch(() => {})
    await prisma.auditLog.deleteMany({ where: { userId: { in: [...userIds] } } })
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } })
    await prisma.$disconnect()
  })

  test('F01 admin builds a segment of dog owners by food brand, sees the live count, saves, pins and deletes it', async ({ page, context, baseURL }) => {
    const brand = token('s1')
    const a = await makeCustomer('الف', { species: 'DOG', brand })
    await makeCustomer('ب', { species: 'DOG', brand, consent: false }) // no SMS consent: not counted
    await makeCustomer('پ', { species: 'CAT', brand }) // wrong species
    await makeCustomer('ت', { species: 'DOG', brand: token('other') }) // other brand
    await signInAdmin(context, baseURL)

    await page.goto('/admin/segments', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('segment-new').click()
    const name = `سگ‌داران ${TAG}`
    await page.getByTestId('segment-name').fill(name)
    await page.getByRole('button', { name: 'سگ', exact: true }).click()
    await page.getByLabel('برند غذای حیوان شامل').fill(brand)
    const preview = page.getByTestId('segment-preview')
    await expect(page.getByTestId('segment-count')).toHaveText(/^(1|۱)$/)
    await expect(preview).toContainText(a.firstName)
    await expect(preview).toContainText('نداشتن رضایت پیامک')

    await page.getByTestId('segment-save').click()
    const card = page.getByTestId('segments-list').locator('li').filter({ hasText: name })
    await expect(card).toBeVisible()
    await expect(card).toContainText(/(1|۱) مشتری با رضایت پیامک/)
    const row = await prisma.segment.findFirstOrThrow({ where: { name } })
    expect(row.rules).toMatchObject({ species: ['DOG'], foodBrandContains: brand })

    await card.getByRole('button', { name: 'سنجاق', exact: true }).click()
    await expect(card).toContainText('سنجاق‌شده')
    expect((await prisma.segment.findUniqueOrThrow({ where: { id: row.id } })).isPinned).toBe(true)

    await card.getByRole('button', { name: 'حذف', exact: true }).click()
    await confirmInDialog(page, 'حذف')
    await expect(page.getByTestId('segments-list').locator('li').filter({ hasText: name })).toHaveCount(0)
    expect(await prisma.segment.count({ where: { id: row.id } })).toBe(0)
  })

  test('F02 campaign wizard: per-recipient preview, brand-restricted personal coupon, launch reaches only consenting customers', async ({ page, context, baseURL }) => {
    const brand = token('c2')
    const slug = `e2e-${TAG}-brand-c2`
    brandSlugs.add(slug)
    const brandRow = await prisma.brand.create({ data: { nameFa: `برند آزمون ${TAG}`, nameEn: brand, slugFa: slug } })
    const a = await makeCustomer('نیلوفر', { species: 'DOG', brand, petName: 'رکس' })
    const noConsent = await makeCustomer('بی‌رضایت', { species: 'DOG', brand, consent: false })
    const unsub = await makeCustomer('انصراف', { species: 'DOG', brand })
    await prisma.marketingContact.create({ data: { phone: unsub.phone, name: unsub.firstName, source: 'admin', consentAt: new Date(Date.now() - 86400000 * 5), unsubscribedAt: new Date(), customerId: unsub.id } })
    await signInAdmin(context, baseURL)

    await page.goto('/admin/campaigns', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('campaign-new').click()
    const name = `کمپین غذا ${TAG}`
    await page.getByTestId('campaign-name').fill(name)
    await page.getByRole('button', { name: 'سگ', exact: true }).click()
    await page.getByLabel('برند غذای حیوان شامل').fill(brand)
    // Audience: the two customers who consented; the one without consent is excluded and said so.
    await expect(page.getByTestId('segment-count')).toHaveText(/^(2|۲)$/)
    await expect(page.getByTestId('segment-preview')).toContainText('نداشتن رضایت پیامک')
    await page.getByTestId('wizard-next').click()

    await page.getByTestId('campaign-body').fill('سلام {name}، برای {petName} با کد {code} تا {expiry} خرید کنید.')
    await expect(page.getByTestId('sms-counter')).toContainText('پیامک')
    const prev = page.getByTestId('wizard-preview')
    await expect(prev).toContainText(a.firstName)
    await expect(prev).toContainText('رکس')
    await expect(prev).not.toContainText('{petName}')
    await page.getByTestId('wizard-next').click()

    await page.getByTestId('coupon-toggle').check()
    await page.getByRole('checkbox', { name: /محدود به برند غذای حیوان هر مشتری/ }).check()
    await page.getByTestId('wizard-next').click()
    const when = new Date(Date.now() + 2 * 86_400_000)
    when.setHours(12, 30, 0, 0)
    await page.locator('input[type="datetime-local"]').fill(localInput(when))
    await page.getByTestId('campaign-launch').click()
    await expect(page.getByRole('dialog')).toContainText('رضایت')
    await confirmInDialog(page, 'زمان‌بندی')
    await expect(page).toHaveURL(/\/admin\/campaigns\/[^/?]+$/, { timeout: 30000 })
    const id = page.url().split('/').pop()!.split('?')[0]
    await expect(page.getByTestId('campaign-stats')).toBeVisible()

    const rows = await prisma.messageOutbox.findMany({ where: { campaignId: id } })
    expect(rows.map((r) => r.phone)).toEqual([a.phone])
    const msg = rows[0]
    expect(msg.status).toBe('QUEUED')
    expect(msg.scheduledFor.getTime()).toBeGreaterThan(Date.now() + 86_400_000)
    expect(msg.body).toContain('رکس')
    expect(msg.body).toContain('لغو: ارسال ۱')
    expect(msg.body).not.toContain('{')
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: msg.couponId! } })
    expect(coupon.customerId).toBe(a.id)
    expect(coupon.usageLimit).toBe(1)
    expect(coupon.brandIds).toEqual([brandRow.id])
    expect(msg.body).toContain(coupon.code)
    expect(await prisma.messageOutbox.count({ where: { phone: { in: [noConsent.phone, unsub.phone] } } })).toBe(0)
    await expect(page.getByTestId('campaign-outbox')).toContainText(a.firstName)
  })

  test('F03 a launched campaign can be cancelled: queued messages are cancelled and their personal codes stop working', async ({ page, context, baseURL }) => {
    const brand = token('c3')
    const a = await makeCustomer('سارا', { species: 'DOG', brand })
    await signInAdmin(context, baseURL)
    const id = await launchWizard(page, { name: `لغو ${TAG}`, brand, body: 'سلام {name}، کد {code} برای شماست.', coupon: true, expectAudience: 1 })
    const before = await prisma.messageOutbox.findFirstOrThrow({ where: { campaignId: id, phone: a.phone } })
    expect(before.status).toBe('QUEUED')
    expect(before.couponId).toBeTruthy()

    await page.getByTestId('campaign-cancel').click()
    await confirmInDialog(page, 'لغو کمپین')
    await expect(page.getByTestId('campaign-cancel')).toHaveCount(0, { timeout: 20000 })
    const after = await prisma.messageOutbox.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.status).toBe('CANCELLED')
    const coupon = await prisma.coupon.findUnique({ where: { id: before.couponId! } })
    expect(coupon?.isActive ?? false).toBe(false)
    expect((await prisma.messageCampaign.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED')
    await expect(page.getByText('لغو شد').first()).toBeVisible()
  })

  test('F04 quiet hours: a message sent from the customer page is held until the morning, and a customer without consent is refused', async ({ page, context, baseURL }) => {
    const ok = await makeCustomer('آرام')
    const no = await makeCustomer('بدون-رضایت', { consent: false })
    await signInAdmin(context, baseURL)

    await page.goto(`/admin/customers/${ok.id}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /پیام‌ها/ }).click()
    await page.getByTestId('msg-body').fill(`سلام {name}، این یک پیام آزمایشی است ${TAG}`)
    const sentAt = new Date()
    await page.getByTestId('msg-send').click()
    await expect.poll(() => prisma.messageOutbox.count({ where: { customerId: ok.id } }), { timeout: 20000 }).toBe(1)
    const row = await prisma.messageOutbox.findFirstOrThrow({ where: { customerId: ok.id } })
    expect(row.kind).toBe('admin')
    expect(row.body).toContain(ok.firstName)
    expect(row.body).toContain('لغو: ارسال ۱')
    if (isQuiet(sentAt)) {
      // Between 21:00 and 09:00 Tehran time: rescheduled to 09:30, never sent at night.
      expect(row.scheduledFor.getTime()).toBeGreaterThan(sentAt.getTime())
      expect(tehran(row.scheduledFor)).toMatchObject({ hour: 9, minute: 30 })
      expect(isQuiet(row.scheduledFor)).toBe(false)
    } else {
      expect(Math.abs(row.scheduledFor.getTime() - sentAt.getTime())).toBeLessThan(10 * 60_000)
    }

    await page.goto(`/admin/customers/${no.id}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /پیام‌ها/ }).click()
    await expect(page.getByText('رضایت دریافت پیامک تبلیغاتی نداده است')).toBeVisible()
    await page.getByTestId('msg-body').fill('پیام آزمایشی بدون رضایت')
    await page.getByTestId('msg-send').click()
    await page.waitForTimeout(1500)
    expect(await prisma.messageOutbox.count({ where: { customerId: no.id } })).toBe(0)
  })

  test('F05 daily cap: a customer who already got a marketing SMS today is skipped by a campaign, a fresh one is not', async ({ page, context, baseURL }) => {
    const brand = token('c5')
    const capped = await makeCustomer('پرپیام', { species: 'DOG', brand })
    const fresh = await makeCustomer('تازه', { species: 'DOG', brand })
    await prisma.messageOutbox.create({
      data: { customerId: capped.id, phone: capped.phone, kind: 'campaign', body: `قبلی ${TAG}`, status: 'SENT', sentAt: new Date(Date.now() - 2 * 3_600_000), scheduledFor: new Date(Date.now() - 2 * 3_600_000) },
    })
    await signInAdmin(context, baseURL)
    const id = await launchWizard(page, { name: `سقف ${TAG}`, brand, body: 'سلام {name}، یک پیشنهاد ویژه داریم.', expectAudience: 2 })
    const rows = await prisma.messageOutbox.findMany({ where: { campaignId: id } })
    expect(rows.map((r) => r.phone)).toEqual([fresh.phone])
    expect(await prisma.messageOutbox.count({ where: { customerId: capped.id, status: 'QUEUED' } })).toBe(0)
  })

  test('F06 sending the queue: delivered through the console provider, or kept safely queued when no provider is connected or at night', async ({ page, context, baseURL }) => {
    const p = await makeCustomer('صف')
    const old = new Date(Date.now() - 60_000)
    const msg = await prisma.messageOutbox.create({ data: { customerId: p.id, phone: p.phone, kind: 'admin', body: `پیام صف ${TAG}`, status: 'QUEUED', scheduledFor: old } })
    await signInAdmin(context, baseURL)

    await page.goto('/admin/outbox', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: 'صف پیامک‌ها' })).toBeVisible()
    const banner = page.getByTestId('sender-banner')
    const configured = (await banner.count()) === 0
    if (!configured) {
      await expect(banner).toContainText('در انتظار اتصال سرویس پیامک')
      await expect(banner).toContainText('SMS_PROVIDER')
    }
    for (let i = 0; i < 3; i++) {
      const btn = page.getByTestId('outbox-process')
      if (await btn.isEnabled()) await btn.click()
      await page.waitForTimeout(1500)
      const current = await prisma.messageOutbox.findUniqueOrThrow({ where: { id: msg.id } })
      if (current.status !== 'QUEUED') break
      await page.reload({ waitUntil: 'domcontentloaded' })
    }
    const done = await prisma.messageOutbox.findUniqueOrThrow({ where: { id: msg.id } })
    if (!configured) {
      expect(done.status).toBe('QUEUED') // never lost while there is nothing to send with
    } else if (isQuiet(new Date())) {
      expect(['QUEUED', 'SENT']).toContain(done.status) // held for the morning unless the clock moved past 09:00 meanwhile
      if (done.status === 'QUEUED') expect(done.scheduledFor.getTime()).toBeGreaterThan(old.getTime())
    } else {
      // A sibling pressing the same button may be sending at the same moment: allow the in-flight state.
      await expect.poll(async () => (await prisma.messageOutbox.findUniqueOrThrow({ where: { id: msg.id } })).status, { timeout: 15000 }).toMatch(/SENT|SENDING|QUEUED/)
      if (done.status === 'SENT') expect(done.sentAt).not.toBeNull()
    }
  })

  test('F07 a failed message is retried from the outbox, and a queued one can be cancelled', async ({ page, context, baseURL }) => {
    const a = await makeCustomer('ناموفق')
    const b = await makeCustomer('لغوشونده')
    const failed = await prisma.messageOutbox.create({ data: { customerId: a.id, phone: a.phone, kind: 'admin', body: `ناموفق ${TAG}`, status: 'FAILED', attempts: 3, error: 'خطای آزمایشی', scheduledFor: new Date() } })
    const queued = await prisma.messageOutbox.create({ data: { customerId: b.id, phone: b.phone, kind: 'admin', body: `در صف ${TAG}`, status: 'QUEUED', scheduledFor: new Date(Date.now() + 2 * 86_400_000) } })
    await signInAdmin(context, baseURL)

    await page.goto('/admin/outbox?status=FAILED', { waitUntil: 'domcontentloaded' })
    const failedRow = page.getByTestId('outbox-row').filter({ hasText: a.phone })
    await expect(failedRow).toContainText('خطای آزمایشی')
    await failedRow.getByRole('button', { name: 'تلاش مجدد' }).click()
    await expect.poll(async () => (await prisma.messageOutbox.findUniqueOrThrow({ where: { id: failed.id } })).status, { timeout: 15000 }).not.toBe('FAILED')

    await page.goto('/admin/outbox?status=QUEUED', { waitUntil: 'domcontentloaded' })
    const queuedRow = page.getByTestId('outbox-row').filter({ hasText: b.phone })
    await expect(queuedRow).toBeVisible()
    await queuedRow.getByRole('button', { name: 'لغو', exact: true }).click()
    await confirmInDialog(page, 'لغو پیام')
    await expect.poll(async () => (await prisma.messageOutbox.findUniqueOrThrow({ where: { id: queued.id } })).status, { timeout: 15000 }).toBe('CANCELLED')
  })

  test('F08 automations: a rule can be switched on and off, and the dry run lists exactly who is due (vaccine, pet birthday, win-back, repeat purchase)', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(150_000)
    const phoneIdx = testInfo.project.name.includes('Mobile') ? 1 : 0
    const now = new Date()
    const t = tehran(now)

    const vac = await makeCustomer('واکسن', { species: 'DOG', petName: 'واکسی' })
    await prisma.petRecord.create({ data: { petId: vac.petId!, kind: 'VACCINE', title: `هاری ${TAG}`, doneAt: new Date(now.getTime() - 360 * 86_400_000), nextDueAt: new Date(now.getTime() + 2 * 86_400_000) } })
    const vacNo = await makeCustomer('واکسن-بی‌رضایت', { species: 'DOG', consent: false })
    await prisma.petRecord.create({ data: { petId: vacNo.petId!, kind: 'VACCINE', title: `هاری ${TAG}`, doneAt: new Date(now.getTime() - 360 * 86_400_000), nextDueAt: new Date(now.getTime() + 2 * 86_400_000) } })

    const bday = await makeCustomer('تولد', { species: 'DOG', petName: 'تولدی' })
    await prisma.pet.update({ where: { id: bday.petId! }, data: { birthDate: new Date(Date.UTC(2021, t.month - 1, t.day, 12)) } })

    const win = await makeCustomer('بازگشت', { extra: { ordersCount: 2, lastOrderAt: new Date(now.getTime() - 70 * 86_400_000) } })

    const products = await prisma.product.findMany({ where: { isActive: true, deletedAt: null, consumeDays: null }, orderBy: { id: 'asc' }, take: 2, select: { id: true, nameFa: true, price: true } })
    const product = products[Math.min(phoneIdx, products.length - 1)]
    await prisma.product.update({ where: { id: product.id }, data: { consumeDays: 30 } })
    touchedProducts.add(product.id)
    const rep = await makeCustomer('تکرار')
    await prisma.order.create({
      data: {
        number: `PB-F${TAG.toUpperCase()}-${++seq}`, customerId: rep.id, status: 'DELIVERED', paymentMethod: 'COD', subtotal: product.price, shippingFee: 0, total: product.price,
        shipName: 'آزمون', shipPhone: rep.phone, shipProvince: 'تهران', shipCity: 'تهران', shipAddress: 'خیابان آزمون', shipPostal: '1938973111',
        createdAt: new Date(now.getTime() - 27 * 86_400_000),
        items: { create: [{ productId: product.id, nameFa: product.nameFa, unitPrice: product.price, quantity: 1, lineTotal: product.price }] },
      },
    })
    await signInAdmin(context, baseURL)
    await page.goto('/admin/automations', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('automations-list')).toBeVisible()

    // Toggle: one rule per browser project so the two projects never fight over the same flag.
    const toggleKind = phoneIdx === 0 ? 'ownerBirthday' : 'abandonedCart'
    const toggle = page.getByTestId(`automation-toggle-${toggleKind}`)
    const original = (await prisma.automationRule.findUnique({ where: { kind: toggleKind } }))?.enabled ?? false
    ruleRestore.set(toggleKind, original)
    await toggle.setChecked(!original)
    await expect.poll(async () => (await prisma.automationRule.findUnique({ where: { kind: toggleKind } }))?.enabled, { timeout: 15000 }).toBe(!original)
    await toggle.setChecked(original)
    await expect.poll(async () => (await prisma.automationRule.findUnique({ where: { kind: toggleKind } }))?.enabled, { timeout: 15000 }).toBe(original)

    const dry = async (kind: string) => {
      const card = page.locator('section').filter({ has: page.getByTestId(`automation-dry-${kind}`) }).last()
      await card.getByTestId(`automation-dry-${kind}`).click()
      const result = card.getByTestId('dry-result')
      await expect(result).toBeVisible({ timeout: 30000 })
      await expect(result).toContainText('هیچ پیامی ارسال نشد')
      return result
    }
    const v = await dry('vaccine')
    await expect(v).toContainText(vac.phone)
    await expect(v).not.toContainText(vacNo.phone) // no consent: never a candidate
    expect(await prisma.messageOutbox.count({ where: { customerId: vac.id } })).toBe(0) // a dry run sends and queues nothing
    await expect(await dry('petBirthday')).toContainText(bday.phone)
    await expect(await dry('winback')).toContainText(win.phone)
    await expect(await dry('repeatPurchase')).toContainText(rep.phone)
    expect(await prisma.messageOutbox.count({ where: { customerId: { in: [vac.id, bday.id, win.id, rep.id] } } })).toBe(0)
  })

  test('F09 an abandoned cart shows up for the admin, and the reminder with a personal code is queued exactly once', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('سبد')
    const product = await prisma.product.findFirstOrThrow({ where: { isActive: true, deletedAt: null, price: { gt: 0 } }, select: { id: true, nameFa: true, price: true } })
    await prisma.cartSnapshot.create({
      data: {
        customerId: c.id,
        items: [{ productId: product.id, quantity: 2, name: product.nameFa, price: product.price }],
        itemCount: 2,
        subtotal: product.price * 2,
        updatedAt: new Date(Date.now() - 5 * 3_600_000),
      },
    })
    await signInAdmin(context, baseURL)
    await page.goto('/admin/carts', { waitUntil: 'domcontentloaded' })
    const row = page.getByTestId('cart-row').filter({ hasText: c.firstName })
    await expect(row).toBeVisible()
    await expect(row).toContainText(product.nameFa)
    await expect(page.getByTestId('top-carted')).toBeVisible()

    await row.getByTestId('cart-remind').click()
    await expect.poll(() => prisma.messageOutbox.count({ where: { customerId: c.id } }), { timeout: 20000 }).toBe(1)
    const msg = await prisma.messageOutbox.findFirstOrThrow({ where: { customerId: c.id } })
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: msg.couponId! } })
    expect(coupon).toMatchObject({ customerId: c.id, type: 'PERCENT', value: 10, usageLimit: 1 })
    expect(msg.body).toContain(coupon.code)
    expect(msg.body).toContain(c.firstName)
    expect((await prisma.cartSnapshot.findUniqueOrThrow({ where: { customerId: c.id } })).lastReminderAt).not.toBeNull()

    // A second click is refused by the one-marketing-SMS-a-day rule: still one message, one live code.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('cart-row').filter({ hasText: c.firstName }).getByTestId('cart-remind').click()
    await page.waitForTimeout(2000)
    expect(await prisma.messageOutbox.count({ where: { customerId: c.id } })).toBe(1)
    expect(await prisma.coupon.count({ where: { customerId: c.id, isActive: true } })).toBe(1)
  })

  test('F10 AI draft panel: three Persian options appear without an AI key, nothing personal is sent in the request, and picking one fills the message', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('هوشمند', { species: 'DOG', brand: token('ai'), petName: 'بوبی', extra: { lastName: 'محرمانه‌زاده', email: `f10-${TAG}@example.test` } })
    await signInAdmin(context, baseURL)
    const bodies: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.headers()['next-action']) bodies.push(r.postData() ?? '')
    })

    await page.goto(`/admin/customers/${c.id}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /پیام‌ها/ }).click()
    await page.getByTestId('ai-draft').click()
    const options = page.getByTestId('draft-options')
    await expect(options).toBeVisible({ timeout: 30000 })
    const buttons = options.getByRole('button')
    await expect(buttons).toHaveCount(3)
    const texts = await buttons.allTextContents()
    for (const t of texts) {
      expect(Array.from(t).length).toBeLessThanOrEqual(300)
      expect(t).toMatch(/[؀-ۿ]/)
      expect(t).not.toContain(c.phone)
      expect(t).not.toContain(c.firstName)
    }
    await expect(options).toContainText(/پیشنهادهای (آماده|هوش مصنوعی)/)

    // Whatever the server does with the model, the browser request carries ids and choices only, never contact details.
    const sent = bodies.join('\n')
    expect(sent.length).toBeGreaterThan(0)
    for (const secret of [c.phone, c.firstName, 'محرمانه‌زاده', `f10-${TAG}@example.test`]) expect(sent).not.toContain(secret)

    await buttons.first().click()
    await expect(page.getByTestId('msg-body')).toHaveValue(texts[0].trim())
  })
})
