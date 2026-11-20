import 'server-only'
import type { Role } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Data for the admin chrome: nav badge counters and the notification centre.
 */

export interface ShellBadges {
  orders: number
  leads: number
  tickets: number
  tasks: number
  inventory: number
}

export interface NotificationItem {
  id: string
  kind: string
  title: string
  body: string | null
  href: string | null
  createdAt: string
  read: boolean
}
export interface NotificationState {
  unread: number
  items: NotificationItem[]
}

const DAY = 24 * 60 * 60 * 1000
const ROLE_RANK: Record<string, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }

let badgeCache: { at: number; value: ShellBadges } | null = null

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn()
  } catch {
    return 0
  }
}

/** Nav counters, one parallel batch of indexed counts, cached for 30 seconds per server instance. */
export async function getShellBadges(): Promise<ShellBadges> {
  const now = Date.now()
  if (badgeCache && now - badgeCache.at < 30_000) return badgeCache.value
  const endOfDay = new Date(new Date().setHours(23, 59, 59, 999))
  const critical = new Date(now + 30 * DAY)
  const [orders, leads, tickets, tasks, inventory] = await Promise.all([
    safeCount(() => db.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING'] } } })),
    safeCount(() => db.lead.count({ where: { stage: 'NEW' } })),
    safeCount(() => db.contactMessage.count({ where: { status: 'OPEN' } })),
    safeCount(() => db.crmTask.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { lte: endOfDay } } })),
    safeCount(() => db.inventory.count({ where: { quantity: { gt: 0 }, expiryDate: { lte: critical }, product: { deletedAt: null } } })),
  ])
  const value = { orders, leads, tickets, tasks, inventory }
  badgeCache = { at: now, value }
  return value
}

/** Notifications the user may see: addressed to them, or to everyone whose role is high enough. */
export async function getNotifications(userId: string, role: Role, take = 20): Promise<NotificationState> {
  try {
    const rows = await db.staffNotification.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * DAY) }, OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    const visible = rows.filter((r) => r.userId === userId || !r.minRole || ROLE_RANK[role] >= (ROLE_RANK[r.minRole] ?? 1))
    return {
      unread: visible.filter((r) => !r.readBy.includes(userId)).length,
      items: visible.slice(0, take).map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        href: r.href,
        createdAt: r.createdAt.toISOString(),
        read: r.readBy.includes(userId),
      })),
    }
  } catch {
    return { unread: 0, items: [] }
  }
}

/** Marks notifications read for one user. No ids = every visible unread one (capped at 100). */
export async function markNotificationsRead(userId: string, role: Role, ids?: string[]): Promise<number> {
  const state = await getNotifications(userId, role, 100)
  const wanted = state.items.filter((n) => !n.read && (!ids || ids.includes(n.id)))
  await Promise.all(wanted.map((n) => db.staffNotification.update({ where: { id: n.id }, data: { readBy: { push: userId } } })))
  return wanted.length
}
