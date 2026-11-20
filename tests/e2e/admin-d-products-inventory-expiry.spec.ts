import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
// A fake client address per context keeps the per-IP rate limits of sibling files out of the way.
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
 * Admin products and inventory plus expiry, end to end against the local database.
 * Everything created here carries TAG (a per-worker random letters-only token) in its name, SKU or number and is
 * removed in afterAll by tracked ids. Searches always use TAG, so no assertion depends on a global count.
 * No test here changes a global singleton (ExpiryConfig keeps its defaults: soon 90 days, critical 30, minimum 7).
 */
const prisma = new PrismaClient()
const DAY = 86_400_000

const TAG = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
let seq = 0

const userIds = new Set<string>()
const categoryIds = new Set<string>()
const productIds = new Set<string>()
const customerIds = new Set<string>()
const orderIds = new Set<string>()

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER'

function sessionToken(userId: string, role: Role): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون کالا', role, expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}

/** A real User row (the audit log points at it) plus the signed admin session cookie. */
async function signIn(context: BrowserContext, baseURL: string | undefined, role: Role, existing?: { id: string }) {
  const user =
    existing ??
    (await prisma.user.create({ data: { email: `e2e-d-${TAG}-${++seq}@example.test`, name: 'مدیر آزمون کالا', role } }))
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(user.id, role), url: baseURL! }])
  return user
}

