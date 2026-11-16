'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { issueOtp, verifyOtp } from '@/lib/customer/otp'
import { clearCustomerCookie, getCustomer, safeNext, setCustomerCookie } from '@/lib/customer/session'
import { sendOtpSms } from '@/lib/sms'
import { normalizeMobile } from '@/lib/text/iran'
import { normalizeFa } from '@/lib/text/persian'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { toLatinDigits } from '@/lib/date/jalali'

export interface CustomerAuthState {
  error?: string
  ok?: boolean
  /** Where to go after a successful step */
  redirectTo?: string
  /** True when the customer must still enter their name */
  needsProfile?: boolean
}

async function clientIp(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'unknown').trim()
}

export async function requestOtpAction(rawPhone: string): Promise<CustomerAuthState> {
  const phone = normalizeMobile(rawPhone)
  if (!phone) return { error: 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷' }

  const ip = await clientIp()
  if (!checkRateLimit(`otp-ip:${ip}`, 15, 3600_000).allowed) {
    return { error: 'درخواست‌های زیادی از این شبکه ارسال شده است. کمی بعد تلاش کنید.' }
  }

  const existing = await db.customer.findUnique({ where: { phone }, select: { isBlocked: true } })
  if (existing?.isBlocked) return { error: 'این حساب غیرفعال شده است. با پشتیبانی تماس بگیرید.' }

  const issued = await issueOtp(phone, ip)
  if (!issued.ok) return { error: issued.error }

  const sent = await sendOtpSms(phone, issued.code)
  if (!sent.ok) {
    console.error('OTP SMS failed:', sent.error)
    return { error: 'ارسال پیامک با خطا مواجه شد. لطفاً دوباره تلاش کنید یا با کلینیک تماس بگیرید.' }
  }
  return { ok: true }
}

export async function verifyOtpAction(rawPhone: string, rawCode: string, next?: string): Promise<CustomerAuthState> {
  const phone = normalizeMobile(rawPhone)
  const code = toLatinDigits(rawCode ?? '').replace(/\D/g, '')
  if (!phone || code.length !== 5) return { error: 'کد ۵ رقمی ارسال‌شده را وارد کنید.' }

  if (!(await verifyOtp(phone, code))) {
    return { error: 'کد واردشده نادرست یا منقضی شده است.' }
  }

  const customer = await db.customer.upsert({
    where: { phone },
    update: { lastLoginAt: new Date() },
    create: { phone, lastLoginAt: new Date() },
  })
  if (customer.isBlocked) return { error: 'این حساب غیرفعال شده است.' }

  await setCustomerCookie(customer.id)
  return { ok: true, needsProfile: !customer.firstName, redirectTo: safeNext(next) }
}

export async function updateProfileAction(formData: FormData): Promise<CustomerAuthState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'ابتدا وارد حساب کاربری شوید.' }

  const firstName = normalizeFa(formData.get('firstName')?.toString() ?? '').slice(0, 60)
  const lastName = normalizeFa(formData.get('lastName')?.toString() ?? '').slice(0, 60)
  const email = (formData.get('email')?.toString() ?? '').trim().toLowerCase().slice(0, 120)
  if (firstName.length < 2 || lastName.length < 2) return { error: 'نام و نام خانوادگی را کامل وارد کنید.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'ایمیل معتبر نیست.' }

  await db.customer.update({ where: { id: customer.id }, data: { firstName, lastName, email: email || null } })
  return { ok: true, redirectTo: safeNext(formData.get('next')?.toString()) }
}

export async function customerLogoutAction(): Promise<CustomerAuthState> {
  await clearCustomerCookie()
  return { ok: true, redirectTo: '/' }
}
