import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

/**
 * Customer accounts end to end, in a real browser against the local database:
 * password sign-up, logout, failed and successful login, changing the password
 * (which must stop the old one working), and the guards around the forms.
 */
const prisma = new PrismaClient()

const PASSWORD = 'Gorbeh-Parvaneh-1405'
const NEW_PASSWORD = 'Sag-Khoshhal-1406'
/** Phones this worker created. Both browser projects run this file at the same time, so
 *  cleanup must only remove its own accounts, never every test account. */
const created = new Set<string>()

function uniquePhone(): string {
  const phone = `0939${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  created.add(phone)
  return phone
}

/** Clicks "خروج" once React owns the button (before that the click would do nothing) and waits for the redirect. */
async function logout(page: Page) {
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'خروج')
    return !!b && Object.keys(b).some((k) => k.startsWith('__reactProps'))
  })
  await page.getByRole('button', { name: 'خروج' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 })
}

async function fillLogin(page: Page, phone: string, password: string) {
  await page.locator('input[name="phone"]').fill(phone)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'ورود', exact: true }).click()
}

test.describe('customer password accounts', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')
  test.afterAll(async () => {
    await prisma.customer.deleteMany({ where: { phone: { in: [...created] } } })
    await prisma.$disconnect()
  })

  test('register, logout, wrong password, login, change password', async ({ page }) => {
    const phone = uniquePhone()
    const visited: string[] = []
    page.on('framenavigated', (f) => f.parentFrame() === null && visited.push(f.url()))

    // 1. Register
    await page.goto('/account/login')
    await expect(page.locator('h1')).toHaveText('ورود به حساب کاربری')
    await page.getByRole('tab', { name: 'ثبت‌نام' }).click()
    await expect(page.locator('h1')).toHaveText('ثبت‌نام در پت‌باس')
    await page.locator('input[name="firstName"]').fill('سارا')
    await page.locator('input[name="lastName"]').fill('رضایی')
    await page.locator('input[name="phone"]').fill(phone)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByText('سارا رضایی').first()).toBeVisible()

    const row = await prisma.customer.findUniqueOrThrow({ where: { phone } })
    expect(row.passwordHash).toMatch(/^scrypt\$/)
    expect(row.phoneVerifiedAt).toBeNull()

    // 2. Logout ends the session
    await logout(page)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/account\/login\?next=%2Faccount/)

    // 3. Wrong password: a clear error, still on the login page, nothing leaked
    await fillLogin(page, phone, 'Wrong-Password-1')
    await expect(page.getByRole('alert').filter({ hasText: 'نادرست' })).toBeVisible()
    await expect(page).toHaveURL(/\/account\/login/)

    // 4. Right password
    await fillLogin(page, phone, PASSWORD)
    await expect(page).toHaveURL(/\/account$/)

    // 5. Change the password from the profile page
    await page.goto('/account/profile')
    await page.locator('input[name="currentPassword"]').fill(PASSWORD)
    await page.locator('input[name="newPassword"]').fill(NEW_PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'تغییر رمز عبور' }).click()
    await expect(page.getByText('رمز عبور تغییر کرد')).toBeVisible()

    // 6. The old password no longer works, the new one does
    await logout(page)
    await page.goto('/account/login')
    await fillLogin(page, phone, PASSWORD)
    await expect(page.getByRole('alert').filter({ hasText: 'نادرست' })).toBeVisible()
    await fillLogin(page, phone, NEW_PASSWORD)
    await expect(page).toHaveURL(/\/account$/)

    // A password must never travel in a URL (history, logs, referrers).
    for (const url of visited) {
      expect(decodeURIComponent(url)).not.toContain(PASSWORD)
      expect(decodeURIComponent(url)).not.toContain(NEW_PASSWORD)
    }
  })

  test('registration refuses weak passwords and existing numbers with clear messages', async ({ page }) => {
    const phone = uniquePhone()
    await prisma.customer.create({ data: { phone, firstName: 'علی', lastName: 'کریمی', phoneVerifiedAt: new Date() } })

    await page.goto('/account/login?mode=register')
    await page.locator('input[name="firstName"]').fill('مریم')
    await page.locator('input[name="lastName"]').fill('احمدی')
    await page.locator('input[name="phone"]').fill(phone)

    await page.locator('input[name="password"]').fill('12345678')
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'عدد' })).toBeVisible()

    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'قبلاً ثبت‌نام' })).toBeVisible()
    await expect(page).toHaveURL(/\/account\/login/)
  })

  test('only ever redirects to a page on this site after login', async ({ page }) => {
    const phone = uniquePhone()
    await page.goto('/account/login?mode=register&next=%2F%2Fevil.example')
    await page.locator('input[name="firstName"]').fill('نیما')
    await page.locator('input[name="lastName"]').fill('صادقی')
    await page.locator('input[name="phone"]').fill(phone)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'ثبت‌نام و ورود' }).click()
    await expect(page).toHaveURL(/\/account$/)
    expect(new URL(page.url()).hostname).not.toContain('evil')
  })

  test('submit buttons are disabled in the server-rendered page, so no secret is sent before hydration', async ({ request }) => {
    const page = await (await request.get('/account/login')).text()
    // Only the login card: the header's search form is a plain GET form that is meant to work early.
    const start = page.indexOf('id="login-panel"')
    expect(start).toBeGreaterThan(-1)
    const card = page.slice(start, page.indexOf('</main>', start))

    // The page is rendered before JavaScript runs: every submit button in the card must be inert then
    // (checked per tag, so the order of attributes does not matter).
    const submitButtons = (card.match(/<button\b[^>]*>/g) ?? []).filter((tag) => /\btype="submit"/.test(tag))
    expect(submitButtons.length).toBeGreaterThan(0)
    for (const tag of submitButtons) expect(tag).toMatch(/\bdisabled\b/)
    // …and the form must never fall back to a GET (which would put the password in the URL).
    const forms = card.match(/<form\b[^>]*>/g) ?? []
    expect(forms.length).toBeGreaterThan(0)
    for (const tag of forms) expect(tag).toMatch(/\bmethod="post"/)
  })

  test('SMS tab appears only when an SMS provider is configured', async ({ page }) => {
    test.skip(!process.env.SMS_PROVIDER, 'no SMS provider in this environment')
    await page.goto('/account/login')
    await expect(page.getByRole('tab', { name: 'ورود با کد پیامکی' })).toBeVisible()
    await page.getByRole('tab', { name: 'ورود با کد پیامکی' }).click()
    await expect(page.getByRole('button', { name: 'دریافت کد ورود' })).toBeVisible()
  })

  test('private pages are not indexable', async ({ request }) => {
    for (const path of ['/account/login', '/cart']) {
      const res = await request.get(path)
      expect(res.headers()['x-robots-tag']).toContain('noindex')
    }
  })
})
