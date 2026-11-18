'use server'

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { issueOtp, verifyOtp } from '@/lib/customer/otp'
import { burnPasswordCheck, hashPassword, PASSWORD_MAX, validatePassword, verifyPassword } from '@/lib/customer/password'
import { clearCustomerCookie, getCustomer, safeNext, setCustomerCookie } from '@/lib/customer/session'
import { customerLoginEnabled, sendOtpSms } from '@/lib/sms'
import { normalizeEmail } from '@/lib/customer/email'
import { normalizeMobile } from '@/lib/text/iran'
import { normalizeFa } from '@/lib/text/persian'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { toLatinDigits } from '@/lib/date/jalali'
import { captureContactSafe } from '@/lib/marketing/contacts'
import { onCustomerCreated } from '@/lib/club/hooks'
import { REFERRAL_COOKIE } from '@/lib/club/referrals'
import { dateField } from '@/lib/club/input'

export interface CustomerAuthState {
  error?: string
  ok?: boolean
  /** Where to go after a successful step */
  redirectTo?: string
  /** True when the customer must still enter their name */
  needsProfile?: boolean
  /** Seconds until a new code may be requested (a code was sent recently and may still be valid). */
  retryAfter?: number
  /** The session is gone: the form should offer to sign in again. */
  needsLogin?: boolean
}

const BLOCKED_MESSAGE = 'این حساب غیرفعال شده است. برای پیگیری با پشتیبانی کلینیک تماس بگیرید.'

/** Letters (Persian, Arabic, Latin), spaces, ZWNJ, dot, apostrophe and hyphen; at least two real letters. */
function isPersonName(value: string): boolean {
  if (!/^[\p{L}\p{M}\s‌.'-]+$/u.test(value)) return false
  return (value.match(/\p{L}/gu) ?? []).length >= 2
}

/** Post-login target that can never point back at the login page (redirect loop). */
function afterLogin(next: string | null | undefined): string {
  const target = safeNext(next)
  return target.startsWith('/account/login') ? '/account' : target
}

/** Invite code remembered by the /r/<code> landing page (validated later, server-side). */
async function referralCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(REFERRAL_COOKIE)?.value ?? null
  } catch {
    return null
  }
}

async function clientIp(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'unknown').trim()
}

