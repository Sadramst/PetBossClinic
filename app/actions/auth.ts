'use server'

import { db } from '@/lib/db'
import { verifyPassword, createSessionToken, setSessionCookie, clearSessionCookie, getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export interface AuthState {
  error?: string
  success?: boolean
}

export async function loginAction(
  prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email')?.toString().trim().toLowerCase()
  const password = formData.get('password')?.toString()
  const locale = formData.get('locale')?.toString() || 'fa'

  if (!email || !password) {
    return {
      error: locale === 'fa' ? 'لطفاً ایمیل و کلمه عبور را وارد نمایید.' : 'Please enter both email and password.',
    }
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user || !user.password) {
      return {
        error: locale === 'fa' ? 'اطلاعات ورود نامعتبر است.' : 'Invalid login credentials.',
      }
    }

    const isValid = verifyPassword(password, user.password)
    if (!isValid) {
      return {
        error: locale === 'fa' ? 'کلمه عبور نادرست است.' : 'Invalid password.',
      }
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
    return {
      error: locale === 'fa' ? 'خطا در برقراری ارتباط با سرور.' : 'Server connection error.',
    }
  }

  // Redirect to admin dashboard on success
  const target = locale === 'en' ? '/en/admin' : '/admin'
  redirect(target)
}

export async function logoutAction(locale: string = 'fa') {
  await clearSessionCookie()
  const loginUrl = locale === 'en' ? '/en/admin/login' : '/admin/login'
  redirect(loginUrl)
}

export async function getCurrentUser() {
  return await getSession()
}
