import { db } from '@/lib/db'

export type AdminBadgeCounts = { orders: number; leads: number; tickets: number; tasks: number; inventory: number; carts?: number }

const TTL_MS = 30_000
let cache: { at: number; value: AdminBadgeCounts } | null = null

export function resetBadgeCache(): void {
  cache = null
}

/**
 * Sidebar counters, one batched round trip, cached for 30 seconds per server instance.
 * orders: paid and waiting to be processed. leads: not yet contacted. tickets: open messages.
 * tasks: open and due by the end of today. inventory: batches in stock that expire within the critical window.
 * carts: carts with items untouched for 24 hours.
 */
export async function getAdminBadgeCounts(now: Date = new Date()): Promise<AdminBadgeCounts> {
  if (cache && now.getTime() - cache.at < TTL_MS && now.getTime() >= cache.at) return cache.value
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  const cfg = await db.expiryConfig.findUnique({ where: { id: 'default' }, select: { criticalDays: true } }).catch(() => null)
  const critical = new Date(now.getTime() + (cfg?.criticalDays ?? 30) * 86_400_000)
  const [orders, leads, tickets, tasks, inventory, carts] = await Promise.all([
    db.order.count({ where: { status: 'CONFIRMED' } }),
    db.lead.count({ where: { stage: 'NEW' } }),
    db.contactMessage.count({ where: { status: 'OPEN' } }),
    db.crmTask.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { lte: endOfDay } } }),
    db.inventory.count({ where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: critical } } }),
    db.cartSnapshot.count({ where: { itemCount: { gt: 0 }, recoveredOrderId: null, updatedAt: { lte: new Date(now.getTime() - 86_400_000) } } }),
  ])
  const value: AdminBadgeCounts = { orders, leads, tickets, tasks, inventory, carts }
  cache = { at: now.getTime(), value }
  return value
}