export async function requestOtpAction(rawPhone: string): Promise<CustomerAuthState> {
  if (!customerLoginEnabled()) {
    return { error: 'ورود با کد پیامکی به‌زودی فعال می‌شود. فعلاً با شماره موبایل و رمز عبور وارد شوید یا ثبت‌نام کنید.' }
  }
  const phone = normalizeMobile(rawPhone)
  if (!phone) return { error: 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷' }

  const ip = await clientIp()
  if (!checkRateLimit(`otp-ip:${ip}`, 15, 3600_000).allowed) {
    return { error: 'درخواست‌های زیادی از این شبکه ارسال شده است. کمی بعد تلاش کنید.' }
  }

  const existing = await db.customer.findUnique({ where: { phone }, select: { isBlocked: true } })
  if (existing?.isBlocked) return { error: BLOCKED_MESSAGE }

  const issued = await issueOtp(phone, ip)
  if (!issued.ok) return { error: issued.error, retryAfter: issued.retryAfter }

  const sent = await sendOtpSms(phone, issued.code)
  if (!sent.ok) {
    console.error('OTP SMS failed:', sent.error)
    // The customer never received this code: drop it so the failed send does not
    // count toward the resend cooldown or the hourly cap.
    try {
      const row = await db.otpCode.findFirst({
        where: { phone, consumedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (row) await db.otpCode.delete({ where: { id: row.id } })
    } catch (err) {
      console.error('OTP cleanup failed:', err)
    }
    return { error: 'ارسال پیامک با خطا مواجه شد. لطفاً دوباره تلاش کنید یا با کلینیک تماس بگیرید.' }
  }
  return { ok: true }
}

export async function verifyOtpAction(rawPhone: string, rawCode: string, next?: string): Promise<CustomerAuthState> {
  const phone = normalizeMobile(rawPhone)
  const code = toLatinDigits(rawCode ?? '').replace(/\D/g, '')
  if (!phone || code.length !== 5) return { error: 'کد ۵ رقمی ارسال‌شده را وارد کنید.' }

  const ip = await clientIp()
  if (!checkRateLimit(`otp-verify:${ip}`, 30, 3600_000).allowed) {
    return { error: 'تلاش‌های زیادی از این شبکه انجام شده است. کمی بعد دوباره امتحان کنید.' }
  }

  // Checked before the code is consumed, so a blocked phone never burns a code or creates a row.
  const existing = await db.customer.findUnique({ where: { phone }, select: { isBlocked: true } })
  if (existing?.isBlocked) return { error: BLOCKED_MESSAGE }

  if (!(await verifyOtp(phone, code))) {
    return { error: 'کد واردشده نادرست یا منقضی شده است. در صورت نیاز کد جدید بگیرید.' }
  }

  // The SMS code proves the customer owns this number.
  const now = new Date()
  const prior = await db.customer.findUnique({ where: { phone }, select: { phoneVerifiedAt: true, passwordHash: true, createdByAdmin: true, lastLoginAt: true } })
  // A password on a number nobody verified was set by whoever registered it first, not
  // necessarily by the owner: drop it, and end any session that was started with it.
  const takeOver = !!prior && !prior.phoneVerifiedAt && !!prior.passwordHash
  const customer = await db.customer.upsert({
    where: { phone },
    update: {
      lastLoginAt: now,
      phoneVerifiedAt: prior?.phoneVerifiedAt ?? now,
      failedLogins: 0,
      lastFailedAt: null,
      ...(takeOver ? { passwordHash: null, email: null, sessionVersion: { increment: 1 } } : {}),
    },
    create: { phone, lastLoginAt: now, phoneVerifiedAt: now },
  })
  if (customer.isBlocked) return { error: BLOCKED_MESSAGE }

  // First SMS sign-in of a new number: give them their welcome coupon (never blocks login).
  if (!prior) {
    await captureContactSafe({ phone, source: 'signup', customerId: customer.id })
    await onCustomerCreated(customer.id, { referralCode: await referralCookie() })
  } else if (prior.createdByAdmin && !prior.lastLoginAt) {
    // A profile the clinic created: first sign-in by its owner earns the signup gift (once).
    await onCustomerCreated(customer.id, { referralCode: null })
  }

  await setCustomerCookie(customer.id, customer.sessionVersion)
  return { ok: true, needsProfile: !customer.firstName, redirectTo: afterLogin(next) }
}

// ─── Password accounts ───────────────────────────────────────────────────────

const MAX_FAILED_LOGINS = 5
const LOCK_MS = 15 * 60 * 1000
const BAD_CREDENTIALS = 'شماره موبایل (یا ایمیل) یا رمز عبور نادرست است. اگر هنوز رمز عبور ندارید، ثبت‌نام کنید یا با کد پیامکی وارد شوید.'
const LOCKED_MESSAGE = 'به‌دلیل چند تلاش ناموفق، ورود با رمز عبور تا ۱۵ دقیقه دیگر مسدود است. می‌توانید با کد پیامکی وارد شوید یا بعداً دوباره امتحان کنید.'
const EMAIL_TAKEN = 'این ایمیل برای حساب دیگری ثبت شده است. ایمیل دیگری وارد کنید یا آن را خالی بگذارید (ایمیل اختیاری است).'
const ADMIN_CREATED = 'پروفایل شما قبلاً در کلینیک ساخته شده است. با کد پیامکی وارد شوید تا به حساب و امتیازهای خود برسید.'
const ALREADY_REGISTERED = 'این شماره یا ایمیل قبلاً ثبت‌نام کرده است. وارد شوید؛ اگر رمز عبور را فراموش کرده‌اید با کد پیامکی وارد شوید.'

/** Phones registered with a password but never verified by SMS, per hour, before registration pauses. */
const UNVERIFIED_SIGNUPS_PER_HOUR = 40

type PasswordCheck = 'ok' | 'bad' | 'locked'

/**
 * Checks a password against a customer's hash with a brute-force lock. An attempt is
 * reserved with one conditional update *before* the (slow) comparison, so firing many
 * guesses at once still allows only MAX_FAILED_LOGINS tries per lock window.
 */
async function checkPasswordWithLock(customerId: string, hash: string, password: string): Promise<PasswordCheck> {
  const now = new Date()
  // Lock window over: start counting again.
  await db.customer.updateMany({
    where: { id: customerId, failedLogins: { gte: MAX_FAILED_LOGINS }, lastFailedAt: { lt: new Date(now.getTime() - LOCK_MS) } },
    data: { failedLogins: 0 },
  })
  const reserved = await db.customer.updateMany({
    where: { id: customerId, failedLogins: { lt: MAX_FAILED_LOGINS } },
    data: { failedLogins: { increment: 1 }, lastFailedAt: now },
  })
  if (reserved.count === 0) return 'locked'
  return (await verifyPassword(password, hash)) ? 'ok' : 'bad'
}

export async function loginWithPasswordAction(formData: FormData): Promise<CustomerAuthState> {
  // One field: a mobile number or an email address.
  const identifier = (formData.get('identifier') ?? formData.get('phone'))?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const byEmail = identifier.includes('@')
  const email = byEmail ? normalizeEmail(identifier) : null
  const phone = byEmail ? null : normalizeMobile(identifier)
  if (!email && !phone) return { error: byEmail ? 'ایمیل معتبر نیست.' : 'شماره موبایل یا ایمیل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷' }
  if (!password || password.length > PASSWORD_MAX * 2) return { error: 'رمز عبور را وارد کنید.' }

  const ip = await clientIp()
  // Generous on purpose: many customers on a mobile carrier share one public address. The
  // real brute-force protection is the per-account lock; this only stops a single source flooding us.
  if (!checkRateLimit(`pw-login:${ip}`, 300, 3600_000).allowed) {
    return { error: 'تلاش‌های زیادی از این شبکه انجام شده است. کمی بعد دوباره امتحان کنید.' }
  }

  const customer = email ? await db.customer.findUnique({ where: { email } }) : await db.customer.findUnique({ where: { phone: phone! } })
  if (!customer?.passwordHash) {
    // Same time and same message as a wrong password: no way to tell which numbers have accounts.
    await burnPasswordCheck(password)
    return { error: BAD_CREDENTIALS }
  }
  if (customer.isBlocked) return { error: BLOCKED_MESSAGE }

  const check = await checkPasswordWithLock(customer.id, customer.passwordHash, password)
  if (check === 'locked') return { error: LOCKED_MESSAGE }
  if (check === 'bad') return { error: BAD_CREDENTIALS }

  const signedIn = await db.customer.update({
    where: { id: customer.id },
    data: { failedLogins: 0, lastFailedAt: null, lastLoginAt: new Date() },
  })
  await setCustomerCookie(signedIn.id, signedIn.sessionVersion)
  return { ok: true, needsProfile: !signedIn.firstName, redirectTo: afterLogin(formData.get('next')?.toString()) }
}

export async function registerWithPasswordAction(formData: FormData): Promise<CustomerAuthState> {
  const firstName = normalizeFa(formData.get('firstName')?.toString() ?? '').slice(0, 60)
  const lastName = normalizeFa(formData.get('lastName')?.toString() ?? '').slice(0, 60)
  const phone = normalizeMobile(formData.get('phone')?.toString() ?? '')
  const rawEmail = formData.get('email')?.toString() ?? ''
  const email = rawEmail.trim() ? normalizeEmail(rawEmail) : null
  const password = formData.get('password')?.toString() ?? ''

  if (firstName.length < 2 || lastName.length < 2 || !isPersonName(firstName) || !isPersonName(lastName)) {
    return { error: 'نام و نام خانوادگی را با حروف و کامل وارد کنید.' }
  }
  if (!phone) return { error: 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷' }
  if (rawEmail.trim() && !email) return { error: 'ایمیل معتبر نیست.' }
  const passwordProblem = validatePassword(password, phone)
  if (passwordProblem) return { error: passwordProblem }

  const ip = await clientIp()
  // Per-address cap is loose (shared carrier addresses); the database circuit breaker below is the real guard.
  if (!checkRateLimit(`register:${ip}`, 40, 3600_000).allowed) {
    return { error: 'ثبت‌نام‌های زیادی از این شبکه انجام شده است. کمی بعد دوباره امتحان کنید.' }
  }
  // Circuit breaker against scripted sign-ups (the limit above is per server instance).
  const recentUnverified = await db.customer.count({
    where: { phoneVerifiedAt: null, createdByAdmin: false, createdAt: { gt: new Date(Date.now() - 3600_000) } },
  })
  if (recentUnverified >= UNVERIFIED_SIGNUPS_PER_HOUR) {
    return { error: 'ثبت‌نام موقتاً با ترافیک بالا روبه‌رو است. کمی بعد دوباره تلاش کنید یا با کد پیامکی وارد شوید.' }
  }

  const clash = await db.customer.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] }, select: { phone: true, createdByAdmin: true, passwordHash: true } })
  if (clash) {
    if (clash.phone === phone && clash.createdByAdmin && !clash.passwordHash) return { error: ADMIN_CREATED }
    return { error: clash.phone === phone ? ALREADY_REGISTERED : EMAIL_TAKEN }
  }

  try {
    const created = await db.customer.create({
      data: {
        phone, email, firstName, lastName, passwordHash: await hashPassword(password), lastLoginAt: new Date(),
        // Only an explicit, unticked-by-default checkbox counts as consent.
        ...(formData.get('marketingSmsConsent')?.toString() === 'on' ? { marketingSmsConsent: true, marketingConsentAt: new Date() } : {}),
      },
    })
    // Attach the welcome coupon; a failure here must never break sign-up.
    await captureContactSafe({ phone, email, name: `${firstName} ${lastName}`, source: 'signup', customerId: created.id })
    // Signup points, invite code and (if they came through an invite link) the referral; never blocks sign-up.
    await onCustomerCreated(created.id, { referralCode: await referralCookie() })
    await setCustomerCookie(created.id, created.sessionVersion)
    return { ok: true, redirectTo: afterLogin(formData.get('next')?.toString()) }
  } catch (err) {
    // Another sign-up for the same number won the race.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String((err.meta as { target?: unknown } | undefined)?.target ?? '')
      return { error: target.includes('email') ? EMAIL_TAKEN : ALREADY_REGISTERED }
    }
    throw err
  }
}

