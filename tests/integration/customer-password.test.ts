/**
 * Customer password login against a real PostgreSQL database (skipped without one).
 * Covers registration, login, the brute-force lock under parallel guessing, the SMS
 * "squatter" takeover protection, logout invalidating old tokens, and password change.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Admin side: the test decides who is signed in as staff, and the audit log is not under test.
let adminRole: 'ADMIN' | 'EDITOR' | null = 'ADMIN'
vi.mock('@/lib/auth', () => ({
  getSessionWithRole: vi.fn(async (min: string) =>
    adminRole && (adminRole === 'ADMIN' || min === 'EDITOR') ? { userId: 'u1', email: 'a@b.c', name: 'A', role: adminRole, expiresAt: 0 } : null
  ),
}))
vi.mock('@/lib/audit', () => ({ logAdminChange: vi.fn(async () => {}) }))

// A minimal cookie jar and request headers the server actions can use.
const jar = new Map<string, string>()
let currentIp = '10.0.0.1'
// When on, every request comes from a different address, so the per-network limiter
// cannot mask the database-backed account lock that the test is about.
let rotateIp = false
let rotated = 0
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => {
    const n = rotated++
    return new Headers({ 'x-forwarded-for': rotateIp ? `10.200.${Math.floor(n / 250)}.${(n % 250) + 1}` : currentIp })
  },
}))

const hasDb = !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
const d = hasDb ? describe : describe.skip

const PASSWORD = 'Gorbeh-Parvaneh-1405'
let seq = 0
const newPhone = () => `0938${String(Date.now()).slice(-5)}${String(++seq).padStart(2, '0')}`
const newIp = () => `10.9.${Math.floor(seq / 250)}.${(seq % 250) + 1}`

function form(values: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

d('customer password login (real database)', () => {
  let db: typeof import('@/lib/db').db
  let actions: typeof import('@/app/actions/customer-auth')
  let session: typeof import('@/lib/customer/session')
  let otp: typeof import('@/lib/customer/otp')

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    actions = await import('@/app/actions/customer-auth')
    session = await import('@/lib/customer/session')
    otp = await import('@/lib/customer/otp')
  })

  afterEach(() => {
    jar.clear()
    currentIp = newIp()
  })

  afterAll(async () => {
    await db.otpCode.deleteMany({ where: { phone: { startsWith: '0938' } } })
    await db.customer.deleteMany({ where: { phone: { startsWith: '0938' } } })
    await db.$disconnect()
  })

  const register = (phone: string, extra: Record<string, string> = {}) =>
    actions.registerWithPasswordAction(
      form({ firstName: 'سارا', lastName: 'رضایی', phone, password: PASSWORD, next: '/checkout', ...extra })
    )

  it('registers a customer, signs them in and honours ?next', async () => {
    currentIp = newIp()
    const phone = newPhone()
    const res = await register(phone)
    expect(res).toMatchObject({ ok: true, redirectTo: '/checkout' })

    const row = await db.customer.findUniqueOrThrow({ where: { phone } })
    expect(row.passwordHash).toMatch(/^scrypt\$/)
    expect(row.passwordHash).not.toContain(PASSWORD)
    expect(row.phoneVerifiedAt).toBeNull() // nobody proved they own the number yet
    expect((await session.getCustomer())?.id).toBe(row.id)
  })

  it('normalises Persian digits in the phone number', async () => {
    currentIp = newIp()
    const phone = newPhone()
    const persian = phone.replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)])
    expect((await register(persian)).ok).toBe(true)
    expect(await db.customer.findUnique({ where: { phone } })).not.toBeNull()
  })

  it('rejects bad input without creating anything', async () => {
    currentIp = newIp()
    const phone = newPhone()
    expect((await register('0212345678')).error).toMatch(/شماره موبایل/)
    expect((await register(phone, { password: '12345678' })).error).toMatch(/عدد/)
    expect((await register(phone, { password: 'short' })).error).toMatch(/حداقل/)
    expect((await register(phone, { firstName: '1', lastName: '2' })).error).toMatch(/نام/)
    expect(await db.customer.findUnique({ where: { phone } })).toBeNull()
  })

  it('refuses a second sign-up for the same number', async () => {
    currentIp = newIp()
    const phone = newPhone()
    expect((await register(phone)).ok).toBe(true)
    jar.clear()
    const again = await register(phone, { password: 'Another-Passw0rd' })
    expect(again.error).toMatch(/قبلاً ثبت‌نام/)
    // The original password still works; the second attempt changed nothing.
    expect((await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))).ok).toBe(true)
  })

  it('signs in with the right password and gives one generic error for everything else', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    jar.clear()

    expect((await actions.loginWithPasswordAction(form({ phone, password: PASSWORD, next: '/account/orders' }))).redirectTo).toBe('/account/orders')
    jar.clear()

    const wrong = await actions.loginWithPasswordAction(form({ phone, password: 'Wrong-Password-1' }))
    const unknown = await actions.loginWithPasswordAction(form({ phone: newPhone(), password: PASSWORD }))
    const smsOnly = await db.customer.create({ data: { phone: newPhone(), phoneVerifiedAt: new Date() } })
    const noPassword = await actions.loginWithPasswordAction(form({ phone: smsOnly.phone, password: PASSWORD }))
    // No way to tell a wrong password from an unknown number or an SMS-only account.
    expect(wrong.error).toBeTruthy()
    expect(unknown.error).toBe(wrong.error)
    expect(noPassword.error).toBe(wrong.error)
    expect(jar.size).toBe(0)
  })

  it('never follows an off-site ?next after login', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    jar.clear()
    for (const next of ['//evil.com', 'https://evil.com', '/\t/evil.com', '/account/login?next=/x']) {
      const res = await actions.loginWithPasswordAction(form({ phone, password: PASSWORD, next }))
      expect(res.redirectTo).toBe('/account')
      jar.clear()
    }
  })

  it('locks after 5 wrong passwords even when the guesses arrive in parallel', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    jar.clear()

    rotateIp = true
    try {
      await Promise.all(
        Array.from({ length: 40 }, () => actions.loginWithPasswordAction(form({ phone, password: 'Wrong-Guess-123' })))
      )
    } finally {
      rotateIp = false
    }
    const row = await db.customer.findUniqueOrThrow({ where: { phone } })
    expect(row.failedLogins).toBe(5) // never more than five tries were allowed

    // Locked: even the correct password is refused for now.
    const locked = await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))
    expect(locked.ok).toBeUndefined()
    expect(locked.error).toMatch(/مسدود/)
    expect(jar.size).toBe(0)

    // After the 15-minute window the correct password works again.
    await db.customer.update({ where: { phone }, data: { lastFailedAt: new Date(Date.now() - 16 * 60_000) } })
    expect((await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))).ok).toBe(true)
    expect((await db.customer.findUniqueOrThrow({ where: { phone } })).failedLogins).toBe(0)
  })

  it('a successful login resets the failure counter', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    jar.clear()
    for (let i = 0; i < 3; i++) await actions.loginWithPasswordAction(form({ phone, password: 'Nope-Nope-123' }))
    expect((await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))).ok).toBe(true)
    expect((await db.customer.findUniqueOrThrow({ where: { phone } })).failedLogins).toBe(0)
  })

  it('SMS login by the real owner removes a password set by someone who registered the number first', async () => {
    currentIp = newIp()
    const phone = newPhone()
    // The squatter registers the victim's number with their own password…
    await register(phone)
    const squatterToken = jar.get('pb_customer')!
    jar.set('pb_customer', squatterToken)
    expect(await session.getCustomer()).not.toBeNull()

    // …then the real owner proves ownership with an SMS code.
    jar.clear()
    const issued = await otp.issueOtp(phone, null)
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const res = await actions.verifyOtpAction(phone, issued.code, '/account')
    expect(res.ok).toBe(true)

    const row = await db.customer.findUniqueOrThrow({ where: { phone } })
    expect(row.passwordHash).toBeNull() // the squatter's password is gone
    expect(row.phoneVerifiedAt).not.toBeNull()
    expect(row.sessionVersion).toBeGreaterThan(0)

    // The squatter's old session no longer works, the owner's does.
    const ownerToken = jar.get('pb_customer')!
    jar.set('pb_customer', squatterToken)
    expect(await session.getCustomer()).toBeNull()
    jar.set('pb_customer', ownerToken)
    expect((await session.getCustomer())?.id).toBe(row.id)
    // And the squatter cannot log in with the old password.
    jar.clear()
    expect((await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))).ok).toBeUndefined()
  })

  it('keeps the password of an account whose number was already verified by SMS', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    await db.customer.update({ where: { phone }, data: { phoneVerifiedAt: new Date() } })
    jar.clear()
    const issued = await otp.issueOtp(phone, null)
    if (!issued.ok) throw new Error('otp')
    await actions.verifyOtpAction(phone, issued.code)
    expect((await db.customer.findUniqueOrThrow({ where: { phone } })).passwordHash).not.toBeNull()
  })

  it('logout ends every session issued before it', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    const token = jar.get('pb_customer')!
    expect(await session.getCustomer()).not.toBeNull()

    await actions.customerLogoutAction()
    expect(jar.has('pb_customer')).toBe(false)
    // Someone who copied the cookie earlier gets nothing.
    jar.set('pb_customer', token)
    expect(await session.getCustomer()).toBeNull()
  })

  it('changes the password: needs the current one, signs out other devices, keeps this one', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    const otherDevice = jar.get('pb_customer')!

    const wrongCurrent = await actions.changePasswordAction(
      form({ currentPassword: 'Not-My-Password-1', newPassword: 'Brand-New-Passw0rd', confirmPassword: 'Brand-New-Passw0rd' })
    )
    expect(wrongCurrent.error).toMatch(/فعلی/)
    const mismatch = await actions.changePasswordAction(
      form({ currentPassword: PASSWORD, newPassword: 'Brand-New-Passw0rd', confirmPassword: 'Different-Passw0rd' })
    )
    expect(mismatch.error).toMatch(/یکسان/)
    const weak = await actions.changePasswordAction(form({ currentPassword: PASSWORD, newPassword: '12345678', confirmPassword: '12345678' }))
    expect(weak.error).toMatch(/عدد/)

    const ok = await actions.changePasswordAction(
      form({ currentPassword: PASSWORD, newPassword: 'Brand-New-Passw0rd', confirmPassword: 'Brand-New-Passw0rd' })
    )
    expect(ok.ok).toBe(true)
    expect(await session.getCustomer()).not.toBeNull() // this device continues

    const thisDevice = jar.get('pb_customer')!
    jar.set('pb_customer', otherDevice)
    expect(await session.getCustomer()).toBeNull() // the other device is signed out
    jar.set('pb_customer', thisDevice)

    jar.clear()
    expect((await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))).ok).toBeUndefined()
    expect((await actions.loginWithPasswordAction(form({ phone, password: 'Brand-New-Passw0rd' }))).ok).toBe(true)
  })

  it('lets an SMS-only customer set a first password without a current one', async () => {
    currentIp = newIp()
    const phone = newPhone()
    const c = await db.customer.create({ data: { phone, firstName: 'علی', lastName: 'کریمی', phoneVerifiedAt: new Date() } })
    jar.set('pb_customer', session.signCustomerToken(c.id, Date.now(), c.sessionVersion))
    const res = await actions.changePasswordAction(form({ newPassword: 'First-Passw0rd-1', confirmPassword: 'First-Passw0rd-1' }))
    expect(res.ok).toBe(true)
    jar.clear()
    expect((await actions.loginWithPasswordAction(form({ phone, password: 'First-Passw0rd-1' }))).ok).toBe(true)
  })

  it('refuses password changes without a session', async () => {
    const res = await actions.changePasswordAction(form({ newPassword: 'Whatever-Passw0rd', confirmPassword: 'Whatever-Passw0rd' }))
    expect(res.needsLogin).toBe(true)
  })

  it('an admin can issue a one-time temporary password for a customer who forgot theirs', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    const oldSession = jar.get('pb_customer')!
    const id = (await db.customer.findUniqueOrThrow({ where: { phone } })).id
    const admin = await import('@/app/actions/admin-orders')

    // Only full admins may do it.
    adminRole = 'EDITOR'
    expect((await admin.resetCustomerPasswordAction(id)).error).toBeTruthy()
    adminRole = null
    expect((await admin.resetCustomerPasswordAction(id)).error).toBeTruthy()
    adminRole = 'ADMIN'
    expect((await admin.resetCustomerPasswordAction('does-not-exist')).error).toMatch(/پیدا نشد/)

    const res = await admin.resetCustomerPasswordAction(id)
    expect(res.ok).toBe(true)
    const temp = res.password!
    expect(temp).toMatch(/^[A-Za-z0-9]{10}$/)
    expect(temp).not.toMatch(/[0OlI1]/) // easy to read out over the phone

    // The customer's earlier sessions ended; the old password is gone; the temporary one works.
    jar.set('pb_customer', oldSession)
    expect(await session.getCustomer()).toBeNull()
    jar.clear()
    expect((await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))).ok).toBeUndefined()
    expect((await actions.loginWithPasswordAction(form({ phone, password: temp }))).ok).toBe(true)

    // The password is only ever stored hashed.
    const row = await db.customer.findUniqueOrThrow({ where: { phone } })
    expect(row.passwordHash).not.toContain(temp)
  })

  it('an admin reset also clears a lock so the customer can get back in', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    const id = (await db.customer.findUniqueOrThrow({ where: { phone } })).id
    await db.customer.update({ where: { id }, data: { failedLogins: 5, lastFailedAt: new Date() } })
    const admin = await import('@/app/actions/admin-orders')
    adminRole = 'ADMIN'
    const { password } = await admin.resetCustomerPasswordAction(id)
    jar.clear()
    expect((await actions.loginWithPasswordAction(form({ phone, password: password! }))).ok).toBe(true)
  })

  it('does not sign in a blocked customer', async () => {
    currentIp = newIp()
    const phone = newPhone()
    await register(phone)
    await db.customer.update({ where: { phone }, data: { isBlocked: true } })
    jar.clear()
    const res = await actions.loginWithPasswordAction(form({ phone, password: PASSWORD }))
    expect(res.error).toMatch(/غیرفعال/)
    expect(jar.size).toBe(0)
  })
})
