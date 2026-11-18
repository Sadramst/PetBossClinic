import 'server-only'
import { Prisma, type Coupon, type MarketingContact } from '@prisma/client'
import { db } from '@/lib/db'
import { canonicalEmail } from '@/lib/customer/email'
import { normalizeMobile } from '@/lib/text/iran'
import { normalizeFa } from '@/lib/text/persian'
import { createCouponWithUniqueCode } from '@/lib/marketing/coupons'
import { describeOffer } from '@/lib/marketing/coupon-rules'
import { getMarketingConfig } from '@/lib/marketing/config'

export interface CaptureInput {
  email?: string | null
  phone?: string | null
  name?: string | null
  /** popup | footer | signup | checkout | admin */
  source: string
  customerId?: string | null
}

export type CaptureResult =
  | { ok: true; code: string; alreadyHad: boolean; message: string; contactId: string; couponId: string | null }
  | { ok: false; error: string }

export const CAPTURE_ERRORS = {
  none: 'شماره موبایل یا ایمیل خود را وارد کنید.',
  phone: 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷',
  email: 'ایمیل معتبر نیست.',
} as const

/** Sources the public forms may claim; anything else is stored as "popup". */
const SOURCES = new Set(['popup', 'footer', 'signup', 'checkout', 'admin'])

class AlreadyClaimed extends Error {}

function welcomeCouponData(config: Awaited<ReturnType<typeof getMarketingConfig>>, customerId: string | null, now: Date): Omit<Prisma.CouponUncheckedCreateInput, 'code'> {
  const offer = { type: config.welcomeType, value: config.welcomeValue, maxDiscount: config.welcomeMaxDiscount }
  return {
    title: `هدیه خوش‌آمدگویی: ${describeOffer(offer)}`,
    description: 'کد شخصی و یک‌بارمصرف برای اولین خرید',
    type: config.welcomeType,
    value: config.welcomeValue,
    maxDiscount: config.welcomeType === 'PERCENT' ? config.welcomeMaxDiscount : null,
    minSubtotal: config.welcomeMinSubtotal,
    startsAt: null,
    endsAt: new Date(now.getTime() + config.welcomeValidDays * 86_400_000),
    isActive: true,
    autoApply: false,
    usageLimit: 1,
    perCustomerLimit: 1,
    firstOrderOnly: true,
    customerId,
    source: 'welcome',
  }
}

/**
 * Stores a lead (mobile and/or email) and gives them their personal welcome coupon.
 * Never duplicates a contact; the same person always gets the SAME code back.
 */