/** Sets or changes the signed-in customer's password. Ends every other session. */
export async function changePasswordAction(formData: FormData): Promise<CustomerAuthState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'نشست شما به پایان رسیده است. دوباره وارد شوید.', needsLogin: true }

  const currentPassword = formData.get('currentPassword')?.toString() ?? ''
  const newPassword = formData.get('newPassword')?.toString() ?? ''
  const confirm = formData.get('confirmPassword')?.toString() ?? ''

  if (customer.passwordHash) {
    if (!currentPassword) return { error: 'رمز عبور فعلی را وارد کنید.' }
    const check = await checkPasswordWithLock(customer.id, customer.passwordHash, currentPassword)
    if (check === 'locked') return { error: LOCKED_MESSAGE }
    if (check === 'bad') return { error: 'رمز عبور فعلی نادرست است.' }
  }
  const problem = validatePassword(newPassword, customer.phone)
  if (problem) return { error: problem }
  if (newPassword !== confirm) return { error: 'تکرار رمز عبور با رمز جدید یکسان نیست.' }

  const updated = await db.customer.update({
    where: { id: customer.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      failedLogins: 0,
      lastFailedAt: null,
      // Every other device is signed out; this one continues with a fresh token.
      sessionVersion: { increment: 1 },
    },
  })
  await setCustomerCookie(updated.id, updated.sessionVersion)
  revalidatePath('/account', 'layout')
  return { ok: true }
}

