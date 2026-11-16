'use server'

import { db } from '@/lib/db'
import { verifyPassword, createSessionToken, setSessionCookie, clearSessionCookie, getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { checkRateLimit } from '@/lib/utils/rate-limit'

export interface AuthState {
  error?: string
  success?: boolean
  redirectUrl?: string
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_PER_ACCOUNT = 5
const MAX_ATTEMPTS_PER_IP = 20
const GENERIC_LOGIN_ERROR = 'ایمیل یا کلمه عبور نادرست است.'

async function clientIp(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'unknown').trim()
}

export async function loginAction(
  prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email')?.toString().trim().toLowerCase()
  const password = formData.get('password')?.toString()

  if (!email || !password) {
    return { error: 'لطفاً ایمیل و کلمه عبور را وارد نمایید.' }
  }

  const ip = await clientIp()
  // Best-effort per-instance IP throttle (stops scripted guessing across many emails).
  if (!checkRateLimit(`admin-login:${ip}`, MAX_ATTEMPTS_PER_IP, LOGIN_WINDOW_MS).allowed) {
    return { error: 'تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر دوباره امتحان کنید.' }
  }

  try {
    const user = await db.user.findUnique({ where: { email } })

    if (user) {
      // Durable per-account lockout (shared across all server instances via the DB).
      const recentFailures = await db.loginAttempt.count({
        where: { email, success: false, createdAt: { gt: new Date(Date.now() - LOGIN_WINDOW_MS) } },
      })
      if (recentFailures >= MAX_FAILED_PER_ACCOUNT) {
        return { error: 'این حساب به دلیل تلاش‌های ناموفق متعدد موقتاً قفل شده است. ۱۵ دقیقه دیگر امتحان کنید.' }
      }
    }

    const isValid = !!user?.password && !user.deletedAt && verifyPassword(password, user.password)

    if (user) {
      await db.loginAttempt.create({ data: { email, ip, success: isValid } }).catch(() => {})
    }

    if (!user || !isValid) {
      // Same message for unknown email and wrong password: no account enumeration.
      return { error: GENERIC_LOGIN_ERROR }
    }

    const token = createSessionToken({
      id: user.id,
      email: user.email!,
      name: user.name,
      role: user.role,
    })

    await setSessionCookie(token)
    revalidatePath('/[locale]/admin', 'layout')
  } catch (err: unknown) {
    console.error('Login error:', err)
    return { error: 'خطا در برقراری ارتباط با سرور.' }
  }

  return { success: true, redirectUrl: '/admin' }
}

export async function logoutAction(_locale: string = 'fa') {
  await clearSessionCookie()
  return {
    success: true,
    redirectUrl: '/admin/login',
  }
}

export async function getCurrentUser() {
  return await getSession()
}
