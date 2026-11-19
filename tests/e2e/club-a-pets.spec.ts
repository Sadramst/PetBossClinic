import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient, type PetSpecies } from '@prisma/client'

/**
 * Customer club, author A: the pet portal. Create (dog, cat, bird), validation, edit, the big profile,
 * health records with due badges, weight trend, deletes with confirmation, the 20-pet limit,
 * ownership (somebody else's pet is a 404), shop chips, avatars and phone-width layout.
 *
 * Isolation: every test makes its own customer (signed in with a session cookie) and only touches
 * its own rows; nothing here changes a global singleton (the one temporary product tweak is restored).
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86_400_000))
    } catch {
      /* ignore */
    }
  })
  // A fake client address per test keeps the per-IP rate limits of sibling files out of the way.
  const o = () => Math.floor(Math.random() * 250) + 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
})

const prisma = new PrismaClient()
const customerIds = new Set<string>()
const DAY = 86_400_000

function uniquePhone(): string {
  return `0935${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
}

function sessionToken(customerId: string, version: number): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600, v: version })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

async function makeCustomer(tag: string) {
  const c = await prisma.customer.create({
    data: { phone: uniquePhone(), firstName: 'مشتری', lastName: `پت ${tag}`, phoneVerifiedAt: new Date() },
  })
  customerIds.add(c.id)
  return c
}

async function signIn(context: BrowserContext, baseURL: string | undefined, c: { id: string; sessionVersion: number }) {
  await context.clearCookies()
  await context.addCookies([{ name: 'pb_customer', value: sessionToken(c.id, c.sessionVersion), url: baseURL! }])
}

/** ISO date (yyyy-mm-dd) `days` from today. */
const isoDay = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)

/** Clicks until the target shows up: the click is ignored if the page has not hydrated yet. */
async function clickUntilVisible(button: Locator, target: Locator) {
  await expect(async () => {
    if (!(await target.isVisible())) await button.click({ timeout: 2000 })
    await expect(target).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
}

async function openAddForm(page: Page) {
  await clickUntilVisible(page.getByTestId('pet-add'), page.getByTestId('pet-name-input'))
}

async function fillPet(page: Page, v: { name?: string; species?: string; breed?: string; sex?: string; birth?: string; weight?: string; food?: string; chip?: string }) {
  if (v.name !== undefined) await page.getByTestId('pet-name-input').fill(v.name)
  if (v.species) await page.locator('select[name="species"]').selectOption(v.species)
  if (v.breed !== undefined) await page.locator('input[name="breed"]').fill(v.breed)
  if (v.sex) await page.locator('select[name="sex"]').selectOption(v.sex)
  if (v.birth) await page.locator('input[name="birthDate"]').fill(v.birth)
  if (v.weight !== undefined) await page.locator('input[name="weightKg"]').fill(v.weight)
  if (v.food !== undefined) await page.locator('input[name="foodBrand"]').fill(v.food)
  if (v.chip !== undefined) await page.locator('input[name="microchip"]').fill(v.chip)
}

async function seedPet(customerId: string, name: string, species: PetSpecies = 'DOG', extra: Record<string, unknown> = {}) {
  return prisma.pet.create({ data: { customerId, name, species, ...extra } })
}

function recordForm(page: Page) {
  return page.locator('form').filter({ hasText: 'ثبت سابقه جدید' })
}

async function addRecord(page: Page, r: { kind?: string; title: string; doneAt: string; nextDueAt?: string; weight?: string }) {
  const form = recordForm(page)
  await expect(page.getByTestId('pet-record-add')).toBeEnabled()
  if (r.kind) await form.locator('select').selectOption(r.kind)
  await form.locator('input[name="title"]').fill(r.title)
  await form.locator('input[name="doneAt"]').fill(r.doneAt)
  if (r.nextDueAt) await form.locator('input[name="nextDueAt"]').fill(r.nextDueAt)
  if (r.weight) await form.locator('input[name="valueNumber"]').fill(r.weight)
  await page.getByTestId('pet-record-add').click()
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test.describe('customer club: pets', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const ids = [...customerIds]
    await prisma.pointsTransaction.deleteMany({ where: { customerId: { in: ids } } }).catch(() => {})
    await prisma.customer.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    await prisma.$disconnect()
  })

  test('A01 a customer creates a dog and sees the big profile with age, breed, food brand and completeness', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a01')
    await signIn(context, baseURL, c)
    const birth = new Date()
    birth.setUTCMonth(birth.getUTCMonth() - 26)

    await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('هنوز حیوان خانگی‌ای ثبت نکرده‌اید.')).toBeVisible()
    await openAddForm(page)
    await fillPet(page, { name: 'رکس', species: 'DOG', breed: 'شیتزو', sex: 'MALE', birth: birth.toISOString().slice(0, 10), weight: '7.5', food: 'رویال کنین' })
    await page.getByTestId('pet-save').click()

    await expect(page).toHaveURL(/\/account\/pets\/[^/]+$/, { timeout: 20_000 })
    const profile = page.getByTestId('pet-profile')
    await expect(profile.getByRole('heading', { name: 'رکس' })).toBeVisible()
    await expect(profile).toContainText('سگ · شیتزو · نر')
    await expect(profile).toContainText(/۲ سال/) // 26 months old
    await expect(profile.getByText('رویال کنین')).toBeVisible()
    // breed 2 + birth date 2 + weight 1 + sex 1 + food 1 of 10 points
    await expect(page.getByTestId('pet-completeness').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70')
    await expect(page.getByTestId('pet-completeness')).toContainText('امتیاز تکمیل آن به حساب شما رسیده است')
    await expect(profile.getByRole('link', { name: /محصولات مناسب رکس/ })).toBeVisible()

    const row = await prisma.pet.findFirstOrThrow({ where: { customerId: c.id } })
    expect(row).toMatchObject({ name: 'رکس', species: 'DOG', breed: 'شیتزو', sex: 'MALE', foodBrand: 'رویال کنین', weightKg: 7.5 })
  })

  test('A02 the pet form explains what is wrong and saves nothing until it is valid', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a02')
    await signIn(context, baseURL, c)
    await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
    await openAddForm(page)

    await page.getByTestId('pet-save').click() // no name
    await expect(page.getByRole('alert').filter({ hasText: 'نام حیوان خانگی را وارد کنید' })).toBeVisible()

    await fillPet(page, { name: 'میشی', species: 'CAT', weight: '500' })
    await page.getByTestId('pet-save').click()
    await expect(page.getByRole('alert').filter({ hasText: 'وزن باید عددی بین' })).toBeVisible()

    await fillPet(page, { weight: '', chip: '123' })
    await page.getByTestId('pet-save').click()
    await expect(page.getByRole('alert').filter({ hasText: 'شماره میکروچیپ باید ۹ تا ۱۵ رقم باشد' })).toBeVisible()
    expect(await prisma.pet.count({ where: { customerId: c.id } })).toBe(0)

    await fillPet(page, { chip: '' })
    await page.getByTestId('pet-save').click()
    await expect(page).toHaveURL(/\/account\/pets\/[^/]+$/, { timeout: 20_000 })
    await expect(page.getByTestId('pet-profile').getByRole('heading', { name: 'میشی' })).toBeVisible()
    expect(await prisma.pet.count({ where: { customerId: c.id } })).toBe(1)
  })

  test('A03 a cat and a bird join the list, each with its species avatar', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a03')
    await signIn(context, baseURL, c)

    for (const p of [{ name: 'پشمالو', species: 'CAT', breed: 'پرشین' }, { name: 'طوطی', species: 'BIRD', breed: 'کاکتیل' }]) {
      await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
      await openAddForm(page)
      await fillPet(page, p)
      await page.getByTestId('pet-save').click()
      await expect(page).toHaveURL(/\/account\/pets\/[^/]+$/, { timeout: 20_000 })
    }
    // The profile of the bird has no photo: the species avatar stands in.
    await expect(page.getByTestId('pet-profile').getByRole('img', { name: 'پرنده' })).toBeVisible()

    await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
    const cards = page.getByTestId('pets-list').getByTestId('pet-card')
    await expect(cards).toHaveCount(2)
    await expect(cards.filter({ hasText: 'پشمالو' })).toContainText('گربه · پرشین')
    await expect(cards.filter({ hasText: 'پشمالو' }).getByRole('img', { name: 'گربه' })).toBeVisible()
    await expect(cards.filter({ hasText: 'طوطی' })).toContainText('پرنده · کاکتیل')
    await expect(cards.filter({ hasText: 'طوطی' }).getByRole('img', { name: 'پرنده' })).toBeVisible()
  })

  test('A04 editing the profile updates the details and raises the completeness meter', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a04')
    await signIn(context, baseURL, c)
    const pet = await seedPet(c.id, 'لیلی', 'CAT')

    await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    const meter = page.getByTestId('pet-completeness').getByRole('progressbar')
    await expect(meter).toHaveAttribute('aria-valuenow', '0')

    await clickUntilVisible(page.getByRole('button', { name: 'ویرایش پروفایل' }), page.getByTestId('pet-name-input'))
    await fillPet(page, { name: 'لیلا', breed: 'پرشین', sex: 'FEMALE', birth: isoDay(-400), food: 'پروپلن' })
    await page.getByTestId('pet-save').click()

    // breed 2 + birth date 2 + sex 1 + food 1 of 10 points
    await expect(meter).toHaveAttribute('aria-valuenow', '60', { timeout: 20_000 })
    const profile = page.getByTestId('pet-profile')
    await expect(profile.getByRole('heading', { name: 'لیلا' })).toBeVisible()
    await expect(profile).toContainText('گربه · پرشین · ماده')
    await expect(profile.getByText('پروپلن')).toBeVisible()
    const row = await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })
    expect(row).toMatchObject({ name: 'لیلا', breed: 'پرشین', sex: 'FEMALE', foodBrand: 'پروپلن' })
  })

  test('A05 health records show overdue, soon and fine due badges, and bad dates are refused', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a05')
    await signIn(context, baseURL, c)
    const pet = await seedPet(c.id, 'بهار', 'DOG')
    await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('هنوز سابقه‌ای ثبت نشده')).toBeVisible()

    await addRecord(page, { title: 'واکسن هاری', doneAt: isoDay(-100), nextDueAt: isoDay(-10) })
    await expect(page.getByTestId('pet-record-row')).toHaveCount(1, { timeout: 20_000 })
    await addRecord(page, { title: 'واکسن سه‌گانه', doneAt: isoDay(-20), nextDueAt: isoDay(10) })
    await expect(page.getByTestId('pet-record-row')).toHaveCount(2, { timeout: 20_000 })
    await addRecord(page, { kind: 'DEWORMING', title: 'قرص ضدانگل', doneAt: isoDay(-5), nextDueAt: isoDay(200) })
    await expect(page.getByTestId('pet-record-row')).toHaveCount(3, { timeout: 20_000 })

    const rows = page.getByTestId('pet-record-row')
    const overdue = rows.filter({ hasText: 'واکسن هاری' })
    await expect(overdue).toContainText('(گذشته)')
    await expect(overdue.getByText(/موعد بعدی/)).toHaveClass(/text-red-400/)
    const soon = rows.filter({ hasText: 'واکسن سه‌گانه' })
    await expect(soon).toContainText(/\(\S+ روز دیگر\)/)
    await expect(soon.getByText(/موعد بعدی/)).toHaveClass(/text-amber-300/)
    const fine = rows.filter({ hasText: 'قرص ضدانگل' })
    await expect(fine).toContainText('ضدانگل')
    await expect(fine.getByText(/موعد بعدی/)).toHaveClass(/text-emerald-400/)
    await expect(fine).not.toContainText('روز دیگر')
    await expect(fine).not.toContainText('(گذشته)')

    // The pets list highlights the overdue vaccine too.
    await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('pet-card')).toContainText('واکسن هاری: موعد گذشته')

    // Refusals: next due before the date it was done, and a weight record without a weight.
    await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    await addRecord(page, { title: 'معاینه', doneAt: isoDay(-1), nextDueAt: isoDay(-30) })
    await expect(page.getByRole('alert').filter({ hasText: 'موعد بعدی باید بعد از تاریخ انجام باشد' })).toBeVisible()
    await addRecord(page, { kind: 'WEIGHT', title: 'وزن‌کشی', doneAt: isoDay(-1) })
    await expect(page.getByRole('alert').filter({ hasText: 'وزن را وارد کنید' })).toBeVisible()
    expect(await prisma.petRecord.count({ where: { petId: pet.id } })).toBe(3)
  })

  test('A06 weight records draw a trend with the latest change', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a06')
    await signIn(context, baseURL, c)
    const pet = await seedPet(c.id, 'پلنگ', 'CAT')
    await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })

    await addRecord(page, { kind: 'WEIGHT', title: 'وزن‌کشی ماه قبل', doneAt: isoDay(-60), weight: '10' })
    await expect(page.getByTestId('pet-record-row')).toHaveCount(1, { timeout: 20_000 })
    await expect(page.getByRole('img', { name: /روند وزن/ })).toHaveCount(0) // one point is not a trend
    await addRecord(page, { kind: 'WEIGHT', title: 'وزن‌کشی امروز', doneAt: isoDay(-30), weight: '12.5' })
    await expect(page.getByTestId('pet-record-row')).toHaveCount(2, { timeout: 20_000 })

    await expect(page.getByRole('img', { name: 'روند وزن از ۱۰ به ۱۲.۵ کیلوگرم' })).toBeVisible()
    await expect(page.getByText('آخرین تغییر وزن: +۲.۵ کیلوگرم')).toBeVisible()
    await expect(page.getByTestId('pet-record-row').filter({ hasText: '۱۲.۵ کیلوگرم' })).toContainText('ثبت وزن')
  })

  test('A07 deleting a record and then the pet asks for confirmation first', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a07')
    await signIn(context, baseURL, c)
    const pet = await seedPet(c.id, 'سیاه', 'DOG')
    await prisma.petRecord.createMany({
      data: [
        { petId: pet.id, kind: 'VACCINE', title: 'واکسن الف', doneAt: new Date(Date.now() - 30 * DAY), source: 'customer' },
        { petId: pet.id, kind: 'CHECKUP', title: 'معاینه ب', doneAt: new Date(Date.now() - 20 * DAY), source: 'customer' },
      ],
    })
    await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    const rows = page.getByTestId('pet-record-row')
    await expect(rows).toHaveCount(2)
    const target = rows.filter({ hasText: 'واکسن الف' })

    // Cancel keeps it
    await expect(async () => {
      await target.getByRole('button', { name: 'حذف این سابقه' }).click({ timeout: 2000 })
      await expect(page.getByText('حذف این سابقه؟')).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 20_000 })
    await page.getByRole('button', { name: 'انصراف' }).click()
    await expect(rows).toHaveCount(2)
    expect(await prisma.petRecord.count({ where: { petId: pet.id } })).toBe(2)

    // Confirm removes only that one
    await target.getByRole('button', { name: 'حذف این سابقه' }).click()
    await page.getByRole('button', { name: 'حذف', exact: true }).click()
    await expect(rows).toHaveCount(1, { timeout: 20_000 })
    await expect(rows.first()).toContainText('معاینه ب')

    // Delete the pet: dialog names it, then it is gone from the list and its URL
    await page.getByRole('button', { name: 'حذف حیوان خانگی' }).click()
    await expect(page.getByText('حذف سیاه؟')).toBeVisible()
    await page.getByRole('button', { name: 'بله، حذف شود' }).click()
    await expect(page).toHaveURL(/\/account\/pets$/, { timeout: 20_000 })
    await expect(page.getByText('هنوز حیوان خانگی‌ای ثبت نکرده‌اید.')).toBeVisible()
    expect((await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).isActive).toBe(false)
    const res = await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(404)
  })

  test('A08 at 20 pets the add button gives way to a limit message, and long names do not overflow a phone', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a08')
    await signIn(context, baseURL, c)
    const long = 'ا'.repeat(38)
    await prisma.pet.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        customerId: c.id,
        name: i === 0 ? long : `حیوان${'ابپتثجچحخدذرزسشصضطظعغفقکگلمنوهی'[i]}`,
        species: 'DOG' as const,
        breed: i === 0 ? 'ب'.repeat(38) : null,
      })),
    })
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('pet-card')).toHaveCount(20)
    await expect(page.getByText('حداکثر ۲۰ حیوان خانگی قابل ثبت است.')).toBeVisible()
    await expect(page.getByTestId('pet-add')).toHaveCount(0)
    expect(await overflow(page)).toBeLessThanOrEqual(0)

    const first = await prisma.pet.findFirstOrThrow({ where: { customerId: c.id, name: long } })
    await page.goto(`/account/pets/${first.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('pet-profile')).toBeVisible()
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })

  test("A09 another customer's pet is a 404 and a signed-out visitor is sent to sign in", async ({ page, context, baseURL }) => {
    const owner = await makeCustomer('a09o')
    const intruder = await makeCustomer('a09i')
    const pet = await seedPet(owner.id, 'گربه‌ی خصوصی', 'CAT', { medicalNotes: 'یادداشت محرمانه' })

    await signIn(context, baseURL, owner)
    await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('pet-profile')).toContainText('یادداشت محرمانه')

    await signIn(context, baseURL, intruder)
    const res = await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(404)
    await expect(page.getByTestId('pet-profile')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('یادداشت محرمانه')
    await page.goto('/account/pets', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('pet-card')).toHaveCount(0)

    await context.clearCookies()
    await page.goto(`/account/pets/${pet.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/account\/login/)
    await expect(page.locator('body')).not.toContainText('یادداشت محرمانه')
  })

  test('A10 a product that suits my pet shows a «مناسب برای» chip that opens the pet profile; guests see none', async ({ page, context, baseURL }) => {
    const c = await makeCustomer('a10')
    const candidates = await prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, slugFa: true, forSpecies: true, speciesCompatibility: { select: { nameFa: true } } },
      take: 200,
    })
    let slug = ''
    let species: PetSpecies = 'RABBIT'
    let restore: { id: string; forSpecies: PetSpecies[] } | null = null
    const byEnum = candidates.find((p) => p.forSpecies.length > 0)
    const byName = candidates.find((p) => p.forSpecies.length === 0 && p.speciesCompatibility.some((s) => /سگ|گربه/.test(s.nameFa)))
    if (byEnum) {
      slug = byEnum.slugFa
      species = byEnum.forSpecies[0]
    } else if (byName) {
      slug = byName.slugFa
      species = byName.speciesCompatibility.some((s) => s.nameFa.includes('سگ')) ? 'DOG' : 'CAT'
    } else {
      // Nothing in the catalogue says who it is for: label one product for rabbits for the duration of the test.
      const p = candidates[0]
      expect(p, 'the catalogue has products').toBeTruthy()
      slug = p.slugFa
      restore = { id: p.id, forSpecies: p.forSpecies }
      await prisma.product.update({ where: { id: p.id }, data: { forSpecies: ['RABBIT'] } })
    }
    try {
      const other: PetSpecies = species === 'BIRD' ? 'FISH' : 'BIRD' // never matches the product
      await seedPet(c.id, 'لوبیا', species)
      await seedPet(c.id, 'غریبه', other)
      await signIn(context, baseURL, c)
      await page.goto(`/product/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' })
      const chips = page.getByTestId('pet-fit')
      await expect(chips).toBeVisible({ timeout: 20_000 })
      await expect(chips).toContainText('مناسب برای لوبیا')
      await expect(chips).not.toContainText('غریبه')
      await chips.getByRole('link', { name: 'مناسب برای لوبیا' }).click()
      await expect(page).toHaveURL(/\/account\/pets\/[^/]+$/, { timeout: 20_000 })
      await expect(page.getByTestId('pet-profile').getByRole('heading', { name: 'لوبیا' })).toBeVisible()

      await context.clearCookies()
      await page.goto(`/product/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
      await expect(page.getByTestId('pet-fit')).toHaveCount(0)
    } finally {
      if (restore) await prisma.product.update({ where: { id: restore.id }, data: { forSpecies: restore.forSpecies } })
    }
  })
})