export async function updateProfileAction(formData: FormData): Promise<CustomerAuthState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'نشست شما به پایان رسیده است. دوباره وارد شوید.', needsLogin: true }

  const firstName = normalizeFa(formData.get('firstName')?.toString() ?? '').slice(0, 60)
  const lastName = normalizeFa(formData.get('lastName')?.toString() ?? '').slice(0, 60)
  const rawEmail = formData.get('email')?.toString() ?? ''
  const email = rawEmail.trim() ? normalizeEmail(rawEmail) : null
  if (firstName.length < 2 || lastName.length < 2) return { error: 'نام و نام خانوادگی را کامل وارد کنید.' }
  if (!isPersonName(firstName) || !isPersonName(lastName)) return { error: 'نام و نام خانوادگی را با حروف وارد کنید.' }
  if (rawEmail.trim() && !email) return { error: 'ایمیل معتبر نیست.' }

  // Club fields are optional: only fields present in the form are touched.
  const extra: Prisma.CustomerUpdateInput = {}
  if (formData.has('birthDate')) {
    const parsed = dateField({ maxYearsAgo: 110 }).safeParse(formData.get('birthDate')?.toString() ?? '')
    if (!parsed.success) return { error: 'تاریخ تولد معتبر نیست. نمونه: ۱۳۷۵/۰۵/۱۵' }
    extra.birthDate = parsed.data
  }
  if (formData.has('city')) extra.city = normalizeFa(formData.get('city')?.toString() ?? '').slice(0, 40) || null
  if (formData.has('gender')) {
    const g = formData.get('gender')?.toString() ?? ''
    extra.gender = g === 'MALE' || g === 'FEMALE' || g === 'OTHER' ? g : null
  }
  const consentRaw = formData.get('marketingSmsConsent')?.toString()
  if ((consentRaw === 'true' || consentRaw === 'false') && (consentRaw === 'true') !== customer.marketingSmsConsent) {
    extra.marketingSmsConsent = consentRaw === 'true'
    extra.marketingConsentAt = new Date()
  }
  try {
    await db.customer.update({ where: { id: customer.id }, data: { firstName, lastName, email, ...extra } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { error: EMAIL_TAKEN }
    throw err
  }
  // The name is shown in the account sidebar on every account page.
  revalidatePath('/account', 'layout')
  return { ok: true, redirectTo: afterLogin(formData.get('next')?.toString()) }
}

/** Sends a confirmation code to the signed-in customer's own number. */
export async function requestPhoneConfirmationAction(): Promise<CustomerAuthState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'نشست شما به پایان رسیده است. دوباره وارد شوید.', needsLogin: true }
  if (customer.phoneVerifiedAt) return { ok: true }
  return requestOtpAction(customer.phone)
}

