import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { getLoyaltyConfig } from '../../lib/club/config'
import { awardPoints, adjustPoints, spendPoints } from '../../lib/club/points'
import { onCustomerCreated, onOrderDelivered, onOrderUndelivered } from '../../lib/club/hooks'
import { pointsForOrder, tierByKey, tierProgress } from '../../lib/club/tiers'

/**
 * Customer club, author B: loyalty points and tiers from the customer's point of view.
 * Sign-up bonus, first-pet and complete-profile bonuses (once), purchase points by tier multiplier,
 * cancel after delivery, idempotent delivery, ledger filters, tier threshold, no negative balance,
 * and the club page reading its numbers from the live LoyaltyConfig.
 *
 * Delivery is applied the way the admin order action does it: the status is saved and then the real
 * onOrderDelivered / onOrderUndelivered hooks run (the same functions updateOrderAction calls).
 *
 * Isolation: every test makes its own customers with unique phones and only asserts on rows it created.
 * The global LoyaltyConfig is never modified: expectations are computed from the live config.
 */
const prisma = new PrismaClient()
const PASSWORD = ['Gorbeh', 'Parvaneh', '1405'].join('-')
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase()

const phones = new Set<string>()
const rewardTitles = new Set<string>()
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`
let orderSeq = 0

const fa = (n: number) => n.toLocaleString('fa-IR')

test.beforeEach(async ({ context }) => {
  const o = () => Math.floor(Math.random() * 250) + 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86_400_000))
    } catch {
      /* ignore */
    }
  })
})

function uniquePhone(): string {
  for (;;) {
    const p = `0932${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`
    if (!phones.has(p)) {
      phones.add(p)
      return p
    }
  }
}

function customerToken(customerId: string): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

async function signIn(context: BrowserContext, baseURL: string | undefined, customerId: string) {
  await context.addCookies([{ name: 'pb_customer', value: customerToken(customerId), url: baseURL! }])
}

/** A verified customer; `signup: true` runs the real new-customer hook (referral code + sign-up bonus). */
async function newCustomer(opts: { signup?: boolean; tier?: string; points?: number; lifetime?: number } = {}) {
  const phone = uniquePhone()
  const c = await prisma.customer.create({
    data: {
      phone,
      phoneVerifiedAt: new Date(),
      email: `club.b.${stamp()}@example.com`,
      firstName: 'مشتری',
      lastName: 'باشگاه',
      ...(opts.tier ? { tier: opts.tier } : {}),
      ...(opts.points != null ? { pointsBalance: opts.points } : {}),
      ...(opts.lifetime != null ? { lifetimePoints: opts.lifetime } : {}),
    },
  })
  if (opts.signup) await onCustomerCreated(c.id)
  return c
}

async function makeOrder(customerId: string, subtotal: number, discount = 0) {
  const total = subtotal - discount
  return prisma.order.create({
    data: {
      number: `PB-CB${RUN}-${++orderSeq}`,
      customerId,
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      subtotal,
      shippingFee: 0,
      discount,
      total,
      shipName: 'آزمون',
      shipPhone: '09320000000',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddress: 'خیابان آزمون باشگاه',
      shipPostal: '1938973111',
    },
  })
}

async function deliver(orderId: string) {
  await prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } })
  await onOrderDelivered(orderId)
}

async function cancelDelivered(orderId: string) {
  await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
  await onOrderUndelivered(orderId)
}

const balanceOf = async (id: string) => (await prisma.customer.findUniqueOrThrow({ where: { id } })).pointsBalance
const countKind = (customerId: string, kind: 'SIGNUP' | 'FIRST_PET' | 'PET_PROFILE' | 'ORDER' | 'REVERSAL' | 'REDEEM') =>
  prisma.pointsTransaction.count({ where: { customerId, kind } })

async function addPetViaUi(page: Page, input: { name: string; breed?: string; birthDate?: string; weight?: string }) {
  await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('pet-add').first().click()
  await page.getByTestId('pet-name-input').fill(input.name)
  if (input.breed) await page.locator('input[name="breed"]').fill(input.breed)
  if (input.birthDate) await page.locator('input[name="birthDate"]').fill(input.birthDate)
  if (input.weight) await page.locator('input[name="weightKg"]').fill(input.weight)
  const save = page.getByTestId('pet-save')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page).toHaveURL(/\/account\/pets\/[^/]+$/, { timeout: 20000 })
  await expect(page.getByTestId('pet-profile')).toBeVisible()
}

test.describe('club B: points and tiers', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const customers = await prisma.customer.findMany({ where: { phone: { in: [...phones] } }, select: { id: true } })
    const ids = customers.map((c) => c.id)
    const orders = await prisma.order.findMany({ where: { customerId: { in: ids } }, select: { id: true } })
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } })
    await prisma.reward.deleteMany({ where: { title: { in: [...rewardTitles] } } })
    // Points rows, pets and their records go with the customer (cascade).
    await prisma.customer.deleteMany({ where: { id: { in: ids } } })
    await prisma.$disconnect()
  })

  test('B01 signing up gives the sign-up bonus once, shown on the club page and in the ledger', async ({ page }) => {
    const cfg = await getLoyaltyConfig()
    test.skip(!cfg.enabled || cfg.signupBonus <= 0, 'sign-up bonus is switched off')
    const phone = uniquePhone()
    await page.goto('/account/login?mode=register', { waitUntil: 'domcontentloaded' })
    await page.locator('input[name="firstName"]').fill('بهار')
    await page.locator('input[name="lastName"]').fill('امتیازی')
    await page.locator('input[name="phone"]').fill(phone)
    await page.locator('input[name="email"]').fill(`club.b.reg.${stamp()}@example.com`)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page).toHaveURL(/\/account$/)

    const row = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    // The sign-up hook finishes right after the account exists.
    await expect.poll(() => countKind(row.id, 'SIGNUP'), { timeout: 15000 }).toBe(1)
    expect(await balanceOf(row.id)).toBe(cfg.signupBonus)

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-points')).toHaveText(fa(cfg.signupBonus))
    const rows = page.getByTestId('points-history-row')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('هدیه عضویت')
    await expect(rows.first()).toContainText(fa(cfg.signupBonus))

    // Visiting again, or logging in again, never pays it twice.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-points')).toHaveText(fa(cfg.signupBonus))
    expect(await countKind(row.id, 'SIGNUP')).toBe(1)
  })

  test('B02 the first pet pays its bonus once, a second pet pays nothing more', async ({ page, context, baseURL }) => {
    const cfg = await getLoyaltyConfig()
    test.skip(!cfg.enabled || cfg.firstPetBonus <= 0, 'first-pet bonus is switched off')
    const c = await newCustomer({ signup: true })
    const start = await balanceOf(c.id)
    await signIn(context, baseURL, c.id)

    // A bare profile (no breed, birth date or weight) earns only the first-pet bonus.
    await addPetViaUi(page, { name: `رکس${stamp().slice(-4)}` })
    await expect.poll(() => countKind(c.id, 'FIRST_PET')).toBe(1)
    expect(await balanceOf(c.id)).toBe(start + cfg.firstPetBonus)
    expect(await countKind(c.id, 'PET_PROFILE')).toBe(0)

    await addPetViaUi(page, { name: `مانی${stamp().slice(-4)}` })
    expect(await prisma.pet.count({ where: { customerId: c.id } })).toBe(2)
    expect(await countKind(c.id, 'FIRST_PET')).toBe(1)
    expect(await balanceOf(c.id)).toBe(start + cfg.firstPetBonus)

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-points')).toHaveText(fa(start + cfg.firstPetBonus))
    await expect(page.getByTestId('points-history-row').filter({ hasText: 'ثبت اولین حیوان خانگی' })).toHaveCount(1)
  })

  test('B03 completing a pet profile pays the profile bonus once, even after more edits', async ({ page, context, baseURL }) => {
    const cfg = await getLoyaltyConfig()
    test.skip(!cfg.enabled || cfg.petProfileBonus <= 0, 'profile bonus is switched off')
    const c = await newCustomer()
    await signIn(context, baseURL, c.id)

    await addPetViaUi(page, { name: `لونا${stamp().slice(-4)}`, breed: 'پرشین', birthDate: '2022-03-04', weight: '4.2' })
    await expect.poll(() => countKind(c.id, 'PET_PROFILE')).toBe(1)
    const after = await balanceOf(c.id)
    expect(after).toBe(cfg.firstPetBonus + cfg.petProfileBonus)
    await expect(page.getByTestId('pet-completeness')).toBeVisible()

    // Editing a complete profile again does not pay it again.
    await page.getByRole('button', { name: 'ویرایش پروفایل' }).click()
    await page.locator('input[name="weightKg"]').fill('4.6')
    const save = page.getByTestId('pet-save')
    await expect(save).toBeEnabled()
    await save.click()
    await expect.poll(async () => (await prisma.pet.findFirstOrThrow({ where: { customerId: c.id } })).weightKg).toBe(4.6)
    expect(await countKind(c.id, 'PET_PROFILE')).toBe(1)
    expect(await countKind(c.id, 'FIRST_PET')).toBe(1)
    expect(await balanceOf(c.id)).toBe(after)
  })

  test('B04 a delivered order pays points with the tier multiplier and updates the dashboard', async ({ page, context, baseURL }) => {
    const cfg = await getLoyaltyConfig()
    test.skip(!cfg.enabled || cfg.tiers.length < 2, 'needs the points system and a second tier')
    const second = cfg.tiers[1]
    const c = await newCustomer({ tier: second.key, points: second.minPoints, lifetime: second.minPoints })
    await signIn(context, baseURL, c.id)

    const order = await makeOrder(c.id, 200_000, 20_000) // points follow what was actually paid
    await deliver(order.id)
    const expected = pointsForOrder(180_000, tierByKey(cfg.tiers, second.key), cfg)
    expect(expected).toBeGreaterThan(0)

    const tx = await prisma.pointsTransaction.findFirstOrThrow({ where: { customerId: c.id, kind: 'ORDER' } })
    expect(tx.points).toBe(expected)
    expect(tx.refId).toBe(order.id)
    expect(await balanceOf(c.id)).toBe(second.minPoints + expected)
    const stats = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(stats.ordersCount).toBe(1)
    expect(stats.totalSpent).toBe(180_000)

    await page.goto('/account', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-points')).toHaveText(fa(second.minPoints + expected))
    await expect(page.getByTestId('club-tier')).toContainText(second.label)
    await expect(page.locator('dl > div').filter({ hasText: 'سفارش تحویل‌شده' })).toContainText(fa(1))

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    const row = page.getByTestId('points-history-row').filter({ hasText: 'خرید از پت‌شاپ' })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(fa(expected))
    await expect(row).toContainText(order.number)
  })

  test('B05 delivering the same order again, even in parallel, never pays twice', async ({ page, context, baseURL }) => {
    const cfg = await getLoyaltyConfig()
    test.skip(!cfg.enabled, 'points are switched off')
    const c = await newCustomer({ points: 0, lifetime: 0 })
    await signIn(context, baseURL, c.id)

    const order = await makeOrder(c.id, 150_000)
    await prisma.order.update({ where: { id: order.id }, data: { status: 'DELIVERED' } })
    await Promise.all([1, 2, 3, 4, 5].map(() => onOrderDelivered(order.id)))
    await onOrderDelivered(order.id)

    const expected = pointsForOrder(150_000, tierByKey(cfg.tiers, 'BRONZE'), cfg)
    expect(await countKind(c.id, 'ORDER')).toBe(1)
    expect(await balanceOf(c.id)).toBe(expected)
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })).ordersCount).toBe(1)

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-points')).toHaveText(fa(expected))
    await expect(page.getByTestId('points-history-row').filter({ hasText: 'خرید از پت‌شاپ' })).toHaveCount(1)
  })

  test('B06 cancelling a delivered order takes its points back, once, and shows the reversal', async ({ page, context, baseURL }) => {
    const cfg = await getLoyaltyConfig()
    test.skip(!cfg.enabled, 'points are switched off')
    const c = await newCustomer({ points: 0, lifetime: 0 })
    await signIn(context, baseURL, c.id)

    const order = await makeOrder(c.id, 300_000)
    await deliver(order.id)
    const earned = pointsForOrder(300_000, tierByKey(cfg.tiers, 'BRONZE'), cfg)
    expect(await balanceOf(c.id)).toBe(earned)

    await cancelDelivered(order.id)
    await onOrderUndelivered(order.id) // a second run changes nothing
    expect(await balanceOf(c.id)).toBe(0)
    expect(await countKind(c.id, 'REVERSAL')).toBe(1)
    const stats = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(stats.ordersCount).toBe(0)
    expect(stats.totalSpent).toBe(0)

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-points')).toHaveText(fa(0))
    await expect(page.getByTestId('points-history-row').filter({ hasText: 'برگشت امتیاز' })).toHaveCount(1)
    await expect(page.getByTestId('points-history-row').filter({ hasText: 'خرید از پت‌شاپ' })).toHaveCount(1)
    await page.goto('/account', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('dl > div').filter({ hasText: 'سفارش تحویل‌شده' })).toContainText(fa(0))
  })

  test('B07 the ledger lists every movement and the filters split earned from spent', async ({ page, context, baseURL }) => {
    const c = await newCustomer({ points: 0, lifetime: 0 })
    await signIn(context, baseURL, c.id)
    // Two earnings, one spending: built with the real points functions.
    await awardPoints(prisma, { customerId: c.id, kind: 'SIGNUP', points: 200, refType: 'customer', refId: c.id, note: 'هدیه آزمون' })
    await awardPoints(prisma, { customerId: c.id, kind: 'BIRTHDAY', points: 100, refType: 'customer', refId: `${c.id}:b`, note: 'تولد آزمون' })
    const spent = await spendPoints(prisma, { customerId: c.id, points: 120, refType: 'reward', refId: `r-${stamp()}`, note: 'جایزه آزمون' })
    expect(spent.ok).toBe(true)
    expect(await balanceOf(c.id)).toBe(180)

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    const rows = page.getByTestId('points-history-row')
    await expect(rows).toHaveCount(3)
    await expect(page.getByTestId('club-points')).toHaveText(fa(180))

    const nav = page.getByRole('navigation', { name: 'فیلتر تاریخچه' })
    await nav.getByRole('link', { name: 'دریافتی' }).click()
    await expect(page).toHaveURL(/f=in/)
    await expect(rows).toHaveCount(2)
    await expect(rows.filter({ hasText: 'دریافت جایزه' })).toHaveCount(0)

    await nav.getByRole('link', { name: 'مصرفی' }).click()
    await expect(page).toHaveURL(/f=out/)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('دریافت جایزه')
    await expect(rows.first()).toContainText(fa(120))

    await nav.getByRole('link', { name: 'همه' }).click()
    await expect(rows).toHaveCount(3)
  })

  test('B08 crossing the tier threshold moves the member up, fills the bar and raises the earn rate', async ({ page, context, baseURL }) => {
    const cfg = await getLoyaltyConfig()
    test.skip(!cfg.enabled || cfg.tiers.length < 3, 'needs at least three tiers')
    const [low, mid, high] = cfg.tiers
    // Fifteen points short of the second tier.
    const c = await newCustomer({ tier: low.key, points: mid.minPoints - 15, lifetime: mid.minPoints - 15 })
    await signIn(context, baseURL, c.id)

    await page.goto('/account', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-tier')).toContainText(low.label)
    const before = tierProgress(cfg.tiers, mid.minPoints - 15)
    await expect(page.getByTestId('club-progress')).toHaveAttribute('aria-valuenow', String(before.percent))
    await expect(page.getByText(`${fa(15)} امتیاز تا سطح ${mid.label}`)).toBeVisible()

    // An order big enough to cross the line.
    const order = await makeOrder(c.id, Math.ceil(16_000 / Math.max(1, cfg.pointsPerThousandToman)) + 1000)
    await deliver(order.id)
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.lifetimePoints).toBeGreaterThanOrEqual(mid.minPoints)
    expect(row.tier).toBe(mid.key)

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-tier')).toContainText(mid.label)
    const after = tierProgress(cfg.tiers, row.lifetimePoints)
    await expect(page.getByTestId('club-progress')).toHaveAttribute('aria-valuenow', String(after.percent))
    await expect(page.getByText(`${fa(after.remaining)} امتیاز تا سطح ${high.label}`)).toBeVisible()
    await expect(page.locator('li[aria-current="step"]')).toContainText(mid.label)

    // The next purchase already earns at the new tier's rate.
    const second = await makeOrder(c.id, 100_000)
    const balanceBefore = await balanceOf(c.id)
    await deliver(second.id)
    const gain = pointsForOrder(100_000, tierByKey(cfg.tiers, mid.key), cfg)
    expect(await balanceOf(c.id)).toBe(balanceBefore + gain)
    expect((await prisma.pointsTransaction.findFirstOrThrow({ where: { customerId: c.id, kind: 'ORDER', refId: second.id } })).points).toBe(gain)
  })

  test('B09 the balance never goes below zero: big deductions are clipped and expensive rewards stay locked', async ({ page, context, baseURL }) => {
    const c = await newCustomer({ points: 30, lifetime: 30 })
    await signIn(context, baseURL, c.id)
    const title = `جایزه گران ${RUN}-${stamp().slice(-5)}`
    rewardTitles.add(title)
    const reward = await prisma.reward.create({
      data: { title, pointsCost: 5_000_000, couponType: 'FIXED', couponValue: 10_000, couponValidDays: 7, stock: 3, isActive: true },
    })

    // Spending more than is there fails and changes nothing.
    const refused = await spendPoints(prisma, { customerId: c.id, points: 100, refType: 'reward', refId: `x-${stamp()}` })
    expect(refused.ok).toBe(false)
    expect(await balanceOf(c.id)).toBe(30)
    // A manual take-back larger than the balance stops at zero.
    await adjustPoints(prisma, { customerId: c.id, points: -500, note: 'تعدیل آزمون' })
    expect(await balanceOf(c.id)).toBe(0)
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.pointsBalance).toBeGreaterThanOrEqual(0)
    expect(row.lifetimePoints).toBeGreaterThanOrEqual(0)
    const negativeBalances = await prisma.pointsTransaction.count({ where: { customerId: c.id, balanceAfter: { lt: 0 } } })
    expect(negativeBalances).toBe(0)

    // Reversing an order whose points were already spent also stops at zero.
    const order = await makeOrder(c.id, 50_000)
    await deliver(order.id)
    await spendPoints(prisma, { customerId: c.id, points: await balanceOf(c.id), refType: 'reward', refId: `y-${stamp()}` })
    await cancelDelivered(order.id)
    expect(await balanceOf(c.id)).toBe(0)

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('club-points')).toHaveText(fa(0))
    const card = page.getByTestId('reward-card').filter({ hasText: title })
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId('reward-redeem')).toBeDisabled()
    await expect(card.getByTestId('reward-redeem')).toContainText('امتیاز کم دارید')
    // Nothing was redeemed.
    expect(await prisma.rewardRedemption.count({ where: { rewardId: reward.id } })).toBe(0)
  })

  test('B10 the club page shows the live loyalty settings: earn rules, tier ladder and reward catalog', async ({ page, context, baseURL }) => {
    const cfg = await getLoyaltyConfig()
    const c = await newCustomer({ points: 0, lifetime: 0 })
    await signIn(context, baseURL, c.id)
    const title = `جایزه فعال ${RUN}-${stamp().slice(-5)}`
    rewardTitles.add(title)
    await prisma.reward.create({
      data: { title, description: 'توضیح آزمون جایزه', pointsCost: 1234, couponType: 'PERCENT', couponValue: 7, couponValidDays: 11, isActive: true },
    })

    await page.goto('/account/club', { waitUntil: 'domcontentloaded' })
    // How to earn: the numbers come from the saved config.
    const earn = page.getByRole('heading', { name: 'چطور امتیاز بگیرم؟' }).locator('xpath=following-sibling::ul[1]')
    await expect(earn.locator('li').filter({ hasText: 'ثبت اولین حیوان خانگی' })).toContainText(fa(cfg.firstPetBonus))
    await expect(earn.locator('li').filter({ hasText: 'تکمیل پروفایل هر حیوان' })).toContainText(fa(cfg.petProfileBonus))
    await expect(earn.locator('li').filter({ hasText: 'هدیه تولد' })).toContainText(fa(cfg.birthdayBonus))
    await expect(earn.locator('li').filter({ hasText: 'هر ۱٬۰۰۰ تومان خرید' })).toContainText(fa(cfg.pointsPerThousandToman))

    // Tier ladder: every configured tier with its threshold, the member's own marked as current.
    const ladder = page.locator('ol > li').filter({ hasText: 'امتیاز کل' })
    await expect(ladder).toHaveCount(cfg.tiers.length)
    for (const t of cfg.tiers) {
      await expect(ladder.filter({ hasText: t.label }).first()).toContainText(fa(t.minPoints))
    }
    await expect(page.locator('li[aria-current="step"]')).toContainText(cfg.tiers[0].label)
    await expect(page.getByTestId('club-tier')).toContainText(cfg.tiers[0].label)

    // Reward catalog: the new reward shows its cost and coupon details; the member has too few points.
    const card = page.getByTestId('reward-card').filter({ hasText: title })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(fa(1234))
    await expect(card).toContainText(`${fa(7)}٪ تخفیف`)
    await expect(card).toContainText(`${fa(11)} روز`)
    await expect(card.getByTestId('reward-redeem')).toBeDisabled()

    // The referral card has the member's own code.
    await expect(page.getByTestId('referral-code')).toBeVisible()
  })
})
