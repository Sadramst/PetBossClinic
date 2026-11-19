'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getCustomer } from '@/lib/customer/session'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { redeemReward } from '@/lib/club/rewards'
import { ensureReferralCode } from '@/lib/club/referrals'

const SESSION_EXPIRED = 'نشست شما به پایان رسیده است. دوباره وارد شوید.'

export interface ClubActionState {
  ok?: boolean
  error?: string
  needsLogin?: boolean
  couponCode?: string
  couponId?: string
  balance?: number
  expiresAt?: string
  referralCode?: string
}

export async function redeemRewardAction(rewardId: string): Promise<ClubActionState> {
  const customer = await getCustomer()
  if (!customer) return { error: SESSION_EXPIRED, needsLogin: true }
  if (typeof rewardId !== 'string' || rewardId.length > 40) return { error: 'جایزه پیدا نشد.' }
  if (!checkRateLimit(`redeem:${customer.id}`, 20, 3600_000).allowed) return { error: 'درخواست‌های زیادی ثبت شده است. کمی بعد دوباره تلاش کنید.' }
  const res = await redeemReward(customer.id, rewardId)
  if (!res.ok) return { error: res.error }
  revalidatePath('/account', 'layout')
  return { ok: true, couponCode: res.couponCode, couponId: res.couponId, balance: res.balance, expiresAt: res.expiresAt?.toISOString() }
}

/** Marketing SMS consent switch. Every change is timestamped so consent (or its withdrawal) can be proven. */
export async function updateMarketingPrefsAction(consent: boolean): Promise<ClubActionState> {
  const customer = await getCustomer()
  if (!customer) return { error: SESSION_EXPIRED, needsLogin: true }
  if (!checkRateLimit(`prefs:${customer.id}`, 30, 3600_000).allowed) return { error: 'درخواست‌های زیادی ثبت شده است. کمی بعد دوباره تلاش کنید.' }
  const value = consent === true
  if (customer.marketingSmsConsent !== value) {
    await db.customer.update({ where: { id: customer.id }, data: { marketingSmsConsent: value, marketingConsentAt: new Date() } })
  }
  revalidatePath('/account/profile')
  return { ok: true }
}

/** The customer's invite code (created on first request for older accounts). */
export async function getMyReferralCodeAction(): Promise<ClubActionState> {
  const customer = await getCustomer()
  if (!customer) return { error: SESSION_EXPIRED, needsLogin: true }
  const code = await ensureReferralCode(customer.id)
  return code ? { ok: true, referralCode: code } : { error: 'ساخت کد دعوت ممکن نشد. دوباره تلاش کنید.' }
}
