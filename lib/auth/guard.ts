import { redirect } from 'next/navigation'
import { getSession, hasRoleAccess, SessionPayload } from './index'
import { Role } from '@prisma/client'

/**
 * Server-side defence-in-depth guard for Admin pages.
 * Enforces authenticated session and minimum role access.
 * Redirects to localized login page if unauthorized.
 */
export async function requireAdmin(
  minRole: Role = 'VIEWER',
  locale: string = 'fa'
): Promise<SessionPayload> {
  const session = await getSession()
  void locale
  const loginPath = '/admin/login'

  if (!session) {
    redirect(loginPath)
  }

  if (!hasRoleAccess(session.role, minRole)) {
    redirect(loginPath)
  }

  return session
}
