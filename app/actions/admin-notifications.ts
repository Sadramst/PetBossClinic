'use server'

import { getSessionWithRole } from '@/lib/auth'
import { getNotifications, markNotificationsRead, type NotificationState } from '@/lib/admin/shell-data'

export type NotificationsResult = { ok: true; data: NotificationState } | { ok: false; error: string }

/** Marks the given notifications (or all) as read for the signed-in user and returns the fresh list. */
export async function markNotificationsReadAction(ids?: string[]): Promise<NotificationsResult> {
  const session = await getSessionWithRole('VIEWER')
  if (!session) return { ok: false, error: 'دسترسی غیرمجاز.' }
  const safeIds = Array.isArray(ids) ? ids.filter((i) => typeof i === 'string').slice(0, 100) : undefined
  await markNotificationsRead(session.userId, session.role, safeIds)
  return { ok: true, data: await getNotifications(session.userId, session.role) }
}

/** Fresh list for the bell (called after navigation, no websockets). */
export async function refreshNotificationsAction(): Promise<NotificationsResult> {
  const session = await getSessionWithRole('VIEWER')
  if (!session) return { ok: false, error: 'دسترسی غیرمجاز.' }
  return { ok: true, data: await getNotifications(session.userId, session.role) }
}
