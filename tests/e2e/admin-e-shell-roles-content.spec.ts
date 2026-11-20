import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

/**
 * New admin shell, roles and content modules, end to end (desktop + phone projects both run this file).
 * Sessions are the same signed HMAC cookie the server issues, one role per test, no real AdminUser rows.
 * Everything written to the database carries TAG and is removed in afterAll by exactly those keys.
 * Layout-dependent tests set their own viewport so both projects exercise the same journey.
 */
const prisma = new PrismaClient()
const TAG = `e${Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(2, 8).padEnd(6, 'x')}`
let seq = 0

const customerIds = new Set<string>()
const notificationIds = new Set<string>()
const auditEntities = new Set<string>()

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'AUTHOR' | 'VIEWER'

function sessionToken(userId: string, role: Role): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'کاربر آزمون', role, expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}

async function signIn(context: BrowserContext, baseURL: string | undefined, role: Role, userId = `e2e_shell_${TAG}_${++seq}`) {
  await context.clearCookies()
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(userId, role), url: baseURL! }])
  return userId
}

/** Click until the (hydrated) handler has opened the thing; avoids racing hydration after domcontentloaded. */
async function clickUntilVisible(click: () => Promise<void>, target: ReturnType<Page['locator']>) {
  await expect(async () => {
    await click()
    await expect(target).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20000 })
}

const DESKTOP = { width: 1280, height: 800 }
const PHONE_360 = { width: 360, height: 740 }

const sidebar = (page: Page) => page.getByTestId('admin-sidebar')
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

