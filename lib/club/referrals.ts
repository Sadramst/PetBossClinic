import { randomInt } from 'node:crypto'
import { db } from '@/lib/db'
import { getLoyaltyConfig } from '@/lib/club/config'
import { awardPoints, type DbClient } from '@/lib/club/points'

/** No look-alike characters (0/O, 1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const REFERRAL_COOKIE = 'pb_ref'
/** A referral only counts when the friend's first order is worth at least this much (Toman, after discount). */
export const REFERRAL_MIN_ORDER = 200_000
const CODE_RE = /^[A-Z2-9]{6,10}$/

export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return CODE_RE.test(code) ? code : null
}

export function generateReferralCode(len = 7): string {
  return Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
}

/** Gives the customer a referral code if they have none (retries on the rare collision). */
export async function ensureReferralCode(customerId: string): Promise<string | null> {
  const existing = await db.customer.findUnique({ where: { id: customerId }, select: { referralCode: true } })
  if (!existing) return null
  if (existing.referralCode) return existing.referralCode
  for (let i = 0; i < 6; i++) {
    const code = generateReferralCode()
    try {
      const done = await db.customer.updateMany({ where: { id: customerId, referralCode: null }, data: { referralCode: code } })
      if (done.count === 0) return (await db.customer.findUnique({ where: { id: customerId }, select: { referralCode: true } }))?.referralCode ?? null
      return code
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') continue
      throw err
    }
  }
  return null
}

/** Owner of a referral code (null when the code is unknown or malformed). */
export async function findReferrerByCode(raw: unknown): Promise<{ id: string } | null> {
  const code = normalizeReferralCode(raw)
  if (!code) return null
  return db.customer.findUnique({ where: { referralCode: code }, select: { id: true } })
}

/**
 * Links a brand-new customer to whoever invited them. Only works while the customer has no
 * referrer yet, no orders, and was created in the last day (a referral cannot be claimed later
 * to farm points), and never for one's own code.
 */
export async function attachReferral(customerId: string, rawCode: unknown): Promise<boolean> {
  const referrer = await findReferrerByCode(rawCode)
  if (!referrer || referrer.id === customerId) return false
  const done = await db.customer.updateMany({
    where: { id: customerId, referredById: null, ordersCount: 0, createdAt: { gt: new Date(Date.now() - 86_400_000) } },
    data: { referredById: referrer.id },
  })
  return done.count === 1
}

/**
 * Called when a referee's FIRST order is delivered: both sides get their points, once
 * (the ledger's unique key makes a second call a no-op).
 */
export async function creditReferralOnFirstOrder(client: DbClient, refereeId: string, orderId: string): Promise<{ credited: boolean }> {
  const referee = await client.customer.findUnique({ where: { id: refereeId }, select: { referredById: true } })
  if (!referee?.referredById) return { credited: false }
  let referrerId = referee.referredById
  for (let i = 0; i < 3; i++) {
    const r = await client.customer.findUnique({ where: { id: referrerId }, select: { mergedIntoId: true } })
    if (!r?.mergedIntoId) break
    referrerId = r.mergedIntoId
  }
  if (referrerId === refereeId) return { credited: false }
  // Only the referee's very first delivered order qualifies, and only above a minimum value.
  const first = await client.order.findFirst({ where: { customerId: refereeId, status: 'DELIVERED' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, subtotal: true, discount: true } })
  if (!first || first.id !== orderId) return { credited: false }
  if (first.subtotal - first.discount < REFERRAL_MIN_ORDER) return { credited: false }
  const cfg = await getLoyaltyConfig(client as never)
  if (!cfg.enabled) return { credited: false }
  const refType = `referral:${orderId}`
  const given = cfg.referralGiven > 0
    ? await awardPoints(client, { customerId: referrerId, kind: 'REFERRAL_GIVEN', points: cfg.referralGiven, refType, refId: refereeId, note: 'اولین خرید دوست دعوت‌شده' })
    : null
  const joined = cfg.referralJoined > 0
    ? await awardPoints(client, { customerId: refereeId, kind: 'REFERRAL_JOINED', points: cfg.referralJoined, refType, refId: referrerId, note: 'هدیهٔ عضویت با کد دعوت' })
    : null
  return { credited: !!(given?.applied || joined?.applied) }
}

/** The qualifying order was cancelled or returned: take both referral rewards back (once). */
export async function reverseReferralForOrder(client: DbClient, orderId: string): Promise<void> {
  const rows = await client.pointsTransaction.findMany({
    where: { kind: { in: ['REFERRAL_GIVEN', 'REFERRAL_JOINED'] }, refType: `referral:${orderId}`, points: { gt: 0 } },
    select: { id: true, customerId: true, points: true },
  })
  for (const r of rows) {
    await awardPoints(client, { customerId: r.customerId, kind: 'REVERSAL', points: -r.points, refType: 'referral', refId: `REF:${r.id}`, note: 'بازگشت امتیاز دعوت (سفارش لغو شد)' })
  }
}

export async function getReferralStats(customerId: string) {
  const [invited, converted, earned] = await Promise.all([
    db.customer.count({ where: { referredById: customerId } }),
    db.pointsTransaction.count({ where: { customerId, kind: 'REFERRAL_GIVEN' } }),
    db.pointsTransaction.aggregate({ where: { customerId, kind: { in: ['REFERRAL_GIVEN'] }, points: { gt: 0 } }, _sum: { points: true } }),
  ])
  return { invited, converted, earnedPoints: earned._sum.points ?? 0 }
}