export async function captureContact(input: CaptureInput, now = new Date()): Promise<CaptureResult> {
  const rawPhone = (input.phone ?? '').trim()
  const rawEmail = (input.email ?? '').trim()
  if (!rawPhone && !rawEmail) return { ok: false, error: CAPTURE_ERRORS.none }
  const phone = rawPhone ? normalizeMobile(rawPhone) : null
  const email = rawEmail ? canonicalEmail(rawEmail) : null
  if (rawPhone && !phone) return { ok: false, error: CAPTURE_ERRORS.phone }
  if (rawEmail && !email) return { ok: false, error: CAPTURE_ERRORS.email }
  const source = SOURCES.has(input.source) ? input.source : 'popup'
  const name = input.name ? normalizeFa(input.name).slice(0, 80) || null : null

  // Link to an existing customer account (by id, else by the same phone/email).
  let customerId = input.customerId ?? null
  if (!customerId) {
    // Only the phone identifies a customer here: an email is never verified, so it must not link accounts.
    const known = phone ? await db.customer.findFirst({ where: { phone }, select: { id: true } }) : null
    customerId = known?.id ?? null
  }

  const matchOr: Prisma.MarketingContactWhereInput[] = []
  if (phone) matchOr.push({ phone })
  if (email) matchOr.push({ email })
  const findContacts = () => db.marketingContact.findMany({ where: { OR: matchOr }, orderBy: { createdAt: 'asc' } })

  let contacts = await findContacts()
  let contact: MarketingContact | undefined = contacts.find((c) => c.welcomeCouponId) ?? contacts[0]
  if (!contact) {
    try {
      contact = await db.marketingContact.create({ data: { phone, email, name, source, consentAt: now, customerId } })
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
      contacts = await findContacts() // a parallel submit created it
      contact = contacts[0]
      if (!contact) throw err
    }
  } else {
    // Fill what is new without ever stealing an identifier another row already owns.
    const data: Prisma.MarketingContactUncheckedUpdateInput = {}
    // A contact reached ONLY through an (unverified) email must not take on a new phone or account link.
    const phoneIdentity = !!phone && contact.phone === phone
    if (phone && !contact.phone && !contacts.some((c) => c.id !== contact!.id && c.phone === phone) && !email) data.phone = phone
    if (email && !contact.email && !contacts.some((c) => c.id !== contact!.id && c.email === email)) data.email = email
    if (name && !contact.name) data.name = name
    if (customerId && !contact.customerId && phoneIdentity) data.customerId = customerId
    if (contact.unsubscribedAt && source !== 'signup') {
      // They asked for the offer again: that is fresh consent.
      data.unsubscribedAt = null
      data.consentAt = now
    }
    if (Object.keys(data).length) contact = await db.marketingContact.update({ where: { id: contact.id }, data })
  }

  const config = await getMarketingConfig()
  const existingCoupon = contact.welcomeCouponId ? await db.coupon.findUnique({ where: { id: contact.welcomeCouponId } }) : null

  if (existingCoupon) {
    // Tie the coupon to the account once there is one (still never to a different customer).
    // Ownership is proven by the phone only; an email-matched contact never hands its coupon to an account.
    if (customerId && phone && contact.phone === phone && !existingCoupon.customerId && existingCoupon.usedCount === 0) {
      await db.coupon.updateMany({ where: { id: existingCoupon.id, customerId: null }, data: { customerId } })
    }
    return {
      ok: true,
      code: existingCoupon.code,
      alreadyHad: true,
      contactId: contact.id,
      couponId: existingCoupon.id,
      message: existingMessage(existingCoupon, now),
    }
  }

  if (!config.welcomeEnabled) {
    return { ok: true, code: '', alreadyHad: false, contactId: contact.id, couponId: null, message: 'ثبت شد. از تخفیف‌ها و خبرهای ویژه با خبر می‌شوید.' }
  }

  // Create the coupon and claim it for the contact in one transaction: a parallel submit loses the claim and rolls back.
  const contactId = contact.id
  try {
    const coupon = await db.$transaction(async (tx) => {
      const created = await createCouponWithUniqueCode(welcomeCouponData(config, phone && contact!.phone === phone ? customerId : null, now), 'WELCOME', tx)
      const claim = await tx.marketingContact.updateMany({ where: { id: contactId, welcomeCouponId: null }, data: { welcomeCouponId: created.id } })
      if (claim.count !== 1) throw new AlreadyClaimed()
      return created
    })
    return {
      ok: true,
      code: coupon.code,
      alreadyHad: false,
      contactId,
      couponId: coupon.id,
      message: `کد تخفیف شخصی شما ساخته شد: ${describeOffer(coupon)} روی اولین خرید.`,
    }
  } catch (err) {
    if (!(err instanceof AlreadyClaimed)) throw err
    const fresh = await db.marketingContact.findUnique({ where: { id: contactId }, select: { welcomeCouponId: true } })
    const winner = fresh?.welcomeCouponId ? await db.coupon.findUnique({ where: { id: fresh.welcomeCouponId } }) : null
    if (!winner) throw err
    return { ok: true, code: winner.code, alreadyHad: true, contactId, couponId: winner.id, message: existingMessage(winner, now) }
  }
}

function existingMessage(coupon: Coupon, now: Date): string {
  if (coupon.usedCount > 0) return 'شما پیش‌تر از کد خوش‌آمدگویی خود استفاده کرده‌اید. برای تخفیف‌های بعدی با ما همراه بمانید.'
  if (coupon.endsAt && coupon.endsAt.getTime() <= now.getTime()) return 'مهلت کد خوش‌آمدگویی شما به پایان رسیده است.'
  return 'شما قبلاً کد تخفیف دریافت کرده‌اید؛ همان کد برای شما نگه داشته شده است.'
}

/**
 * captureContact for sign-up paths: never throws, so a marketing hiccup can never break
 * registration or login.
 */
export async function captureContactSafe(input: CaptureInput): Promise<void> {
  try {
    await captureContact(input)
  } catch (err) {
    // No contact details in the log line.
    console.error('marketing capture failed', { source: input.source, name: (err as Error)?.name })
  }
}