test.beforeEach(async ({ context }) => {
  // Per-context random client address so rate limits never bleed between workers
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` })
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 10 * 365 * 24 * 3600 * 1000))
    } catch {}
  })
})

test.afterAll(async () => {
  try {
    if (customerIds.size) await prisma.customer.deleteMany({ where: { id: { in: [...customerIds] } } })
    if (notificationIds.size) await prisma.staffNotification.deleteMany({ where: { id: { in: [...notificationIds] } } })
    if (auditEntities.size) await prisma.auditLog.deleteMany({ where: { entity: { in: [...auditEntities] } } })
  } finally {
    await prisma.$disconnect()
  }
})

test('E01 viewer sees a short grouped menu with no management links', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'VIEWER')
  await page.setViewportSize(DESKTOP)
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const nav = sidebar(page)
  await expect(nav).toBeVisible()
  for (const slug of ['dashboard', 'orders', 'customers', 'leads', 'tasks', 'carts', 'reports']) {
    await expect(nav.getByTestId(`nav-${slug}`)).toBeVisible()
  }
  for (const slug of ['products', 'inventory', 'messages', 'marketing', 'club', 'posts', 'settings', 'audit', 'users']) {
    await expect(nav.getByTestId(`nav-${slug}`)).toHaveCount(0)
  }
  // group headings come from the nav definition
  await expect(nav.getByText('فروش', { exact: true })).toBeVisible()
  await expect(nav.getByText('مشتریان', { exact: true }).first()).toBeVisible()
  await expect(nav.getByTestId('nav-dashboard')).toHaveAttribute('aria-current', 'page')
})

test('E02 editor gains catalogue and content links but not owner-only areas', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'EDITOR')
  await page.setViewportSize(DESKTOP)
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const nav = sidebar(page)
  for (const slug of ['products', 'inventory', 'messages', 'segments', 'campaigns', 'outbox', 'posts', 'homepage', 'services', 'faqs', 'media']) {
    await expect(nav.getByTestId(`nav-${slug}`)).toBeVisible()
  }
  for (const slug of ['marketing', 'automations', 'settings', 'theme', 'audit', 'users']) {
    await expect(nav.getByTestId(`nav-${slug}`)).toHaveCount(0)
  }
  // merged sub-pages keep their parent highlighted
  await page.goto('/admin/testimonials', { waitUntil: 'domcontentloaded' })
  await expect(sidebar(page).getByTestId('nav-faqs')).toHaveAttribute('aria-current', 'page')
})

test('E03 admin menu reaches the marketing and club pages and still hides user management', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'ADMIN')
  await page.setViewportSize(DESKTOP)
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const nav = sidebar(page)
  for (const slug of ['marketing', 'club', 'automations', 'settings', 'theme', 'audit']) {
    await expect(nav.getByTestId(`nav-${slug}`)).toBeVisible()
  }
  await expect(nav.getByTestId('nav-users')).toHaveCount(0)

  await expect(async () => {
    await nav.getByTestId('nav-marketing').click()
    await expect(page).toHaveURL(/\/admin\/marketing/, { timeout: 2500 })
  }).toPass({ timeout: 20000 })
  await expect(page.getByRole('heading', { level: 1, name: 'بازاریابی و تخفیف‌ها' })).toBeVisible()
  await expect(page.getByTestId('breadcrumbs')).toContainText('پیشخوان')

  await expect(async () => {
    await sidebar(page).getByTestId('nav-club').click()
    await expect(page).toHaveURL(/\/admin\/club/, { timeout: 2500 })
  }).toPass({ timeout: 20000 })
  await expect(page.getByTestId('breadcrumbs')).toBeVisible()
  await expect(sidebar(page).getByTestId('nav-club')).toHaveAttribute('aria-current', 'page')
})

test('E04 dashboard widgets follow the role', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'VIEWER')
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('widget-leads')).toBeVisible()
  await expect(page.getByTestId('widget-messages')).toBeVisible()
  await expect(page.getByTestId('widget-tasks')).toHaveCount(0)
  await expect(page.getByTestId('widget-churn')).toHaveCount(0)
  await expect(page.getByTestId('widget-carts')).toHaveCount(0)
  await expect(page.getByTestId('club-kpis')).toHaveCount(0)

  await signIn(context, baseURL, 'ADMIN')
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('widget-tasks')).toBeVisible()
  await expect(page.getByTestId('widget-churn')).toBeVisible()
  await expect(page.getByTestId('widget-carts')).toBeVisible()
  await expect(page.getByTestId('widget-recent-orders')).toBeVisible()
  await expect(page.getByTestId('club-kpis')).toBeVisible()
  // each widget leads to its pre-filtered list
  await expect(page.getByTestId('widget-leads').getByRole('link', { name: 'مشاهده همه' })).toHaveAttribute('href', /\/admin\/leads\?stage=NEW/)
})

test('E05 command palette finds a customer by name and opens the 360 page', async ({ page, context, baseURL }) => {
  const customer = await prisma.customer.create({
    data: { phone: `0938${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`, firstName: `زهرا${TAG}`, lastName: 'پالت' },
  })
  customerIds.add(customer.id)

  await signIn(context, baseURL, 'EDITOR')
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const input = page.getByTestId('cmdk-input')
  await clickUntilVisible(() => page.getByTestId('cmdk-trigger').click(), input)

  // static navigation commands filter locally
  await input.fill('گزارش')
  await expect(page.getByTestId('cmdk-result').filter({ hasText: 'گزارش‌ها' }).first()).toBeVisible()

  await input.fill(TAG)
  const hit = page.getByTestId('cmdk-result').filter({ hasText: `زهرا${TAG}` })
  await expect(hit).toHaveCount(1)
  await hit.click()
  await expect(page).toHaveURL(new RegExp(`/admin/customers/${customer.id}`))

  // Esc closes the palette
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  await clickUntilVisible(() => page.getByTestId('cmdk-trigger').click(), page.getByTestId('cmdk-input'))
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('cmdk-input')).toBeHidden()
})

test('E06 notification centre lists a staff alert, deep-links and marks it read', async ({ page, context, baseURL }) => {
  const userId = await signIn(context, baseURL, 'EDITOR')
  const title = `سرنخ تازه ${TAG}`
  const note = await prisma.staffNotification.create({
    data: { kind: 'NEW_LEAD', title, body: 'یک درخواست مشاوره رسید', href: '/admin/leads', userId, minRole: 'VIEWER' },
  })
  notificationIds.add(note.id)

  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const bell = page.getByTestId('notif-bell')
  await expect(bell).toHaveAttribute('aria-label', /خوانده‌نشده/)
  await clickUntilVisible(() => bell.click(), page.getByRole('dialog', { name: 'اعلان‌ها' }))
  const item = page.getByTestId('notif-item').filter({ hasText: title })
  await expect(item).toHaveCount(1)
  await item.getByRole('link').click()
  await expect(page).toHaveURL(/\/admin\/leads/)
  await expect
    .poll(async () => (await prisma.staffNotification.findUnique({ where: { id: note.id } }))?.readBy.includes(userId))
    .toBe(true)

  // after a reload the bell has no unread badge for this alert
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('notif-bell')).toHaveAttribute('aria-label', /اعلان‌ها/)
})

test('E07 user management is super-admin only and the audit log is closed to viewers', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'ADMIN')
  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/admin(\/login)?\/?(\?.*)?$/)

  await signIn(context, baseURL, 'VIEWER')
  await page.goto('/admin/audit', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/admin(\/login)?\/?(\?.*)?$/)

  await signIn(context, baseURL, 'SUPER_ADMIN')
  await page.setViewportSize(DESKTOP)
  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/admin\/users/)
  await expect(page.locator('main h1').first()).toBeVisible()
  await expect(sidebar(page).getByTestId('nav-users')).toBeVisible()
  await expect(sidebar(page).getByTestId('nav-users')).toHaveAttribute('aria-current', 'page')
})

test('E08 phone drawer opens the grouped menu, navigates, closes and nothing overflows at 360px', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'ADMIN')
  await page.setViewportSize(PHONE_360)
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('admin-sidebar')).toBeHidden()
  expect(await noOverflow(page)).toBe(true)

  const drawer = page.locator('#admin-mobile-nav')
  await clickUntilVisible(() => page.getByRole('button', { name: 'باز کردن منو' }).click(), drawer)
  await expect(drawer.getByTestId('nav-orders')).toBeVisible()
  await drawer.getByTestId('nav-orders').click()
  await expect(page).toHaveURL(/\/admin\/orders/)
  await expect(drawer).toBeHidden()
  expect(await noOverflow(page)).toBe(true)

  for (const path of ['/admin/audit', '/admin/inventory', '/admin/leads']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main h1').first()).toBeVisible()
    expect(await noOverflow(page), `${path} overflows at 360px`).toBe(true)
  }
})

test('E09 content modules open from the menu with their own headings and breadcrumbs', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'EDITOR')
  await page.setViewportSize(DESKTOP)
  const pages: [string, string, string][] = [
    ['/admin/posts', 'مجله و مقالات', 'posts'],
    ['/admin/faqs', 'مدیریت سوالات متداول', 'faqs'],
    ['/admin/menus', 'مدیریت منوهای ناوبری', 'homepage'],
  ]
  for (const [path, heading, slug] of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(sidebar(page).getByTestId(`nav-${slug}`)).toHaveAttribute('aria-current', 'page')
    expect(await noOverflow(page)).toBe(true)
  }
  await page.goto('/admin/services', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main h1').first()).toBeVisible()
  await expect(sidebar(page).getByTestId('nav-services')).toHaveAttribute('aria-current', 'page')
})

test('E10 audit log filters server-side and shows a before/after diff', async ({ page, context, baseURL }) => {
  const entity = `E2E_${TAG.toUpperCase()}`
  auditEntities.add(entity)
  const idOf = (n: number) => `${TAG}-rec-${n}`
  await prisma.auditLog.createMany({
    data: [
      { action: 'CREATE', entity, entityId: idOf(1), after: { title: 'اولی', price: 100 } },
      { action: 'UPDATE', entity, entityId: idOf(2), before: { title: 'قدیم', price: 100 }, after: { title: 'جدید', price: 100 } },
      { action: 'DELETE', entity, entityId: idOf(3), before: { title: 'سومی' } },
    ],
  })

  await signIn(context, baseURL, 'ADMIN')
  await page.goto(`/admin/audit?q=${TAG}-rec`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('audit-log')).toBeVisible()
  await expect(page.getByTestId('breadcrumbs')).toContainText('گزارش تغییرات')
  const rows = page.getByTestId('audit-log').locator('tbody tr, [data-testid="data-row-card"]')
  await expect.poll(async () => await page.locator('[data-testid="data-row"]:visible, [data-testid="data-row-card"]:visible').count()).toBe(3)

  // action filter is applied on the server through the URL
  await page.goto(`/admin/audit?q=${TAG}-rec&action=UPDATE`, { waitUntil: 'domcontentloaded' })
  await expect.poll(async () => await page.locator('[data-testid="data-row"]:visible, [data-testid="data-row-card"]:visible').count()).toBe(1)
  void rows

  const row = page.locator('[data-testid="data-row"]:visible, [data-testid="data-row-card"]:visible').first()
  await expect(async () => {
    await row.click()
    await expect(page.getByTestId('audit-drawer')).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })
  const diff = page.getByTestId('audit-diff')
  await expect(diff).toContainText('title')
  await expect(diff).toContainText('قدیم')
  await expect(diff).toContainText('جدید')
  // unchanged fields are not listed
  await expect(diff).not.toContainText('price')

  // an impossible search shows the empty state, garbage params never break the page
  await page.goto(`/admin/audit?q=${TAG}-nothing-here`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('رکوردی پیدا نشد')).toBeVisible()
  const bad = await page.goto('/admin/audit?page=-4&size=abc&entity=%27%3Bdrop&from=zzz', { waitUntil: 'domcontentloaded' })
  expect(bad!.status()).toBe(200)
})
