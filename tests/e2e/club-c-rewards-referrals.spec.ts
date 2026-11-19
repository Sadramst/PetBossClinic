import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000)) } catch {}
  })
})

/**
 * Customer club: rewards and referrals, as a customer and a clinic admin experience them.
 * Every test builds its own customers, rewards and orders straight in the local database (unique, random data),
 * drives the real /account/club, /account/coupons, cart / checkout, registration and admin order screens,
 * and asserts on its own rows only. Both browser projects run this file at the same time, and nothing here
 * changes a global singleton (LoyaltyConfig is only read), so cleanup removes just what this worker created.
 */
const prisma = new PrismaClient()
const PASSWORD = ['Gorbeh', 'Parvaneh', '1405'].join('-')
const DISCOUNT = 20000
const fa = (n: number) => n.toLocaleString('fa-IR')

const phones = new Set<string>()
const rewardIds = new Set<string>()
const couponIds = new Set<string>()
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

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function uniqueReferralCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('')
}

function secret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
}

function customerToken(customerId: string): string {
  const key = crypto.createHmac('sha256', secret()).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600, v: 0 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

function adminCookie(baseURL: string) {
  const payload = { userId: 'admin_test_e2e', email: 'admin@petboss.com', name: 'Clinic Administrator', role: 'ADMIN', expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return { name: 'petboss_session', value: `${body}.${sig}`, domain: new URL(baseURL).hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const }
}

type Product = { id: string; slugFa: string; nameFa: string; price: number }

async function pickProduct(): Promise<Product> {
  return prisma.product.findFirstOrThrow({
    where: { isActive: true, deletedAt: null, price: { gte: 50_000, lt: 2_000_000 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
    select: { id: true, slugFa: true, nameFa: true, price: true },
  })
}

async function makeCustomer(opts: { points?: number; tier?: string; referralCode?: string; referredById?: string; address?: boolean; ageDays?: number } = {}) {
  const phone = uniquePhone()
  const points = opts.points ?? 0
  const customer = await prisma.customer.create({
    data: {
      phone,
      firstName: 'آزمون',
      lastName: 'باشگاه',
      phoneVerifiedAt: new Date(), // keeps these rows out of the sign-up circuit breaker's unverified count
      pointsBalance: points,
      lifetimePoints: points,
      tier: opts.tier ?? 'BRONZE',
      referralCode: opts.referralCode ?? null,
      referredById: opts.referredById ?? null,
      ...(opts.ageDays ? { createdAt: new Date(Date.now() - opts.ageDays * 86_400_000) } : {}),
    },
  })
  if (opts.address) {
    await prisma.address.create({
      data: {
        customerId: customer.id,
        recipientName: 'آزمون باشگاه',
        recipientPhone: phone,
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان شریعتی، کوچه آزمون خودکار، نبش میدان',
        postalCode: '1938973111',
        isDefault: true,
      },
    })
  }
  return { id: customer.id, phone }
}

async function makeReward(over: Record<string, unknown> = {}) {
  const title = `جایزه آزمون ${stamp()}`
  const reward = await prisma.reward.create({
    data: { title, pointsCost: 200, couponType: 'FIXED', couponValue: DISCOUNT, couponValidDays: 30, ...over } as Parameters<typeof prisma.reward.create>[0]['data'],
  })
  rewardIds.add(reward.id)
  return reward
}

const signIn = async (context: BrowserContext, baseURL: string, customerId: string) => {
  await context.clearCookies()
  await context.addCookies([{ name: 'pb_customer', value: customerToken(customerId), url: baseURL }])
}

const card = (page: Page, title: string) => page.getByTestId('reward-card').filter({ hasText: title })

/** Opens the club page, takes the reward through the confirmation dialog and returns the coupon code shown. */
async function redeemInUi(page: Page, title: string): Promise<string> {
  const c = card(page, title)
  await expect(c.getByTestId('reward-redeem')).toBeEnabled()
  await c.getByTestId('reward-redeem').click()
  await page.getByRole('button', { name: 'تأیید و دریافت' }).click()
  await expect(c.getByTestId('reward-code')).toBeVisible()
  return ((await c.getByTestId('reward-code').textContent()) ?? '').trim()
}

async function startCart(page: Page, product: Product) {
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

async function placeCodOrder(page: Page): Promise<string> {
  const cod = page.getByRole('radio', { name: /پرداخت در محل/ })
  await expect(cod).toBeEnabled()
  await cod.check()
  await expect(page.getByRole('button', { name: 'ثبت نهایی سفارش' })).toBeEnabled()
  await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click()
  await expect(page).toHaveURL(/\/account\/orders\/PB-\d{4}-\d{6}/, { timeout: 30000 })
  return page.url().match(/PB-\d{4}-\d{6}/)![0]
}

/** Moves the order to delivered through the real admin order screen (which runs the club hooks). */
async function deliverAsAdmin(browser: Browser, baseURL: string, number: string, headers: Record<string, string>) {
  await prisma.order.update({ where: { number }, data: { status: 'SHIPPED' } })
  const ctx = await browser.newContext({ baseURL, locale: 'fa-IR', extraHTTPHeaders: headers })
  try {
    await ctx.addCookies([adminCookie(baseURL)])
    await ctx.addInitScript(() => {
      try { localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000)) } catch {}
    })
    const admin = await ctx.newPage()
    await admin.goto('/admin/orders?status=SHIPPED')
    await admin.getByRole('button', { name: new RegExp(number) }).click()
    await admin.locator('select').selectOption({ label: 'تحویل‌شده' })
    await admin.getByRole('button', { name: 'ذخیره تغییرات' }).click()
    // The saved order leaves the SHIPPED tab and the drawer closes, so the stored status is the reliable signal.
    await expect.poll(async () => (await prisma.order.findUniqueOrThrow({ where: { number } })).status, { timeout: 20_000 }).toBe('DELIVERED')
  } finally {
    await ctx.close()
  }
}

async function loyalty() {
  const row = await prisma.loyaltyConfig.findUnique({ where: { id: 'main' } })
  return { referralGiven: row?.referralGiven ?? 150, referralJoined: row?.referralJoined ?? 100 }
}

async function register(page: Page, phone: string, first = 'سارا', last = 'رضایی') {
  await page.locator('input[name="firstName"]').fill(first)
  await page.locator('input[name="lastName"]').fill(last)
  await page.locator('input[name="phone"]').fill(phone)
  await page.locator('input[name="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
}

test.describe('customer club: rewards and referrals', () => {
  // Each test is its own shopper: the coupon box and sign-up limit attempts per client address.
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
    await prisma.rewardRedemption.deleteMany({ where: { OR: [{ customerId: { in: ids } }, { rewardId: { in: [...rewardIds] } }] } }).catch(swallow)
    await prisma.pointsTransaction.deleteMany({ where: { customerId: { in: ids } } }).catch(swallow)
    await prisma.marketingContact.deleteMany({ where: { OR: [{ phone: { in: [...phones] } }, { customerId: { in: ids } }] } }).catch(swallow)
    await prisma.coupon.deleteMany({ where: { OR: [{ id: { in: [...couponIds, ...welcome] } }, { customerId: { in: ids } }] } }).catch(swallow)
    await prisma.reward.deleteMany({ where: { id: { in: [...rewardIds] } } }).catch(swallow)
    await prisma.customer.updateMany({ where: { referredById: { in: ids } }, data: { referredById: null } }).catch(swallow)
    await prisma.customer.deleteMany({ where: { id: { in: ids } } }).catch(swallow)
    await prisma.$disconnect()
  })

  test('C01 redeeming a reward takes the points, shows the code and saves it in my coupons', async ({ page, context, baseURL }) => {
    const me = await makeCustomer({ points: 500 })
    const reward = await makeReward({ pointsCost: 200, description: 'تخفیف ویژه اعضای باشگاه' })
    await signIn(context, baseURL!, me.id)

    await page.goto('/account/club')
    await expect(page.getByTestId('club-points')).toHaveText(fa(500))
    const code = await redeemInUi(page, reward.title)
    expect(code).toMatch(/^[A-Z0-9-]{6,}$/)

    // Points were taken once, with a ledger line, and the coupon is personal and single-use
    await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: me.id } })).pointsBalance).toBe(300)
    const tx = await prisma.pointsTransaction.findMany({ where: { customerId: me.id, kind: 'REDEEM' } })
    expect(tx).toHaveLength(1)
    expect(tx[0].points).toBe(-200)
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code } })
    couponIds.add(coupon.id)
    expect(coupon.customerId).toBe(me.id)
    expect(coupon.usageLimit).toBe(1)
    expect(coupon.source).toBe('reward')
    expect(await prisma.rewardRedemption.count({ where: { customerId: me.id, rewardId: reward.id } })).toBe(1)
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: reward.id } })).redeemedCount).toBe(1)

    // The page shows the new balance and the spend in the history
    await expect(page.getByTestId('club-points')).toHaveText(fa(300))
    await expect(page.getByTestId('points-history-row').filter({ hasText: fa(200) })).toHaveCount(1)

    // The code is also in «کدهای تخفیف من»
    await page.goto('/account/coupons')
    await expect(page.getByTestId('my-coupons-list')).toContainText(code)
  })

  test('C02 a reward code works in the cart for its owner and is refused for another customer', async ({ page, context, baseURL }) => {
    const product = await pickProduct()
    const [owner, other] = await Promise.all([makeCustomer({ points: 400, address: true }), makeCustomer({ address: true })])
    const reward = await makeReward({ pointsCost: 150 })

    await signIn(context, baseURL!, owner.id)
    await page.goto('/account/club')
    const code = await redeemInUi(page, reward.title)
    couponIds.add((await prisma.coupon.findUniqueOrThrow({ where: { code } })).id)

    // Someone else cannot use it
    await signIn(context, baseURL!, other.id)
    await startCart(page, product)
    await openCheckout(page)
    await typeCode(page, code)
    await expect(page.getByRole('alert').filter({ hasText: 'این کد تخفیف برای حساب شما صادر نشده است.' })).toBeVisible()
    await expect(page.getByTestId('coupon-applied')).toHaveCount(0)

    // The owner gets the discount and the order uses the reward coupon
    await signIn(context, baseURL!, owner.id)
    await startCart(page, product)
    await openCheckout(page)
    await typeCode(page, code)
    await expect(page.getByTestId('coupon-applied')).toContainText(code)
    await expect(page.getByTestId('discount-line')).toContainText(fa(DISCOUNT))
    const number = await placeCodOrder(page)
    const order = await prisma.order.findUniqueOrThrow({ where: { number } })
    expect(order.customerId).toBe(owner.id)
    expect(order.couponCode).toBe(code)
    expect(order.discount).toBe(DISCOUNT)
    expect(await prisma.order.count({ where: { customerId: other.id } })).toBe(0)
  })

  test('C03 not enough points: the button says how many are missing, and a stale page is refused by the server', async ({ page, context, baseURL }) => {
    const poor = await makeCustomer({ points: 120 })
    const rich = await makeCustomer({ points: 500 })
    const reward = await makeReward({ pointsCost: 500 })
    const cheap = await makeReward({ pointsCost: 300 })

    // Visible refusal: disabled, with the exact shortfall
    await signIn(context, baseURL!, poor.id)
    await page.goto('/account/club')
    const c = card(page, reward.title)
    await expect(c.getByTestId('reward-redeem')).toBeDisabled()
    await expect(c.getByTestId('reward-redeem')).toHaveText(`${fa(380)} امتیاز کم دارید`)

    // A page loaded while the balance was enough: the server re-checks and nothing is charged
    await signIn(context, baseURL!, rich.id)
    await page.goto('/account/club')
    await expect(card(page, cheap.title).getByTestId('reward-redeem')).toBeEnabled()
    await prisma.customer.update({ where: { id: rich.id }, data: { pointsBalance: 100 } })
    await card(page, cheap.title).getByTestId('reward-redeem').click()
    await page.getByRole('button', { name: 'تأیید و دریافت' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'امتیاز شما برای دریافت این جایزه کافی نیست.' })).toBeVisible()
    await expect(card(page, cheap.title).getByTestId('reward-code')).toHaveCount(0)
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: rich.id } })).pointsBalance).toBe(100)
    expect(await prisma.rewardRedemption.count({ where: { customerId: { in: [poor.id, rich.id] } } })).toBe(0)
    expect(await prisma.coupon.count({ where: { customerId: { in: [poor.id, rich.id] } } })).toBe(0)
  })

  test('C04 a tier-locked reward and a sold-out reward cannot be taken, even from a stale page', async ({ page, context, baseURL }) => {
    const me = await makeCustomer({ points: 2000, tier: 'BRONZE' })
    const locked = await makeReward({ pointsCost: 100, minTier: 'PLATINUM' })
    const soldOut = await makeReward({ pointsCost: 100, stock: 1, redeemedCount: 1 })
    const lastOne = await makeReward({ pointsCost: 100, stock: 1, redeemedCount: 0 })

    await signIn(context, baseURL!, me.id)
    await page.goto('/account/club')
    await expect(card(page, locked.title).getByTestId('reward-redeem')).toBeDisabled()
    await expect(card(page, locked.title).getByTestId('reward-redeem')).toContainText('ویژه سطح')
    await expect(card(page, soldOut.title).getByTestId('reward-redeem')).toBeDisabled()
    await expect(card(page, soldOut.title).getByTestId('reward-redeem')).toHaveText('تمام شد')

    // The last unit goes to someone else while this page is open
    await expect(card(page, lastOne.title).getByTestId('reward-redeem')).toBeEnabled()
    await prisma.reward.update({ where: { id: lastOne.id }, data: { redeemedCount: 1 } })
    await card(page, lastOne.title).getByTestId('reward-redeem').click()
    await page.getByRole('button', { name: 'تأیید و دریافت' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'موجودی این جایزه تمام شده است.' })).toBeVisible()

    expect((await prisma.customer.findUniqueOrThrow({ where: { id: me.id } })).pointsBalance).toBe(2000)
    expect(await prisma.rewardRedemption.count({ where: { customerId: me.id } })).toBe(0)
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: lastOne.id } })).redeemedCount).toBe(1)
  })

  test('C05 a double-clicked confirmation charges the points and makes the coupon only once', async ({ page, context, baseURL }) => {
    const me = await makeCustomer({ points: 1000 })
    const reward = await makeReward({ pointsCost: 300 })
    await signIn(context, baseURL!, me.id)

    await page.goto('/account/club')
    const c = card(page, reward.title)
    await expect(c.getByTestId('reward-redeem')).toBeEnabled()
    await c.getByTestId('reward-redeem').click()
    await page.getByRole('button', { name: 'تأیید و دریافت' }).dblclick().catch(() => undefined)
    await expect(c.getByTestId('reward-code')).toBeVisible()

    await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: me.id } })).pointsBalance).toBe(700)
    expect(await prisma.pointsTransaction.count({ where: { customerId: me.id, kind: 'REDEEM' } })).toBe(1)
    expect(await prisma.rewardRedemption.count({ where: { customerId: me.id, rewardId: reward.id } })).toBe(1)
    expect(await prisma.coupon.count({ where: { customerId: me.id, source: 'reward' } })).toBe(1)
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: reward.id } })).redeemedCount).toBe(1)
    await expect(page.getByTestId('club-points')).toHaveText(fa(700))
  })

  test('C06 an invite link remembers the code, and registering through it links the new member to the inviter', async ({ page, context }) => {
    const code = uniqueReferralCode()
    const inviter = await makeCustomer({ referralCode: code })
    const phone = uniquePhone()

    await page.goto(`/r/${code}`)
    await expect(page).toHaveURL(/\/account\/login\?mode=register/)
    const cookie = (await context.cookies()).find((c) => c.name === 'pb_ref')
    expect(cookie?.value).toBe(code)
    expect(cookie?.httpOnly).toBe(true)

    await register(page, phone)
    await expect(page).toHaveURL(/\/account$/)
    const friend = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    expect(friend.referredById).toBe(inviter.id)
    expect(friend.referralCode).toMatch(/^[A-Z2-9]{6,10}$/)
    expect(friend.referralCode).not.toBe(code)

    // Nothing is paid for the invite yet: only after the friend's first delivered order
    expect(await prisma.pointsTransaction.count({ where: { customerId: { in: [friend.id, inviter.id] }, kind: { in: ['REFERRAL_GIVEN', 'REFERRAL_JOINED'] } } })).toBe(0)

    // The friend has an invite code of their own on the club page
    await page.goto('/account/club')
    await expect(page.getByTestId('referral-code')).toHaveText(friend.referralCode!)
  })

  test('C07 both sides get their referral points only when the friend\'s first order is delivered', async ({ page, context, baseURL, browser }) => {
    const product = await pickProduct()
    const inviter = await makeCustomer({ referralCode: uniqueReferralCode() })
    const friend = await makeCustomer({ referredById: inviter.id, address: true })
    const o = () => Math.floor(Math.random() * 250) + 1
    const headers: Record<string, string> = {}
    headers['x-forwarded-for'] = `10.${o()}.${o()}.${o()}`
    const cfg = await loyalty()
    const referralRows = () =>
      prisma.pointsTransaction.findMany({ where: { customerId: { in: [inviter.id, friend.id] }, kind: { in: ['REFERRAL_GIVEN', 'REFERRAL_JOINED'] } } })

    // The friend buys; a placed order is not enough
    await signIn(context, baseURL!, friend.id)
    await startCart(page, product)
    await openCheckout(page)
    const number = await placeCodOrder(page)
    expect(await referralRows()).toHaveLength(0)

    // Delivered by the clinic: the inviter is paid for the friend, and the friend for joining
    await deliverAsAdmin(browser, baseURL!, number, headers)
    await expect.poll(async () => (await referralRows()).length).toBe(2)
    const rows = await referralRows()
    const given = rows.find((r) => r.kind === 'REFERRAL_GIVEN')!
    const joined = rows.find((r) => r.kind === 'REFERRAL_JOINED')!
    expect(given.customerId).toBe(inviter.id)
    expect(given.refId).toBe(friend.id)
    expect(given.points).toBe(cfg.referralGiven)
    expect(joined.customerId).toBe(friend.id)
    expect(joined.refId).toBe(inviter.id)
    expect(joined.points).toBe(cfg.referralJoined)
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: inviter.id } })).pointsBalance).toBe(cfg.referralGiven)

    // The friend sees the gift in the history
    await page.goto('/account/club')
    await expect(page.getByTestId('points-history-row').filter({ hasText: fa(cfg.referralJoined) }).first()).toBeVisible()
  })

  test('C08 the invite card shows the code and live counts, and its copy button copies the link', async ({ page, context, baseURL }) => {
    const code = uniqueReferralCode()
    const inviter = await makeCustomer({ referralCode: code, points: 150 })
    const [f1, f2, f3] = await Promise.all([1, 2, 3].map(() => makeCustomer({ referredById: inviter.id })))
    void f1
    void f2
    await prisma.pointsTransaction.create({
      data: { customerId: inviter.id, kind: 'REFERRAL_GIVEN', points: 150, balanceAfter: 150, refType: 'referral', refId: f3.id, note: 'اولین خرید دوست دعوت‌شده' },
    })

    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL!).origin }).catch(() => undefined)
    await signIn(context, baseURL!, inviter.id)
    await page.goto('/account/club')
    await expect(page.getByTestId('referral-code')).toHaveText(code)
    const stat = (label: string) => page.locator('dl > div').filter({ hasText: label })
    await expect(stat('دعوت‌شده')).toContainText(fa(3))
    await expect(stat('خریدکرده')).toContainText(fa(1))
    await expect(stat('امتیاز دریافتی')).toContainText(fa(150))
    await expect(page.getByTestId('points-history-row').filter({ hasText: fa(150) })).toHaveCount(1)

    const copy = page.getByTestId('referral-copy').getByRole('button')
    await expect(copy).toBeEnabled()
    await copy.click()
    await expect(copy).toHaveText('کپی شد')
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => null))
    if (clip) expect(clip).toMatch(new RegExp(`/r/${code}$`))
    await expect(page.getByRole('link', { name: 'اشتراک در تلگرام' })).toHaveAttribute('href', /t\.me\/share/)
  })

  test('C09 referral abuse: unknown codes are ignored, and existing customers cannot be linked through an invite', async ({ page, context }) => {
    const code = uniqueReferralCode()
    const inviter = await makeCustomer({ referralCode: code })
    const existing = await makeCustomer({ ageDays: 3, referralCode: uniqueReferralCode() })

    // An unknown code sets no cookie but still lands on sign-up
    await page.goto('/r/ZZZZZZZZ')
    await expect(page).toHaveURL(/\/account\/login\?mode=register/)
    expect((await context.cookies()).find((c) => c.name === 'pb_ref')).toBeUndefined()

    // A real code, then an already-registered person tries to sign up again through it
    await page.goto(`/r/${code}`)
    await expect(page).toHaveURL(/\/account\/login\?mode=register/)
    await register(page, existing.phone, 'علی', 'کریمی')
    await expect(page.getByRole('alert').filter({ hasText: 'قبلاً ثبت‌نام کرده است' })).toBeVisible()
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: existing.id } })).referredById).toBeNull()

    // The inviter cannot invite themselves through their own link either
    await page.goto(`/r/${code}`)
    await register(page, inviter.phone, 'مینا', 'صادقی')
    await expect(page.getByRole('alert').filter({ hasText: 'قبلاً ثبت‌نام کرده است' })).toBeVisible()
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: inviter.id } })).referredById).toBeNull()

    expect(await prisma.customer.count({ where: { referredById: inviter.id } })).toBe(0)
    expect(await prisma.pointsTransaction.count({ where: { customerId: { in: [inviter.id, existing.id] }, kind: { in: ['REFERRAL_GIVEN', 'REFERRAL_JOINED'] } } })).toBe(0)
  })

  test('C10 a deactivated reward disappears from the catalog and cannot be redeemed from an open page', async ({ page, context, baseURL }) => {
    const me = await makeCustomer({ points: 600 })
    const stays = await makeReward({ pointsCost: 100 })
    const goes = await makeReward({ pointsCost: 100 })
    const hidden = await makeReward({ pointsCost: 100, isActive: false })
    await signIn(context, baseURL!, me.id)

    await page.goto('/account/club')
    await expect(card(page, stays.title)).toHaveCount(1)
    await expect(card(page, goes.title)).toHaveCount(1)
    await expect(card(page, hidden.title)).toHaveCount(0)

    // The admin switches a reward off while the page is open
    await expect(card(page, goes.title).getByTestId('reward-redeem')).toBeEnabled()
    await prisma.reward.update({ where: { id: goes.id }, data: { isActive: false } })
    await card(page, goes.title).getByTestId('reward-redeem').click()
    await page.getByRole('button', { name: 'تأیید و دریافت' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'این جایزه در دسترس نیست.' })).toBeVisible()
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: me.id } })).pointsBalance).toBe(600)
    expect(await prisma.rewardRedemption.count({ where: { customerId: me.id } })).toBe(0)

    // After a reload it is gone, the other reward still works
    await page.goto('/account/club')
    await expect(card(page, goes.title)).toHaveCount(0)
    await redeemInUi(page, stays.title)
    await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: me.id } })).pointsBalance).toBe(500)
  })
})
