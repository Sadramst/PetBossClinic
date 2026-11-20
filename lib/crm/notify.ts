import type { Role, StaffNotificationKind } from '@prisma/client'
import { db } from '@/lib/db'
import { newId } from '@/lib/crm/types'
import { rolesAtLeast } from '@/lib/crm/roles'

export type StaffNotificationRow = {
  id: string
  kind: StaffNotificationKind
  title: string
  body: string | null
  href: string | null
  read: boolean
  createdAt: Date
}

/** Adds a bell notification. `dedupeKey` makes it idempotent. Never throws into the caller. */
export async function notifyStaff(n: {
  kind: StaffNotificationKind
  title: string
  body?: string
  href?: string
  userId?: string
  minRole?: Role
  dedupeKey?: string
}): Promise<void> {
  try {
    await db.staffNotification.createMany({
      data: [
        {
          id: newId(),
          kind: n.kind,
          title: n.title.slice(0, 160),
          body: n.body?.slice(0, 400) ?? null,
          href: n.href ?? null,
          userId: n.userId ?? null,
          minRole: n.minRole ?? null,
          dedupeKey: n.dedupeKey ?? null,
        },
      ],
      skipDuplicates: true,
    })
  } catch (err) {
    console.error('staff notification failed', (err as Error)?.name)
  }
}

/** Audience of one person: addressed to them, or to everybody whose role reaches `minRole`. */
function audience(userId: string, role: Role) {
  const allowedMin = ['VIEWER', 'AUTHOR', 'EDITOR', 'ADMIN', 'SUPER_ADMIN'].filter((r) => rolesAtLeast(r as Role).includes(role))
  return {
    OR: [{ userId }, { userId: null, OR: [{ minRole: null }, { minRole: { in: allowedMin } }] }],
  }
}

export async function listStaffNotifications(userId: string, role: Role, take = 20): Promise<{ items: StaffNotificationRow[]; unread: number }> {
  const limit = Math.min(100, Math.max(1, Math.floor(take)))
  const since = new Date(Date.now() - 30 * 86_400_000)
  const where = { createdAt: { gte: since }, ...audience(userId, role) }
  const [rows, unread] = await Promise.all([
    db.staffNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
    db.staffNotification.count({ where: { ...where, NOT: { readBy: { has: userId } } } }),
  ])
  return {
    items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, read: r.readBy.includes(userId), createdAt: r.createdAt })),
    unread,
  }
}

/** Marks the given notifications (or every recent one) read for this user. Atomic, no lost updates. */
export async function markStaffNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  if (ids && ids.length === 0) return
  const since = new Date(Date.now() - 30 * 86_400_000)
  if (ids) {
    await db.$executeRaw`UPDATE "StaffNotification" SET "readBy" = array_append("readBy", ${userId}) WHERE "id" = ANY(${ids.slice(0, 200)}) AND NOT (${userId} = ANY("readBy"))`
  } else {
    await db.$executeRaw`UPDATE "StaffNotification" SET "readBy" = array_append("readBy", ${userId}) WHERE "createdAt" >= ${since} AND NOT (${userId} = ANY("readBy"))`
  }
}