/** Confirms the signed-in customer's number with the code that was sent to it. */
export async function confirmPhoneAction(rawCode: string): Promise<CustomerAuthState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'نشست شما به پایان رسیده است. دوباره وارد شوید.', needsLogin: true }
  if (customer.phoneVerifiedAt) return { ok: true }
  const code = toLatinDigits(rawCode ?? '').replace(/\D/g, '')
  if (code.length !== 5) return { error: 'کد ۵ رقمی ارسال‌شده را وارد کنید.' }
  const ip = await clientIp()
  if (!checkRateLimit(`otp-verify:${ip}`, 30, 3600_000).allowed) {
    return { error: 'تلاش‌های زیادی از این شبکه انجام شده است. کمی بعد دوباره امتحان کنید.' }
  }
  if (!(await verifyOtp(customer.phone, code))) {
    return { error: 'کد واردشده نادرست یا منقضی شده است. در صورت نیاز کد جدید بگیرید.' }
  }
  await db.customer.update({ where: { id: customer.id }, data: { phoneVerifiedAt: new Date() } })
  revalidatePath('/account', 'layout')
  return { ok: true }
}

export async function customerLogoutAction(): Promise<CustomerAuthState> {
  const customer = await getCustomer()
  // Bumping the version makes any copy of this session token useless, not just this browser's cookie.
  if (customer) await db.customer.update({ where: { id: customer.id }, data: { sessionVersion: { increment: 1 } } })
  await clearCustomerCookie()
  return { ok: true, redirectTo: '/' }
}
