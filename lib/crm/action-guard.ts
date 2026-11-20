import type { Role } from '@prisma/client'
import { getSessionWithRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { MSG, isCrmError } from '@/lib/crm/errors'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
export type Guard = { ok: true; userId: string; role: Role; name: string | null } | { ok: false; error: string }

/** Role check plus a per-user, per-bucket rate limit shared by every CRM server action. */
export async function crmGuard(min: Role, bucket: string, max: number): Promise<Guard> {
  const session = await getSessionWithRole(min)
  if (!session) return { ok: false, error: MSG.denied }
  if (!checkRateLimit(`crm-${bucket}:${session.userId}`, max, 60_000).allowed) return { ok: false, error: MSG.busy }
  return { ok: true, userId: session.userId, role: session.role, name: (session as { name?: string | null }).name ?? null }
}

export function crmFail(e: unknown, tag = 'crm'): { ok: false; error: string } {
  if (isCrmError(e)) return { ok: false, error: e.message }
  console.error(`[${tag}]`, e)
  return { ok: false, error: MSG.generic }
}

/** Parses an ISO date string from the client; null for empty, throws nothing. */
export function parseIso(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