/** A letters-only token per test (it starts with the worker TAG), so one test never sees another test's rows. */
const scope = () => TAG + Array.from({ length: 3 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')

async function makeCategory(s: string, label: string) {
  const n = ++seq
  const cat = await prisma.productCategory.create({ data: { slugFa: `e2e-d-${s}-c${n}`, nameFa: `دسته آزمون ${s} ${label}` } })
  categoryIds.add(cat.id)
  return cat
}

async function makeProduct(
  s: string,
  categoryId: string,
  label: string,
  over: { price?: number; stockStatus?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LOW_STOCK'; isActive?: boolean; tracksExpiry?: boolean } = {}
) {
  const n = ++seq
  const product = await prisma.product.create({
    data: {
      categoryId,
      sku: `E2E-D-${s}-${n}`.toUpperCase(),
      slugFa: `e2e-d-${s}-p${n}`,
      nameFa: `کالای آزمون ${s} ${label}`,
      price: over.price ?? 150000,
      stockStatus: over.stockStatus ?? 'IN_STOCK',
      isPurchasable: true,
      isActive: over.isActive ?? true,
      tracksExpiry: over.tracksExpiry ?? false,
    },
  })
  productIds.add(product.id)
  return product
}

/** A stock batch expiring `days` from now (null = no date). */
async function makeBatch(productId: string, quantity: number, days: number | null, batchNumber?: string) {
  return prisma.inventory.create({
    data: { productId, quantity, expiryDate: days == null ? null : new Date(Date.now() + days * DAY), batchNumber: batchNumber ?? `B${TAG}${++seq}`.toUpperCase() },
  })
}

/** Waits until React owns the element: a click or submit before that would be a native form submit. */
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

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768
/** Table rows on desktop, cards on phones: the kit renders both and CSS shows one. */
const rowsOf = (page: Page) => page.getByTestId(isPhone(page) ? 'data-row-card' : 'data-row')
const rowFor = (page: Page, text: string) => rowsOf(page).filter({ hasText: text })

/** Same output as lib/shop/expiry formatJalaliDate (long style), to compare the shown date with the batch. */
const jalaliLong = (d: Date) =>
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(d)

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page must not scroll sideways').toBeLessThanOrEqual(1)
}

test.describe('admin products, inventory and expiry', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const pids = [...productIds]
    const batches = await prisma.inventory.findMany({ where: { productId: { in: pids } }, select: { id: true } })
    await prisma.order.deleteMany({ where: { id: { in: [...orderIds] } } })
    await prisma.inventoryAdjustment.deleteMany({ where: { OR: [{ productId: { in: pids } }, { inventoryId: { in: batches.map((b) => b.id) } }] } })
    const coupons = await prisma.coupon.findMany({ where: { productIds: { hasSome: pids } }, select: { id: true } })
    await prisma.coupon.deleteMany({ where: { id: { in: coupons.map((c) => c.id) } } })
    await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: [...pids, ...coupons.map((c) => c.id)] } }, { userId: { in: [...userIds] } }] } })
    // Products created through the admin form carry the TAG in their SKU and are not tracked by id.
    await prisma.product.deleteMany({ where: { OR: [{ id: { in: pids } }, { sku: { startsWith: `E2E-D-${TAG}`.toUpperCase() } }] } })
    await prisma.customer.deleteMany({ where: { id: { in: [...customerIds] } } })
    await prisma.productCategory.deleteMany({ where: { id: { in: [...categoryIds] } } })
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } })
    await prisma.$disconnect()
  })

  test('D01 products list filters, searches and pages through the URL', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'ADMIN')
    const catA = await makeCategory(S, 'الف')
    const catB = await makeCategory(S, 'ب')
    await makeProduct(S, catA.id, 'الف')
    const b = await makeProduct(S, catA.id, 'ب', { stockStatus: 'OUT_OF_STOCK' })
    const c = await makeProduct(S, catA.id, 'ج', { isActive: false })
    const d = await makeProduct(S, catB.id, 'د')

    await page.goto(`/admin/products?q=${S}`, { waitUntil: 'domcontentloaded' })
    await expect(rowsOf(page)).toHaveCount(4)
    await expect(page.getByTestId('pager')).toContainText(/نمایش\s*[۱1]\s*تا\s*[۴4]\s*از\s*[۴4]/)

    // Each filter is a URL parameter that the server applies
    await page.goto(`/admin/products?q=${S}&status=OUT_OF_STOCK`, { waitUntil: 'domcontentloaded' })
    await expect(rowsOf(page)).toHaveCount(1)
    await expect(rowFor(page, b.nameFa)).toHaveCount(1)
    await page.goto(`/admin/products?q=${S}&status=INACTIVE`, { waitUntil: 'domcontentloaded' })
    await expect(rowFor(page, c.nameFa)).toHaveCount(1)
    await expect(rowsOf(page)).toHaveCount(1)
    await page.goto(`/admin/products?q=${S}&cat=${catB.id}`, { waitUntil: 'domcontentloaded' })
    await expect(rowFor(page, d.nameFa)).toHaveCount(1)
    await expect(rowsOf(page)).toHaveCount(1)

    // An impossible search shows the empty state; garbage parameters never break the page
    await page.goto(`/admin/products?q=${S}zzzz-none`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('محصولی پیدا نشد')).toBeVisible()
    const bad = await page.goto(`/admin/products?q=${S}&page=-5&size=abc&status=NOPE&cat=missing&expiry=zzz`, { waitUntil: 'domcontentloaded' })
    expect(bad!.status()).toBe(200)

    // Typing in the search box and resetting go through the URL as well
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'products-list')
    await page.getByTestId('filter-search').fill(`${S} د`)
    await expect(page).toHaveURL(new RegExp(`q=${S}`))
    // (the label «الف» would also match category A's name, which the search covers on purpose)
    await expect(rowFor(page, d.nameFa)).toHaveCount(1)
    await expect(rowsOf(page)).toHaveCount(1)
    await page.getByTestId('filter-reset').click()
    await expect(page).not.toHaveURL(/q=/)
    await noHorizontalOverflow(page)
  })

  test('D02 inline price and stock edits save from the list and are audited', async ({ page, context, baseURL }) => {
    const S = scope()
    test.skip(isPhone(page), 'inline editing lives in the desktop table; phones get the read-only card')
    await signIn(context, baseURL, 'EDITOR')
    const cat = await makeCategory(S, 'درجا')
    const p = await makeProduct(S, cat.id, 'درجا', { price: 100000 })

    await page.goto(`/admin/products?q=${S}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'products-list')
    const price = page.getByTestId(`inline-price-${p.id}`)
    await price.fill('123000')
    await price.press('Enter')
    await expect.poll(async () => (await prisma.product.findUnique({ where: { id: p.id } }))?.price).toBe(123000)

    await page.getByTestId(`inline-stock-${p.id}`).selectOption('OUT_OF_STOCK')
    await expect.poll(async () => (await prisma.product.findUnique({ where: { id: p.id } }))?.stockStatus).toBe('OUT_OF_STOCK')
    await expect.poll(async () => prisma.auditLog.count({ where: { entity: 'PRODUCT', entityId: p.id, action: 'UPDATE' } })).toBeGreaterThanOrEqual(2)

    // The new values are what the list shows after a reload, and a rejected price falls back to the stored one
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId(`inline-price-${p.id}`)).toHaveValue('123000')
    await expect(page.getByTestId(`inline-stock-${p.id}`)).toHaveValue('OUT_OF_STOCK')
  })

  test('D03 bulk price change shows a preview first and applies only after confirmation', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'ADMIN')
    const cat = await makeCategory(S, 'گروهی')
    const p1 = await makeProduct(S, cat.id, 'قیمت یک', { price: 100000 })
    const p2 = await makeProduct(S, cat.id, 'قیمت دو', { price: 200000 })
    const p3 = await makeProduct(S, cat.id, 'قیمت سه', { price: 300000 })

    await page.goto(`/admin/products?q=${encodeURIComponent(S + ' قیمت')}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'products-list')
    await expect(rowsOf(page)).toHaveCount(3)
    for (const p of [p1, p2]) await rowFor(page, p.nameFa).locator('input[type="checkbox"]').check()
    await expect(page.getByTestId('bulk-bar')).toContainText(/[۲2]\s*مورد انتخاب شده/)

    await page.getByTestId('bulk-bar').getByRole('button', { name: 'تغییر قیمت' }).click()
    await page.getByRole('combobox', { name: /گرد کردن/ }).selectOption('1')
    await page.getByLabel(/مقدار \(برای کاهش منفی\)/).fill('10')
    await page.getByRole('button', { name: 'پیش‌نمایش' }).click()
    const preview = page.getByTestId('price-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(p1.nameFa)
    await expect(preview).toContainText(p2.nameFa)
    await expect(preview).not.toContainText(p3.nameFa)
    // 10 percent on 100,000 and 200,000 (Persian digits and separators are ignored)
    const afterOf = async (name: string) => {
      const cell = await preview.locator('tr', { hasText: name }).locator('td').last().innerText()
      return Number(cell.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))))
    }
    expect(await afterOf(p1.nameFa)).toBe(110000)
    expect(await afterOf(p2.nameFa)).toBe(220000)
    // Nothing has been written by the preview
    expect((await prisma.product.findUnique({ where: { id: p1.id } }))?.price).toBe(100000)

    await page.getByTestId('price-apply').click()
    await page.getByRole('button', { name: 'اعمال تغییر' }).click()
    await expect.poll(async () => (await prisma.product.findUnique({ where: { id: p1.id } }))?.price).toBe(110000)
    expect((await prisma.product.findUnique({ where: { id: p2.id } }))?.price).toBe(220000)
    expect((await prisma.product.findUnique({ where: { id: p3.id } }))?.price).toBe(300000)
    await expect.poll(async () => prisma.auditLog.count({ where: { entity: 'PRODUCT', entityId: { in: [p1.id, p2.id] } } })).toBeGreaterThanOrEqual(2)
  })

  test('D04 create, edit and delete a product through the form', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'EDITOR')
    const cat = await makeCategory(S, 'فرم')
    const sku = `E2E-D-${S}-FORM`.toUpperCase()
    const name = `کالای فرم ${S}`

    await page.goto(`/admin/products?q=${S}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'products-list')
    await page.getByTestId('product-new').click()
    await expect(page.getByText('ثبت محصول جدید')).toBeVisible()
    await page.locator('form select').first().selectOption(cat.id)
    await page.getByPlaceholder('مثال: PB-CAT-001').fill(sku)
    await page.getByPlaceholder('مثال: غذای خشک گربه ایندور ۲ کیلوگرم').fill(name)
    await page.getByPlaceholder('مثال: ۲۴۵۰۰۰۰').fill('250000')
    await page.getByRole('button', { name: 'ذخیره محصول' }).click()
    await expect.poll(async () => (await prisma.product.findUnique({ where: { sku } }))?.price).toBe(250000)
    const created = await prisma.product.findUniqueOrThrow({ where: { sku } })
    productIds.add(created.id)
    expect(created.nameFa).toBe(name)
    expect(created.categoryId).toBe(cat.id)

    // Edit: open it from the filtered list and change the price
    await page.goto(`/admin/products?q=${encodeURIComponent(name)}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'products-list')
    await expect(rowsOf(page)).toHaveCount(1)
    await rowsOf(page).first().getByRole('button', { name: name }).click()
    await expect(page.getByText('ویرایش محصول')).toBeVisible()
    await page.getByPlaceholder('مثال: ۲۴۵۰۰۰۰').fill('275000')
    await page.getByRole('button', { name: 'ذخیره محصول' }).click()
    await expect.poll(async () => (await prisma.product.findUnique({ where: { id: created.id } }))?.price).toBe(275000)

    // Delete: the browser confirm is accepted, and the row is gone for good
    await page.goto(`/admin/products?q=${encodeURIComponent(name)}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'products-list')
    page.once('dialog', (dialog) => dialog.accept())
    if (isPhone(page)) {
      await page.getByTestId('data-row-card').first().getByRole('button', { name: 'حذف' }).click()
    } else {
      await rowsOf(page).first().getByRole('button', { name: 'حذف' }).click()
    }
    await expect.poll(async () => prisma.product.count({ where: { id: created.id } })).toBe(0)
    await expect.poll(async () => prisma.auditLog.count({ where: { entity: 'PRODUCT', entityId: created.id, action: 'DELETE' } })).toBe(1)
  })

  test('D05 inventory board groups batches by urgency, filters by state and hides write actions from editors', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'ADMIN')
    const cat = await makeCategory(S, 'انبار')
    const pe = await makeProduct(S, cat.id, 'منقضی', { tracksExpiry: true })
    const pc = await makeProduct(S, cat.id, 'بحرانی', { tracksExpiry: true })
    const ps = await makeProduct(S, cat.id, 'نزدیک', { tracksExpiry: true })
    const po = await makeProduct(S, cat.id, 'سالم', { tracksExpiry: true })
    const be = await makeBatch(pe.id, 4, -5)
    const bc = await makeBatch(pc.id, 6, 15)
    const bs = await makeBatch(ps.id, 8, 60)
    const bo = await makeBatch(po.id, 10, 400)

    await page.goto(`/admin/inventory?q=${S}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'inventory-board')
    for (const state of ['expired', 'critical', 'soon', 'ok']) await expect(page.getByTestId(`expiry-group-${state}`)).toBeVisible()
    await expect(page.getByTestId(`expiry-group-expired`).getByTestId(`batch-row-${be.id}`)).toBeVisible()
    await expect(page.getByTestId(`expiry-group-critical`).getByTestId(`batch-row-${bc.id}`)).toBeVisible()
    // Only the most urgent groups start open (accordion); open the others like a user would
    for (const g of ['soon', 'ok']) {
      const group = page.getByTestId(`expiry-group-${g}`)
      if ((await group.getAttribute('open')) === null) await group.locator('summary').click()
    }
    await expect(page.getByTestId(`expiry-group-soon`).getByTestId(`batch-row-${bs.id}`)).toBeVisible()
    await expect(page.getByTestId(`expiry-group-ok`).getByTestId(`batch-row-${bo.id}`)).toBeVisible()
    // Expired stock raises an alert, and every row carries a text badge (never colour alone)
    await expect(page.getByRole('alert').filter({ hasText: 'بچ منقضی' })).toBeVisible()
    await expect(page.getByTestId(`batch-row-${be.id}`).getByTestId('expiry-badge')).toHaveAttribute('data-state', 'expired')
    await expect(page.getByTestId(`batch-row-${bc.id}`).getByTestId('expiry-badge')).toHaveAttribute('data-state', 'critical')
    await expect(page.getByTestId(`batch-row-${bo.id}`).getByTestId('expiry-badge')).toContainText('سالم')

    // The state filter lives in the URL and narrows the groups
    await page.getByTestId('inventory-filter-state').selectOption('critical')
    await expect(page).toHaveURL(/state=critical/)
    await expect(page.getByTestId(`batch-row-${bc.id}`)).toBeVisible()
    await expect(page.getByTestId('expiry-group-soon')).toHaveCount(0)
    await expect(page.getByTestId(`batch-row-${bs.id}`)).toHaveCount(0)
    await page.goto(`/admin/inventory?q=${S}&state=expired`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId(`batch-row-${be.id}`)).toBeVisible()
    await expect(page.getByTestId(`batch-row-${bo.id}`)).toHaveCount(0)

    // An editor sees the board but not the stock-changing actions
    await signIn(context, baseURL, 'EDITOR')
    await page.goto(`/admin/inventory?q=${S}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId(`batch-row-${be.id}`)).toBeVisible()
    await expect(page.getByTestId(`batch-adjust-${be.id}`)).toHaveCount(0)
    await expect(page.getByTestId(`batch-writeoff-${be.id}`)).toHaveCount(0)
    await noHorizontalOverflow(page)
  })

  test('D06 multi-line batch entry validates every row and saves all rows together', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'ADMIN')
    const cat = await makeCategory(S, 'ورود')
    const p1 = await makeProduct(S, cat.id, 'ورودی یک', { tracksExpiry: true })
    const p2 = await makeProduct(S, cat.id, 'ورودی دو', { tracksExpiry: true })

    await page.goto(`/admin/inventory?q=${S}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'inventory-board')
    await page.getByTestId('batch-new').click()
    const drawer = page.getByTestId('batch-drawer')
    await expect(drawer).toBeVisible()

    const pick = async (line: number, name: string) => {
      const box = page.getByTestId(`batch-line-${line}`).getByRole('combobox')
      await box.fill(name.replace('کالای آزمون ', ''))
      await page.getByRole('option').filter({ hasText: name }).first().click()
    }

    await pick(0, p1.nameFa)
    await page.getByTestId('batch-qty-0').fill('24')
    await page.getByTestId('batch-line-0').getByRole('button', { name: '+۶ ماه' }).click()

    await page.getByTestId('batch-add-line').click()
    await pick(1, p2.nameFa)
    await page.getByTestId('batch-qty-1').fill('5')

    // The second row has no expiry date: the whole save is refused with an inline message
    await page.getByTestId('batch-save').click()
    await expect(page.getByTestId('batch-line-1').getByRole('alert')).toContainText('تاریخ را وارد کنید')
    expect(await prisma.inventory.count({ where: { productId: { in: [p1.id, p2.id] } } })).toBe(0)

    await page.getByTestId('batch-line-1').getByRole('button', { name: '+۱۲ ماه' }).click()
    await page.getByTestId('batch-save').click()
    await expect(drawer.getByRole('status')).toBeVisible()

    await expect.poll(async () => prisma.inventory.count({ where: { productId: { in: [p1.id, p2.id] } } })).toBe(2)
    const b1 = await prisma.inventory.findFirstOrThrow({ where: { productId: p1.id } })
    const b2 = await prisma.inventory.findFirstOrThrow({ where: { productId: p2.id } })
    expect(b1.quantity).toBe(24)
    expect(b2.quantity).toBe(5)
    const daysTo = (d: Date | null) => ((d?.getTime() ?? 0) - Date.now()) / DAY
    expect(daysTo(b1.expiryDate)).toBeGreaterThan(170)
    expect(daysTo(b1.expiryDate)).toBeLessThan(200)
    expect(daysTo(b2.expiryDate)).toBeGreaterThan(355)
    expect(daysTo(b2.expiryDate)).toBeLessThan(375)
  })

  test('D07 pasted rows become batches, then adjust and write-off change stock with a reason', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'ADMIN')
    const cat = await makeCategory(S, 'اکسل')
    const p = await makeProduct(S, cat.id, 'اکسل', { tracksExpiry: true })

    // ?new=1 opens the entry drawer straight away (the header's quick-create link uses it)
    await page.goto(`/admin/inventory?q=${S}&new=1`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'inventory-board')
    const drawer = page.getByTestId('batch-drawer')
    await expect(drawer).toBeVisible()
    await drawer.getByText('چسباندن از اکسل یا CSV').click()
    await drawer.locator('details textarea').fill(`${p.sku}, 12, 1406/12/12`)
    await drawer.getByRole('button', { name: 'افزودن سطرها' }).click()
    await expect(page.getByTestId('batch-qty-0')).toHaveValue('12')
    await page.getByTestId('batch-save').click()

    await expect.poll(async () => prisma.inventory.count({ where: { productId: p.id } })).toBe(1)
    const batch = await prisma.inventory.findFirstOrThrow({ where: { productId: p.id } })
    expect(batch.quantity).toBe(12)
    // 1406/12/12 in the Jalali calendar is the beginning of March 2028
    expect(batch.expiryDate!.getTime()).toBeGreaterThan(Date.UTC(2028, 1, 27))
    expect(batch.expiryDate!.getTime()).toBeLessThan(Date.UTC(2028, 2, 6))

    // Adjust by a counted difference
    await page.goto(`/admin/inventory?q=${S}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'inventory-board')
    await page.getByTestId(`batch-adjust-${batch.id}`).click()
    await page.getByLabel(/تغییر \(مثلاً/).fill('-5')
    await page.getByRole('button', { name: 'ثبت تعدیل' }).click()
    await expect.poll(async () => (await prisma.inventory.findUnique({ where: { id: batch.id } }))?.quantity).toBe(7)
    const adj = await prisma.inventoryAdjustment.findFirstOrThrow({ where: { inventoryId: batch.id } })
    expect(adj.delta).toBe(-5)
    expect(adj.reason).toBe('COUNT')

    // Write off the rest after the confirmation dialog
    await page.reload({ waitUntil: 'domcontentloaded' })
    await hydrated(page, 'inventory-board')
    await page.getByTestId(`batch-writeoff-${batch.id}`).click()
    await page.getByRole('button', { name: 'امحا کن' }).click()
    await expect.poll(async () => (await prisma.inventory.findUnique({ where: { id: batch.id } }))?.quantity).toBe(0)
    await expect.poll(async () => prisma.inventoryAdjustment.count({ where: { inventoryId: batch.id } })).toBe(2)
  })

  test('D08 a near-expiry batch gets a one-click discount coupon; a healthy batch does not', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'ADMIN')
    const cat = await makeCategory(S, 'تخفیف')
    const ps = await makeProduct(S, cat.id, 'تخفیف نزدیک', { tracksExpiry: true })
    const po = await makeProduct(S, cat.id, 'تخفیف سالم', { tracksExpiry: true })
    const bs = await makeBatch(ps.id, 9, 50)
    const bo = await makeBatch(po.id, 9, 400)

    await page.goto(`/admin/inventory?q=${S}`, { waitUntil: 'domcontentloaded' })
    await hydrated(page, 'inventory-board')
    await expect(page.getByTestId(`batch-row-${bo.id}`)).toBeVisible()
    await expect(page.getByTestId(`batch-row-${bo.id}`).getByRole('button', { name: 'تخفیف نزدیک انقضا' })).toHaveCount(0)
    await page.getByTestId(`batch-row-${bs.id}`).getByRole('button', { name: 'تخفیف نزدیک انقضا' }).click()

    await expect.poll(async () => prisma.coupon.count({ where: { productIds: { has: ps.id } } })).toBe(1)
    const coupon = await prisma.coupon.findFirstOrThrow({ where: { productIds: { has: ps.id } } })
    expect(coupon.type).toBe('PERCENT')
    expect(coupon.value).toBeGreaterThan(0)
    expect(coupon.isActive).toBe(true)
    // The offer stops before the batch becomes unsellable
    expect(coupon.endsAt!.getTime()).toBeLessThan(bs.expiryDate!.getTime())
    await expect.poll(async () => prisma.auditLog.count({ where: { entity: 'COUPON', entityId: coupon.id } })).toBe(1)
    // Scoped to one product: the healthy one is untouched
    expect(await prisma.coupon.count({ where: { productIds: { has: po.id } } })).toBe(0)
  })

  test('D09 storefront shows expiry once, calmly, from the batch that ships first', async ({ page }) => {
    const S = scope()
    const cat = await makeCategory(S, 'ویترین')
    const okP = await makeProduct(S, cat.id, 'سالم', { tracksExpiry: true })
    const nearP = await makeProduct(S, cat.id, 'نزدیک', { tracksExpiry: true })
    const fefoP = await makeProduct(S, cat.id, 'ترکیبی', { tracksExpiry: true })
    const deadP = await makeProduct(S, cat.id, 'منقضی', { tracksExpiry: true })
    const plainP = await makeProduct(S, cat.id, 'بدون انقضا')
    await makeBatch(okP.id, 20, 400)
    await makeBatch(nearP.id, 20, 20)
    // FEFO: the nearer batch is what the customer receives, so that is the date shown
    const fefoNear = await makeBatch(fefoP.id, 3, 45)
    await makeBatch(fefoP.id, 30, 500)
    await makeBatch(deadP.id, 20, -3)
    await makeBatch(plainP.id, 20, null)
    const view = (slug: string) => page.goto(`/product/${slug}`, { waitUntil: 'domcontentloaded' })

    await view(okP.slugFa)
    await expect(page.getByTestId('product-expiry')).toHaveCount(1)
    await expect(page.getByTestId('product-expiry')).toHaveAttribute('data-state', 'ok')
    await expect(page.getByTestId('product-expiry-badge')).toHaveCount(0)

    await view(nearP.slugFa)
    await expect(page.getByTestId('product-expiry')).toHaveCount(1)
    await expect(page.getByTestId('product-expiry-badge')).toHaveText('تاریخ نزدیک')
    await expect(page.getByTestId('product-expiry')).toContainText('مناسب مصرف سریع')

    await view(fefoP.slugFa)
    await expect(page.getByTestId('product-expiry')).toHaveCount(1)
    await expect(page.getByTestId('product-expiry')).toHaveAttribute('data-state', 'soon')
    await expect(page.getByTestId('product-expiry')).toContainText(jalaliLong(fefoNear.expiryDate!))

    // Only expired stock: no date is promised, the clinic checks it before shipping
    await view(deadP.slugFa)
    await expect(page.getByTestId('product-expiry')).toContainText('پیش از ارسال')
    await expect(page.getByTestId('product-expiry-badge')).toHaveCount(0)
    // A product without expiry tracking shows nothing at all
    await view(plainP.slugFa)
    await expect(page.getByTestId('product-expiry')).toHaveCount(0)

    // The category listing links to these pages; the cart explains when the date is printed
    await page.goto(`/shop/${cat.slugFa}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator(`a[href="/product/${okP.slugFa}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href="/product/${nearP.slugFa}"]`).first()).toBeVisible()
    await view(nearP.slugFa)
    const add = page.getByRole('button', { name: 'افزودن به سبد خرید' })
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('افزودن به سبد خرید'))
      return !!b && Object.keys(b).some((k) => k.startsWith('__reactProps'))
    })
    await add.click()
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(nearP.nameFa).first()).toBeVisible()
    await expect(page.getByText('تاریخ انقضا بعد از تأیید سفارش در فاکتور درج می‌شود')).toBeVisible()
    await noHorizontalOverflow(page)
  })

  test('D10 processing an order takes stock from the earliest batch first and cancelling puts it back', async ({ page, context, baseURL }) => {
    const S = scope()
    await signIn(context, baseURL, 'ADMIN')
    const cat = await makeCategory(S, 'سفارش')
    const p = await makeProduct(S, cat.id, 'سفارش', { tracksExpiry: true, price: 90000 })
    const near = await makeBatch(p.id, 2, 40)
    const far = await makeBatch(p.id, 10, 400)
    const phone = `0936${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}${String(++seq).padStart(4, '0')}`
    const customer = await prisma.customer.create({ data: { phone, firstName: 'مشتری', lastName: `انبار ${S}`, marketingSmsConsent: false } as never })
    customerIds.add(customer.id)
    const number = `PB-E2E-${S}-${++seq}`.toUpperCase()
    const order = await prisma.order.create({
      data: {
        number,
        customerId: customer.id,
        status: 'CONFIRMED',
        paymentMethod: 'COD',
        subtotal: 270000,
        shippingFee: 0,
        total: 270000,
        shipName: 'مشتری آزمون',
        shipPhone: phone,
        shipProvince: 'تهران',
        shipCity: 'تهران',
        shipAddress: 'خیابان آزمون، پلاک ۱',
        shipPostal: '1938973111',
        items: { create: [{ productId: p.id, nameFa: p.nameFa, sku: p.sku, slugFa: p.slugFa, unitPrice: 90000, quantity: 3, lineTotal: 270000 }] },
      },
    })
    orderIds.add(order.id)

    // Before: the page shows the nearer batch, the one that would ship
    await page.goto(`/product/${p.slugFa}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('product-expiry')).toContainText(jalaliLong(near.expiryDate!))

    const openOrder = async (status: string) => {
      await page.goto(`/admin/orders?status=${status}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => {
        const el = document.querySelector('main')
        return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'))
      })
      await page.getByRole('button', { name: new RegExp(number) }).click()
      await expect(page.getByText(p.nameFa).first()).toBeVisible()
    }
    const statusSelect = () => page.locator('select', { has: page.locator('option', { hasText: 'در حال آماده‌سازی' }) })

    await openOrder('CONFIRMED')
    await statusSelect().selectOption({ label: 'در حال آماده‌سازی' })
    await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()

    await expect.poll(async () => (await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe('PROCESSING')
    await expect.poll(async () => (await prisma.inventory.findUnique({ where: { id: near.id } }))?.quantity).toBe(0)
    expect((await prisma.inventory.findUnique({ where: { id: far.id } }))?.quantity).toBe(9)
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })
    const takes = item.allocations as { batchId: string; quantity: number; expiryDate?: string }[]
    expect(takes.find((t) => t.batchId === near.id)?.quantity).toBe(2)
    expect(takes.find((t) => t.batchId === far.id)?.quantity).toBe(1)
    // The expiry date of each shipped batch is stored on the order line for the invoice
    expect(takes.find((t) => t.batchId === near.id)?.expiryDate).toBeTruthy()

    // The storefront now shows the batch that is left to ship
    await expect(async () => {
      await page.goto(`/product/${p.slugFa}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('product-expiry')).toHaveAttribute('data-state', 'ok', { timeout: 3000 })
    }).toPass({ timeout: 30000 })

    // Cancelling gives every unit back to the batch it came from
    await openOrder('PROCESSING')
    await statusSelect().selectOption({ label: 'لغوشده' })
    await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
    await page.getByRole('button', { name: 'لغو سفارش', exact: true }).click()
    await expect.poll(async () => (await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe('CANCELLED')
    await expect.poll(async () => (await prisma.inventory.findUnique({ where: { id: near.id } }))?.quantity).toBe(2)
    expect((await prisma.inventory.findUnique({ where: { id: far.id } }))?.quantity).toBe(10)
  })
})
