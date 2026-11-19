import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

/**
 * Lead capture and the welcome code, end to end in a real browser against the local database:
 * the welcome popup, the footer capture strip, the top banner, and what lands in the database.
 *
 * Isolation: every test uses its own phone / email and its own fake client IP (x-forwarded-for),
 * because lead capture is rate limited per IP and every browser here shares one address. Only rows this
 * file created are asserted on and removed. The two config tests briefly change the single global
 * MarketingConfig row and always put it back.
 */
const prisma = new PrismaClient()

test.describe.configure({ retries: 1 })

const POPUP_KEY = 'pb_welcome_popup_v1'
const COUPON_KEY = 'pb_coupon_v1'

const phones = new Set<string>()
const emails = new Set<string>()
let seq = 0
let popupDelay = 8

function uniquePhone(): string {
  const prefix = ['0937', '0936', '0934'][seq++ % 3]
  const phone = `${prefix}${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  phones.add(phone)
  return phone
}

function uniqueEmail(): string {
  const email = `a-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`
  emails.add(email)
  return email
}

const toFa = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

/** Gives this browser its own client address so the per-IP capture limit is never shared between tests. */
async function ownIp(context: BrowserContext) {
  const o = () => Math.floor(Math.random() * 250) + 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
}

/** Pretends the popup was dismissed already, so it never covers the page under test. */
async function silencePopup(page: Page) {
  await page.addInitScript((key) => {
    try {
      localStorage.setItem(key, String(Date.now() + 30 * 86_400_000))
    } catch {
      /* ignore */
    }
  }, POPUP_KEY)
}

async function openPopup(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('welcome-popup')).toBeVisible({ timeout: (popupDelay + 20) * 1000 })
}

async function noHorizontalOverflow(page: Page) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(wide).toBe(false)
}

test.describe('lead capture and welcome code', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.beforeAll(async () => {
    const cfg = await prisma.marketingConfig.findUnique({ where: { id: 'main' } })
    if (cfg) popupDelay = cfg.popupDelaySeconds
  })

  test.afterAll(async () => {
    const contacts = await prisma.marketingContact.findMany({
      where: { OR: [{ phone: { in: [...phones] } }, { email: { in: [...emails] } }] },
      select: { id: true, welcomeCouponId: true },
    })
    const couponIds = contacts.map((c) => c.welcomeCouponId).filter((x): x is string => !!x)
    await prisma.marketingContact.deleteMany({ where: { id: { in: contacts.map((c) => c.id) } } })
    await prisma.coupon.deleteMany({ where: { id: { in: couponIds }, usedCount: 0 } })
    await prisma.$disconnect()
  })

  test('A01 popup appears after the delay, closes with Esc and stays dismissed after reload', async ({ page, context }) => {
    await ownIp(context)
    await openPopup(page)
    const popup = page.getByTestId('welcome-popup')
    await expect(popup).toHaveAttribute('role', 'dialog')
    await expect(popup.getByTestId('welcome-popup-input')).toBeFocused()
    await expect(page.getByTestId('welcome-popup-submit')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    const snooze = await page.evaluate((k) => Number(localStorage.getItem(k)), POPUP_KEY)
    expect(snooze).toBeGreaterThan(Date.now() + 6 * 86_400_000)

    // Dismissed for a week: a reload and another page must not bring it back.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(Math.min(popupDelay + 3, 15) * 1000)
    await expect(page.getByTestId('welcome-popup')).toHaveCount(0)
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    await expect(page.getByTestId('welcome-popup')).toHaveCount(0)
  })

  test('A02 popup capture by mobile: personal code, copy button, saved to the contact in the database', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await ownIp(context)
    const phone = uniquePhone()
    await openPopup(page)
    await page.getByTestId('welcome-popup-input').fill(toFa(phone))
    await page.getByTestId('welcome-popup-submit').click()

    const codeEl = page.getByTestId('welcome-code')
    await expect(codeEl).toBeVisible({ timeout: 20000 })
    const code = ((await codeEl.textContent()) ?? '').trim()
    expect(code).toMatch(/^WELCOME-/)
    await expect(page.getByText('کد در حساب شما هم ذخیره شد')).toBeVisible()
    await expect(page.getByRole('link', { name: 'شروع خرید' })).toBeVisible()

    await page.getByTestId('coupon-copy').click()
    await expect(page.getByTestId('coupon-copy')).toContainText('کپی شد')
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
    if (clip !== null) expect(clip).toBe(code)

    // The code is remembered for the cart and the popup is snoozed for a long time.
    expect(await page.evaluate((k) => localStorage.getItem(k), COUPON_KEY)).toBe(code)
    const snooze = await page.evaluate((k) => Number(localStorage.getItem(k)), POPUP_KEY)
    expect(snooze).toBeGreaterThan(Date.now() + 300 * 86_400_000)

    const contact = await prisma.marketingContact.findUniqueOrThrow({ where: { phone } })
    expect(contact.source).toBe('popup')
    expect(contact.email).toBeNull()
    expect(contact.consentAt).toBeTruthy()
    expect(contact.welcomeCouponId).toBeTruthy()
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: contact.welcomeCouponId! } })
    expect(coupon.code).toBe(code)
    expect(coupon.source).toBe('welcome')
    expect(coupon.usageLimit).toBe(1)
    expect(coupon.firstOrderOnly).toBe(true)
    expect(coupon.usedCount).toBe(0)
    expect(coupon.isActive).toBe(true)
    expect(coupon.endsAt && coupon.endsAt.getTime() > Date.now()).toBeTruthy()
  })

  test('A03 popup capture by email gives a personal single-use code stored with the contact', async ({ page, context }) => {
    await ownIp(context)
    const email = uniqueEmail()
    await openPopup(page)
    await page.getByTestId('welcome-popup-input').fill(email)
    await page.getByTestId('welcome-popup-submit').click()
    const codeEl = page.getByTestId('welcome-code')
    await expect(codeEl).toBeVisible({ timeout: 20000 })
    const code = ((await codeEl.textContent()) ?? '').trim()
    expect(code).toMatch(/^WELCOME-/)

    const contact = await prisma.marketingContact.findUniqueOrThrow({ where: { email } })
    expect(contact.phone).toBeNull()
    expect(contact.unsubscribedAt).toBeNull()
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: contact.welcomeCouponId! } })
    expect(coupon.code).toBe(code)
    expect(coupon.perCustomerLimit).toBe(1)
    expect(coupon.customerId).toBeNull()
  })

  test('A04 popup rejects empty, bad mobile and bad email with Persian errors and stores nothing; fits at 360px', async ({ page, context }) => {
    await ownIp(context)
    await page.setViewportSize({ width: 360, height: 740 })
    await openPopup(page)
    const input = page.getByTestId('welcome-popup-input')
    const alert = page.getByTestId('welcome-popup').getByRole('alert')

    await page.getByTestId('welcome-popup-submit').click()
    await expect(alert).toContainText('شماره موبایل یا ایمیل خود را وارد کنید')

    await input.fill('0912')
    await page.getByTestId('welcome-popup-submit').click()
    await expect(alert).toContainText('شماره موبایل معتبر نیست')

    const bad = `a-e2e-bad-${Date.now()}@nodot`
    await input.fill(bad)
    await page.getByTestId('welcome-popup-submit').click()
    await expect(alert).toContainText('ایمیل واردشده معتبر نیست')

    await noHorizontalOverflow(page)
    const box = await page.getByTestId('welcome-popup').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(361)

    expect(await prisma.marketingContact.count({ where: { email: bad } })).toBe(0)
    expect(await page.getByTestId('welcome-code').count()).toBe(0)

    // The close button works and remembers the choice.
    await page.getByTestId('welcome-popup-close').click()
    await expect(page.getByTestId('welcome-popup')).toBeHidden()
  })

  test('A05 the same person asking again, from another browser and in Persian digits, gets the SAME code', async ({ page, browser, context }) => {
    await silencePopup(page)
    await ownIp(context)
    const phone = uniquePhone()

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('footer-capture-input').fill(phone)
    await page.getByTestId('footer-capture-submit').click()
    const first = page.getByTestId('welcome-code')
    await expect(first).toBeVisible({ timeout: 20000 })
    const code = ((await first.textContent()) ?? '').trim()
    expect(code).toMatch(/^WELCOME-/)

    const ctx2 = await browser.newContext({ locale: 'fa-IR' })
    try {
      await ownIp(ctx2)
      const p2 = await ctx2.newPage()
      await silencePopup(p2)
      await p2.goto('/', { waitUntil: 'domcontentloaded' })
      await p2.getByTestId('footer-capture-input').fill(toFa(phone))
      await p2.getByTestId('footer-capture-submit').click()
      // The existing code is NOT shown to an anonymous submitter; they are pointed to their account instead.
      await expect(p2.getByTestId('welcome-code')).toHaveCount(0)
      await expect(p2.getByRole('status').filter({ hasText: 'کدهای تخفیف من' })).toBeVisible({ timeout: 20000 })
    } finally {
      await ctx2.close()
    }

    expect(await prisma.marketingContact.count({ where: { phone } })).toBe(1)
    const contact = await prisma.marketingContact.findUniqueOrThrow({ where: { phone } })
    expect(await prisma.coupon.count({ where: { id: contact.welcomeCouponId! } })).toBe(1)
    const total = await prisma.coupon.count({ where: { code: code } })
    expect(total).toBe(1)
  })

  test('A06 footer capture by email works, and the same email in capitals reuses the same contact and code', async ({ page, browser, context }) => {
    await silencePopup(page)
    await ownIp(context)
    const email = uniqueEmail()

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('footer-capture-input').fill(email)
    await page.getByTestId('footer-capture-submit').click()
    const el = page.getByTestId('welcome-code')
    await expect(el).toBeVisible({ timeout: 20000 })
    const code = ((await el.textContent()) ?? '').trim()

    const row = await prisma.marketingContact.findUniqueOrThrow({ where: { email } })
    expect(row.source).toBe('footer')

    const ctx2 = await browser.newContext({ locale: 'fa-IR' })
    try {
      await ownIp(ctx2)
      const p2 = await ctx2.newPage()
      await silencePopup(p2)
      await p2.goto('/', { waitUntil: 'domcontentloaded' })
      await p2.getByTestId('footer-capture-input').fill(email.toUpperCase())
      await p2.getByTestId('footer-capture-submit').click()
      // The existing code is NOT shown to an anonymous submitter; they are pointed to their account instead.
      await expect(p2.getByTestId('welcome-code')).toHaveCount(0)
      await expect(p2.getByRole('status').filter({ hasText: 'کدهای تخفیف من' })).toBeVisible({ timeout: 20000 })
    } finally {
      await ctx2.close()
    }
    expect(await prisma.marketingContact.count({ where: { email } })).toBe(1)
    expect(await prisma.coupon.count({ where: { code } })).toBe(1)
  })

  test('A07 footer strip shows Persian errors for bad input and nothing overflows at 360px, even after success', async ({ page, context }) => {
    await silencePopup(page)
    await ownIp(context)
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const input = page.getByTestId('footer-capture-input')
    await input.scrollIntoViewIfNeeded()

    await page.getByTestId('footer-capture-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: 'شماره موبایل یا ایمیل خود را وارد کنید' })).toBeVisible()
    await input.fill('123456')
    await page.getByTestId('footer-capture-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: 'شماره موبایل معتبر نیست' })).toBeVisible()
    await input.fill('not-an-email@x')
    await page.getByTestId('footer-capture-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: 'ایمیل واردشده معتبر نیست' })).toBeVisible()
    await noHorizontalOverflow(page)

    await input.fill(uniquePhone().replace(/^0/, '+98'))
    await page.getByTestId('footer-capture-submit').click()
    await expect(page.getByTestId('welcome-code')).toBeVisible({ timeout: 20000 })
    await noHorizontalOverflow(page)
  })

  test('A08 the popup is never shown on /checkout, /cart or the admin area', async ({ page, context }) => {
    await ownIp(context)
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout((popupDelay + 3) * 1000)
    await expect(page.getByTestId('welcome-popup')).toHaveCount(0)
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('welcome-popup')).toHaveCount(0)
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('welcome-popup')).toHaveCount(0)
    await expect(page.getByTestId('promo-banner')).toHaveCount(0)
  })
})

test.describe('campaign config driven storefront (changes the shared config row, desktop only)', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  type Snapshot = {
    popupEnabled: boolean
    bannerEnabled: boolean
    bannerText: string | null
    bannerLink: string | null
    bannerEndsAt: Date | null
    bannerCouponCode: string | null
  }
  let before: Snapshot | null = null

  async function restore() {
    if (before) await prisma.marketingConfig.update({ where: { id: 'main' }, data: before })
  }

  test.beforeAll(async () => {
    const cfg = await prisma.marketingConfig.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } })
    before = {
      popupEnabled: cfg.popupEnabled,
      bannerEnabled: cfg.bannerEnabled,
      bannerText: cfg.bannerText,
      bannerLink: cfg.bannerLink,
      bannerEndsAt: cfg.bannerEndsAt,
      bannerCouponCode: cfg.bannerCouponCode,
    }
  })

  test.afterAll(async () => {
    await restore()
    await prisma.$disconnect()
  })

  test('A09 top banner follows the admin config: shows with countdown, dismiss lasts the session, expired or disabled hides it', async ({ page, browser, context }, info) => {
    test.skip(info.project.name !== 'chromium-rtl', 'config is global: only the desktop project changes it')
    await ownIp(context)
    await silencePopup(page)
    const text = `جشنواره آزمون ${Date.now()}`
    try {
      await prisma.marketingConfig.update({
        where: { id: 'main' },
        data: { bannerEnabled: true, bannerText: text, bannerLink: '/shop', bannerEndsAt: new Date(Date.now() + 2 * 86_400_000), bannerCouponCode: null },
      })
      await page.goto('/shop', { waitUntil: 'domcontentloaded' })
      const banner = page.getByTestId('promo-banner')
      await expect(banner).toBeVisible()
      await expect(banner).toContainText(text)
      await expect(banner.getByLabel('زمان باقی‌مانده')).toBeVisible()
      await expect(banner.getByRole('link', { name: text })).toHaveAttribute('href', /\/shop$/)

      await banner.getByRole('button', { name: 'بستن اطلاعیه' }).click()
      await expect(banner).toHaveCount(0)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('promo-banner')).toHaveCount(0)

      // A new browser session sees it again.
      const ctx2 = await browser.newContext({ locale: 'fa-IR' })
      try {
        const p2 = await ctx2.newPage()
        await silencePopup(p2)
        await p2.goto('/shop', { waitUntil: 'domcontentloaded' })
        await expect(p2.getByTestId('promo-banner')).toContainText(text)
      } finally {
        await ctx2.close()
      }

      // Past end date: gone for everyone.
      await prisma.marketingConfig.update({ where: { id: 'main' }, data: { bannerEndsAt: new Date(Date.now() - 60_000) } })
      const ctx3 = await browser.newContext({ locale: 'fa-IR' })
      try {
        const p3 = await ctx3.newPage()
        await silencePopup(p3)
        await p3.goto('/shop', { waitUntil: 'domcontentloaded' })
        await expect(p3.getByTestId('promo-banner')).toHaveCount(0)
        await prisma.marketingConfig.update({ where: { id: 'main' }, data: { bannerEndsAt: null, bannerEnabled: false } })
        await p3.reload({ waitUntil: 'domcontentloaded' })
        await expect(p3.getByTestId('promo-banner')).toHaveCount(0)
        await expect(p3.locator('body')).toBeVisible()
      } finally {
        await ctx3.close()
      }
    } finally {
      await restore()
    }
  })

  test('A10 turning the popup off in the config removes it from the storefront', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'chromium-rtl', 'config is global: only the desktop project changes it')
    await ownIp(context)
    try {
      await prisma.marketingConfig.update({ where: { id: 'main' }, data: { popupEnabled: false } })
      await page.goto('/shop', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('h1').first()).toBeVisible()
      await page.waitForTimeout(Math.min(popupDelay + 3, 15) * 1000)
      await expect(page.getByTestId('welcome-popup')).toHaveCount(0)
      // The footer strip is independent of the popup and still there.
      await expect(page.getByTestId('footer-capture-input')).toBeVisible()
    } finally {
      await restore()
    }
  })
})
